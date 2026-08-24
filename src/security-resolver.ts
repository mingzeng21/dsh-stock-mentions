import type { StockProvider, StockResolution, StockSecurity } from './rpc-contract.ts'
import { StockMentionsError } from './stock-api/errors.ts'

export interface SecuritySearchHit {
  code: string
  market: 'SH' | 'SZ'
  name: string
  category?: string
}

export interface SecuritySearchProvider {
  readonly name: StockProvider
  search(candidate: string, signal: AbortSignal): Promise<readonly SecuritySearchHit[]>
}

/** Resolves only unique current ordinary Shanghai/Shenzhen A-share matches. */
export class SecurityResolver {
  constructor(private readonly providers: readonly SecuritySearchProvider[]) {}

  async resolve(candidates: readonly string[], signal: AbortSignal): Promise<readonly StockResolution[]> {
    const unique = [...new Set(candidates.map(normalizeCandidate).filter(candidate => candidate !== ''))]
    const results: StockResolution[] = []
    for (const candidate of unique) {
      results.push(await this.resolveOne(candidate, signal))
    }
    return results
  }

  private async resolveOne(candidate: string, signal: AbortSignal): Promise<StockResolution> {
    const code = parseCode(candidate)
    const market = /^(?:\d{6})\.(SH|SZ)$/iu.exec(candidate)?.[1]?.toUpperCase() as 'SH' | 'SZ' | undefined
    const hits: SecuritySearchHit[] = []
    for (const provider of this.providers) {
      try {
        hits.push(...await provider.search(candidate, signal))
        if (hits.length > 0) break
      } catch (error) {
        if (error instanceof StockMentionsError && error.code === 'cancelled') throw error
      }
    }
    const ordinary = dedupeAndFilterOrdinaryHits(hits)
    const exact = code === undefined
      ? ordinary.filter(hit => normalizeName(hit.name) === normalizeName(candidate))
      : ordinary.filter(hit => hit.code === code && (market === undefined || hit.market === market))
    if (exact.length !== 1) return { candidate, status: 'unresolved' }
    return { candidate, status: 'resolved', security: toSecurity(exact[0]!) }
  }
}

export function normalizeCandidate(value: string): string {
  return value.trim().replace(/\s+/gu, ' ')
}

export function normalizeName(value: string): string {
  return value.replace(/[\u0000-\u0020\u00a0\u2000-\u200f\u2028\u202f\u3000]+/gu, '')
}

export function parseCode(candidate: string): string | undefined {
  const match = /^(\d{6})(?:\.(?:SH|SZ))?$/iu.exec(candidate.trim())
  return match?.[1]
}

function dedupeAndFilterOrdinaryHits(hits: readonly SecuritySearchHit[]): SecuritySearchHit[] {
  const seen = new Set<string>()
  const result: SecuritySearchHit[] = []
  for (const hit of hits) {
    if (!/^\d{6}$/u.test(hit.code)) continue
    if (hit.market !== 'SH' && hit.market !== 'SZ') continue
    if (hit.category !== undefined && !/^(?:A|AB_STOCK|stock)$/iu.test(hit.category)) continue
    if (!isOrdinaryAShareCode(hit.code, hit.market)) continue
    const key = `${hit.market}:${hit.code}:${normalizeName(hit.name)}`
    if (seen.has(key)) continue
    seen.add(key)
    result.push(hit)
  }
  return result
}

export function isOrdinaryAShareCode(code: string, market: 'SH' | 'SZ'): boolean {
  if (!/^\d{6}$/u.test(code)) return false
  if (market === 'SH') return /^(?:600|601|603|605|688|689)\d{3}$/u.test(code)
  return /^(?:000|001|002|003|300|301)\d{3}$/u.test(code)
}

function toSecurity(hit: SecuritySearchHit): StockSecurity {
  return {
    code: hit.code,
    market: hit.market,
    symbol: `${hit.code}.${hit.market}`,
    name: hit.name,
    exchange: hit.market === 'SH' ? 'SSE' : 'SZSE',
  }
}
