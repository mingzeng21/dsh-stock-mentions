import { describe, expect, it, vi } from 'vitest'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { MessageId } from '@deepseek-ai/dsh-client-connection/client'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
import { StockMentionAnnotator, extractCandidates } from '../src/client/annotator.ts'
import { collectStockMentionActions } from '../src/client/stock-actions.ts'

describe('extractCandidates', () => {
  it('keeps source offsets while excluding links, fences, HTML, math, and URLs', () => {
    const text = '贵州茅台 600519.SH [平安银行](https://example.test/000001) `600000`\n```\n招商银行\n```\n<span>宁德时代</span> $隆基绿能$'
    const candidates = extractCandidates(text, 32)

    expect(candidates).toEqual([
      { candidate: '贵州茅台', start: 0, end: 4 },
      { candidate: '600519.SH', start: 5, end: 14 },
      { candidate: '600000', start: 52, end: 58 },
    ])
  })

  it('limits candidates after sorting by source position', () => {
    expect(extractCandidates('贵州茅台，宁德时代，600519', 2)).toEqual([
      { candidate: '贵州茅台', start: 0, end: 4 },
      { candidate: '宁德时代', start: 5, end: 9 },
    ])
  })

  it('uses UTF-16 offsets when preceding text contains astral characters', () => {
    expect(extractCandidates('😀贵州茅台', 32)).toContainEqual({ candidate: '贵州茅台', start: 2, end: 6 })
  })

  it('projects resolved mentions through the local compatibility contract', async () => {
    const onActivate = vi.fn()
    const connection = {
      rpc: {
        call: vi.fn(async () => ({
          ok: true,
          value: {
            protocolVersion: 1,
            items: [{
              candidate: '贵州茅台',
              status: 'resolved',
              security: {
                code: '600519', market: 'SH', symbol: '600519.SH', name: '贵州茅台', exchange: 'SSE',
              },
            }],
          },
        })),
      },
    } as unknown as ConnectionHandle
    const annotator = new StockMentionAnnotator(connection, onActivate, 32, vi.fn())
    const sessionId = 'session-1' as SessionId
    const messageId = 'message-1' as MessageId
    const source = annotator.stateFor(sessionId)

    annotator.request(sessionId, messageId, [{ index: 0, text: '贵州茅台' }])
    await vi.waitFor(() => expect(source.getSnapshot().get(messageId)?.get(0)).toHaveLength(1))

    const annotation = source.getSnapshot().get(messageId)?.get(0)?.[0]
    expect(annotation?.start).toBe(0)
    expect(annotation?.end).toBe(4)
    annotation?.onActivate()
    expect(onActivate).toHaveBeenCalledWith(sessionId, expect.objectContaining({ symbol: '600519.SH' }))

    annotator.dispose()
  })
})

describe('collectStockMentionActions', () => {
  it('deduplicates resolved securities while preserving activation', () => {
    const activate = vi.fn()
    const snapshot = new Map([
      ['message-1' as MessageId, new Map([
        [0, [{
          start: 0, end: 4, text: '贵州茅台', kind: 'stock-mention',
          payload: { code: '600519', market: 'SH', symbol: '600519.SH', name: '贵州茅台', exchange: 'SSE' },
          onActivate: activate,
        }]],
        [1, [{
          start: 0, end: 9, text: '600519.SH', kind: 'stock-mention',
          payload: { code: '600519', market: 'SH', symbol: '600519.SH', name: '贵州茅台', exchange: 'SSE' },
          onActivate: vi.fn(),
        }]],
      ])],
    ])

    const actions = collectStockMentionActions(snapshot, 'message-1' as MessageId)
    expect(actions).toHaveLength(1)
    expect(actions[0]?.text).toBe('贵州茅台')
    actions[0]?.onActivate()
    expect(activate).toHaveBeenCalledOnce()
  })
})
