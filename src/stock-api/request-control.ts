import { StockMentionsError } from './errors.ts'

export type AbortableSleep = (milliseconds: number, signal: AbortSignal) => Promise<void>

/** Bounds concurrent public requests and spaces their starts per provider. */
export class ProviderGate {
  private active = 0
  private readonly queue: Array<{
    signal: AbortSignal
    run: () => Promise<string>
    resolve: (value: string) => void
    reject: (error: unknown) => void
  }> = []
  private nextStartAt = 0

  constructor(private readonly concurrency: number, private readonly intervalMs: number) {}

  run(signal: AbortSignal, operation: () => Promise<string>): Promise<string> {
    if (signal.aborted) return Promise.reject(new StockMentionsError('请求已取消。', 'cancelled'))
    return new Promise<string>((resolve, reject) => {
      this.queue.push({ signal, run: operation, resolve, reject })
      void this.drain()
    })
  }

  private async drain(): Promise<void> {
    while (this.active < this.concurrency && this.queue.length > 0) {
      const item = this.queue.shift()!
      if (item.signal.aborted) {
        item.reject(new StockMentionsError('请求已取消。', 'cancelled'))
        continue
      }
      this.active++
      const delay = Math.max(0, this.nextStartAt - Date.now())
      if (delay > 0) {
        try {
          await sleep(delay, item.signal)
        } catch (error) {
          this.active--
          item.reject(error)
          continue
        }
      }
      this.nextStartAt = Date.now() + this.intervalMs
      void item.run().then(item.resolve, item.reject).finally(() => {
        this.active--
        void this.drain()
      })
    }
  }
}

export async function withTimeout<T>(
  signal: AbortSignal,
  timeoutMs: number,
  operation: (signal: AbortSignal) => Promise<T>,
): Promise<T> {
  const controller = new AbortController()
  const abort = (): void => { controller.abort(signal.reason) }
  if (signal.aborted) abort()
  else signal.addEventListener('abort', abort, { once: true })
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await operation(controller.signal)
  } catch (error) {
    if (signal.aborted || controller.signal.aborted) {
      throw new StockMentionsError('公开数据请求已取消或超时。', signal.aborted ? 'cancelled' : 'unavailable')
    }
    throw error
  } finally {
    clearTimeout(timeout)
    signal.removeEventListener('abort', abort)
  }
}

function sleep(milliseconds: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new StockMentionsError('请求已取消。', 'cancelled'))
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds)
    signal.addEventListener('abort', () => {
      clearTimeout(timer)
      reject(new StockMentionsError('请求已取消。', 'cancelled'))
    }, { once: true })
  })
}
