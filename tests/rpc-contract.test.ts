import { describe, expect, it } from 'vitest'
import {
  isKlineRequest, isNewsRequest, isResolveMentionsRequest, isSecurityRequest,
  isStockQuoteResponse, STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
} from '../src/rpc-contract.ts'

describe('stock mentions RPC contract', () => {
  it('accepts only bounded protocol requests', () => {
    expect(isResolveMentionsRequest({
      protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
      candidates: ['贵州茅台', '600519.SH'],
    })).toBe(true)
    expect(isSecurityRequest({
      protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
      symbol: '600519.SH',
    })).toBe(true)
    expect(isKlineRequest({
      protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
      symbol: '600519.SH', period: 'day', adjust: 'qfq',
    })).toBe(true)
    expect(isNewsRequest({
      protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
      symbol: '600519.SH', limit: 10,
    })).toBe(true)
  })

  it('rejects extra fields and invalid news limits', () => {
    expect(isSecurityRequest({
      protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
      symbol: '600519.SH', url: 'https://example.test',
    })).toBe(false)
    expect(isNewsRequest({
      protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
      symbol: '600519.SH', limit: 11,
    })).toBe(false)
  })

  it('validates the extended quote fields used by the panel header', () => {
    expect(isStockQuoteResponse({
      protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
      symbol: '601869.SH',
      quote: {
        currentPrice: 363.6, previousClose: 357.71, change: 5.89, changePercent: 1.65,
        open: 355, high: 366.9, low: 350.88, volumeShares: 1460000, amount: 3546000000,
        marketCap: 301031000000, volumeRatio: 0.7, turnoverRate: 2.42, marketTime: null,
      },
      meta: { fetchedAt: '2026-08-24T07:00:00.000Z', source: 'eastmoney' },
    })).toBe(true)
    expect(isStockQuoteResponse({
      protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
      symbol: '601869.SH',
      quote: { currentPrice: 363.6 },
      meta: { fetchedAt: '2026-08-24T07:00:00.000Z', source: 'eastmoney' },
    })).toBe(false)
  })
})
