/** Stock mentions panel dictionaries. */

export const zh = {
  quote: '行情', intraday: '分时', day: '日K', news: '资讯', refresh: '刷新',
  close: '关闭', loading: '加载中…', retry: '重试', noData: '暂无数据', error: '数据加载失败',
  latest: '最新', change: '涨跌', changePercent: '涨幅', high: '高', low: '低', open: '开',
  marketCap: '市值', volumeRatio: '量比', turnover: '换手', amount: '额', volume: '量',
  previousClose: '昨收', marketTime: '交易时间', qfq: '前复权', source: '数据源', fetched: '更新时间',
  warning: '数据已降级', panel: '股票行情面板', lineChart: '分时走势', candleChart: 'K线走势',
  chartNoData: '暂无图表数据', average: '均价', quoteLoading: '行情数据加载中…', quoteError: '顶部行情暂不可用',
  marketSH: '沪A', marketSZ: '深A', recent30: '最近30日',
  unitTrillion: '万亿', unitHundredMillion: '亿', unitTenThousand: '万',
  sourceEastmoney: '东方财富', sourceTencent: '腾讯', sourceSina: '新浪', sourceTonghuashun: '同花顺',
} as const

export type StockMentionsKey = keyof typeof zh

export const en = {
  quote: 'Quote', intraday: 'Intraday', day: 'Day K', news: 'News', refresh: 'Refresh',
  close: 'Close', loading: 'Loading…', retry: 'Retry', noData: 'No data', error: 'Failed to load',
  latest: 'Latest', change: 'Change', changePercent: 'Change %', high: 'High', low: 'Low', open: 'Open',
  marketCap: 'Market cap', volumeRatio: 'Volume ratio', turnover: 'Turnover', amount: 'Amount', volume: 'Volume',
  previousClose: 'Prev close', marketTime: 'Market time', qfq: 'Adjusted', source: 'Source', fetched: 'Updated',
  warning: 'Fallback source', panel: 'Stock quote panel', lineChart: 'Intraday chart', candleChart: 'K-line chart',
  chartNoData: 'No chart data', average: 'Average', quoteLoading: 'Quote loading…', quoteError: 'Quote unavailable',
  marketSH: 'SH A', marketSZ: 'SZ A', recent30: 'Recent 30 days',
  unitTrillion: 'T', unitHundredMillion: '100M', unitTenThousand: '10K',
  sourceEastmoney: 'Eastmoney', sourceTencent: 'Tencent', sourceSina: 'Sina', sourceTonghuashun: 'Tonghuashun',
} satisfies Record<StockMentionsKey, string>

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Copy owned by the stock mentions quote panel. */
    stockMentions: StockMentionsKey
  }
}
