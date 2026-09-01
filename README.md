# dsh-stock-mentions

在 DeepSeek Harness（DSH）的助手回答中识别沪深普通 A 股名称和代码，并在回答操作区提供可点击的股票按钮。点击按钮后，右侧行情面板会展示报价、分时图、日 K 线和个股资讯。

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com) [![npm version](https://img.shields.io/npm/v/dsh-stock-mentions.svg)](https://www.npmjs.com/package/dsh-stock-mentions) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![Node: >=22.19.0](https://img.shields.io/badge/Node-%3E%3D22.19.0-339933.svg)](https://nodejs.org)

中文 | [English](README.en.md)

> 当前适配 DSH `v0.1.2-alpha.3`。由于该版本还没有通用 Markdown 文本标注入口，股票按钮目前显示在已完成助手回答的操作区，而不是股票原文位置。待 DSH 提供该扩展点后，再恢复原文内联按钮。

## 效果

<p align="center">
  <img src="https://raw.githubusercontent.com/mingzeng21/dsh-stock-mentions/main/docs/screenshots/sc1.png" width="49%" alt="白天模式下的股票按钮和行情面板" />
  <img src="https://raw.githubusercontent.com/mingzeng21/dsh-stock-mentions/main/docs/screenshots/sc-2.png" width="49%" alt="黑夜模式下的个股资讯面板" />
</p>

## 快速开始

### 环境要求

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) `v0.1.2-alpha.3` 或兼容的 `0.1.2-alpha` 版本
- Node.js `>=22.19.0`
- 已初始化 DSH 的 `web` profile

### 安装

使用 DSH CLI 将插件安装到 Web profile：

```sh
dsh plugin --profile web add dsh-stock-mentions
dsh web
```

如果 DSH Web 已经在运行，安装或更新后需要停止并重新执行 `dsh web`，然后刷新浏览器页面。

### 验证功能

让助手回答中包含明确的股票名称或代码，例如：

```text
请简要介绍贵州茅台（600519.SH）的主营业务，并列出需要关注的风险。
```

回答完成后，在助手回答底部的操作区找到“贵州茅台”按钮。点击按钮，右侧会打开行情面板。

## 本地开发与测试

本项目没有独立的开发服务器，UI 必须通过 DSH Web host 验证。

在插件目录安装依赖并运行完整校验：

```sh
cd /path/to/dsh-stock-mentions
npm install
npm run verify
```

使用本地源码启动的 DSH 测试插件：

```sh
cd /path/to/deepseek-harness
pnpm dsh plugin --profile web add /path/to/dsh-stock-mentions
pnpm dsh web
```

修改插件代码后，先重新执行 `npm run build` 或 `npm run verify`，再重启 DSH Web。因为本地安装使用的是 `link:` 包，通常不需要重复安装。

常用检查命令：

```sh
# 查看插件是否已经进入 web profile
pnpm dsh web --dump-config > /tmp/dsh-web-config.txt
grep -n "stock-mentions" /tmp/dsh-web-config.txt

# 单独运行测试、构建和包校验
npm test
npm run build
npm run verify:package
```

注意：`npm install` 和 `npm run verify` 要分开执行。将多个命令直接作为 `npm install` 的参数可能导致 npm 报 `edgesOut` 错误；如果系统没有 `rg`，可以使用上面的 `grep`。

## 功能

- 自动识别助手回答中的沪深普通 A 股名称和股票代码。
- 只有 Host 唯一确认的证券才会显示按钮，减少日期、金额和普通编号的误识别。
- 行情面板展示最新价、涨跌额/幅、最高、最低、开盘、市值、量比、换手率、成交额、成交量和昨收。
- 支持分时走势和最近 30 个交易日的前复权日 K 线。
- 支持个股资讯，默认显示最新 10 条。
- 面板默认宽度为 360px，与 DSH 详情栏的默认宽度保持一致；320px 以下自动切换为更紧凑的单列布局。
- 主题跟随 DSH，中文和英文由 DSH locale 注入。
- 数据请求由 Host 统一处理，包含超时、取消、缓存、响应校验和数据源降级。

## 识别范围

支持的代码示例：

```text
600519.SH
000001.SZ
688001.SH
```

也支持经过 Host 唯一确认的规范简称，例如“贵州茅台”“平安银行”。插件只接受沪深交易所普通 A 股，排除指数、基金、ETF、债券、B 股、北交所证券和板块代码。

插件不会解析以下内容：

- 用户消息、reasoning、工具结果和流式中的未完成文本；
- Markdown 链接、围栏代码块、数学公式和 HTML 字面量；
- 无法唯一确认的名称、代码或证券类型。

## 数据与安全

浏览器端不直接访问行情网站，而是通过版本化 `/stock-mentions` RPC channel 请求 Host 侧的归一化数据。Host 使用固定的公开数据源，包括东方财富、腾讯财经、新浪财经和同花顺，并按资源类型执行备用源切换。

- 不需要 API Key、Cookie、Authorization 或其他服务凭据。
- 浏览器只提交经过限制的候选证券和规范化 symbol。
- 不向上游发送完整助手原文、任意 URL 或用户凭据。
- 行情面板状态只保留在当前客户端会话，不写入对话日志。
- 插件只读，不提供交易、自选股、持仓或投资建议功能。

## 卸载

```sh
dsh plugin --profile web remove dsh-stock-mentions
```

## 开发校验

```sh
npm run verify
```

该命令会依次执行 TypeScript 检查、Vitest 测试、生产构建和 npm 包内容校验。

## 许可证

[MIT](LICENSE) © 2026 dsh-stock-mentions contributors
