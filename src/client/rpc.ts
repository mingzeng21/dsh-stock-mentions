import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import {
  isStockIntradayResponse, isStockKlineResponse, isStockNewsResponse, isStockQuoteResponse,
  STOCK_MENTIONS_INTRADAY_ENDPOINT, STOCK_MENTIONS_KLINE_ENDPOINT, STOCK_MENTIONS_NEWS_ENDPOINT,
  STOCK_MENTIONS_QUOTE_ENDPOINT, STOCK_MENTIONS_RPC_CHANNEL, STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
  type KlineAdjust, type KlinePeriod, type StockIntradayResponse, type StockKlineResponse,
  type StockNewsResponse, type StockQuoteResponse,
} from '../rpc-contract.ts'

/** Typed browser calls for one panel tab. */
export async function loadQuote(connection: ConnectionHandle, symbol: string, signal: AbortSignal): Promise<StockQuoteResponse> {
  return call(connection, STOCK_MENTIONS_QUOTE_ENDPOINT, { protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION, symbol }, signal, normalizeStockQuoteResponse)
}

export async function loadIntraday(connection: ConnectionHandle, symbol: string, signal: AbortSignal): Promise<StockIntradayResponse> {
  return call(connection, STOCK_MENTIONS_INTRADAY_ENDPOINT, { protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION, symbol }, signal, value => isStockIntradayResponse(value) ? value : undefined)
}

export async function loadKline(
  connection: ConnectionHandle,
  symbol: string,
  period: KlinePeriod,
  adjust: KlineAdjust,
  signal: AbortSignal,
): Promise<StockKlineResponse> {
  return call(connection, STOCK_MENTIONS_KLINE_ENDPOINT, { protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION, symbol, period, adjust }, signal, value => isStockKlineResponse(value) ? value : undefined)
}

export async function loadNews(connection: ConnectionHandle, symbol: string, limit: number, signal: AbortSignal): Promise<StockNewsResponse> {
  return call(connection, STOCK_MENTIONS_NEWS_ENDPOINT, { protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION, symbol, limit }, signal, value => isStockNewsResponse(value) ? value : undefined)
}

async function call<T>(
  connection: ConnectionHandle,
  endpoint: string,
  payload: unknown,
  signal: AbortSignal,
  decode: (value: unknown) => T | undefined,
): Promise<T> {
  const result = await connection.rpc.call(STOCK_MENTIONS_RPC_CHANNEL, endpoint, payload, signal)
  if (!result.ok) throw new Error(result.error.message)
  const value = decode(result.value)
  if (value === undefined) throw new Error('股票面板响应无效。')
  return value
}

function normalizeStockQuoteResponse(value: unknown): StockQuoteResponse | undefined {
  if (!isRecord(value) || !isRecord(value.quote)) return undefined
  const quote = value.quote
  const normalized = {
    protocolVersion: value.protocolVersion,
    symbol: value.symbol,
    quote: {
      currentPrice: numberOrNull(quote.currentPrice),
      previousClose: numberOrNull(quote.previousClose),
      change: numberOrNull(quote.change),
      changePercent: numberOrNull(quote.changePercent),
      open: numberOrNull(quote.open),
      high: numberOrNull(quote.high),
      low: numberOrNull(quote.low),
      volumeShares: numberOrNull(quote.volumeShares),
      amount: numberOrNull(quote.amount),
      marketCap: numberOrNull(quote.marketCap),
      volumeRatio: numberOrNull(quote.volumeRatio),
      turnoverRate: numberOrNull(quote.turnoverRate),
      marketTime: typeof quote.marketTime === 'string' ? quote.marketTime : null,
    },
    meta: value.meta,
  }
  return isStockQuoteResponse(normalized) ? normalized : undefined
}

function numberOrNull(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(number) ? number : null
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
