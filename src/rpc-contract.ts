/** Versioned Host/Client protocol for settled stock mentions and its panel. */

export const STOCK_MENTIONS_RPC_CHANNEL = '/stock-mentions'
export const STOCK_MENTIONS_RPC_PROTOCOL_VERSION = 1 as const

export const STOCK_MENTIONS_RESOLVE_ENDPOINT = 'resolve-mentions'
export const STOCK_MENTIONS_QUOTE_ENDPOINT = 'security-quote'
export const STOCK_MENTIONS_INTRADAY_ENDPOINT = 'security-intraday'
export const STOCK_MENTIONS_KLINE_ENDPOINT = 'security-kline'
export const STOCK_MENTIONS_NEWS_ENDPOINT = 'security-news'

export type StockMarket = 'SH' | 'SZ'
export type StockProvider = 'eastmoney' | 'tencent' | 'sina' | 'tonghuashun'
export type KlinePeriod = 'day' | 'week' | 'month'
export type KlineAdjust = 'qfq' | 'none'
export type StockPanelTab = 'intraday' | 'day' | 'month' | 'news'

export interface StockSecurity {
  code: string
  market: StockMarket
  symbol: string
  name: string
  exchange: 'SSE' | 'SZSE'
}

export interface StockResolution {
  candidate: string
  status: 'resolved' | 'unresolved'
  security?: StockSecurity
}

export interface StockDataMeta {
  fetchedAt: string
  source: StockProvider
  warning?: string
}

export interface StockQuote {
  currentPrice: number | null
  previousClose: number | null
  change: number | null
  changePercent: number | null
  open: number | null
  high: number | null
  low: number | null
  volumeShares: number | null
  amount: number | null
  marketCap: number | null
  volumeRatio: number | null
  turnoverRate: number | null
  marketTime: string | null
}

export interface StockQuoteResponse {
  protocolVersion: typeof STOCK_MENTIONS_RPC_PROTOCOL_VERSION
  symbol: string
  quote: StockQuote
  meta: StockDataMeta
}

export interface StockIntradayPoint {
  time: string
  price: number | null
  averagePrice: number | null
  cumulativeVolumeShares: number | null
  cumulativeAmount: number | null
}

export interface StockIntradayResponse {
  protocolVersion: typeof STOCK_MENTIONS_RPC_PROTOCOL_VERSION
  symbol: string
  previousClose: number | null
  points: readonly StockIntradayPoint[]
  meta: StockDataMeta
}

export interface StockKlineBar {
  time: string
  open: number | null
  high: number | null
  low: number | null
  close: number | null
  volumeShares: number | null
  amount: number | null
}

export interface StockKlineResponse {
  protocolVersion: typeof STOCK_MENTIONS_RPC_PROTOCOL_VERSION
  symbol: string
  period: KlinePeriod
  adjust: KlineAdjust
  bars: readonly StockKlineBar[]
  meta: StockDataMeta
}

export interface StockNewsItem {
  id: string
  title: string
  publishedAt: string
  source: string
  summary: string
  url?: string
}

export interface StockNewsResponse {
  protocolVersion: typeof STOCK_MENTIONS_RPC_PROTOCOL_VERSION
  symbol: string
  items: readonly StockNewsItem[]
  meta: StockDataMeta
}

export interface ResolveMentionsRequest {
  protocolVersion: typeof STOCK_MENTIONS_RPC_PROTOCOL_VERSION
  candidates: readonly string[]
}

export interface ResolveMentionsResponse {
  protocolVersion: typeof STOCK_MENTIONS_RPC_PROTOCOL_VERSION
  items: readonly StockResolution[]
}

export interface SecurityRequest {
  protocolVersion: typeof STOCK_MENTIONS_RPC_PROTOCOL_VERSION
  symbol: string
}

export interface KlineRequest extends SecurityRequest {
  period: KlinePeriod
  adjust: KlineAdjust
}

export interface NewsRequest extends SecurityRequest {
  limit: number
}

export interface StockMentionsPluginConfig {
  enabled: boolean
  defaultTab: StockPanelTab
  candidateLimit: number
  cacheMaxEntries: number
  cacheTtlMs: {
    resolution: number
    unresolved: number
    quote: number
    intraday: number
    kline: number
    news: number
  }
  timeoutMs: number
  providerOrder: {
    resolver: readonly StockProvider[]
    quote: readonly StockProvider[]
    intraday: readonly StockProvider[]
    kline: readonly StockProvider[]
    news: readonly StockProvider[]
  }
}

export const STOCK_MENTIONS_DEFAULT_CONFIG: StockMentionsPluginConfig = {
  enabled: true,
  defaultTab: 'intraday',
  candidateLimit: 32,
  cacheMaxEntries: 256,
  cacheTtlMs: {
    resolution: 60 * 60 * 1_000,
    unresolved: 5 * 60 * 1_000,
    quote: 5_000,
    intraday: 15_000,
    kline: 5 * 60 * 1_000,
    news: 60 * 1_000,
  },
  timeoutMs: 12_000,
  providerOrder: {
    resolver: ['eastmoney'],
    quote: ['tencent', 'eastmoney', 'sina'],
    intraday: ['eastmoney', 'tencent', 'tonghuashun'],
    kline: ['eastmoney', 'tencent', 'sina', 'tonghuashun'],
    news: ['tencent', 'sina'],
  },
}

export function isResolveMentionsRequest(value: unknown): value is ResolveMentionsRequest {
  return hasExactKeys(value, ['protocolVersion', 'candidates'])
    && value.protocolVersion === STOCK_MENTIONS_RPC_PROTOCOL_VERSION
    && Array.isArray(value.candidates)
    && value.candidates.length <= STOCK_MENTIONS_DEFAULT_CONFIG.candidateLimit
    && value.candidates.every(candidate => typeof candidate === 'string' && candidate.length <= 32)
}

export function isSecurityRequest(value: unknown): value is SecurityRequest {
  return hasExactKeys(value, ['protocolVersion', 'symbol'])
    && value.protocolVersion === STOCK_MENTIONS_RPC_PROTOCOL_VERSION
    && typeof value.symbol === 'string'
}

export function isKlineRequest(value: unknown): value is KlineRequest {
  return hasExactKeys(value, ['protocolVersion', 'symbol', 'period', 'adjust'])
    && isSecurityRequest({ protocolVersion: value.protocolVersion, symbol: value.symbol })
    && (value.period === 'day' || value.period === 'week' || value.period === 'month')
    && (value.adjust === 'qfq' || value.adjust === 'none')
}

export function isNewsRequest(value: unknown): value is NewsRequest {
  return hasExactKeys(value, ['protocolVersion', 'symbol', 'limit'])
    && isSecurityRequest({ protocolVersion: value.protocolVersion, symbol: value.symbol })
    && typeof value.limit === 'number'
    && Number.isInteger(value.limit)
    && value.limit >= 1
    && value.limit <= 10
}

export function isResolveMentionsResponse(value: unknown): value is ResolveMentionsResponse {
  return isRecord(value)
    && value.protocolVersion === STOCK_MENTIONS_RPC_PROTOCOL_VERSION
    && Array.isArray(value.items)
    && value.items.every(isStockResolution)
}

export function isStockQuoteResponse(value: unknown): value is StockQuoteResponse {
  return isRecord(value)
    && value.protocolVersion === STOCK_MENTIONS_RPC_PROTOCOL_VERSION
    && typeof value.symbol === 'string'
    && isStockQuote(value.quote)
    && isDataMeta(value.meta)
}

export function isStockIntradayResponse(value: unknown): value is StockIntradayResponse {
  return isRecord(value)
    && value.protocolVersion === STOCK_MENTIONS_RPC_PROTOCOL_VERSION
    && typeof value.symbol === 'string'
    && Array.isArray(value.points)
    && isDataMeta(value.meta)
}

export function isStockKlineResponse(value: unknown): value is StockKlineResponse {
  return isRecord(value)
    && value.protocolVersion === STOCK_MENTIONS_RPC_PROTOCOL_VERSION
    && typeof value.symbol === 'string'
    && Array.isArray(value.bars)
    && isDataMeta(value.meta)
}

export function isStockNewsResponse(value: unknown): value is StockNewsResponse {
  return isRecord(value)
    && value.protocolVersion === STOCK_MENTIONS_RPC_PROTOCOL_VERSION
    && typeof value.symbol === 'string'
    && Array.isArray(value.items)
    && value.items.every(isStockNewsItem)
    && isDataMeta(value.meta)
}

function isStockResolution(value: unknown): value is StockResolution {
  return isRecord(value)
    && typeof value.candidate === 'string'
    && (value.status === 'resolved' || value.status === 'unresolved')
    && (value.security === undefined || isStockSecurity(value.security))
}

function isStockSecurity(value: unknown): value is StockSecurity {
  return isRecord(value)
    && typeof value.code === 'string'
    && (value.market === 'SH' || value.market === 'SZ')
    && typeof value.symbol === 'string'
    && typeof value.name === 'string'
    && (value.exchange === 'SSE' || value.exchange === 'SZSE')
}

function isStockQuote(value: unknown): value is StockQuote {
  return isRecord(value)
    && isNullableNumber(value.currentPrice)
    && isNullableNumber(value.previousClose)
    && isNullableNumber(value.change)
    && isNullableNumber(value.changePercent)
    && isNullableNumber(value.open)
    && isNullableNumber(value.high)
    && isNullableNumber(value.low)
    && isNullableNumber(value.volumeShares)
    && isNullableNumber(value.amount)
    && isNullableNumber(value.marketCap)
    && isNullableNumber(value.volumeRatio)
    && isNullableNumber(value.turnoverRate)
    && (value.marketTime === null || typeof value.marketTime === 'string')
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || typeof value === 'number' && Number.isFinite(value)
}

function isDataMeta(value: unknown): value is StockDataMeta {
  return isRecord(value)
    && typeof value.fetchedAt === 'string'
    && typeof value.source === 'string'
    && (value.warning === undefined || typeof value.warning === 'string')
}

function isStockNewsItem(value: unknown): value is StockNewsItem {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.title === 'string'
    && typeof value.publishedAt === 'string'
    && typeof value.source === 'string'
    && typeof value.summary === 'string'
    && (value.url === undefined || typeof value.url === 'string')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function hasExactKeys(value: unknown, keys: readonly string[]): value is Record<string, unknown> {
  if (!isRecord(value)) return false
  const actual = Object.keys(value).sort()
  return actual.length === keys.length && actual.every((key, index) => key === [...keys].sort()[index])
}
