import type { ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { StockSecurity } from '../rpc-contract.ts'
import type { ChatTextAnnotationsSnapshot } from './annotation-contract.ts'

export interface StockTextBlock {
  readonly index: number
  readonly text: string
}

export interface StockMentionAction {
  readonly text: string
  readonly security: StockSecurity
  readonly onActivate: () => void
}

type MessageId = string

interface AssistantStepNode {
  readonly kind: 'assistant-step'
  readonly data: {
    readonly finalNode?: {
      readonly messageId: MessageId
      readonly blocks: readonly ({ readonly kind: 'text'; readonly text: string } | { readonly kind: 'reasoning' } | { readonly kind: 'tool-call' })[]
    }
    readonly blocks: readonly ({ readonly kind: 'text'; readonly text: string } | { readonly kind: 'reasoning' } | { readonly kind: 'tool-call' })[]
  }
}

/** Read the finalized assistant text blocks addressed by one action row. */
export function assistantTextBlocks(snapshot: ChatSnapshot, messageId: MessageId): readonly StockTextBlock[] {
  for (const rawNode of snapshot.nodes.values()) {
    const node = rawNode as unknown as AssistantStepNode
    if (node.kind !== 'assistant-step') continue
    const finalNode = node.data.finalNode
    if (finalNode?.messageId !== messageId) continue
    return finalNode.blocks.flatMap((block, index) =>
      block.kind === 'text' ? [{ index, text: block.text }] : [],
    )
  }
  return []
}

/** Collapse annotations for one message into one button per resolved security. */
export function collectStockMentionActions(
  snapshot: ChatTextAnnotationsSnapshot,
  messageId: MessageId,
): readonly StockMentionAction[] {
  const byBlock = snapshot.get(messageId)
  if (byBlock === undefined) return []

  const actions: StockMentionAction[] = []
  const seen = new Set<string>()
  for (const annotations of byBlock.values()) {
    for (const annotation of annotations) {
      if (!isStockSecurity(annotation.payload)) continue
      if (seen.has(annotation.payload.symbol)) continue
      seen.add(annotation.payload.symbol)
      actions.push({
        text: annotation.text,
        security: annotation.payload,
        onActivate: annotation.onActivate,
      })
    }
  }
  return actions
}

function isStockSecurity(value: unknown): value is StockSecurity {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Record<string, unknown>
  return typeof candidate.code === 'string'
    && (candidate.market === 'SH' || candidate.market === 'SZ')
    && typeof candidate.symbol === 'string'
    && typeof candidate.name === 'string'
    && (candidate.exchange === 'SSE' || candidate.exchange === 'SZSE')
}
