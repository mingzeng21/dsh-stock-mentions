import type { ConnectionHandle, MessageId } from '@deepseek-ai/dsh-client-connection/client'
import type { SessionId } from '@deepseek-ai/dsh-client-runtime/client'
import type {
  AssistantTextAnnotations, ChatTextAnnotations, ChatTextAnnotationsSnapshot,
} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { MarkdownTextAnnotation } from '@deepseek-ai/dsh-client-ui-primitives'
import {
  isResolveMentionsResponse, STOCK_MENTIONS_RESOLVE_ENDPOINT,
  STOCK_MENTIONS_RPC_CHANNEL, STOCK_MENTIONS_RPC_PROTOCOL_VERSION,
  type StockResolution, type StockSecurity,
} from '../rpc-contract.ts'

const EMPTY_ANNOTATIONS: ChatTextAnnotationsSnapshot = new Map()
const STOPWORDS = new Set(['股票', '公司', '行业', '市场', '价格', '今天', '昨日', '明天', '目前', '相关', '消息', '表示', '可以', '以及', '如果', '因为', '所以'])

export interface StockMentionCandidate {
  candidate: string
  start: number
  end: number
}

interface SessionState {
  snapshot: ChatTextAnnotationsSnapshot
  listeners: Set<() => void>
  requested: Set<string>
  controllers: Set<AbortController>
  source: { getSnapshot: () => ChatTextAnnotationsSnapshot; subscribe: (listener: () => void) => () => void }
}

/** Client-side candidate extraction and settled-text annotation projection. */
export class StockMentionAnnotator implements ChatTextAnnotations {
  private disposed = false
  private readonly sessions = new Map<SessionId, SessionState>()
  private readonly cache = new Map<string, { expiresAt: number; value: StockResolution }>()
  private readonly pending = new Map<string, Promise<StockResolution>>()
  private readonly queue = new AsyncQueue(2)

  constructor(
    private readonly connection: ConnectionHandle,
    private readonly onActivate: (sessionId: SessionId, security: StockSecurity) => void,
    private readonly candidateLimit: number,
    private readonly onSessionRelease: (sessionId: SessionId) => void,
  ) {}

  stateFor(sessionId: SessionId) {
    return this.state(sessionId).source
  }

  request(
    sessionId: SessionId,
    messageId: MessageId,
    blocks: readonly { readonly index: number; readonly text: string }[],
  ): void {
    const state = this.state(sessionId)
    for (const block of blocks) {
      const requestKey = `${messageId}:${block.index}:${block.text}`
      if (state.requested.has(requestKey)) continue
      state.requested.add(requestKey)
      const candidates = extractCandidates(block.text, this.candidateLimit)
      if (candidates.length === 0) continue
      const controller = new AbortController()
      state.controllers.add(controller)
      void this.annotateBlock(sessionId, messageId, block.index, candidates, controller.signal)
        .catch(() => undefined)
        .finally(() => state.controllers.delete(controller))
    }
  }

  release(sessionId: SessionId): void {
    const state = this.sessions.get(sessionId)
    if (state === undefined) return
    for (const controller of state.controllers) controller.abort()
    state.controllers.clear()
    this.sessions.delete(sessionId)
    this.onSessionRelease(sessionId)
  }

  dispose(): void {
    this.disposed = true
    for (const sessionId of [...this.sessions.keys()]) this.release(sessionId)
    this.cache.clear()
    this.pending.clear()
  }

  private async annotateBlock(
    sessionId: SessionId,
    messageId: MessageId,
    blockIndex: number,
    candidates: readonly StockMentionCandidate[],
    signal: AbortSignal,
  ): Promise<void> {
    const resolutions = await Promise.all(candidates.map(candidate => this.resolve(candidate.candidate, signal)))
    const annotations = candidates.flatMap((candidate, index) => {
      const resolution = resolutions[index]
      if (resolution?.status !== 'resolved' || resolution.security === undefined) return []
      return [this.annotation(sessionId, candidate, resolution.security)]
    })
    if (annotations.length === 0) return
    const state = this.sessions.get(sessionId)
    if (state === undefined || signal.aborted) return
    const byMessage = new Map<MessageId, AssistantTextAnnotations>(state.snapshot)
    const byBlock = new Map<number, readonly MarkdownTextAnnotation[]>(byMessage.get(messageId) ?? [])
    byBlock.set(blockIndex, annotations)
    byMessage.set(messageId, byBlock)
    state.snapshot = byMessage
    for (const listener of [...state.listeners]) listener()
  }

  private annotation(sessionId: SessionId, candidate: StockMentionCandidate, security: StockSecurity): MarkdownTextAnnotation {
    return {
      start: candidate.start,
      end: candidate.end,
      text: candidate.candidate,
      ariaLabel: `查看 ${security.name}（${security.symbol}）行情`,
      title: `${security.name} · ${security.symbol}`,
      kind: 'stock-mention',
      payload: security,
      onActivate: () => {
        if (!this.disposed && this.sessions.has(sessionId)) this.onActivate(sessionId, security)
      },
    }
  }

  private resolve(candidate: string, signal: AbortSignal): Promise<StockResolution> {
    const cached = this.cache.get(candidate)
    if (cached !== undefined && cached.expiresAt > Date.now()) return Promise.resolve(cached.value)
    const existing = this.pending.get(candidate)
    if (existing !== undefined) return existing
    const promise = this.queue.run(async () => {
      const result = await this.connection.rpc.call(
        STOCK_MENTIONS_RPC_CHANNEL,
        STOCK_MENTIONS_RESOLVE_ENDPOINT,
        { protocolVersion: STOCK_MENTIONS_RPC_PROTOCOL_VERSION, candidates: [candidate] },
        signal,
      )
      if (!result.ok || !isResolveMentionsResponse(result.value)) throw new Error('股票解析响应无效。')
      const resolution = result.value.items[0] ?? { candidate, status: 'unresolved' as const }
      this.cache.set(candidate, {
        value: resolution,
        expiresAt: Date.now() + (resolution.status === 'resolved' ? 60 * 60 * 1_000 : 5 * 60 * 1_000),
      })
      return resolution
    })
    this.pending.set(candidate, promise)
    void promise.then(
      () => { if (this.pending.get(candidate) === promise) this.pending.delete(candidate) },
      () => { if (this.pending.get(candidate) === promise) this.pending.delete(candidate) },
    )
    return promise
  }

  private state(sessionId: SessionId): SessionState {
    const existing = this.sessions.get(sessionId)
    if (existing !== undefined) return existing
    const listeners = new Set<() => void>()
    const state: SessionState = {
      snapshot: EMPTY_ANNOTATIONS,
      listeners,
      requested: new Set(),
      controllers: new Set(),
      source: {
        getSnapshot: () => state.snapshot,
        subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
      },
    }
    this.sessions.set(sessionId, state)
    return state
  }
}

class AsyncQueue {
  private active = 0
  private readonly pending: Array<{ run: () => Promise<StockResolution>; resolve: (value: StockResolution) => void; reject: (error: unknown) => void }> = []

  constructor(private readonly concurrency: number) {}

  run(run: () => Promise<StockResolution>): Promise<StockResolution> {
    return new Promise<StockResolution>((resolve, reject) => {
      this.pending.push({ run, resolve, reject })
      this.drain()
    })
  }

  private drain(): void {
    while (this.active < this.concurrency && this.pending.length > 0) {
      const item = this.pending.shift()!
      this.active++
      void item.run().then(item.resolve, item.reject).finally(() => {
        this.active--
        this.drain()
      })
    }
  }
}

export function extractCandidates(text: string, limit: number): readonly StockMentionCandidate[] {
  const candidates: StockMentionCandidate[] = []
  const occupied: Array<[number, number]> = []
  const searchableText = maskExcludedText(text)
  for (const match of searchableText.matchAll(/(?<!\d)(\d{6}(?:\.(?:SH|SZ))?)(?!\d)/giu)) {
    const candidate = match[1]
    const start = match.index + (match[0].indexOf(candidate))
    candidates.push({ candidate, start, end: start + candidate.length })
    occupied.push([start, start + candidate.length])
  }
  const addName = (candidate: string, start: number): void => {
    if (candidate.length < 2 || candidate.length > 8 || STOPWORDS.has(candidate)) return
    const end = start + candidate.length
    if (occupied.some(([left, right]) => start < right && end > left)) return
    if (candidates.some(item => item.start === start && item.end === end)) return
    candidates.push({ candidate, start, end })
    occupied.push([start, end])
  }
  const segmenter = 'Segmenter' in Intl ? new Intl.Segmenter('zh', { granularity: 'word' }) : undefined
  if (segmenter !== undefined) {
    let hanStart: number | undefined
    let hanEnd = 0
    const flushHan = (): void => {
      if (hanStart !== undefined && hanEnd - hanStart >= 2 && hanEnd - hanStart <= 8) {
        addName(searchableText.slice(hanStart, hanEnd), hanStart)
      }
      hanStart = undefined
    }
    for (const part of segmenter.segment(searchableText)) {
      if (/^\p{Script=Han}+$/u.test(part.segment)) {
        if (hanStart === undefined) hanStart = part.index
        hanEnd = part.index + part.segment.length
      } else {
        flushHan()
      }
    }
    flushHan()
  } else {
    for (const match of searchableText.matchAll(/[\p{Script=Han}]+/gu)) {
      if (match[0].length >= 2 && match[0].length <= 8) addName(match[0], match.index)
    }
  }
  return candidates.sort((left, right) => left.start - right.start).slice(0, limit)
}

function maskExcludedText(text: string): string {
  const masked = text.split('')
  const copy = (start: number, end: number): void => {
    for (let index = start; index < end; index++) masked[index] = text[index] ?? ' '
  }
  const mask = (pattern: RegExp, restoreCodes = false): void => {
    for (const match of text.matchAll(pattern)) {
      const start = match.index
      const end = start + match[0].length
      if (restoreCodes) {
        for (const code of match[0].matchAll(/(?<!\d)\d{6}(?:\.(?:SH|SZ))?(?!\d)/giu)) {
          copy(start + code.index, start + code.index + code[0].length)
        }
      }
      for (let index = start; index < end; index++) masked[index] = ' '
      if (restoreCodes) {
        for (const code of match[0].matchAll(/(?<!\d)\d{6}(?:\.(?:SH|SZ))?(?!\d)/giu)) {
          copy(start + code.index, start + code.index + code[0].length)
        }
      }
    }
  }
  mask(/```[\s\S]*?```|~~~[\s\S]*?~~~/gu)
  mask(/`[^`\n]*`/gu, true)
  mask(/!?\[[^\]]*\]\([^)]*\)/gu)
  mask(/https?:\/\/[^\s)]+/giu)
  mask(/<!--[\s\S]*?-->|<([A-Za-z][\w:-]*)\b[^>]*>[\s\S]*?<\/\1\s*>/giu)
  mask(/<[^>]+>/gu)
  mask(/\$\$[\s\S]*?\$\$|\\\([\s\S]*?\\\)|(?<!\\)\$[^$\n]+\$/gu)
  return masked.join('')
}
