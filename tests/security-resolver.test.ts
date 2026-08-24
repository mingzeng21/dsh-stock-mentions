import { describe, expect, it } from 'vitest'
import { SecurityResolver } from '../src/security-resolver.ts'

describe('SecurityResolver', () => {
  it('resolves one current ordinary A-share match and rejects index hits', async () => {
    const resolver = new SecurityResolver([{
      name: 'fake',
      search: async () => [
        { code: '399001', market: 'SZ', name: '深证成指', category: 'index' },
        { code: '600519', market: 'SH', name: '贵州茅台', category: 'A' },
      ],
    }])

    await expect(resolver.resolve(['贵州茅台'], new AbortController().signal)).resolves.toEqual([{
      candidate: '贵州茅台',
      status: 'resolved',
      security: {
        code: '600519', market: 'SH', symbol: '600519.SH', name: '贵州茅台', exchange: 'SSE',
      },
    }])
  })

  it('resolves code candidates by code and leaves ambiguous names unresolved', async () => {
    const resolver = new SecurityResolver([{
      name: 'fake',
      search: async (candidate: string) => candidate.startsWith('600519')
        ? [{ code: '600519', market: 'SH', name: '贵州茅台' }]
        : [
          { code: '000001', market: 'SZ', name: '平安银行' },
          { code: '600001', market: 'SH', name: '平安银行' },
        ],
    }])

    await expect(resolver.resolve(['600519.SH', '平安银行'], new AbortController().signal)).resolves.toEqual([
      {
        candidate: '600519.SH',
        status: 'resolved',
        security: {
          code: '600519', market: 'SH', symbol: '600519.SH', name: '贵州茅台', exchange: 'SSE',
        },
      },
      { candidate: '平安银行', status: 'unresolved' },
    ])
  })

  it('does not ignore a market suffix supplied by the candidate', async () => {
    const resolver = new SecurityResolver([{
      name: 'fake',
      search: async () => [{ code: '000001', market: 'SZ', name: '平安银行' }],
    }])

    await expect(resolver.resolve(['000001.SH'], new AbortController().signal)).resolves.toEqual([
      { candidate: '000001.SH', status: 'unresolved' },
    ])
  })
})
