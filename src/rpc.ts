import type { ConnectionRpcHandler, HostConnectionHandle } from '@deepseek-ai/dsh-client-connection'
import {
  isKlineRequest, isNewsRequest, isResolveMentionsRequest, isSecurityRequest,
  STOCK_MENTIONS_INTRADAY_ENDPOINT, STOCK_MENTIONS_KLINE_ENDPOINT, STOCK_MENTIONS_NEWS_ENDPOINT,
  STOCK_MENTIONS_QUOTE_ENDPOINT, STOCK_MENTIONS_RESOLVE_ENDPOINT, STOCK_MENTIONS_RPC_CHANNEL,
  STOCK_MENTIONS_RPC_PROTOCOL_VERSION, type StockMentionsPluginConfig,
} from './rpc-contract.ts'
import { StockMentionsError } from './stock-api/errors.ts'
import { StockDataService } from './stock-api/service.ts'

type RpcResult = Awaited<ReturnType<ConnectionRpcHandler>>
type CacheEntry = { expiresAt: number; value: unknown }
type Flight = {
  controller: AbortController
  promise: Promise<unknown>
  waiters: number
  settled: boolean
}

export interface StockMentionsRpcOptions {
  fetcher?: typeof fetch
  now?: () => Date
  config: StockMentionsPluginConfig
}

/** Mount the standalone versioned RPC channel on the authenticated Host connection. */
export function registerStockMentionsRpc(
  connection: HostConnectionHandle,
  options: StockMentionsRpcOptions,
): () => Promise<void> {
  return connection.rpc.handle(
    STOCK_MENTIONS_RPC_CHANNEL,
    createStockMentionsRpcHandler(options),
  )
}

export function createStockMentionsRpcHandler(options: StockMentionsRpcOptions): ConnectionRpcHandler {
  const config = options.config
  const now = options.now ?? (() => new Date())
  const service = new StockDataService({
    fetcher: options.fetcher,
    now,
    timeoutMs: config.timeoutMs,
    providerOrder: config.providerOrder,
  })
  const cache = new Map<string, CacheEntry>()
  const flights = new Map<string, Flight>()

  return async (endpoint, payload, signal) => {
    if (signal.aborted) return cancelled()
    if (!config.enabled) return unavailable('股票提及插件已关闭。')
    try {
      switch (endpoint) {
        case STOCK_MENTIONS_RESOLVE_ENDPOINT:
          return await resolveMentions(payload, signal)
        case STOCK_MENTIONS_QUOTE_ENDPOINT:
          if (!isSecurityRequest(payload)) return badRequest('security-quote 请求参数无效。')
          return ok(await cached(`quote:${payload.symbol}`, config.cacheTtlMs.quote, signal, requestSignal => service.quote(payload.symbol, requestSignal)))
        case STOCK_MENTIONS_INTRADAY_ENDPOINT:
          if (!isSecurityRequest(payload)) return badRequest('security-intraday 请求参数无效。')
          return ok(await cached(`intraday:${payload.symbol}`, config.cacheTtlMs.intraday, signal, requestSignal => service.intraday(payload.symbol, requestSignal)))
        case STOCK_MENTIONS_KLINE_ENDPOINT:
          if (!isKlineRequest(payload)) return badRequest('security-kline 请求参数无效。')
          return ok(await cached(`kline:${payload.symbol}:${payload.period}:${payload.adjust}`, config.cacheTtlMs.kline, signal, requestSignal => service.kline(payload.symbol, payload.period, payload.adjust, requestSignal)))
        case STOCK_MENTIONS_NEWS_ENDPOINT:
          if (!isNewsRequest(payload)) return badRequest('security-news 请求参数无效。')
          return ok(await cached(`news:${payload.symbol}:${payload.limit}`, config.cacheTtlMs.news, signal, requestSignal => service.news(payload.symbol, payload.limit, requestSignal)))
        default:
          return badRequest(`未知的股票提及 RPC endpoint：${endpoint}。`)
      }
    } catch (error) {
      return mapError(signal, error)
    }
  }

  async function resolveMentions(payload: unknown, signal: AbortSignal): Promise<RpcResult> {
    if (!isResolveMentionsRequest(payload)) return badRequest('resolve-mentions 请求参数无效。')
    const items = []
    for (const candidate of [...new Set(payload.candidates)]) {
      const normalized = candidate.trim().replace(/\s+/gu, ' ')
      if (normalized === '') continue
      const hit = await cached(
        `resolve:${normalized}`,
        config.cacheTtlMs.resolution,
        signal,
        requestSignal => service.resolve([normalized], requestSignal).then(result => result[0] ?? { candidate: normalized, status: 'unresolved' }),
        value => value.status === 'resolved' ? config.cacheTtlMs.resolution : config.cacheTtlMs.unresolved,
      )
      items.push(hit)
    }
    return ok({ protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION, items })
  }

  function cached<T>(
    key: string,
    ttlMs: number,
    signal: AbortSignal,
    operation: (requestSignal: AbortSignal) => Promise<T>,
    ttlFor?: (value: T) => number,
  ): Promise<T> {
    const current = cache.get(key)
    if (current !== undefined && current.expiresAt > now().getTime()) {
      cache.delete(key)
      cache.set(key, current)
      return Promise.resolve(current.value as T)
    }
    if (current !== undefined) cache.delete(key)
    const run = flights.get(key) ?? createFlight(key, operation)
    return waitForFlight<T>(run, signal).then(value => {
      cache.delete(key)
      cache.set(key, { value, expiresAt: now().getTime() + (ttlFor?.(value) ?? ttlMs) })
      while (cache.size > config.cacheMaxEntries) cache.delete(cache.keys().next().value as string)
      return value
    })
  }

  function createFlight<T>(key: string, operation: (signal: AbortSignal) => Promise<T>): Flight {
    const controller = new AbortController()
    const flight: Flight = {
      controller,
      promise: Promise.resolve().then(() => operation(controller.signal)),
      waiters: 0,
      settled: false,
    }
    flights.set(key, flight)
    void flight.promise.then(
      () => finishFlight(key, flight),
      () => finishFlight(key, flight),
    )
    return flight
  }

  function finishFlight(key: string, flight: Flight): void {
    flight.settled = true
    if (flights.get(key) === flight) flights.delete(key)
  }
}

function waitForFlight<T>(flight: Flight, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new StockMentionsError('请求已取消。', 'cancelled'))
  flight.waiters++
  return new Promise<T>((resolve, reject) => {
    let finished = false
    const release = (): void => {
      if (finished) return
      finished = true
      signal.removeEventListener('abort', onAbort)
      flight.waiters--
      if (flight.waiters === 0 && !flight.settled) flight.controller.abort()
    }
    const onAbort = (): void => {
      release()
      reject(new StockMentionsError('请求已取消。', 'cancelled'))
    }
    signal.addEventListener('abort', onAbort, { once: true })
    void flight.promise.then(
      value => { release(); resolve(value as T) },
      error => { release(); reject(error) },
    )
  })
}

function ok(value: unknown): RpcResult { return { ok: true, value } as RpcResult }
function badRequest(message: string): RpcResult { return { ok: false, error: { code: 'bad-request', message, details: { issues: [] } } } as RpcResult }
function unavailable(message: string): RpcResult { return { ok: false, error: { code: 'internal', message, details: {} } } as RpcResult }
function cancelled(): RpcResult { return { ok: false, error: { code: 'cancelled', message: '请求已取消。', details: {} } } as RpcResult }
function mapError(signal: AbortSignal, error: unknown): RpcResult {
  if (signal.aborted || error instanceof StockMentionsError && error.code === 'cancelled') return cancelled()
  if (error instanceof StockMentionsError && error.code === 'bad-request') return badRequest(error.message)
  return unavailable(error instanceof StockMentionsError ? error.message : '公开数据源暂时不可用。')
}
