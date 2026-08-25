import { describe, expect, it } from 'vitest'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import { loadQuote } from '../src/client/rpc.ts'

describe('client quote RPC compatibility', () => {
  it('accepts a partial legacy quote and fills omitted fields with null', async () => {
    const connection = {
      rpc: {
        call: async () => ({
          ok: true,
          value: {
            protocolVersion: 1,
            symbol: '601869.SH',
            quote: {
              currentPrice: '363.60',
              previousClose: '357.71',
              change: '5.89',
              changePercent: '1.65',
            },
            meta: { fetchedAt: '2026-08-24T07:00:00.000Z', source: 'eastmoney' },
          },
        }),
      },
    } as unknown as ConnectionHandle

    await expect(loadQuote(connection, '601869.SH', new AbortController().signal)).resolves.toMatchObject({
      quote: {
        currentPrice: 363.6,
        previousClose: 357.71,
        change: 5.89,
        changePercent: 1.65,
        open: null,
        marketCap: null,
      },
    })
  })
})
