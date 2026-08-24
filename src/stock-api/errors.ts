export type StockErrorCode = 'bad-request' | 'unavailable' | 'upstream' | 'cancelled'

/** Error category retained by the RPC layer without exposing upstream payloads. */
export class StockMentionsError extends Error {
  constructor(message: string, readonly code: StockErrorCode = 'upstream') {
    super(message)
    this.name = 'StockMentionsError'
  }
}
