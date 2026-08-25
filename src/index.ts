import type {} from '@deepseek-ai/dsh-client-connection'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'
import { registerStockMentionsRpc } from './rpc.ts'
import {
  STOCK_MENTIONS_DEFAULT_CONFIG,
  type StockMentionsPluginConfig,
} from './rpc-contract.ts'

export const name = 'dsh-stock-mentions'
export const inject = ['connection']
const providerSchema = z.union(['eastmoney', 'tencent', 'sina', 'tonghuashun'] as const)

export const Config = z.object({
  enabled: z.boolean().default(STOCK_MENTIONS_DEFAULT_CONFIG.enabled),
  defaultTab: z.union(['intraday', 'day', 'news'] as const).default(STOCK_MENTIONS_DEFAULT_CONFIG.defaultTab),
  candidateLimit: z.number().step(1).min(1).max(32).default(STOCK_MENTIONS_DEFAULT_CONFIG.candidateLimit),
  cacheMaxEntries: z.number().step(1).min(1).max(4096).default(STOCK_MENTIONS_DEFAULT_CONFIG.cacheMaxEntries),
  cacheTtlMs: z.object({
    resolution: z.number().default(STOCK_MENTIONS_DEFAULT_CONFIG.cacheTtlMs.resolution),
    unresolved: z.number().default(STOCK_MENTIONS_DEFAULT_CONFIG.cacheTtlMs.unresolved),
    quote: z.number().default(STOCK_MENTIONS_DEFAULT_CONFIG.cacheTtlMs.quote),
    intraday: z.number().default(STOCK_MENTIONS_DEFAULT_CONFIG.cacheTtlMs.intraday),
    kline: z.number().default(STOCK_MENTIONS_DEFAULT_CONFIG.cacheTtlMs.kline),
    news: z.number().default(STOCK_MENTIONS_DEFAULT_CONFIG.cacheTtlMs.news),
  }).default(STOCK_MENTIONS_DEFAULT_CONFIG.cacheTtlMs),
  timeoutMs: z.number().step(1).min(1).max(120_000).default(STOCK_MENTIONS_DEFAULT_CONFIG.timeoutMs),
  providerOrder: z.object({
    resolver: z.array(providerSchema).default([...STOCK_MENTIONS_DEFAULT_CONFIG.providerOrder.resolver]),
    quote: z.array(providerSchema).default([...STOCK_MENTIONS_DEFAULT_CONFIG.providerOrder.quote]),
    intraday: z.array(providerSchema).default([...STOCK_MENTIONS_DEFAULT_CONFIG.providerOrder.intraday]),
    kline: z.array(providerSchema).default([...STOCK_MENTIONS_DEFAULT_CONFIG.providerOrder.kline]),
    news: z.array(providerSchema).default([...STOCK_MENTIONS_DEFAULT_CONFIG.providerOrder.news]),
  }).default({
    resolver: [...STOCK_MENTIONS_DEFAULT_CONFIG.providerOrder.resolver],
    quote: [...STOCK_MENTIONS_DEFAULT_CONFIG.providerOrder.quote],
    intraday: [...STOCK_MENTIONS_DEFAULT_CONFIG.providerOrder.intraday],
    kline: [...STOCK_MENTIONS_DEFAULT_CONFIG.providerOrder.kline],
    news: [...STOCK_MENTIONS_DEFAULT_CONFIG.providerOrder.news],
  }),
}) as unknown as z<StockMentionsPluginConfig>

/** Mount the independent Host data layer and its versioned RPC channel. */
export function apply(ctx: Context, config: StockMentionsPluginConfig): void {
  const effective = mergeConfig(config)
  ctx.effect(
    () => registerStockMentionsRpc(ctx.connection, { config: effective }),
    'dsh-stock-mentions: RPC channel',
  )
}

function mergeConfig(config: StockMentionsPluginConfig): StockMentionsPluginConfig {
  return {
    ...STOCK_MENTIONS_DEFAULT_CONFIG,
    ...config,
    cacheTtlMs: { ...STOCK_MENTIONS_DEFAULT_CONFIG.cacheTtlMs, ...config.cacheTtlMs },
    providerOrder: { ...STOCK_MENTIONS_DEFAULT_CONFIG.providerOrder, ...config.providerOrder },
  }
}
