# dsh-stock-mentions

`dsh-stock-mentions` 是一个独立的 DeepSeek Harness 插件：它在已结算的助手普通 Markdown 中识别经 Host 确认的沪深普通 A 股证券代码和规范简称，并把这些范围渲染为可访问按钮。点击按钮后，根级 `shell.overlay` 面板以同花顺风格展示常驻报价头部、默认分时图、日／月 K 线和个股资讯；面板只读，不展示委托、五档盘口或成交明细。

## 已实现范围

- Host 侧通过独立的 `/stock-mentions` RPC channel 访问东方财富、腾讯、新浪和同花顺的公开接口；不需要授权、Cookie、API key 或其他服务凭据。
- Client 只提交候选词，不把助手全文或任意 URL 发送给上游；客户端不直接访问行情网站。
- 只接受当前唯一匹配的沪深普通 A 股；指数、基金、ETF、债券、B 股、北交所证券、别名和歧义简称保持普通文本。
- 只处理已结算助手的段落、列表、表格单元格和精确行内代码；链接、围栏代码、数学公式、原始 HTML、流式文本、用户消息、reasoning 和工具结果不交互。
- 面板按当前会话管理选择，tab 懒加载、手动刷新、请求取消和数据源降级提示；不提供交易、自选、持仓、投资建议或模型工具。

## 独立性

本插件在 package、manifest、RPC、Host service 和 Client UI 层都独立于 `dsh-stock-market`。实现可以参考公开数据适配和请求控制方法，但不会导入其包、注入其服务、注册其 RPC 或注册 Agent 工具。

## 开发

```sh
node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit
node node_modules/typescript/bin/tsc -p tsconfig.test.json --noEmit
NODE_ENV=test node node_modules/vitest/vitest.mjs run tests
npm run build
```

详细设计、协议、数据源顺序、缓存 TTL 和测试边界见 [`docs/design.md`](docs/design.md)。
