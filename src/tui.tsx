/** @jsxImportSource @opentui/solid */
/**
 * Wiring layer for the multi-provider surfaces: resolves the active
 * OpenCode session's model provider to a registered quota provider,
 * pulls on a timer + session events, and renders the sidebar panel
 * and status chip from the pure V2 modules (model.ts -> render.ts).
 * All I/O (env, fs, fetch, theme, TUI api) stays at this edge.
 *
 * Rendering note: under Bun the loaded @opentui/solid bundle pairs with the
 * SSR solid build, whose reconciler never re-runs reactive children. The
 * slot renderers therefore drive re-renders themselves: a render effect
 * (real solid instance) rebuilds the content box and swaps it into a stable
 * container via Renderable add/remove. In a reactive host the same code is
 * simply driven by the identical signal/effect instance.
 */
import { createSignal, createRenderEffect } from "solid-js/dist/solid.js"
import { getOwner, runWithOwner } from "solid-js"
import { readFileSync } from "node:fs"
import { homedir } from "node:os"
import { TextAttributes } from "@opentui/core"
import type { JSX } from "@opentui/solid"
import { resolveConfig } from "./config"
import { resolveToken } from "./token"
import { fetchQuota, type QuotaRow } from "./api"
import { computeRunway, pushSample, type Sample } from "./runway"
import { buildPanel, buildChip, type ModelInput, type PanelModel } from "./model"
import { renderPanelLines, renderChipSegments, GRID, type Segment } from "./render"
import { THEME_KEY } from "./roles"
import { sanitize } from "./format"
import { resolve, type QuotaProvider } from "./providers"

/** Adapt global fetch to fetchQuota's { status, text } contract. */
async function fetchAdapter(
  url: string,
  init: { headers: Record<string, string>; signal: AbortSignal },
): Promise<{ status: number; text: string }> {
  const response = await fetch(url, init)
  return { status: response.status, text: await response.text() }
}

/**
 * History key shape: provider id first so a provider switch starts a
 * fresh burn-rate history. Two providers that both use the label "5h"
 * do not pollute each other's runway.
 */
const historyKey = (providerId: string, label: string) => `${providerId}:${label}`

export async function createTuiPlugin(
  api: any,
  options: unknown,
  _meta: unknown,
): Promise<void> {
  // Config is resolved once; warnings surface as a single toast.
  const { config, warnings } = resolveConfig(process.env, options as any)
  if (warnings.length > 0) {
    api.ui.toast({
      variant: "warning",
      title: "OpenCode Quota Runway config",
      message: warnings.join("; ").slice(0, 300),
      duration: 4000,
    })
  }

  // Active provider resolution. Seeded from the current session's
  // model.providerID (if there is one) and updated on
  // session.next.model.switched and tui.session.select events. When
  // null, the panel and chip are not registered and the command toasts
  // a no-provider message.
  const initialSessionId =
    (api.route?.current?.name === "session" && api.route?.current?.params?.sessionID) || null
  const initialProvider = resolve(
    initialSessionId
      ? (api.state?.session?.get(initialSessionId)?.model?.providerID as string | undefined)
      : undefined,
  )
  const [activeProvider, setActiveProvider] = createSignal<QuotaProvider | null>(initialProvider)

  // Signals feed the render tree; histories are plain non-reactive state.
  const [rows, setRows] = createSignal<QuotaRow[]>([])
  const [error, setError] = createSignal<string | null>(null)
  const [updatedAt, setUpdatedAt] = createSignal<number | null>(null)
  // Stamped at every refresh completion (success OR failure): drives the
  // staleness marker while in an error state, where updatedAt (last success)
  // would either lag behind fresh attempts or never be set at all.
  const [lastAttemptAt, setLastAttemptAt] = createSignal<number | null>(null)
  // True while a fetch is actually in flight (set when it starts, cleared in
  // the finally) — skipped/joined scheduleRefresh calls never flip it.
  const [updating, setUpdating] = createSignal(false)
  // 10s heartbeat: slot renderers subscribe so freshness text and reset
  // markers advance between refreshes without refetching.
  const [tick, setTick] = createSignal(0)
  // Provider id used for the most recent sample. A switch drops the
  // history and prevResetAt maps by simple prefix mismatch: the next
  // refresh starts fresh. (We rely on the simple invariant that all
  // keys for the previous provider start with `${oldId}:`.)
  const histories = new Map<string, Sample[]>()
  const prevResetAt = new Map<string, number | null>()
  let currentProviderIdForHistory: string | null = null
  const theme = (): Record<string, string> => api.theme.current

  // Refresh engine: in-flight dedupe + idle throttle (design D5) + a 1s
  // cooldown on click-forced refresh starts (anti double-fetch for clicks;
  // engine forces — timer/session/command — are exempt, and a click is never
  // cooled down while data is missing: rows absent or an error state means a
  // fetch is required for correctness).
  let inFlight: Promise<void> | null = null
  let lastFetchStartedAt = 0
  let lastForceStartedAt = 0

  function dropHistoryForProviderSwitch(newProviderId: string | null): void {
    if (newProviderId === currentProviderIdForHistory) return
    if (currentProviderIdForHistory === null) {
      // First time we resolve a provider; nothing to drop.
      currentProviderIdForHistory = newProviderId
      return
    }
    for (const key of [...histories.keys()]) {
      if (key.startsWith(`${currentProviderIdForHistory}:`)) histories.delete(key)
    }
    for (const key of [...prevResetAt.keys()]) {
      if (key.startsWith(`${currentProviderIdForHistory}:`)) prevResetAt.delete(key)
    }
    currentProviderIdForHistory = newProviderId
  }

  async function doRefresh(): Promise<void> {
    const provider = activeProvider()
    if (!provider) return
    try {
      const token = resolveTokenForProvider(provider)
      if (!token) {
        setError("no-token")
        return
      }
      const endpoint = config.endpoint ?? provider.endpoints[0]
      const result = await fetchQuota(fetchAdapter, token, {
        endpoint,
        timeoutMs: config.timeoutMs,
      })
      // Stale-fetch guard: a provider switch (or any path that resets
      // inFlight via switchActiveProvider) can clear the slot while this
      // fetch is in flight. If the active provider is no longer the one
      // we started this fetch for, drop the result on the floor.
      if (activeProvider() !== provider) return
      if (!result.ok) {
        setError(result.error)
        return
      }
      const parsed = provider.parse(result.payload)
      const now = Date.now()
      setRows(parsed.rows)
      setUpdatedAt(now)
      setError(parsed.rows.length === 0 ? "empty" : null)
      dropHistoryForProviderSwitch(provider.id)
      for (const row of parsed.rows) {
        if (row.usage == null) continue
        const key = historyKey(provider.id, row.label)
        const prev = prevResetAt.get(key)
        if (prev !== undefined && row.resetAt !== prev) {
          histories.set(key, []) // resetAt changed: window boundary
        }
        histories.set(
          key,
          pushSample(
            histories.get(key) ?? [],
            { t: now, usage: row.usage },
            prev ?? null,
            config.maxHistory,
          ),
        )
        prevResetAt.set(key, row.resetAt)
      }
      if (parsed.rows.length > 0) {
        const live = new Set(parsed.rows.map((row) => historyKey(provider.id, row.label)))
        for (const key of [...histories.keys()]) {
          if (!live.has(key)) histories.delete(key)
        }
        for (const key of [...prevResetAt.keys()]) {
          if (!live.has(key)) prevResetAt.delete(key)
        }
      }
    } finally {
      setLastAttemptAt(Date.now())
    }
  }

  function resolveTokenForProvider(provider: QuotaProvider): string | undefined {
    // Legacy escape hatch: when the config layer explicitly overrides
    // authKeys or tokenEnv (e.g. the test suite to force a "no token"
    // path), the override wins. Otherwise the active provider's keys
    // are used so the wiring is provider-driven.
    const authKeys = config.authKeys.length > 0 ? config.authKeys : provider.authKeys
    const tokenEnv = config.tokenEnv.length > 0 ? config.tokenEnv : provider.tokenEnv
    return resolveToken(
      (path) => readFileSync(path, "utf8"),
      homedir(),
      process.env,
      { authKeys, tokenEnv },
    )
  }

  function scheduleRefresh(force = false, source: "engine" | "click" = "engine"): Promise<void> {
    if (!activeProvider()) return Promise.resolve()
    if (inFlight != null) return inFlight
    if (
      force &&
      source === "click" &&
      Date.now() - lastForceStartedAt < 1000 &&
      rows().length > 0 &&
      error() == null
    ) {
      return Promise.resolve()
    }
    if (!force && Date.now() - lastFetchStartedAt < config.intervalMs / 2) {
      return Promise.resolve()
    }
    lastFetchStartedAt = Date.now()
    if (force) lastForceStartedAt = Date.now()
    setUpdating(true)
    inFlight = (async () => {
      await doRefresh()
    })().finally(() => {
      inFlight = null
      setUpdating(false)
    })
    return inFlight
  }

  /** Shared ModelInput for both slots. Reading tick() subscribes the caller. */
  function modelInput(): ModelInput {
    void tick()
    const now = Date.now()
    const provider = activeProvider()
    const currentRows = rows()
    const runways: ModelInput["runways"] = {}
    for (const row of currentRows) {
      if (!provider) continue
      const key = historyKey(provider.id, row.label)
      const h = histories.get(key)
      runways[key] = {
        result: computeRunway(h ?? [], row, now),
        spanMs: h == null ? null : h.length >= 2 ? h[h.length - 1].t - h[0].t : h.length === 1 ? 0 : null,
      }
    }
    return {
      title: provider?.label ?? "Quota",
      chipPrefix: provider?.chipPrefix ?? " ",
      providerId: provider?.id ?? "",
      rows: currentRows,
      runways,
      updatedAt: updatedAt(),
      lastAttemptAt: lastAttemptAt(),
      error: error(),
      updating: updating(),
      now,
      intervalMs: config.intervalMs,
      tightFactor: config.tightFactor,
      gaugeWidth: config.gaugeWidth,
      formatTime: (ms) => new Date(ms).toLocaleTimeString(),
    }
  }

  /**
   * detail:"auto" drops the second (detail) line of every window whose
   * verdict is "ok". renderPanelLines returns [header, win, detail] * N (or
   * [header, single-line] for error/loading, left untouched).
   */
  function applyDetailMode(lines: Segment[][], model: PanelModel): Segment[][] {
    if (config.detail !== "auto" || model.windows.length === 0) return lines
    if (lines.length !== 1 + 2 * model.windows.length) return lines
    const out: Segment[][] = [lines[0]]
    for (let i = 0; i < model.windows.length; i++) {
      out.push(lines[1 + 2 * i])
      if (model.windows[i].verdict !== "ok") out.push(lines[2 + 2 * i])
    }
    return out
  }

  function panelSegments(): Segment[][] {
    const model = buildPanel(modelInput())
    return applyDetailMode(
      renderPanelLines(model, { gaugeWidth: config.gaugeWidth, mode: config.glyphs, targetWidth: GRID.width }),
      model,
    )
  }

  function renderPanel(): JSX.Element {
    // Click-to-refresh: a drag (selection) must not be treated as a click;
    // the flag is reset on the mouseup that consumed the drag. No horizontal
    // padding: the 38-col grid starts at col 0, flush with the sidebar's
    // native sections (Context/MCP/LSP render <box> without padding).
    let dragged = false
    const owner = getOwner()
    const container = (
      <box
        flexDirection="column"
        onMouseDrag={() => {
          dragged = true
        }}
        onMouseUp={() => {
          if (dragged) {
            dragged = false
            return
          }
          void scheduleRefresh(true, "click").catch(() => {})
        }}
      />
    ) as any
    let content: any = null
    createRenderEffect(() => {
      const lines = panelSegments()
      const next = runWithOwner(owner, () => (
        <box flexDirection="column">
          {lines.map((line, lineIdx) => (
            <box flexDirection="row">
              {line
                .filter((seg) => seg.text !== "")
                .map((seg, segIdx) => (
                  <text
                    fg={theme()[THEME_KEY[seg.role]]}
                    attributes={seg.bold || (lineIdx === 0 && segIdx === 0) ? TextAttributes.BOLD : 0}
                    wrapMode="none"
                    flexShrink={0}
                  >
                    {seg.text}
                  </text>
                ))}
            </box>
          ))}
        </box>
      )) as any
      if (content != null) {
        container.remove(content)
        const old = content
        queueMicrotask(() => old.destroyRecursively())
      }
      content = next
      container.add(next)
    })
    return container as JSX.Element
  }

  function renderChip(): JSX.Element {
    const owner = getOwner()
    const container = <box flexDirection="row" /> as any
    let content: any = null
    createRenderEffect(() => {
      const segs = renderChipSegments(buildChip(modelInput()), config.glyphs)
      const next = runWithOwner(owner, () => (
        <box flexDirection="row">
          {segs
            .filter((seg) => seg.text !== "")
            .map((seg) => (
              <text fg={theme()[THEME_KEY[seg.role]]}>{seg.text}</text>
            ))}
        </box>
      )) as any
      if (content != null) {
        container.remove(content)
        const old = content
        queueMicrotask(() => old.destroyRecursively())
      }
      content = next
      container.add(next)
    })
    return container as JSX.Element
  }

  // Fire-and-forget refreshes carry their own rejection sink: a failure in
  // the refresh pipeline must not surface as an unhandled rejection. The
  // awaited run() path below is exempt — it toasts the error instead.
  if (activeProvider()) scheduleRefresh(true).catch(() => {})
  const timer = setInterval(() => scheduleRefresh().catch(() => {}), config.intervalMs)
  const tickTimer = setInterval(() => setTick((t) => t + 1), 10_000)
  const offIdle = api.event.on("session.idle", () => scheduleRefresh(false).catch(() => {}))
  const offErr = api.event.on("session.error", () => scheduleRefresh(true).catch(() => {}))
  // Track the last non-null provider id so the "no provider" toast can
  // surface the model's id (or "unknown") instead of a blank message.
  let lastKnownProviderId: string | null = null

  // Active-provider switch. Wipe the visible state (rows/error/freshness)
  // so the panel doesn't keep showing the previous provider's data while
  // the new fetch is in flight; then trigger a forced refresh.
  function switchActiveProvider(next: QuotaProvider | null): void {
    if (next) lastKnownProviderId = next.id
    // Drop the in-flight slot so scheduleRefresh starts a fresh fetch for
    // `next` (or skips if null). The old fetch's doRefresh() will see the
    // activeProvider mismatch via its post-await guard and discard the result.
    inFlight = null
    setActiveProvider(next)
    setRows([])
    setError(null)
    setUpdatedAt(null)
    setLastAttemptAt(null)
    if (next) {
      scheduleRefresh(true).catch(() => {})
    } else {
      api.ui.toast({
        variant: "warning",
        title: "OpenCode Quota Runway",
        message: `no quota provider for ${lastKnownProviderId ?? "current session"}`,
        duration: 4000,
      })
    }
  }
  // Two flavours of "where is the providerID" — payload direct (model.switched
  // already carries it) vs state lookup (session.select / session.updated
  // only carry a sessionID, so the model must be fetched from opencode's
  // reactive session cache). Extracted so each handler stays a one-liner
  // and the chain is consistent.
  const providerIdFromModelPayload = (e: any): string | undefined =>
    e?.properties?.model?.providerID as string | undefined
  const providerIdFromSessionState = (sid: string): string | undefined =>
    api.state?.session?.get(sid)?.model?.providerID as string | undefined

  const offModelSwitched = api.event.on("session.next.model.switched", (e: any) => {
    switchActiveProvider(resolve(providerIdFromModelPayload(e)))
  })
  const offTuiSession = api.event.on("tui.session.select", (e: any) => {
    const sid = e?.properties?.sessionID as string | undefined
    if (!sid) return
    switchActiveProvider(resolve(providerIdFromSessionState(sid)))
  })
  // Fallback: opencode sometimes delivers model/agent changes via the
  // generic session.updated event (carrying the new model in info.model)
  // rather than session.next.model.switched. Re-resolve from state and
  // switch only if the active provider actually changed — the no-op guard
  // keeps the refresh engine from firing on every per-message update.
  const offSessionUpdated = api.event.on("session.updated", (e: any) => {
    // Opencode sometimes fires session.updated without a sessionID in the
    // payload (e.g. for bulk updates) — fall back to the route's current.
    const sid = (e?.properties?.sessionID as string | undefined) ??
      api.route?.current?.params?.sessionID
    if (!sid) return
    const next = resolve(providerIdFromSessionState(sid))
    if (next == null && activeProvider() == null) return
    if (next?.id === activeProvider()?.id) return
    switchActiveProvider(next)
  })

  // No UI surface enabled -> no register call at all (an empty slots object
  // would be dead wiring). Polling and the /quota-runway command stay live.
  // order 50 renders the panel as the FIRST sidebar section, above Context.
  // NOTE: slots.register returns the assigned slot ID string — slot lifetime
  // is managed by the host (tracked dispose), so there is nothing to call.
  if (activeProvider() && (config.panel || config.chip)) {
    api.slots.register({
      order: 50,
      slots: {
        ...(config.panel ? { sidebar_content: renderPanel } : {}),
        ...(config.chip ? { session_prompt_right: renderChip } : {}),
      },
    })
  }

  const disposeLayer = api.keymap.registerLayer({
    commands: [
      {
        name: "opencode-quota-runway.refresh",
        title: "OpenCode Quota Runway: refresh now",
        desc: "Fetch current quota usage for the active provider",
        slashName: "quota-runway",
        slashAliases: ["qr"],
        namespace: "palette",
        run: async () => {
          const provider = activeProvider()
          if (!provider) {
            const sid = api.route?.current?.params?.sessionID
            const pid = (sid ? api.state?.session?.get(sid)?.model?.providerID : undefined) as
              | string
              | undefined
            api.ui.toast({
              variant: "warning",
              title: "OpenCode Quota Runway",
              message: `no quota provider for ${pid ?? "unknown"}`,
              duration: 4000,
            })
            return
          }
          await scheduleRefresh(true)
          const current = rows()
          const err = error()
          api.ui.toast({
            variant: err != null ? "error" : "success",
            title: "OpenCode Quota Runway",
            message:
              err ??
              current
                .map((x) => `${sanitize(x.label)}: ${x.usage ?? "?"}/${x.limit ?? "?"}`)
                .join(" | ")
                .slice(0, 300),
            duration: 4000,
          })
        },
      },
    ],
    bindings: [],
  })

  api.lifecycle.onDispose(() => {
    clearInterval(timer)
    clearInterval(tickTimer)
    offIdle()
    offErr()
    offModelSwitched()
    offTuiSession()
    disposeLayer?.()
  })
}
