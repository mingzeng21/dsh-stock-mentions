import type {
  KlineAdjust, KlinePeriod, StockIntradayPoint, StockKlineBar, StockNewsItem, StockProvider,
  StockQuote, StockSecurity,
} from '../rpc-contract.ts'
import { parseCode, type SecuritySearchHit, type SecuritySearchProvider } from '../security-resolver.ts'
import { StockMentionsError } from './errors.ts'
import { ProviderGate, withTimeout } from './request-control.ts'

export interface PublicStockApiOptions {
  fetcher?: typeof fetch
  now?: () => Date
  timeoutMs?: number
}

interface SourceQuote { quote: StockQuote; source: StockProvider }
interface SourceIntraday { previousClose: number | null; points: readonly StockIntradayPoint[]; source: StockProvider }
interface SourceKline { bars: readonly StockKlineBar[]; source: StockProvider }
interface SourceNews { items: readonly StockNewsItem[]; source: StockProvider }

/** Host-only adapters for public, credential-free A-share data endpoints. */
export class PublicStockApi implements SecuritySearchProvider {
  readonly name = 'eastmoney' as const
  private readonly fetcher: typeof fetch | undefined
  private readonly now: () => Date
  private readonly timeoutMs: number
  private readonly gates = {
    eastmoney: new ProviderGate(2, 350),
    tencent: new ProviderGate(3, 100),
    sina: new ProviderGate(2, 300),
    tonghuashun: new ProviderGate(1, 500),
  } satisfies Record<StockProvider, ProviderGate>

  constructor(options: PublicStockApiOptions = {}) {
    this.fetcher = options.fetcher ?? globalThis.fetch
    this.now = options.now ?? (() => new Date())
    this.timeoutMs = options.timeoutMs ?? 12_000
  }

  async search(candidate: string, signal: AbortSignal): Promise<readonly SecuritySearchHit[]> {
    const url = new URL('https://search-codetable.eastmoney.com/codetable/search/web/market')
    // Eastmoney's code-table endpoint accepts the six-digit code, not the
    // Harness symbol form with its `.SH`/`.SZ` suffix. Market validation stays
    // in SecurityResolver, so a mismatched suffix remains unresolved.
    url.searchParams.set('keyword', parseCode(candidate) ?? candidate)
    url.searchParams.set('label', 'AB_STOCK')
    url.searchParams.set('uid', '')
    url.searchParams.set('pageIndex', '1')
    url.searchParams.set('pageSize', '20')
    const value = await this.requestJson('eastmoney', url, signal)
    return searchHits(value)
  }

  async quote(security: StockSecurity, provider: StockProvider, signal: AbortSignal): Promise<SourceQuote> {
    if (provider === 'tencent') return this.tencentQuote(security, signal)
    if (provider === 'eastmoney') return this.eastmoneyQuote(security, signal)
    if (provider === 'sina') return this.sinaQuote(security, signal)
    throw new StockMentionsError('同花顺暂不提供报价适配器。', 'unavailable')
  }

  async intraday(security: StockSecurity, provider: StockProvider, signal: AbortSignal): Promise<SourceIntraday> {
    if (provider === 'eastmoney') return this.eastmoneyIntraday(security, signal)
    if (provider === 'tencent') return this.tencentIntraday(security, signal)
    throw new StockMentionsError(`${provider}暂不提供分时适配器。`, 'unavailable')
  }

  async kline(
    security: StockSecurity,
    period: KlinePeriod,
    adjust: KlineAdjust,
    provider: StockProvider,
    signal: AbortSignal,
  ): Promise<SourceKline> {
    if (provider === 'eastmoney') return this.eastmoneyKline(security, period, adjust, signal)
    if (provider === 'tencent') return this.tencentKline(security, period, adjust, signal)
    if (provider === 'sina') return this.sinaKline(security, period, signal)
    return this.tonghuashunKline(security, signal)
  }

  async news(security: StockSecurity, provider: StockProvider, limit: number, signal: AbortSignal): Promise<SourceNews> {
    if (provider === 'tencent') return this.tencentNews(security, limit, signal)
    if (provider === 'sina') return this.sinaNews(security, limit, signal)
    throw new StockMentionsError(`${provider}暂不提供个股资讯适配器。`, 'unavailable')
  }

  private async eastmoneyQuote(security: StockSecurity, signal: AbortSignal): Promise<SourceQuote> {
    const value = await this.requestJson('eastmoney', eastmoneyUrl('/api/qt/stock/get', {
      secid: eastmoneySecid(security), fltt: 2, invt: 2,
      fields: 'f43,f44,f45,f46,f47,f48,f50,f57,f58,f60,f116,f168,f169,f170,f86',
    }), signal)
    const data = recordAt(value, ['data'])
    if (data === undefined) throw new StockMentionsError('东方财富报价响应无效。')
    return {
      source: 'eastmoney',
      quote: {
        currentPrice: numberOrNull(data.f43), previousClose: numberOrNull(data.f60),
        change: numberOrNull(data.f169), changePercent: numberOrNull(data.f170),
        open: numberOrNull(data.f46), high: numberOrNull(data.f44), low: numberOrNull(data.f45),
        volumeShares: numberOrNull(data.f47), amount: numberOrNull(data.f48),
        marketCap: numberOrNull(data.f116), volumeRatio: numberOrNull(data.f50),
        turnoverRate: numberOrNull(data.f168), marketTime: stringOrNull(data.f86) ?? this.now().toISOString(),
      },
    }
  }

  private async tencentQuote(security: StockSecurity, signal: AbortSignal): Promise<SourceQuote> {
    const symbol = exchangeSymbol(security)
    const text = await this.requestText('tencent', `https://qt.gtimg.cn/q=${symbol}`, signal, 'gbk')
    const match = new RegExp(`(?:^|\\n)\\s*v_${symbol}="((?:\\\\.|[^"])*)";?`, 'u').exec(text)
    if (match === null) throw new StockMentionsError('腾讯报价响应无效。')
    const fields = decodeJsString(match[1]!).split('~')
    const amountTenThousand = numberOrNull(fields[37])
    return {
      source: 'tencent',
      quote: {
        currentPrice: numberOrNull(fields[3]), previousClose: numberOrNull(fields[4]),
        change: numberOrNull(fields[31]), changePercent: numberOrNull(fields[32]),
        open: numberOrNull(fields[5]), high: numberOrNull(fields[33]), low: numberOrNull(fields[34]),
        volumeShares: multiply(numberOrNull(fields[6]), 100),
        amount: multiply(amountTenThousand, 10_000), marketCap: null, volumeRatio: null,
        turnoverRate: numberOrNull(fields[38]),
        marketTime: stringOrNull(fields[30]),
      },
    }
  }

  private async sinaQuote(security: StockSecurity, signal: AbortSignal): Promise<SourceQuote> {
    const symbol = exchangeSymbol(security)
    const text = await this.requestText('sina', `https://hq.sinajs.cn/list=${symbol}`, signal, 'gbk')
    const match = new RegExp(`(?:^|\\n)\\s*var hq_str_${symbol}="((?:\\\\.|[^"])*)";?`, 'u').exec(text)
    if (match === null) throw new StockMentionsError('新浪报价响应无效。')
    const fields = decodeJsString(match[1]!).split(',')
    return {
      source: 'sina',
      quote: {
        currentPrice: numberOrNull(fields[3]), previousClose: numberOrNull(fields[2]),
        change: null, changePercent: null, open: numberOrNull(fields[1]),
        high: numberOrNull(fields[4]), low: numberOrNull(fields[5]),
        volumeShares: numberOrNull(fields[8]), amount: numberOrNull(fields[9]),
        marketCap: null, volumeRatio: null, turnoverRate: null,
        marketTime: fields[30] && fields[31] ? `${fields[30]} ${fields[31]}` : null,
      },
    }
  }

  private async eastmoneyIntraday(security: StockSecurity, signal: AbortSignal): Promise<SourceIntraday> {
    const value = await this.requestJson('eastmoney', eastmoneyUrl('/api/qt/stock/trends2/get', {
      secid: eastmoneySecid(security), ndays: 1, iscr: 0, iscca: 0,
      fields1: 'f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13',
      fields2: 'f51,f52,f53,f54,f55,f56,f57,f58',
    }), signal)
    const data = recordAt(value, ['data'])
    const rows = arrayAt(data, ['trends'])
    if (rows === undefined) throw new StockMentionsError('东方财富分时响应无效。')
    const points = rows.flatMap(row => {
      if (typeof row !== 'string') return []
      const fields = row.split(',')
      return [{
        time: fields[0] ?? '', price: numberOrNull(fields[1]), averagePrice: numberOrNull(fields[2]),
        cumulativeVolumeShares: numberOrNull(fields[5]), cumulativeAmount: numberOrNull(fields[6]),
      }]
    }).filter(point => point.time !== '')
    return { source: 'eastmoney', previousClose: numberOrNull(data?.preClose), points }
  }

  private async tencentIntraday(security: StockSecurity, signal: AbortSignal): Promise<SourceIntraday> {
    const value = await this.requestJson('tencent', new URL(`https://web.ifzq.gtimg.cn/appstock/app/minute/query?code=${exchangeSymbol(security)}`), signal)
    const rows = findStringArrays(value).find(items => items.length > 0 && items.some(item => item.includes(',')))
    if (rows === undefined) throw new StockMentionsError('腾讯分时响应无效。')
    const points = rows.flatMap(row => {
      const fields = row.split(',')
      return fields.length >= 3 ? [{
        time: fields[0]!, price: numberOrNull(fields[1]), averagePrice: numberOrNull(fields[2]),
        cumulativeVolumeShares: numberOrNull(fields[5]), cumulativeAmount: numberOrNull(fields[6]),
      }] : []
    })
    return { source: 'tencent', previousClose: null, points }
  }

  private async eastmoneyKline(security: StockSecurity, period: KlinePeriod, adjust: KlineAdjust, signal: AbortSignal): Promise<SourceKline> {
    const value = await this.requestJson('eastmoney', eastmoneyUrl('/api/qt/stock/kline/get', {
      secid: eastmoneySecid(security), klt: period === 'day' ? 101 : period === 'week' ? 102 : 103,
      fqt: adjust === 'qfq' ? 1 : 0, lmt: 120,
      fields1: 'f1,f2,f3,f4,f5,f6', fields2: 'f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61',
    }), signal)
    const rows = arrayAt(recordAt(value, ['data']), ['klines'])
    if (rows === undefined) throw new StockMentionsError('东方财富 K 线响应无效。')
    const bars = rows.flatMap(row => typeof row !== 'string' ? [] : parseKlineRow(row)).slice(-120)
    return { source: 'eastmoney', bars }
  }

  private async tencentKline(security: StockSecurity, period: KlinePeriod, adjust: KlineAdjust, signal: AbortSignal): Promise<SourceKline> {
    const param = `${exchangeSymbol(security)},${period},,,120,${adjust === 'qfq' ? 'qfq' : ''}`
    const value = await this.requestJson('tencent', new URL(`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${encodeURIComponent(param)}`), signal)
    const rows = findStringArrays(value).find(items => items.some(item => item.split(',').length >= 6))
    if (rows === undefined) throw new StockMentionsError('腾讯 K 线响应无效。')
    return { source: 'tencent', bars: rows.flatMap(parseKlineRow).slice(-120) }
  }

  private async sinaKline(security: StockSecurity, period: KlinePeriod, signal: AbortSignal): Promise<SourceKline> {
    const scale = period === 'day' ? 240 : period === 'week' ? 1_008 : 4_320
    const url = new URL('https://quotes.sina.cn/cn/api/json_v2.php/CN_MarketDataService.getKLineData')
    url.searchParams.set('symbol', exchangeSymbol(security)); url.searchParams.set('scale', String(scale))
    url.searchParams.set('ma', 'no'); url.searchParams.set('datalen', '120')
    const value = await this.requestJson('sina', url, signal)
    const rows = arrayValue(value)
    if (rows === undefined) throw new StockMentionsError('新浪 K 线响应无效。')
    return { source: 'sina', bars: rows.flatMap(row => isRecord(row) ? [{
      time: stringOrNull(row.day) ?? stringOrNull(row.date) ?? '', open: numberOrNull(row.open),
      high: numberOrNull(row.high), low: numberOrNull(row.low), close: numberOrNull(row.close),
      volumeShares: numberOrNull(row.volume), amount: numberOrNull(row.amount),
    }] : []).filter(bar => bar.time !== '').slice(-120) }
  }

  private async tonghuashunKline(security: StockSecurity, signal: AbortSignal): Promise<SourceKline> {
    const value = await this.requestJson('tonghuashun', new URL(`https://d.10jqka.com.cn/v6/line/${exchangeSymbol(security)}/01/last.js`), signal)
    const rows = findStringArrays(value).find(items => items.some(item => item.split(',').length >= 6))
    if (rows === undefined) throw new StockMentionsError('同花顺 K 线响应无效。')
    return { source: 'tonghuashun', bars: rows.flatMap(parseKlineRow).slice(-120) }
  }

  private async tencentNews(security: StockSecurity, limit: number, signal: AbortSignal): Promise<SourceNews> {
    const url = new URL('https://web.ifzq.gtimg.cn/appstock/news/info/search')
    url.searchParams.set('symbol', exchangeSymbol(security)); url.searchParams.set('n', String(limit))
    url.searchParams.set('page', '1'); url.searchParams.set('limit', String(limit)); url.searchParams.set('type', '2')
    const items = newsItems(await this.requestJson('tencent', url, signal), limit)
    if (items.length === 0) throw new StockMentionsError('腾讯资讯响应无效。')
    return { source: 'tencent', items }
  }

  private async sinaNews(security: StockSecurity, limit: number, signal: AbortSignal): Promise<SourceNews> {
    const url = new URL(`https://vip.stock.finance.sina.com.cn/corp/go.php/vCB_AllNewsStock/symbol/${exchangeSymbol(security)}.phtml`)
    const text = await this.requestText('sina', url, signal, 'utf-8')
    const items = parseHtmlNews(text, limit)
    if (items.length === 0) throw new StockMentionsError('新浪资讯响应无效。')
    return { source: 'sina', items }
  }

  private async requestJson(provider: StockProvider, url: URL, signal: AbortSignal): Promise<unknown> {
    const text = await this.requestText(provider, url, signal, 'utf-8')
    const payload = text.trim().replace(/^[^(]*\(/u, '').replace(/\);?$/u, '')
    try { return JSON.parse(payload) as unknown } catch { throw new StockMentionsError(`${provider}返回了无效数据。`) }
  }

  private async requestText(provider: StockProvider, url: URL | string, signal: AbortSignal, encoding: 'utf-8' | 'gbk'): Promise<string> {
    const fetcher = this.fetcher
    if (typeof fetcher !== 'function') throw new StockMentionsError('当前运行环境不支持公开数据请求。', 'unavailable')
    return withTimeout(signal, this.timeoutMs, timeoutSignal => this.gates[provider].run(timeoutSignal, async () => {
      const response = await fetcher(url, {
        method: 'GET', redirect: 'error', signal: timeoutSignal,
        headers: { Accept: 'application/json, text/plain, */*', Referer: 'https://finance.qq.com/' },
      })
      if (!response.ok) throw new StockMentionsError(`${provider}请求失败：HTTP ${response.status}。`)
      const bytes = await response.arrayBuffer()
      return new TextDecoder(encoding).decode(bytes).slice(0, 8 * 1024 * 1024)
    }))
  }
}

function eastmoneyUrl(path: string, params: Record<string, string | number>): URL {
  const url = new URL(`https://push2.eastmoney.com${path}`)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value))
  return url
}

function eastmoneySecid(security: StockSecurity): string { return `${security.market === 'SH' ? 1 : 0}.${security.code}` }
function exchangeSymbol(security: StockSecurity): string { return `${security.market.toLowerCase()}${security.code}` }

function searchHits(value: unknown): SecuritySearchHit[] {
  return findRecords(value).flatMap(record => {
    const code = stringOrNull(record.f12) ?? stringOrNull(record.code) ?? stringOrNull(record.SECURITY_CODE)
    const name = stringOrNull(record.f14) ?? stringOrNull(record.shortName) ?? stringOrNull(record.name) ?? stringOrNull(record.SECURITY_NAME_ABBR)
    const marketValue = stringOrNull(record.f13) ?? stringOrNull(record.market) ?? stringOrNull(record.MARKET)
    if (code === null || name === null || marketValue === null) return []
    const market: 'SH' | 'SZ' | undefined = marketValue === '1' || /^SH(?:SE)?$/iu.test(marketValue)
      ? 'SH' : marketValue === '0' || /^SZ(?:SE)?$/iu.test(marketValue) ? 'SZ' : undefined
    return market === undefined ? [] : [{ code, market, name, category: stringOrNull(record.type) ?? undefined }]
  })
}

function parseKlineRow(row: string): StockKlineBar[] {
  const fields = row.split(',')
  if (fields.length < 7) return []
  const bar = {
    time: fields[0]!, open: numberOrNull(fields[1]), close: numberOrNull(fields[2]),
    high: numberOrNull(fields[3]), low: numberOrNull(fields[4]), volumeShares: numberOrNull(fields[5]),
    amount: numberOrNull(fields[6]),
  }
  return bar.time === '' ? [] : [bar]
}

function newsItems(value: unknown, limit: number): StockNewsItem[] {
  return findObjects(value).flatMap((record, index) => {
    const title = stringOrNull(record.title) ?? stringOrNull(record.articleTitle) ?? stringOrNull(record.news_title)
    const publishedAt = stringOrNull(record.time) ?? stringOrNull(record.publish_time) ?? stringOrNull(record.pubTime)
    if (title === null || publishedAt === null || !Date.parse(publishedAt)) return []
    const url = safeNewsUrl(stringOrNull(record.url) ?? stringOrNull(record.link))
    return [{
      id: stringOrNull(record.id) ?? stringOrNull(record.newsId) ?? `${publishedAt}-${index}`,
      title, publishedAt,
      source: stringOrNull(record.source) ?? stringOrNull(record.mediaName) ?? '公开资讯',
      summary: stringOrNull(record.summary) ?? stringOrNull(record.abstract) ?? stringOrNull(record.digest) ?? '',
      ...(url === undefined ? {} : { url }),
    }]
  }).sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt)).slice(0, limit)
}

function parseHtmlNews(text: string, limit: number): StockNewsItem[] {
  const items: StockNewsItem[] = []
  for (const match of text.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([^<]{4,200})<\/a>/giu)) {
    const title = stripHtml(match[2]!).trim()
    if (title === '') continue
    items.push({ id: match[1]!, title, publishedAt: new Date().toISOString(), source: '新浪财经', summary: '', url: safeNewsUrl(match[1]!) })
    if (items.length >= limit) break
  }
  return items
}

function findRecords(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 5) return []
  if (Array.isArray(value)) return value.flatMap(item => findRecords(item, depth + 1))
  if (!isRecord(value)) return []
  const direct = Object.keys(value).some(key => /(?:code|f12|security_code)/iu.test(key)) ? [value] : []
  return [...direct, ...Object.values(value).flatMap(item => findRecords(item, depth + 1))]
}

function findObjects(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 5) return []
  if (Array.isArray(value)) return value.flatMap(item => findObjects(item, depth + 1))
  if (!isRecord(value)) return []
  return [value, ...Object.values(value).flatMap(item => findObjects(item, depth + 1))]
}

function findStringArrays(value: unknown, depth = 0): string[][] {
  if (depth > 6) return []
  if (Array.isArray(value)) {
    if (value.every(item => typeof item === 'string')) return [value]
    return value.flatMap(item => findStringArrays(item, depth + 1))
  }
  if (!isRecord(value)) return []
  return Object.values(value).flatMap(item => findStringArrays(item, depth + 1))
}

function arrayAt(value: Record<string, unknown> | undefined, keys: readonly string[]): unknown[] | undefined {
  const current = value?.[keys[0]!]
  return Array.isArray(current) ? current : undefined
}

function recordAt(value: unknown, keys: readonly string[]): Record<string, unknown> | undefined {
  let current: unknown = value
  for (const key of keys) {
    if (!isRecord(current)) return undefined
    current = current[key]
  }
  return isRecord(current) ? current : undefined
}

function arrayValue(value: unknown): unknown[] | undefined { return Array.isArray(value) ? value : undefined }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null && !Array.isArray(value) }
function stringOrNull(value: unknown): string | null { return typeof value === 'string' ? value : typeof value === 'number' ? String(value) : null }
function numberOrNull(value: unknown): number | null {
  const number = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN
  return Number.isFinite(number) ? number : null
}
function multiply(value: number | null, by: number): number | null { return value === null ? null : value * by }
function decodeJsString(value: string): string { try { return JSON.parse(`"${value}"`) as string } catch { return value } }
function stripHtml(value: string): string { return value.replace(/<[^>]*>/gu, '') }
function safeNewsUrl(value: string | null): string | undefined {
  if (value === null) return undefined
  try {
    const url = new URL(value, 'https://finance.qq.com')
    const hostname = url.hostname.toLowerCase().replace(/\.$/u, '')
    const allowedDomain = ['qq.com', 'sina.com.cn', 'eastmoney.com', '10jqka.com.cn']
      .some(domain => hostname === domain || hostname.endsWith(`.${domain}`))
    return ['http:', 'https:'].includes(url.protocol) && allowedDomain
      ? url.href : undefined
  } catch { return undefined }
}
