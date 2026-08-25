import { describe, expect, it } from 'vitest'
import { StockDataService } from '../src/stock-api/service.ts'

describe('StockDataService quote enrichment', () => {
  it('fills missing volume ratio from Eastmoney when Tencent is the primary source', async () => {
    const fields = Array.from({ length: 49 }, () => '')
    fields[3] = '33.90'
    fields[4] = '34.06'
    fields[45] = '123.45'
    const service = new StockDataService({
      fetcher: async input => {
        const url = new URL(String(input))
        if (url.hostname === 'qt.gtimg.cn') return new Response(`v_sz002142="${fields.join('~')}";`, { status: 200 })
        return new Response(JSON.stringify({ data: { f43: '33.90', f60: '34.06', f50: '1.24', f116: '12345000000' } }), { status: 200 })
      },
      providerOrder: {
        resolver: ['eastmoney'], quote: ['tencent'], intraday: ['eastmoney'],
        kline: ['eastmoney'], news: ['tencent'],
      },
    })

    await expect(service.quote('002142.SZ', new AbortController().signal)).resolves.toMatchObject({
      quote: { marketCap: 12_345_000_000, volumeRatio: 1.24 },
      meta: { warning: '市值、量比字段已由东方财富补齐。' },
    })
  })
})
