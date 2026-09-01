import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { Context as ClientContext } from '@deepseek-ai/cordis'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the renderer plugin's Context merge (ctx.slots).
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
import type {} from '@deepseek-ai/dsh-client-ui-layout/client'
import type {} from '@deepseek-ai/dsh-client-ui-chat/client'
import { STOCK_MENTIONS_DEFAULT_CONFIG, type StockSecurity } from '../rpc-contract.ts'
import { StockMentionPanelController } from './controller.ts'
import { StockMentionPanel } from './panel/StockMentionPanel.tsx'
import { StockMentionAnnotator } from './annotator.ts'
import { StockMentionActions } from './StockMentionActions.tsx'
import { en, zh } from './locales.ts'

interface AssistantActionsSlotRegistry {
  inject(name: 'conversation.chat.assistant-actions', factory: () => () => void): void
  register(
    options: {
      name: 'conversation.chat.assistant-actions'
      id: string
      order: number
      locale: string
      inject: () => { readonly annotator: StockMentionAnnotator }
    },
    component: typeof StockMentionActions,
  ): () => void
}

const NS = 'stockMentions'
const ANNOTATION_SERVICE = 'chatTextAnnotations'

export const inject = ['slots', 'connection', 'locale']

/** Browser half: expose the compatibility provider and mount one overlay panel. */
export function apply(ctx: ClientContext): void {
  const connection = ctx.get('connection') as unknown as ConnectionHandle
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-stock-mentions: dictionaries')
  const controller = new StockMentionPanelController()
  const annotator = new StockMentionAnnotator(
    connection,
    (sessionId: string, security: StockSecurity) => controller.open({ sessionId, security }),
    STOCK_MENTIONS_DEFAULT_CONFIG.candidateLimit,
    sessionId => controller.closeSession(sessionId),
  )

  ctx.effect(() => {
    const dispose = ctx.provide(ANNOTATION_SERVICE, annotator)
    return () => {
      dispose()
      annotator.dispose()
      controller.dispose()
    }
  }, 'dsh-stock-mentions: annotation service')

  // alpha.3 exposes this slot at runtime, but its standalone declaration bundle
  // does not carry the nested SlotMap merge into third-party project references.
  const assistantActionsSlots = ctx.slots as unknown as AssistantActionsSlotRegistry
  assistantActionsSlots.inject('conversation.chat.assistant-actions', () => assistantActionsSlots.register({
    name: 'conversation.chat.assistant-actions',
    id: 'stock-mentions',
    order: 30,
    locale: NS,
    inject: () => ({ annotator }),
  }, StockMentionActions))

  ctx.effect(() => ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay',
    id: 'stock-mentions',
    order: 80,
    locale: NS,
    inject: () => ({
      connection,
      controller,
      defaultTab: STOCK_MENTIONS_DEFAULT_CONFIG.defaultTab,
    }),
  }, StockMentionPanel)), 'dsh-stock-mentions: overlay panel')

  ctx.effect(() => () => {
    controller.close()
  }, 'dsh-stock-mentions: selection cleanup')
}
