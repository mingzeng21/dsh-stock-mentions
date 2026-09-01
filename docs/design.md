# dsh-stock-mentions 设计文档

## 1. 背景

DeepSeek Harness 的 Web 客户端从会话事件投影 `ConversationSnapshot`，再沿 `AssistantMarkdown` → `MarkdownText` → React DOM 渲染助手输出。由于 dsh-v0.1.2-alpha.3 尚未提供通用 Markdown 标注入口，本插件当前通过 `conversation.chat.assistant-actions` 在已完成助手回答的操作区增加股票按钮；未来上游提供标注契约后，再将按钮下沉到原文范围内。

点击按钮只打开客户端的股票面板。面板通过 Host 侧 UI RPC 获取报价、分时、K 线和个股资讯；客户端不直接请求公开行情网站，不修改助手原文，也不把面板状态写进会话日志。

## 2. 已确认的设计

- `dsh-stock-mentions` 是独立的 UI-only 插件，拥有自己的证券解析、公开数据适配、归一化、缓存、请求控制、RPC 和面板。
- 可以参考或复制 `dsh-stock-market` 的公开数据适配、请求控制和归一化实现，但不导入它的包、不注入它的服务、不注册它的 RPC、不注册 Agent 股票工具。
- 只支持沪深交易所普通 A 股股票；排除指数、基金、ETF、债券、B 股、北交所证券和板块代码。
- 解析所有已完成助手普通文本块；不解析 reasoning、工具结果、用户消息或流式文本；解析结果在 assistant action row 汇总为按钮。
- 支持普通段落、列表、表格单元格，以及精确证券代码的行内代码；排除链接、围栏代码块、数学公式和 HTML 字面量。
- 证券名称通过 Host 的公开搜索接口动态确认；只有唯一有效证券匹配才生成标注。
- 面板使用根级 `shell.overlay`，选择状态绑定当前会话；切换会话时关闭面板并取消请求。
- 面板首发包含报价、分时、最近 30 个交易日前复权日 K 线和个股资讯；报价数据常驻顶部，默认打开分时 tab，其他 tab 懒加载。
- 顶部展示当前价、涨跌额/幅、最高、最低、开盘、市值、量比、换手率等只读指标；不展示委托、五档盘口或成交明细。
- 只读、手动刷新；不提供交易、自选股、持仓、投资建议或会影响 Agent 上下文的动作。
- 客户端通过 DSH `ctx.locale` 注册 `stockMentions` 命名空间的完整 `zh/en` 词典；overlay 声明同一命名空间，由框架注入 `t()`，语言切换时自动重新渲染。面板不直接读取 `navigator.language`。
- 文本标注按 Harness 通用纯数据扩展点设计，`ui-primitives` 不依赖 Cordis；但 `dsh-v0.1.2-alpha.3` 尚未提供该扩展点，插件暂时只保留本地适配契约，等待上游渲染入口。

## 3. 用户流程

```text
助手输出流式文本
    ↓
助手文本完成，保留原始 Markdown
    ↓
客户端提取代码和有限中文候选词
    ↓
Host resolve-mentions：精确搜索并过滤普通 A 股
    ↓
解析结果进入缓存，Markdown 重新渲染
    ↓
证券提及在助手回答操作区显示为按钮
    ↓ 点击
StockMentionPanelController.open(symbol)
    ↓
Host RPC：security-quote / security-intraday / security-kline / security-news
    ↓
shell.overlay 显示股票面板
```

解析失败不会阻塞对话，也不会改变原文。解析成功后才增加操作区按钮；面板请求失败只影响当前资源 tab。

## 4. 待上游提供的 Harness 文本标注扩展

当前 `MarkdownText` 已有文件提及先例，但没有可注册的通用文本标注输入。插件已使用 alpha.3 提供的 `conversation.chat.assistant-actions` 作为兼容入口；如果要把按钮嵌回原文，仍需要在 Harness 中增加通用接口：

```ts
interface TextAnnotation {
  start: number
  end: number
  text: string
  ariaLabel: string
  title: string
  kind: string
  payload: unknown
  onActivate: () => void
}
```

范围是原始 Markdown 的半开区间 `[start, end)`，偏移单位是 JavaScript UTF-16 code unit。`ui-primitives` 接收不可变的纯数据标注和激活回调，负责拆分文本、绘制按钮、键盘操作和安全排除区域；它不发起网络请求，也不读取 Cordis 服务。

`ui-conversation` 在已完成助手文本的 effect 中调用可选标注服务，把解析后的 `TextAnnotation[]` 传给 `MarkdownText`。React render 只消费已经解析的数据；首次稳定渲染可以保持普通文本，解析完成后再重新渲染按钮。

标注器必须满足：

- 不在 React render 中发起网络请求。
- 不修改原始 Markdown。
- 不进入 Markdown 链接、围栏代码、数学公式或 HTML 字面量。
- 同一范围只有一个标注器可以占用。
- 卸载插件后，标注服务、标注结果和点击处理器全部失效。

不使用 `MutationObserver`、CSS 伪链接、事件代理或另一个 `assistant-step` keyed renderer。

## 5. 证券识别

### 5.1 代码

支持带市场后缀的代码：

```text
600519.SH
000001.SZ
688001.SH
```

六位代码可以作为候选，但必须由 Host 确认市场和证券类别后才能成为按钮。日期、金额、电话号码、普通编号和指数代码不生成证券标注。

代码行内代码可以标注；围栏代码块中的代码保持普通代码样式。证券代码旁的空格、括号和中文标点不纳入标注范围。

### 5.2 名称

客户端使用 `Intl.Segmenter('zh', { granularity: 'word' })` 提取有限中文候选词；只保留 2–8 个汉字的候选，并过滤数字、URL、Markdown 语法、常见停用词和明显句法片段。单条消息最多提交 32 个唯一候选词；分词不可用时使用有限长度连续汉字片段作为降级路径。

客户端只发送候选 token 和候选类型，不发送整段助手原文。Host 通过固定的公开搜索接口进行精确查询，并过滤出沪深普通 A 股：上海代码接受 `600`、`601`、`603`、`605`、`688` 开头的股票，深圳代码接受 `000`、`001`、`002`、`003`、`300`、`301` 开头的股票，同时检查上游市场和证券类别字段。

名称只接受当前有效的规范简称。首尾空白和连续 Unicode 空白可以归一化；不移除中间标点，不做拼音、模糊、曾用名或行业别名匹配。零个或多个匹配均返回未解析，不显示选择器。

所有成功结果归一化为内部证券引用，例如 `600519.SH`；行情 RPC 不接受名称或原始上游搜索结果。

## 6. Host 数据层和 RPC

### 6.1 RPC endpoint

插件使用一个版本化 RPC channel，并拆分为以下 endpoint：

```text
resolve-mentions
security-quote
security-intraday
security-kline
security-news
```

`resolve-mentions` 的请求只包含候选：

```ts
interface ResolveMentionsRequest {
  protocolVersion: number
  candidates: ReadonlyArray<string>
}
```

响应按候选返回唯一确认的普通股票或 `unresolved`：

```ts
interface ResolveMentionsResponse {
  protocolVersion: number
  items: ReadonlyArray<{
    candidate: string
    status: 'resolved' | 'unresolved'
    security?: { symbol: string; code: string; market: 'SH' | 'SZ'; name: string; exchange: 'SSE' | 'SZSE' }
  }>
}
```

行情、分时、K 线和资讯请求只接受归一化 `symbol` 及受限业务参数。每个请求和响应都使用精确字段校验，返回稳定的 UI 错误码，不透传上游响应或 endpoint 名称。

### 6.2 数据适配

Host 侧可复用 `dsh-stock-market` 的公开数据实现思路：固定 provider、固定 Host/path、参数白名单、固定 Referer、服务端 GBK/JSONP 解析、响应结构校验、响应大小限制、超时、取消、并发门控和启动间隔。

客户端不能传任意 URL、Host、Referer、Cookie、Authorization 或凭据。新闻链接只有在 Host 根据允许列表确认后才可返回。

默认 provider 顺序：

| 资源 | 首选与备用 |
| --- | --- |
| 证券名称解析 | 东方财富搜索 |
| 报价 | 腾讯 → 东方财富 → 新浪 |
| K 线 | 东方财富 → 腾讯 → 新浪 → 同花顺 |
| 分时 | 东方财富 → 腾讯 → 同花顺 |
| 个股资讯 | 腾讯 → 新浪；通用搜索使用东方财富 |

发生故障切换时，响应记录实际来源和 warning；不能静默混淆不同数据口径。

### 6.3 缓存和并发

Host 使用进程级有界 LRU，默认最多保留 256 个条目；缓存不进入 SessionEvent：

| 资源 | 默认 TTL |
| --- | ---: |
| 唯一名称解析 | 1 小时 |
| 未解析或歧义名称 | 5 分钟 |
| 报价 | 5 秒 |
| 分时 | 15 秒 |
| K 线 | 5 分钟 |
| 个股资讯 | 60 秒 |

这些默认值是可配置的部署 tunable。相同 endpoint 和归一化参数的 in-flight 请求合并；每个 UI 等待者可以独立取消，只有最后一个等待者取消时才取消共享上游请求。

## 7. 客户端状态和面板

客户端拆成三个模块：

```text
StockMentionAnnotator
  候选提取、解析缓存、in-flight 去重和 TextAnnotation 生成

StockMentionPanelController
  当前会话的证券选择、tab、打开/关闭和请求取消

StockMentionPanel
  overlay 外壳、tab 内容、数据请求、刷新、错误和可访问交互
```

面板状态按会话隔离：

```ts
interface StockMentionSelection {
  sessionId: string
  security: { code: string; market: 'SH' | 'SZ'; symbol: string; name: string; exchange: 'SSE' | 'SZSE' }
}
```

面板使用根级 `shell.overlay`，不是 `details` 列，因此始终贴合窗口右边缘，不为左侧会话栏预留空白。面板默认宽度为 360px，与 DSH 详情栏默认宽度保持一致；内部布局使用面板容器断点，在 320px 以下自动切换为单列报价和更紧凑的图表。打开时获得焦点，Escape 关闭并将焦点返回触发按钮；窄屏覆盖中心对话区；关闭或切换证券时取消未完成请求。首发不自动滚动聊天、不高亮来源文本。

图表按 tab 懒加载：

- 报价数据随面板打开立即加载并常驻顶部。
- 默认打开分时；切换到日 K、月 K 或资讯时才请求对应数据。
- 每个 tab 保留最近一次成功结果。
- 手动刷新只刷新当前 tab。

## 8. 用户可见数据

### 8.1 报价

报价统一为：

```text
symbol, quote.currentPrice, quote.previousClose, quote.change,
quote.changePercent, quote.open, quote.high, quote.low,
quote.volumeShares, quote.amount, quote.marketCap, quote.volumeRatio,
quote.turnoverRate, quote.marketTime
```

缺失字段使用 `null`，UI 显示“暂无数据”。报价区不展示市盈率、市净率等估值字段。

### 8.2 图表

- 分时：当日价格线和均价线。
- K 线：最近 30 个交易日的日线，默认前复权；Host 协议仍保留周线和月线参数以兼容已有数据适配器。
- K 线使用 SVG 蜡烛图并显示右侧价格轴；分时图使用带渐进面积填充的价格线并显示右侧价格轴。
- 使用无额外图表依赖的 SVG 线图和蜡烛图。
- 首发不支持缩放、拖拽、技术指标和画线工具。

### 8.3 资讯

每条资讯统一为：

```text
id, title, publishedAt, source, summary, url?
```

默认显示最新 10 条，按发布时间倒序。标题为空或无法确认时间的记录丢弃。`url` 只有在 Host 允许列表确认后才返回；没有可靠地址时只显示标题、时间、来源和摘要。

## 9. 流式、错误和安全

流式阶段不做名称标注。已完成且已挂载的助手消息进入解析调度；全局缓存、in-flight 去重和最多两个解析请求并发，防止历史消息同时出现时放大请求量。

失败保持局部化：

- 解析失败：保持普通文本。
- 代码格式有效但行情不可用：按钮仍可打开面板。
- 名称接口不可用：名称保持普通文本。
- 单个 tab 失败：只显示该 tab 的重试状态。
- 数据源切换：显示更新时间和简短来源提示。
- 关闭面板或切换证券：取消旧请求。

助手文本是不可信输入。按钮使用 React 事件处理；不从文本拼接可执行 URL；不向上游发送会话全文；不把面板状态写入会话日志；不触发模型工具调用。

## 10. 插件结构

```text
dsh-stock-mentions/
  CONTEXT.md
  README.md
  cordis.patch.yml
  package.json
  docs/
    design.md
    adr/
  src/
    index.ts                         # Host 插件入口
    rpc-contract.ts                  # UI RPC 协议
    rpc.ts                           # Host handler、缓存和错误映射
    security-resolver.ts             # A 股代码/名称解析
    stock-api/                       # 独立的公开 provider 适配器
    client/
      index.ts                       # Client 插件入口
      annotator.ts                   # 候选、解析缓存和标注
      controller.ts                  # 面板状态
      panel/
        StockMentionPanel.tsx
        StockMentionPanel.module.css
      chart/
        StockChart.tsx
        StockChart.module.css
  tests/
```

Host 和 Client 通过独立 bundle、manifest 和 `cordis.patch.yml` 安装。插件不依赖 `dsh-stock-market`，也不注册 `stock_*` Agent 工具。

## 11. 实现状态

### Phase 0：Harness 通用标注能力（待上游）

- 插件保留 `annotation-contract.ts` 作为未来通用标注接口的兼容契约。
- 等待上游在 `ui-primitives` / `ui-chat` 增加纯数据标注输入和已完成助手文本的可选标注服务。
- 上游接口落地后，再补齐普通文本、行内代码、链接、围栏代码、数学公式、流式和卸载的浏览器组合测试。

### Phase 1：独立 Host 数据层（已完成基础实现）

- 创建独立包、Host/Client 入口和 bundle patch。
- 实现 A 股代码归一化和动态名称解析。
- 复制并收窄公开 provider、归一化、缓存、并发、超时和错误映射。
- 实现 `resolve-mentions`、`security-quote`、`security-intraday`、`security-kline`、`security-news`。

### Phase 2：面板和文本入口（已完成基础实现）

- 在 DSH alpha.3 的 `conversation.chat.assistant-actions` 中接入已完成回答的股票操作按钮；保留通用文本标注契约，等待上游原文渲染入口。
- 实现 `shell.overlay` 面板、会话级 controller、tab 懒加载、刷新、取消和错误状态。
- 实现报价、分时、K 线、资讯和 SVG 图表。

### Phase 3：组合测试和发布（待完成）

- 真实 Loader 装载 Host/Client 插件。
- 浏览器注册、卸载、无障碍和窄屏测试。
- keyless snapshot 覆盖按钮、面板和失败状态。
- 运行类型检查、构建、包校验、文档门禁和可选公开源 smoke test。

## 12. 测试要求

### 纯逻辑和 Host 测试

- 代码格式、市场归一化和普通数字排除。
- 普通股票与指数、基金、ETF、B 股、北交所证券排除。
- 中文候选提取、停用词过滤、候选上限和 UTF-16 范围。
- 唯一名称、零结果和歧义结果。
- 重叠范围、重复 token 和范围排序。
- provider 参数白名单、固定 Host、GBK/JSONP 解析和响应上限。
- 故障切换、缓存 TTL、in-flight 合并、取消、超时和错误码。
- 每个 RPC request/response 的协议校验。

### 浏览器和组合测试（待补齐）

- 普通段落、列表、表格和精确行内代码显示按钮。
- 链接、围栏代码、数学公式、HTML 和流式尾部不显示按钮。
- tab 懒加载、手动刷新、会话切换取消和局部错误。
- 面板切换证券和会话时取消请求、关闭状态正确。
- provider 降级和单 tab 错误局部化。
- 插件卸载后标注、slot、RPC、缓存任务和 controller 全部移除。
- 真实 Loader、bundle patch、manifest 和 keyless snapshots。

## 13. 相关决策

- [ADR 0001：独立数据层](./adr/0001-standalone-data-layer.md)
- [ADR 0002：通用 Markdown 标注扩展](./adr/0002-general-markdown-annotations.md)

Harness 主仓库已同步记录通用 `MarkdownText` 扩展的 README、测试、类型契约和 Agent Note；股票插件的领域词汇和独立数据层决策记录在本目录。

## 14. 第一实施顺序

已按“DSH action slot 兼容入口 → 证券解析 → RPC 数据层 → overlay 面板”的顺序完成 alpha.3 可用实现；下一步是完成真实 Loader、浏览器组合测试，并在 Harness 提供 Markdown 标注入口后恢复原文内联按钮。
