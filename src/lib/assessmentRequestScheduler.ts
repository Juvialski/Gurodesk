/**
 * Small, provider-agnostic request scheduler used by assessment generation
 * and review.  It deliberately treats local usage as an estimate: Gemini (and
 * the teacher's provider account) remains authoritative for quota decisions.
 *
 * The scheduler is kept independent from Supabase and Gemini so it can be
 * tested with deterministic functions and so a cancelled mobile session can
 * abandon queued work without losing already completed items.
 */

export type AssessmentModelRequestError = Error & {
  status?: number
  retryAfterMs?: number
  response?: { status?: number; headers?: { get?: (name: string) => string | null } }
}

export type AssessmentSchedulerOptions = {
  /** Target start rate per model. 10 is intentionally below the product's
   * approximately-15 RPM guidance and is not represented as a provider cap. */
  requestsPerMinute?: number
  maxConcurrencyPerModel?: number
  maxRetries?: number
  backoffBaseMs?: number
  backoffMaxMs?: number
  now?: () => number
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  usageStorageKey?: string
}

export type AssessmentRequestContext = {
  signal?: AbortSignal
  attempt: number
  model: string
}

type QueueEntry<T> = {
  task: (context: AssessmentRequestContext) => Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
  signal?: AbortSignal
  enqueuedAt: number
}

type ModelQueue = {
  model: string
  entries: QueueEntry<unknown>[]
  running: number
  nextStartAt: number
  timer: ReturnType<typeof setTimeout> | null
}

export type AssessmentUsageEstimate = {
  /** Local attempts started on this device today. */
  model: string
  requestCount: number
  day: string
  approximate: true
  note: 'Provider quota and usage may differ.'
}

const DEFAULT_RPM = 10
const DEFAULT_CONCURRENCY = 2
const DEFAULT_RETRIES = 2

function abortError() {
  return new DOMException('Assessment request cancelled.', 'AbortError')
}

function readRetryAfterMs(error: unknown) {
  const candidate = error as AssessmentModelRequestError | null
  if (Number.isFinite(candidate?.retryAfterMs) && (candidate?.retryAfterMs ?? 0) >= 0) return candidate!.retryAfterMs!
  const headers = candidate?.response?.headers
  const raw = headers?.get?.('Retry-After')
  if (!raw) return 0
  const seconds = Number(raw)
  if (Number.isFinite(seconds)) return Math.max(0, Math.round(seconds * 1000))
  const date = Date.parse(raw)
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : 0
}

function statusOf(error: unknown) {
  const candidate = error as AssessmentModelRequestError | null
  return Number(candidate?.status ?? candidate?.response?.status ?? 0)
}

function retryable(error: unknown) {
  const status = statusOf(error)
  if ([408, 425, 429, 500, 502, 503, 504].includes(status)) return true
  const message = String((error as { message?: unknown })?.message ?? error).toLocaleLowerCase('en')
  return /timeout|temporar|network|rate.?limit|quota|gateway|try again/.test(message)
}

function defaultSleep(ms: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortError())
      return
    }
    const timer = setTimeout(resolve, Math.max(0, ms))
    signal?.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(abortError())
    }, { once: true })
  })
}

function safeStorage(key: string) {
  try {
    if (typeof localStorage === 'undefined') return null
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function writeStorage(key: string, value: string) {
  try {
    if (typeof localStorage !== 'undefined') localStorage.setItem(key, value)
  } catch {
    // Local counters are optional and must never block a request.
  }
}

function localDay(now: number) {
  const value = new Date(now)
  // Use the device's local calendar day: the displayed estimate should match
  // the teacher's “today”, not an arbitrary UTC boundary.
  const month = String(value.getMonth() + 1).padStart(2, '0')
  const day = String(value.getDate()).padStart(2, '0')
  return `${value.getFullYear()}-${month}-${day}`
}

/**
 * Per-model queues with bounded concurrency and a safety-margin start pace.
 * Each attempt increments an approximate local counter; failed and provider-
 * rejected attempts are intentionally included because they consume usage.
 */
export class AssessmentRequestScheduler {
  private readonly requestsPerMinute: number
  private readonly maxConcurrencyPerModel: number
  private readonly maxRetries: number
  private readonly backoffBaseMs: number
  private readonly backoffMaxMs: number
  private readonly now: () => number
  private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void>
  private readonly usageStorageKey: string
  private readonly queues = new Map<string, ModelQueue>()
  private readonly usage = new Map<string, AssessmentUsageEstimate>()

  constructor(options: AssessmentSchedulerOptions = {}) {
    this.requestsPerMinute = Math.max(1, Math.min(12, Math.floor(options.requestsPerMinute ?? DEFAULT_RPM)))
    this.maxConcurrencyPerModel = Math.max(1, Math.min(4, Math.floor(options.maxConcurrencyPerModel ?? DEFAULT_CONCURRENCY)))
    this.maxRetries = Math.max(0, Math.min(4, Math.floor(options.maxRetries ?? DEFAULT_RETRIES)))
    this.backoffBaseMs = Math.max(25, Math.floor(options.backoffBaseMs ?? 750))
    this.backoffMaxMs = Math.max(this.backoffBaseMs, Math.floor(options.backoffMaxMs ?? 20_000))
    this.now = options.now ?? (() => Date.now())
    this.sleep = options.sleep ?? defaultSleep
    this.usageStorageKey = options.usageStorageKey ?? 'gurodesk.assessment.ai.usage.estimate.v1'
    this.loadUsage()
  }

  get intervalMs() {
    return Math.ceil(60_000 / this.requestsPerMinute)
  }

  get queueConcurrency() {
    return this.maxConcurrencyPerModel
  }

  private loadUsage() {
    const raw = safeStorage(this.usageStorageKey)
    if (!raw) return
    try {
      const values = JSON.parse(raw) as Record<string, AssessmentUsageEstimate>
      Object.entries(values).forEach(([model, value]) => {
        if (value && Number.isFinite(value.requestCount) && (!value.day || value.day === localDay(this.now()))) this.usage.set(model, {
          model,
          requestCount: Math.max(0, Math.floor(value.requestCount)),
          day: value.day || localDay(this.now()),
          approximate: true,
          note: 'Provider quota and usage may differ.',
        })
      })
    } catch {
      // Corrupt local counters are harmless; start a fresh estimate.
    }
  }

  private persistUsage() {
    const serializable = Object.fromEntries(this.usage.entries())
    writeStorage(this.usageStorageKey, JSON.stringify(serializable))
  }

  private count(model: string) {
    const prior = this.usage.get(model)
    const day = localDay(this.now())
    const sameDay = prior?.day === day
    const next: AssessmentUsageEstimate = {
      model,
      requestCount: (sameDay ? prior?.requestCount ?? 0 : 0) + 1,
      day,
      approximate: true,
      note: 'Provider quota and usage may differ.',
    }
    this.usage.set(model, next)
    this.persistUsage()
  }

  getUsageEstimate(model?: string): AssessmentUsageEstimate | AssessmentUsageEstimate[] {
    if (model) return { ...(this.usage.get(model) ?? {
      model,
      requestCount: 0,
      day: localDay(this.now()),
      approximate: true,
      note: 'Provider quota and usage may differ.',
    }) }
    return [...this.usage.values()].map((value) => ({ ...value }))
  }

  /** Remove only queued (not currently running) work for a model. */
  cancel(model?: string) {
    const queues = model ? [this.queues.get(model)].filter(Boolean) as ModelQueue[] : [...this.queues.values()]
    queues.forEach((queue) => {
      const pending = queue.entries.splice(0)
      pending.forEach((entry) => entry.reject(abortError()))
      if (queue.timer) clearTimeout(queue.timer)
      queue.timer = null
      this.pump(queue)
    })
  }

  enqueue<T>(model: string, task: (context: AssessmentRequestContext) => Promise<T>, options: { signal?: AbortSignal } = {}) {
    const normalizedModel = model.trim() || 'unknown-model'
    if (options.signal?.aborted) return Promise.reject(abortError())
    const queue: ModelQueue = this.queues.get(normalizedModel) ?? {
      model: normalizedModel, entries: [], running: 0, nextStartAt: 0, timer: null,
    }
    this.queues.set(normalizedModel, queue)
    return new Promise<T>((resolve, reject) => {
      const entry: QueueEntry<T> = { task, resolve, reject, signal: options.signal, enqueuedAt: this.now() }
      queue.entries.push(entry as QueueEntry<unknown>)
      const onAbort = () => {
        const index = queue.entries.indexOf(entry as QueueEntry<unknown>)
        if (index >= 0) {
          queue.entries.splice(index, 1)
          reject(abortError())
        }
      }
      options.signal?.addEventListener('abort', onAbort, { once: true })
      this.pump(queue)
    })
  }

  private pump(queue: ModelQueue) {
    if (queue.running >= this.maxConcurrencyPerModel || !queue.entries.length) return
    const wait = Math.max(0, queue.nextStartAt - this.now())
    if (wait > 0) {
      if (!queue.timer) {
        queue.timer = setTimeout(() => { queue.timer = null; this.pump(queue) }, wait)
      }
      return
    }
    const entry = queue.entries.shift()!
    if (entry.signal?.aborted) {
      entry.reject(abortError())
      this.pump(queue)
      return
    }
    queue.running += 1
    void this.run(queue, entry)
    // `run` reserves the first request slot synchronously before yielding. A
    // second worker may run concurrently, but every provider attempt (including
    // retries) still reserves its own paced start below.
    this.pump(queue)
  }

  private async reserveRequestStart(queue: ModelQueue, signal?: AbortSignal) {
    while (true) {
      if (signal?.aborted) throw abortError()
      const wait = Math.max(0, queue.nextStartAt - this.now())
      if (wait > 0) {
        await this.sleep(wait, signal)
        continue
      }
      // JavaScript executes this reservation atomically until the next await.
      // Concurrent workers that wake together therefore observe the updated
      // value and cannot start two requests in the same model slot.
      queue.nextStartAt = this.now() + this.intervalMs
      return
    }
  }

  private async run<T>(queue: ModelQueue, entry: QueueEntry<T>) {
    let lastError: unknown = null
    try {
      for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
        if (entry.signal?.aborted) throw abortError()
        try {
          await this.reserveRequestStart(queue, entry.signal)
          // Every retry is a fresh provider request and therefore increments
          // the local estimate. The estimate never blocks work.
          this.count(queue.model)
          const value = await entry.task({ signal: entry.signal, attempt: attempt + 1, model: queue.model })
          entry.resolve(value)
          return
        } catch (error) {
          lastError = error
          if (!retryable(error) || attempt >= this.maxRetries || entry.signal?.aborted) break
          const retryAfter = readRetryAfterMs(error)
          const backoff = Math.min(this.backoffMaxMs, this.backoffBaseMs * 2 ** attempt)
          await this.sleep(Math.max(retryAfter, backoff), entry.signal)
        }
      }
      entry.reject(lastError ?? new Error('Assessment request failed.'))
    } catch (error) {
      entry.reject(error)
    } finally {
      queue.running = Math.max(0, queue.running - 1)
      this.pump(queue)
    }
  }
}

export const assessmentRequestScheduler = new AssessmentRequestScheduler()

export function assessmentUsageEstimate(model?: string) {
  return assessmentRequestScheduler.getUsageEstimate(model)
}
