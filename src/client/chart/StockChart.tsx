import { useId } from 'react'
import type { StockIntradayPoint, StockKlineBar } from '../../rpc-contract.ts'
import css from './StockChart.module.css'

// Keep the viewBox close to the narrow side-panel ratio. The old 720×300 canvas
// was letterboxed by the browser, which made the actual plot look tiny.
const WIDTH = 440
const HEIGHT = 340
const PLOT_LEFT = 16
const PLOT_RIGHT = 384
const PLOT_TOP = 24
const LINE_PLOT_BOTTOM = 280
const CANDLE_PLOT_BOTTOM = 244
const VOLUME_TOP = 258
const VOLUME_BOTTOM = 282
const AXIS_LABEL_Y = HEIGHT - 11

export function StockChart({ points, bars, previousClose, mode, labels = { line: '分时走势', candle: 'K 线走势', noData: '暂无图表数据' } }: {
  points?: readonly StockIntradayPoint[]
  bars?: readonly StockKlineBar[]
  previousClose?: number | null
  mode: 'line' | 'candle'
  labels?: { line: string; candle: string; noData: string }
}) {
  const instanceId = useId().replace(/:/gu, '')
  const gradientId = `stock-area-${instanceId}`
  const clipId = `stock-plot-${instanceId}`
  const linePoints = points ?? []
  const candleBars = bars?.filter((bar): bar is StockKlineBar & { close: number } => bar.close !== null) ?? []
  const lineValues = linePoints.flatMap(point => [point.price, point.averagePrice].filter((value): value is number => value !== null))
  const candleValues = candleBars.flatMap(bar => [bar.open, bar.high, bar.low, bar.close].filter((value): value is number => value !== null))
  const values = mode === 'line' ? [...lineValues] : [...candleValues]
  if (previousClose !== null && previousClose !== undefined) values.push(previousClose)
  if (values.length === 0 || (mode === 'line' && linePoints.every(point => point.price === null))) return <div role="status">{labels.noData}</div>

  const dataMin = Math.min(...values)
  const dataMax = Math.max(...values)
  const dataRange = dataMax - dataMin
  const padding = Math.max(dataRange * 0.08, Math.abs(dataMax) * 0.0025, 0.01)
  const min = dataMin - padding
  const max = dataMax + padding
  const range = max - min
  const plotBottom = mode === 'line' ? LINE_PLOT_BOTTOM : CANDLE_PLOT_BOTTOM
  const pointCount = mode === 'line' ? linePoints.length : candleBars.length
  const x = (index: number) => pointCount <= 1
    ? PLOT_LEFT + (PLOT_RIGHT - PLOT_LEFT) / 2
    : PLOT_LEFT + (index / (pointCount - 1)) * (PLOT_RIGHT - PLOT_LEFT)
  const y = (value: number) => plotBottom - ((value - min) / range) * (plotBottom - PLOT_TOP)
  const gridRatios = [0, 0.25, 0.5, 0.75, 1]
  const visibleLabels = mode === 'line'
    ? [linePoints[0]?.time, linePoints[Math.floor(linePoints.length / 2)]?.time, linePoints.at(-1)?.time]
    : [candleBars[0]?.time, candleBars[Math.floor(candleBars.length / 2)]?.time, candleBars.at(-1)?.time]
  const lastPrice = [...linePoints].reverse().find(point => point.price !== null)?.price ?? null
  const lineTone = previousClose !== null && previousClose !== undefined && lastPrice !== null && lastPrice < previousClose ? 'down' : 'up'
  const lineValuesForPath = linePoints.map(point => point.price)
  const linePath = mode === 'line' ? pathFor(lineValuesForPath, x, y) : ''
  const averagePath = mode === 'line' ? pathFor(linePoints.map(point => point.averagePrice), x, y) : ''
  const areaPaths = mode === 'line' ? areaPathsFor(lineValuesForPath, x, y, plotBottom) : []
  const bodyWidth = Math.max(3, Math.min(9, (PLOT_RIGHT - PLOT_LEFT) / Math.max(pointCount, 1) * 0.64))
  const volumeMax = mode === 'candle' ? Math.max(...candleBars.map(bar => bar.volumeShares ?? 0), 0) : 0

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={mode === 'line' ? labels.line : labels.candle}>
      <defs>
        {mode === 'line' && <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" className={lineTone === 'up' ? css.areaUpStart : css.areaDownStart} />
          <stop offset="58%" className={lineTone === 'up' ? css.areaUpMid : css.areaDownMid} />
          <stop offset="100%" className={lineTone === 'up' ? css.areaUpEnd : css.areaDownEnd} />
        </linearGradient>}
        <clipPath id={clipId}><rect x={PLOT_LEFT} y={PLOT_TOP} width={PLOT_RIGHT - PLOT_LEFT} height={(mode === 'line' ? plotBottom : VOLUME_BOTTOM) - PLOT_TOP} rx="2" /></clipPath>
      </defs>
      <rect x={PLOT_LEFT} y={PLOT_TOP} width={PLOT_RIGHT - PLOT_LEFT} height={plotBottom - PLOT_TOP} className={css.plotBackground} />
      <rect x={PLOT_LEFT} y={PLOT_TOP} width={PLOT_RIGHT - PLOT_LEFT} height={plotBottom - PLOT_TOP} className={css.plotBorder} />
      {gridRatios.map((ratio, index) => {
        const lineY = PLOT_TOP + ratio * (plotBottom - PLOT_TOP)
        const value = max - ratio * range
        return <g key={`grid-${index}`}>
          <line x1={PLOT_LEFT} y1={lineY} x2={PLOT_RIGHT} y2={lineY} className={css.grid} />
          <text x={WIDTH - 4} y={lineY} textAnchor="end" dominantBaseline="middle" className={css.yLabel}>{formatAxisValue(value)}</text>
        </g>
      })}
      {gridRatios.slice(1, -1).map((ratio, index) => {
        const lineX = PLOT_LEFT + ratio * (PLOT_RIGHT - PLOT_LEFT)
        return <line key={`vertical-grid-${index}`} x1={lineX} y1={PLOT_TOP} x2={lineX} y2={plotBottom} className={css.gridVertical} />
      })}
      <line x1={PLOT_RIGHT} y1={PLOT_TOP} x2={PLOT_RIGHT} y2={plotBottom} className={css.axis} />
      <line x1={PLOT_LEFT} y1={plotBottom} x2={PLOT_RIGHT} y2={plotBottom} className={css.axis} />
      {mode === 'line' && previousClose !== null && previousClose !== undefined && <>
        <line x1={PLOT_LEFT} y1={y(previousClose)} x2={PLOT_RIGHT} y2={y(previousClose)} className={css.previousClose} />
        <text x={WIDTH - 4} y={clamp(y(previousClose) + 1, PLOT_TOP + 8, plotBottom - 5)} textAnchor="end" dominantBaseline="middle" className={css.previousCloseLabel}>{formatAxisValue(previousClose)}</text>
      </>}
      <g clipPath={`url(#${clipId})`}>
        {mode === 'line' && linePath !== '' && <>
          {areaPaths.map((areaPath, index) => <path key={`area-${index}`} d={areaPath} fill={`url(#${gradientId})`} className={css.area} />)}
          {averagePath !== '' && <path d={averagePath} className={css.averageLine} />}
          <path d={linePath} className={lineTone === 'up' ? css.lineUp : css.lineDown} />
          {lastPrice !== null && <circle cx={x(lastNonNullIndex(lineValuesForPath))} cy={y(lastPrice)} r="3.2" className={lineTone === 'up' ? css.pointUp : css.pointDown} />}
        </>}
        {mode === 'candle' && volumeMax > 0 && <>
          <line x1={PLOT_LEFT} y1={VOLUME_BOTTOM} x2={PLOT_RIGHT} y2={VOLUME_BOTTOM} className={css.volumeBaseline} />
          {candleBars.map((bar, index) => {
            const volume = bar.volumeShares ?? 0
            if (volume <= 0) return null
            const open = bar.open ?? bar.close
            const color = bar.close >= open ? css.volumeUp : css.volumeDown
            const height = Math.max(1, (volume / volumeMax) * (VOLUME_BOTTOM - VOLUME_TOP))
            return <rect key={`volume-${bar.time}-${index}`} x={x(index) - bodyWidth / 2} y={VOLUME_BOTTOM - height} width={bodyWidth} height={height} className={color} />
          })}
        </>}
        {mode === 'candle' && candleBars.map((bar, index) => {
          const open = bar.open ?? bar.close
          const close = bar.close
          const high = bar.high ?? Math.max(open, close)
          const low = bar.low ?? Math.min(open, close)
          const rising = close >= open
          return <g key={`${bar.time}-${index}`}>
            <line x1={x(index)} x2={x(index)} y1={y(high)} y2={y(low)} className={rising ? css.wickUp : css.wickDown} />
            <rect x={x(index) - bodyWidth / 2} y={Math.min(y(open), y(close))} width={bodyWidth} height={Math.max(1.5, Math.abs(y(open) - y(close)))} className={rising ? css.candleUp : css.candleDown} />
            <title>{`${bar.time} · ${formatAxisValue(close)}`}</title>
          </g>
        })}
      </g>
      {visibleLabels.map((label, index) => label ? <text key={`${label}-${index}`} x={index === 0 ? PLOT_LEFT : index === 1 ? (PLOT_LEFT + PLOT_RIGHT) / 2 : PLOT_RIGHT} y={AXIS_LABEL_Y} textAnchor={index === 0 ? 'start' : index === 1 ? 'middle' : 'end'} className={css.label}>{formatTimeLabel(label)}</text> : null)}
    </svg>
  )
}

function pathFor(values: readonly (number | null)[], x: (index: number) => number, y: (value: number) => number): string {
  let path = ''
  let hasPrevious = false
  values.forEach((value, index) => {
    if (value === null) {
      hasPrevious = false
      return
    }
    path += `${hasPrevious ? 'L' : 'M'} ${x(index)} ${y(value)} `
    hasPrevious = true
  })
  return path.trim()
}

function areaPathsFor(values: readonly (number | null)[], x: (index: number) => number, y: (value: number) => number, bottom: number): string[] {
  const paths: string[] = []
  let path = ''
  let firstIndex = -1
  let lastIndex = -1
  const finish = () => {
    if (path !== '' && firstIndex >= 0 && lastIndex >= 0) paths.push(`${path} L ${x(lastIndex)} ${bottom} L ${x(firstIndex)} ${bottom} Z`)
    path = ''
    firstIndex = -1
    lastIndex = -1
  }

  values.forEach((value, index) => {
    if (value === null) {
      finish()
      return
    }
    if (firstIndex < 0) {
      firstIndex = index
      path = `M ${x(index)} ${y(value)} `
    } else {
      path += `L ${x(index)} ${y(value)} `
    }
    lastIndex = index
  })
  finish()
  return paths
}

function lastNonNullIndex(values: readonly (number | null)[]): number {
  for (let index = values.length - 1; index >= 0; index--) {
    if (values[index] !== null) return index
  }
  return -1
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value))
}

function formatAxisValue(value: number): string { return value.toFixed(2) }

function formatTimeLabel(value: string): string {
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2})/u.exec(value)
  return match === null ? value : `${match[1]} ${match[2]}`
}
