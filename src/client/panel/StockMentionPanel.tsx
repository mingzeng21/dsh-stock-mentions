import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import type { ConnectionHandle } from '@deepseek-ai/dsh-client-connection/client'
import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots'
import {
  type StockIntradayResponse, type StockKlineResponse, type StockNewsResponse, type StockProvider,
  type StockQuoteResponse,
} from '../../rpc-contract.ts'
import { StockMentionPanelController, type StockMentionSelection } from '../controller.ts'
import { loadIntraday, loadKline, loadNews, loadQuote } from '../rpc.ts'
import { StockChart } from '../chart/StockChart.tsx'
import css from './StockMentionPanel.module.css'

type Tab = 'intraday' | 'day' | 'news'
type PanelData = StockQuoteResponse | StockIntradayResponse | StockKlineResponse | StockNewsResponse

type Translator = PropsLocale<'stockMentions'>['t']
type Text = ReturnType<typeof createText>

function createText(t: Translator) {
  return {
    quote: t('quote'), intraday: t('intraday'), day: t('day'), news: t('news'), refresh: t('refresh'),
    close: t('close'), loading: t('loading'), retry: t('retry'), noData: t('noData'), error: t('error'),
    latest: t('latest'), change: t('change'), changePercent: t('changePercent'), high: t('high'), low: t('low'), open: t('open'),
    marketCap: t('marketCap'), volumeRatio: t('volumeRatio'), turnover: t('turnover'), amount: t('amount'), volume: t('volume'),
    previousClose: t('previousClose'), marketTime: t('marketTime'), qfq: t('qfq'), source: t('source'), fetched: t('fetched'),
    warning: t('warning'), panel: t('panel'), lineChart: t('lineChart'), candleChart: t('candleChart'),
    chartNoData: t('chartNoData'), average: t('average'), chartHigh: t('chartHigh'), chartLow: t('chartLow'), quoteLoading: t('quoteLoading'), quoteError: t('quoteError'),
    marketSH: t('marketSH'), marketSZ: t('marketSZ'), recent30: t('recent30'),
    units: { trillion: t('unitTrillion'), hundredMillion: t('unitHundredMillion'), tenThousand: t('unitTenThousand') },
    sourceLabels: {
      eastmoney: t('sourceEastmoney'), tencent: t('sourceTencent'), sina: t('sourceSina'), tonghuashun: t('sourceTonghuashun'),
    },
  }
}

const TABS: readonly Tab[] = ['intraday', 'day', 'news']

export function StockMentionPanel({ connection, controller, defaultTab = 'intraday', t }: {
  connection: ConnectionHandle
  controller: StockMentionPanelController
  defaultTab?: Tab
} & PropsLocale<'stockMentions'>) {
  const selection = useSyncExternalStore(controller.subscribe, controller.getSnapshot, controller.getSnapshot)
  const [tab, setTab] = useState<Tab>(defaultTab)
  const [refresh, setRefresh] = useState(0)
  const [data, setData] = useState<Map<string, PanelData>>(() => new Map())
  const [tabError, setTabError] = useState<string | null>(null)
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const dataRef = useRef(data)
  const panelRef = useRef<HTMLElement | null>(null)
  const returnFocusRef = useRef<HTMLElement | null>(null)
  dataRef.current = data
  const text = createText(t)

  useEffect(() => {
    if (selection === null) {
      returnFocusRef.current?.focus()
      returnFocusRef.current = null
      return
    }
    returnFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const frame = requestAnimationFrame(() => panelRef.current?.focus())
    return () => cancelAnimationFrame(frame)
  }, [selection?.security.symbol])

  useEffect(() => {
    if (selection === null) return
    setTab(defaultTab)
    setTabError(null)
    setQuoteError(null)
    setRefresh(0)
  }, [defaultTab, selection?.security.symbol])

  useEffect(() => {
    if (selection === null) return
    const quoteKey = dataKey(selection, 'quote')
    const chartKey = dataKey(selection, tab)
    const shouldLoadQuote = refresh > 0 || !dataRef.current.has(quoteKey)
    const shouldLoadChart = refresh > 0 || !dataRef.current.has(chartKey)
    if (!shouldLoadQuote && !shouldLoadChart) return

    const abortController = new AbortController()
    if (shouldLoadQuote) {
      setQuoteError(null)
      void loadQuote(connection, selection.security.symbol, abortController.signal).then(value => {
        setData(previous => new Map(previous).set(quoteKey, value))
      }, reason => {
        if (!abortController.signal.aborted) setQuoteError(reason instanceof Error ? reason.message : String(reason))
      })
    }
    if (shouldLoadChart) {
      setTabError(null)
      const load = tab === 'intraday'
        ? loadIntraday(connection, selection.security.symbol, abortController.signal)
        : tab === 'day'
          ? loadKline(connection, selection.security.symbol, 'day', 'qfq', abortController.signal)
          : loadNews(connection, selection.security.symbol, 10, abortController.signal)
      void load.then(value => {
        setData(previous => new Map(previous).set(chartKey, value))
      }, reason => {
        if (!abortController.signal.aborted) setTabError(reason instanceof Error ? reason.message : String(reason))
      })
    }
    return () => abortController.abort()
  }, [connection, refresh, selection?.security.symbol, tab])

  if (selection === null) return null
  const quoteData = data.get(dataKey(selection, 'quote'))
  const quote = quoteData !== undefined && 'quote' in quoteData ? quoteData : undefined
  const chartData = data.get(dataKey(selection, tab))
  const metaData = chartData ?? quote

  return (
    <aside
      ref={panelRef}
      className={css.panel}
      role="dialog"
      aria-modal="false"
      tabIndex={-1}
      aria-label={`${selection.security.name} ${text.panel}`}
      onKeyDown={event => { if (event.key === 'Escape') controller.close() }}
    >
      <StockHeader selection={selection} text={text} onClose={() => controller.close()} />
      {quote !== undefined
        ? <QuoteSummary data={quote} text={text} />
        : <div className={css.quoteLoading} role="status">{text.quoteLoading}</div>}
      {quoteError !== null && <div className={css.quoteError} role="alert">{text.quoteError}：{quoteError}</div>}
      <nav className={css.tabs} aria-label={text.panel} role="tablist">
        {TABS.map(item => (
          <button
            key={item}
            type="button"
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? css.activeTab : undefined}
            onClick={() => { setTab(item); setRefresh(0) }}
          >
            {text[item]}
          </button>
        ))}
      </nav>
      <div className={css.body}>
        {tabError !== null && <div className={css.error} role="alert">{text.error}：{tabError}<button type="button" onClick={() => setRefresh(value => value + 1)}>{text.retry}</button></div>}
        {chartData === undefined && tabError === null && <div className={css.status} role="status">{text.loading}</div>}
        {chartData !== undefined && <PanelContent data={chartData} tab={tab} quote={quote} text={text} />}
      </div>
      <footer className={css.footer}>
        <button type="button" onClick={() => setRefresh(value => value + 1)}>{text.refresh}</button>
        {metaData !== undefined && <MetaLine data={metaData} text={text} />}
      </footer>
    </aside>
  )
}

function StockHeader({ selection, text, onClose }: { selection: StockMentionSelection; text: Text; onClose: () => void }) {
  return (
    <header className={css.header}>
      <div className={css.headerCopy}>
        <div className={css.headerName}>{selection.security.name}</div>
        <div className={css.headerMeta}>
          <span>{selection.security.symbol}</span>
          <span className={css.marketTag}>{selection.security.market === 'SH' ? text.marketSH : text.marketSZ}</span>
        </div>
      </div>
      <button type="button" className={css.closeButton} aria-label={text.close} onClick={onClose}>×</button>
    </header>
  )
}

function QuoteSummary({ data, text }: { data: StockQuoteResponse; text: Text }) {
  const quote = data.quote
  const change = quote.change ?? deriveChange(quote.currentPrice, quote.previousClose)
  const changePercent = quote.changePercent ?? deriveChangePercent(change, quote.previousClose)
  const currentTone = toneClass(change)
  return (
    <section className={css.quoteSummary} aria-label={text.quote}>
      <div className={css.currentBlock}>
        <span className={css.eyebrow}>{text.latest}</span>
        <strong className={`${css.currentPrice} ${currentTone}`}>{formatPrice(quote.currentPrice)}</strong>
        <div className={`${css.changeLine} ${currentTone}`}>
          <span>{formatSigned(change)}</span>
          <span>{formatPercent(changePercent)}</span>
        </div>
      </div>
      <dl className={css.metrics}>
        <QuoteMetric label={text.high} value={formatPrice(quote.high)} tone={quoteTone(quote.high, quote.previousClose)} />
        <QuoteMetric label={text.low} value={formatPrice(quote.low)} tone={quoteTone(quote.low, quote.previousClose)} />
        <QuoteMetric label={text.open} value={formatPrice(quote.open)} tone={quoteTone(quote.open, quote.previousClose)} />
        <QuoteMetric label={text.marketCap} value={formatMarketCap(quote.marketCap, text)} />
        <QuoteMetric label={text.volumeRatio} value={formatRatio(quote.volumeRatio)} />
        <QuoteMetric label={text.turnover} value={formatPercent(quote.turnoverRate)} />
      </dl>
      <div className={css.secondaryStats}>
        <span><b>{text.amount}</b>{formatLargeNumber(quote.amount, text)}</span>
        <span><b>{text.volume}</b>{formatShares(quote.volumeShares, text)}</span>
        <span><b>{text.previousClose}</b>{formatPrice(quote.previousClose)}</span>
      </div>
    </section>
  )
}

function QuoteMetric({ label, value, tone = css.neutral }: { label: string; value: string; tone?: string }) {
  return <div className={css.metric}><dt>{label}</dt><dd className={tone}>{value}</dd></div>
}

function PanelContent({ data, tab, quote, text }: { data: PanelData; tab: Tab; quote?: StockQuoteResponse; text: Text }) {
  if (tab === 'intraday' && 'points' in data) {
    const last = data.points.at(-1)
    return <ChartSection title={text.intraday} summary={<ChartSummary quote={quote} point={last?.price ?? null} average={last?.averagePrice ?? null} text={text} />}><StockChart mode="line" points={data.points} previousClose={data.previousClose ?? quote?.quote.previousClose ?? null} labels={{ line: text.lineChart, candle: text.candleChart, noData: text.chartNoData }} /></ChartSection>
  }
  if (tab === 'day' && 'bars' in data) {
    const bars = data.bars.slice(-30)
    return <ChartSection title={text.day} summary={<KlineSummary bars={bars} text={text} />}><StockChart mode="candle" bars={bars} previousClose={quote?.quote.previousClose} labels={{ line: text.lineChart, candle: text.candleChart, noData: text.chartNoData, high: text.chartHigh, low: text.chartLow }} /></ChartSection>
  }
  if (tab === 'news' && 'items' in data) return <NewsList data={data} noData={text.noData} />
  return <div className={css.status}>{text.noData}</div>
}

function ChartSection({ title, summary, children }: { title: string; summary: ReactNode; children: ReactNode }) {
  return <section className={css.chartSection} aria-label={title}><div className={css.chartHeader}><strong>{title}</strong><span>{summary}</span></div><div className={css.chart}>{children}</div></section>
}

function ChartSummary({ quote, point, average, text }: { quote?: StockQuoteResponse; point: number | null; average: number | null; text: Text }) {
  const current = quote?.quote.currentPrice ?? point
  const change = quote?.quote.change ?? deriveChange(current, quote?.quote.previousClose ?? null)
  const tone = toneClass(change)
  return <span className={css.chartSummary}><b className={tone}>{text.latest} {formatPrice(current)}</b><em className={tone}>{text.change} {formatSigned(change)}</em><span>{text.average} {formatPrice(average)}</span></span>
}

function KlineSummary({ bars, text }: { bars: readonly StockKlineResponse['bars'][number][]; text: Text }) {
  const validBars = bars.filter(bar => bar.close !== null)
  if (validBars.length === 0) return <span className={css.chartMode}>{text.qfq} · {text.recent30}</span>
  const high = Math.max(...validBars.map(bar => bar.high ?? Math.max(bar.open ?? bar.close!, bar.close!)))
  const low = Math.min(...validBars.map(bar => bar.low ?? Math.min(bar.open ?? bar.close!, bar.close!)))
  return <span className={css.chartSummary}>
    <span>{text.qfq} · {text.recent30}</span>
    <b className={css.up}>{text.chartHigh} {formatPrice(high)}</b>
    <b className={css.down}>{text.chartLow} {formatPrice(low)}</b>
  </span>
}

function NewsList({ data, noData }: { data: StockNewsResponse; noData: string }) {
  if (data.items.length === 0) return <div className={css.status}>{noData}</div>
  return <ol className={css.news}>{data.items.map(item => <li key={item.id}><div>{item.url ? <a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a> : item.title}</div><small>{item.source} · {item.publishedAt}</small>{item.summary !== '' && <p>{item.summary}</p>}</li>)}</ol>
}

function MetaLine({ data, text }: { data: PanelData; text: Text }) {
  const meta = data.meta
  return <span className={css.meta}>{text.source}：{sourceLabel(meta.source, text)} · {text.fetched}：{meta.fetchedAt}{meta.warning && ` · ${text.warning}`}</span>
}

function dataKey(selection: StockMentionSelection, tab: Tab | 'quote'): string {
  return `${selection.security.symbol}:${tab}`
}

function deriveChange(current: number | null, previousClose: number | null): number | null {
  return current !== null && previousClose !== null ? current - previousClose : null
}

function deriveChangePercent(change: number | null, previousClose: number | null): number | null {
  return change !== null && previousClose !== null && previousClose !== 0 ? change / previousClose * 100 : null
}

function toneClass(value: number | null): string {
  if (value === null || value === 0) return css.neutral
  return value > 0 ? css.up : css.down
}

function quoteTone(value: number | null, previousClose: number | null): string {
  return toneClass(deriveChange(value, previousClose))
}

function formatPrice(value: number | null): string { return value === null ? '—' : value.toFixed(2) }
function formatSigned(value: number | null): string { return value === null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(2)}` }
function formatPercent(value: number | null): string { return value === null ? '—' : `${value.toFixed(2)}%` }
function formatRatio(value: number | null): string { return value === null ? '—' : value.toFixed(2) }
function formatShares(value: number | null, text: Text): string { return value === null ? '—' : formatLargeNumber(value, text) }
function formatMarketCap(value: number | null, text: Text): string { return formatLargeNumber(value, text) }

function formatLargeNumber(value: number | null, text: Text): string {
  if (value === null) return '—'
  const absolute = Math.abs(value)
  if (absolute >= 1e12) return `${(value / 1e12).toFixed(2)}${text.units.trillion}`
  if (absolute >= 1e8) return `${(value / 1e8).toFixed(2)}${text.units.hundredMillion}`
  if (absolute >= 1e4) return `${(value / 1e4).toFixed(2)}${text.units.tenThousand}`
  return Math.round(value).toLocaleString('zh-CN')
}

function sourceLabel(source: StockProvider, text: Text): string {
  return text.sourceLabels[source] ?? source
}
