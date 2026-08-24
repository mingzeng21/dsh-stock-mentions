import { describe, expect, it } from 'vitest'
import { PublicStockApi } from '../src/stock-api/public-service.ts'

describe('PublicStockApi security search', () => {
  it('normalizes suffixed codes and reads Eastmoney shortName results', async () => {
    const requests: URL[] = []
    const api = new PublicStockApi({
      fetcher: async input => {
        requests.push(new URL(String(input)))
        return new Response(JSON.stringify({
          result: {
            labelList: [{
              quoteList: [{ code: '601995', shortName: '中金公司', market: 1 }],
            }],
          },
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      },
    })

    await expect(api.search('601995.SH', new AbortController().signal)).resolves.toEqual([
      { code: '601995', market: 'SH', name: '中金公司', category: undefined },
    ])
    expect(requests[0]?.searchParams.get('keyword')).toBe('601995')
  })
})

describe('PublicStockApi news normalization', () => {
  it('parses records without security-code fields and keeps only approved news hosts', async () => {
    const api = new PublicStockApi({
      fetcher: async () => new Response(JSON.stringify({
        data: {
          items: [
            {
              id: 'safe', title: '贵州茅台发布公告', time: '2026-08-23T10:00:00+08:00',
              source: '腾讯财经', summary: '摘要', url: 'https://news.qq.com/article/safe',
            },
            {
              id: 'unsafe', title: '外部文章', time: '2026-08-23T09:00:00+08:00',
              source: '未知来源', summary: '', url: 'https://notqq.com/article/unsafe',
            },
          ],
        },
      }), { status: 200, headers: { 'content-type': 'application/json' } }),
    })

    const result = await api.news({
      code: '600519', market: 'SH', symbol: '600519.SH', name: '贵州茅台', exchange: 'SSE',
    }, 'tencent', 10, new AbortController().signal)
    expect(result).toMatchObject({
      source: 'tencent',
      items: [
        { id: 'safe', url: 'https://news.qq.com/article/safe' },
        { id: 'unsafe' },
      ],
    })
    expect(result.items[1]).not.toHaveProperty('url')
  })
})

describe('PublicStockApi quote normalization', () => {
  it('maps Eastmoney market cap and volume ratio into the stable quote shape', async () => {
    const requests: URL[] = []
    const api = new PublicStockApi({
      fetcher: async input => {
        requests.push(new URL(String(input)))
        return new Response(JSON.stringify({
          data: {
            f43: '363.60', f44: '366.90', f45: '350.88', f46: '355.00', f47: '1460000',
            f48: '3546000000', f50: '0.70', f60: '357.71', f116: '301031000000',
            f168: '2.42', f169: '5.89', f170: '1.65', f86: '2026-08-24 15:00:00',
          },
        }), { status: 200, headers: { 'content-type': 'application/json' } })
      },
    })

    await expect(api.quote({
      code: '601869', market: 'SH', symbol: '601869.SH', name: '长飞光纤', exchange: 'SSE',
    }, 'eastmoney', new AbortController().signal)).resolves.toMatchObject({
      source: 'eastmoney',
      quote: { marketCap: 301031000000, volumeRatio: 0.7, turnoverRate: 2.42 },
    })
    expect(requests[0]?.searchParams.get('fields')).toContain('f50')
    expect(requests[0]?.searchParams.get('fields')).toContain('f116')
  })
})
