import type { StockSecurity } from '../rpc-contract.ts'

export interface StockMentionSelection {
  sessionId: string
  security: StockSecurity
}

/** Session-scoped panel selection store; it never enters the conversation log. */
export class StockMentionPanelController {
  private selection: StockMentionSelection | null = null
  private readonly listeners = new Set<() => void>()

  getSnapshot = (): StockMentionSelection | null => this.selection

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  open(selection: StockMentionSelection): void {
    this.selection = selection
    this.emit()
  }

  close(): void {
    if (this.selection === null) return
    this.selection = null
    this.emit()
  }

  closeSession(sessionId: string): void {
    if (this.selection?.sessionId === sessionId) this.close()
  }

  dispose(): void {
    this.selection = null
    this.listeners.clear()
  }

  private emit(): void {
    for (const listener of [...this.listeners]) listener()
  }
}
