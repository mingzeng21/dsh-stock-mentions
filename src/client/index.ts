import { createElement } from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { ClientContext, SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import { STOCK_MENTIONS_DEFAULT_CONFIG, type StockSecurity } from '../rpc-contract.ts'
import { StockMentionPanelController } from './controller.ts'
import { StockMentionPanel } from './panel/StockMentionPanel.tsx'
import { StockMentionAnnotator } from './annotator.ts'

export const inject = ['slots', 'connection']

/** Browser half: provide annotations to ui-conversation and mount one overlay panel. */
export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as unknown as ConnectionHandle
  const controller = new StockMentionPanelController()
  const annotator = new StockMentionAnnotator(
    connection,
    (sessionId: SessionId, security: StockSecurity) => controller.open({ sessionId, security }),
    STOCK_MENTIONS_DEFAULT_CONFIG.candidateLimit,
    sessionId => controller.closeSession(sessionId),
  )

  ctx.effect(() => {
    const dispose = ctx.provide('chatTextAnnotations', annotator)
    return () => {
      dispose()
      annotator.dispose()
      controller.dispose()
    }
  }, 'dsh-stock-mentions: annotation service')

  ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'stock-mentions',
    order: 80,
  }, () => createElement(StockMentionPanel, {
    connection,
    controller,
    defaultTab: STOCK_MENTIONS_DEFAULT_CONFIG.defaultTab,
  }))), 'dsh-stock-mentions: overlay panel')

  ctx.effect(() => () => {
    controller.close()
  }, 'dsh-stock-mentions: selection cleanup')
}
