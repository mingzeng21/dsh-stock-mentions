import {
  STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
  type KlineAdjust, type KlinePeriod, type StockDataMeta, type StockIntradayResponse,
  type StockKlineResponse, type StockNewsResponse, type StockProvider, type StockQuoteResponse,
  type StockResolution, type StockSecurity,
} from '../rpc-contract.ts'
import { isOrdinaryAShareCode, SecurityResolver } from '../security-resolver.ts'
import { StockMentionsError } from './errors.ts'
import { PublicStockApi } from './public-service.ts'

export interface StockDataServiceOptions {
  fetcher?: typeof fetch
  now?: () => Date
  timeoutMs?: number
  providerOrder: {
    resolver: readonly StockProvider[]
    quote: readonly StockProvider[]
    intraday: readonly StockProvider[]
    kline: readonly StockProvider[]
    news: readonly StockProvider[]
  }
}

/** Combines the independent public adapters into stable RPC response fields. */
export class StockDataService {
  private readonly api: PublicStockApi
  private readonly resolver: SecurityResolver
  private readonly now: () => Date

  constructor(private readonly options: StockDataServiceOptions) {
    this.now = options.now ?? (() => new Date())
    this.api = new PublicStockApi({ fetcher: options.fetcher, now: this.now, timeoutMs: options.timeoutMs })
    const searchProviders = options.providerOrder.resolver
      .filter(provider => provider === 'eastmoney')
      .map(() => this.api)
    this.resolver = new SecurityResolver(searchProviders)
  }

  resolve(candidates: readonly string[], signal: AbortSignal): Promise<readonly StockResolution[]> {
    return this.resolver.resolve(candidates, signal)
  }

  async quote(symbol: string, signal: AbortSignal): Promise<StockQuoteResponse> {
    const security = securityFromSymbol(symbol)
    const response = await this.withFallback(this.options.providerOrder.quote, signal,
      provider => this.api.quote(security, provider, signal),
      result => ({
        protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
        symbol: security.symbol,
        quote: result.quote,
        meta: this.meta(result.source),
      }))
    return this.enrichQuote(response, security, signal)
  }

  private async enrichQuote(response: StockQuoteResponse, security: StockSecurity, signal: AbortSignal): Promise<StockQuoteResponse> {
    if (response.quote.marketCap !== null && response.quote.volumeRatio !== null) return response
    try {
      const supplement = await this.api.quote(security, 'eastmoney', signal)
      const marketCap = response.quote.marketCap ?? supplement.quote.marketCap
      const volumeRatio = response.quote.volumeRatio ?? supplement.quote.volumeRatio
      if (marketCap === response.quote.marketCap && volumeRatio === response.quote.volumeRatio) return response
      const warnings = [response.meta.warning, '市值、量比字段已由东方财富补齐。'].filter((value): value is string => value !== undefined)
      return {
        ...response,
        quote: { ...response.quote, marketCap, volumeRatio },
        meta: { ...response.meta, warning: warnings.join(' ') },
      }
    } catch (error) {
      if (error instanceof StockMentionsError && error.code === 'cancelled') throw error
      return response
    }
  }

  intraday(symbol: string, signal: AbortSignal): Promise<StockIntradayResponse> {
    const security = securityFromSymbol(symbol)
    return this.withFallback(this.options.providerOrder.intraday, signal,
      provider => this.api.intraday(security, provider, signal),
      result => ({
        protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
        symbol: security.symbol,
        previousClose: result.previousClose,
        points: result.points,
        meta: this.meta(result.source),
      }))
  }

  kline(symbol: string, period: KlinePeriod, adjust: KlineAdjust, signal: AbortSignal): Promise<StockKlineResponse> {
    const security = securityFromSymbol(symbol)
    return this.withFallback(this.options.providerOrder.kline, signal,
      provider => this.api.kline(security, period, adjust, provider, signal),
      result => ({
        protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
        symbol: security.symbol,
        period,
        adjust,
        bars: result.bars,
        meta: this.meta(result.source),
      }))
  }

  news(symbol: string, limit: number, signal: AbortSignal): Promise<StockNewsResponse> {
    const security = securityFromSymbol(symbol)
    return this.withFallback(this.options.providerOrder.news, signal,
      provider => this.api.news(security, provider, limit, signal),
      result => ({
        protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
        symbol: security.symbol,
        items: result.items,
        meta: this.meta(result.source),
      }))
  }

  private meta(source: StockProvider): StockDataMeta {
    return { fetchedAt: this.now().toISOString(), source }
  }

  private async withFallback<T, R extends { meta: StockDataMeta }>(
    providers: readonly StockProvider[],
    signal: AbortSignal,
    operation: (provider: StockProvider) => Promise<T>,
    map: (value: T) => R,
  ): Promise<R> {
    let last: unknown
    for (const [index, provider] of providers.entries()) {
      try {
        const mapped = map(await operation(provider))
        return index === 0
          ? mapped
          : { ...mapped, meta: { ...mapped.meta, warning: '首选数据源不可用，已切换公开备用数据源。' } }
      } catch (error) {
        if (error instanceof StockMentionsError && error.code === 'cancelled') throw error
        last = error
      }
    }
    throw last instanceof StockMentionsError
      ? last
      : new StockMentionsError('公开数据源暂时不可用。', 'unavailable')
  }
}

export function securityFromSymbol(symbol: string): StockSecurity {
  const match = /^(\d{6})\.(SH|SZ)$/u.exec(symbol.trim().toUpperCase())
  if (match === null || !isOrdinaryAShareCode(match[1]!, match[2] as 'SH' | 'SZ')) throw new StockMentionsError('证券标识无效。', 'bad-request')
  const code = match[1]!
  const market = match[2] as 'SH' | 'SZ'
  return { code, market, symbol: `${code}.${market}`, name: '', exchange: market === 'SH' ? 'SSE' : 'SZSE' }
}

export function withWarning<T extends { meta: StockDataMeta }>(response: T, warning: string): T {
  return { ...response, meta: { ...response.meta, warning } }
}
