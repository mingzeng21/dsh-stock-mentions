import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import type { ChatSnapshot } from '@deepseek-ai/dsh-client-ui-chat/client'
import type { StockMentionAnnotator } from './annotator.ts'
import { assistantTextBlocks, collectStockMentionActions } from './stock-actions.ts'
import css from './StockMentionActions.module.css'

export interface StockMentionActionsInjected {
  readonly annotator: StockMentionAnnotator
}

type ChatSelector = <Selected>(selector: (snapshot: ChatSnapshot) => Selected) => Selected

export type StockMentionActionsProps = StockMentionActionsInjected & PropsLocale<'stockMentions'> & {
  readonly messageId: string
  readonly sessionId: string
  readonly useChat: ChatSelector
}

/** Resolve finalized assistant mentions and expose them through DSH's action row. */
export function StockMentionActions({
  messageId, sessionId, useChat, annotator, t,
}: StockMentionActionsProps) {
  const selectChat = useCallback((snapshot: ChatSnapshot) => snapshot, [])
  const chat = useChat(selectChat)
  const blocks = useMemo(() => assistantTextBlocks(chat, messageId), [chat, messageId])
  const source = useMemo(() => annotator.stateFor(sessionId), [annotator, sessionId])
  const annotations = useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot)

  useEffect(() => {
    if (blocks.length === 0) return
    annotator.request(sessionId, messageId, blocks)
  }, [annotator, blocks, messageId, sessionId])

  const actions = useMemo(
    () => collectStockMentionActions(annotations, messageId),
    [annotations, messageId],
  )
  if (actions.length === 0) return null

  return (
    <span className={css.actions} aria-label={t('viewQuote')}>
      {actions.map(action => (
        <button
          key={action.security.symbol}
          type="button"
          className={css.action}
          title={`${action.security.name} · ${action.security.symbol}`}
          aria-label={`${t('viewQuote')}：${action.security.name}（${action.security.symbol}）`}
          onClick={action.onActivate}
        >
          <span>{action.text}</span>
        </button>
      ))}
    </span>
  )
}
