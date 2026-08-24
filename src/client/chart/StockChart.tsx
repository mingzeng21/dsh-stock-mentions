import type { StockIntradayPoint, StockKlineBar } from '../../rpc-contract.ts'
import css from './StockChart.module.css'

export function StockChart({ points, bars, previousClose, mode, labels = { line: '分时走势', candle: 'K 线走势', noData: '暂无图表数据' } }: {
  points?: readonly StockIntradayPoint[]
  bars?: readonly StockKlineBar[]
  previousClose?: number | null
  mode: 'line' | 'candle'
  labels?: { line: string; candle: string; noData: string }
}) {
  const linePoints = points ?? []
  const candleBars = bars?.filter((bar): bar is StockKlineBar & { close: number } => bar.close !== null) ?? []
  const lineValues = linePoints.flatMap(point => [point.price, point.averagePrice].filter((value): value is number => value !== null))
  const candleValues = candleBars.flatMap(bar => [bar.open, bar.high, bar.low, bar.close].filter((value): value is number => value !== null))
  const values = mode === 'line' ? [...lineValues, ...(previousClose === null || previousClose === undefined ? [] : [previousClose])] : candleValues
  if (values.length === 0) return <div role="status">{labels.noData}</div>

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || Math.max(Math.abs(max) * 0.01, 1)
  const width = 720
  const height = 280
  const chartBottom = height - 28
  const chartTop = 12
  const pointCount = mode === 'line' ? linePoints.length : candleBars.length
  const x = (index: number) => pointCount <= 1 ? width / 2 : (index / (pointCount - 1)) * width
  const y = (value: number) => chartBottom - ((value - min) / range) * (chartBottom - chartTop)
  const gridValues = [0, 0.25, 0.5, 0.75, 1]
  const visibleLabels = mode === 'line'
    ? [linePoints[0]?.time, linePoints[Math.floor(linePoints.length / 2)]?.time, linePoints.at(-1)?.time]
    : [candleBars[0]?.time, candleBars[Math.floor(candleBars.length / 2)]?.time, candleBars.at(-1)?.time]
  return (
    <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={mode === 'line' ? labels.line : labels.candle}>
      {gridValues.map((ratio, index) => <line key={`grid-${index}`} x1="0" y1={chartTop + ratio * (chartBottom - chartTop)} x2={width} y2={chartTop + ratio * (chartBottom - chartTop)} className={css.grid} />)}
      <line x1="0" y1={chartBottom} x2={width} y2={chartBottom} className={css.axis} />
      {mode === 'line' && previousClose !== null && previousClose !== undefined && <line x1="0" y1={y(previousClose)} x2={width} y2={y(previousClose)} className={css.previousClose} />}
      {mode === 'line' && <>
        <polyline points={linePoints.flatMap((point, index) => point.price === null ? [] : [`${x(index)},${y(point.price)}`]).join(' ')} className={css.line} />
        <polyline points={linePoints.flatMap((point, index) => point.averagePrice === null ? [] : [`${x(index)},${y(point.averagePrice)}`]).join(' ')} className={css.averageLine} />
        {linePoints.flatMap((point, index) => point.price === null ? [] : [<circle key={`${point.time}-${index}`} cx={x(index)} cy={y(point.price)} r="2.4" className={css.point}><title>{`${point.time} · ${point.price}`}</title></circle>])}
      </>}
      {mode === 'candle' && candleBars.map((bar, index) => {
        const open = bar.open ?? bar.close
        const close = bar.close
        const high = bar.high ?? Math.max(open, close)
        const low = bar.low ?? Math.min(open, close)
        const color = close >= open ? css.up : css.down
        return <g key={`${bar.time}-${index}`}><line x1={x(index)} x2={x(index)} y1={y(high)} y2={y(low)} className={color} /><rect x={x(index) - 3} y={Math.min(y(open), y(close))} width="6" height={Math.max(1.5, Math.abs(y(open) - y(close)))} className={color} /></g>
      })}
      {visibleLabels.map((label, index) => label ? <text key={`${label}-${index}`} x={index === 0 ? 0 : index === 1 ? width / 2 : width} y={height - 7} textAnchor={index === 0 ? 'start' : index === 1 ? 'middle' : 'end'} className={css.label}>{label}</text> : null)}
    </svg>
  )
}
