/**
 * Compatibility contract for the annotation provider used by the plugin.
 *
 * DSH v0.1.2-alpha.3 release still does not export this contract or consume the
 * `chatTextAnnotations` service. Keeping the contract local lets the resolver
 * remain tested and ready for the upstream renderer seam without importing
 * removed DSH packages.
 */
export interface MarkdownTextAnnotation {
  readonly start: number
  readonly end: number
  readonly text: string
  readonly ariaLabel?: string
  readonly title?: string
  readonly kind: string
  readonly payload?: unknown
  readonly onActivate: () => void
}

export type AssistantTextAnnotations = ReadonlyMap<number, readonly MarkdownTextAnnotation[]>

/** Opaque IDs are strings; avoiding nominal package coupling keeps linked DSH builds compatible. */
export type ChatTextAnnotationsSnapshot = ReadonlyMap<string, AssistantTextAnnotations>

export interface ChatTextAnnotations {
  stateFor(sessionId: string): {
    getSnapshot: () => ChatTextAnnotationsSnapshot
    subscribe: (listener: () => void) => () => void
  }
  request(
    sessionId: string,
    messageId: string,
    blocks: readonly { readonly index: number; readonly text: string }[],
  ): void
  release(sessionId: string): void
}
