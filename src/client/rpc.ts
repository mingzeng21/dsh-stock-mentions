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
  return call(connection, STOCK_MENTIONS_QUOTE_ENDPOINT, { protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION, symbol }, signal, isStockQuoteResponse)
}

export async function loadIntraday(connection: ConnectionHandle, symbol: string, signal: AbortSignal): Promise<StockIntradayResponse> {
  return call(connection, STOCK_MENTIONS_INTRADAY_ENDPOINT, { protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION, symbol }, signal, isStockIntradayResponse)
}

export async function loadKline(
  connection: ConnectionHandle,
  symbol: string,
  period: KlinePeriod,
  adjust: KlineAdjust,
  signal: AbortSignal,
): Promise<StockKlineResponse> {
  return call(connection, STOCK_MENTIONS_KLINE_ENDPOINT, { protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION, symbol, period, adjust }, signal, isStockKlineResponse)
}

export async function loadNews(connection: ConnectionHandle, symbol: string, limit: number, signal: AbortSignal): Promise<StockNewsResponse> {
  return call(connection, STOCK_MENTIONS_NEWS_ENDPOINT, { protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION, symbol, limit }, signal, isStockNewsResponse)
}

async function call<T>(
  connection: ConnectionHandle,
  endpoint: string,
  payload: unknown,
  signal: AbortSignal,
  validate: (value: unknown) => value is T,
): Promise<T> {
  const result = await connection.rpc.call(STOCK_MENTIONS_RPC_CHANNEL, endpoint, payload, signal)
  if (!result.ok) throw new Error(result.error.message)
  if (!validate(result.value)) throw new Error('股票面板响应无效。')
  return result.value
}
