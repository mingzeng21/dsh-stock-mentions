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

  it('decodes GBK Sina stock-news pages without replacement characters', async () => {
    const html = Uint8Array.from([
      ...new TextEncoder().encode('<nav><a href="/home">Home</a></nav><div class="datelist"><ul><li>2026-08-24 <a target=\'_blank\' href=\'https://finance.sina.com.cn/news/1\'>'),
      196, 254, 178, 168, 210, 248, 208, 208, 183, 162, 178, 188, 185, 171, 184, 230,
      ...new TextEncoder().encode('</a></li></ul></div>'),
    ])
    const api = new PublicStockApi({
      fetcher: async () => new Response(html, { status: 200, headers: { 'content-type': 'text/html' } }),
    })

    const result = await api.news({
      code: '002142', market: 'SZ', symbol: '002142.SZ', name: '宁波银行', exchange: 'SZSE',
    }, 'sina', 10, new AbortController().signal)

    expect(result.items[0]?.title).toBe('宁波银行发布公告')
    expect(result.items[0]?.title).not.toContain('�')
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

  it('reads Tencent market cap from the documented quote fields', async () => {
    const fields = Array.from({ length: 49 }, () => '')
    fields[3] = '33.90'
    fields[4] = '34.06'
    fields[45] = '123.45'
    const api = new PublicStockApi({
      fetcher: async () => new Response(`v_sz002142="${fields.join('~')}";`, { status: 200 }),
    })

    await expect(api.quote({
      code: '002142', market: 'SZ', symbol: '002142.SZ', name: '宁波银行', exchange: 'SZSE',
    }, 'tencent', new AbortController().signal)).resolves.toMatchObject({
      source: 'tencent', quote: { marketCap: 12_345_000_000 },
    })
  })
})

describe('PublicStockApi K-line limits', () => {
  it('requests and returns only the latest 30 daily bars', async () => {
    const requests: URL[] = []
    const api = new PublicStockApi({
      fetcher: async input => {
        requests.push(new URL(String(input)))
        return new Response(JSON.stringify({ data: { klines: Array.from({ length: 35 }, (_, index) => `2026-07-${String(index + 1).padStart(2, '0')},10,11,12,9,100,1000`) } }), { status: 200 })
      },
    })

    const result = await api.kline({
      code: '002142', market: 'SZ', symbol: '002142.SZ', name: '宁波银行', exchange: 'SZSE',
    }, 'day', 'qfq', 'eastmoney', new AbortController().signal)

    expect(requests[0]?.searchParams.get('lmt')).toBe('30')
    expect(result.bars).toHaveLength(30)
    expect(result.bars[0]?.time).toBe('2026-07-06')
  })
})
