# dsh-stock-mentions

你在 DSH 对话中提到的股票名称或股票代码，会自动变成可点击按钮——点一下，行情和资讯就在右侧侧边栏展开。

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com) [![npm version](https://img.shields.io/npm/v/dsh-stock-mentions.svg)](https://www.npmjs.com/package/dsh-stock-mentions) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![Node: >=22.19.0](https://img.shields.io/badge/Node-%3E%3D22.19.0-339933.svg)](https://nodejs.org)

中文 | [English](README.en.md)

`dsh-stock-mentions` 是一个 DeepSeek Harness 插件。它会从已完成的助手回复中识别沪深普通 A 股的股票名称和股票代码，把识别到的内容直接变成可访问按钮。点击按钮后，DSH Web 右侧会展开行情侧边栏，展示报价概览、分时图、最近 30 个交易日的日 K 线和个股资讯。

## 先看效果

<p align="center">
  <img src="https://raw.githubusercontent.com/mingzeng21/dsh-stock-mentions/main/docs/screenshots/sc1.png" width="49%" alt="白天模式下，证券按钮和行情侧边栏" />
  <img src="https://raw.githubusercontent.com/mingzeng21/dsh-stock-mentions/main/docs/screenshots/sc-2.png" width="49%" alt="黑夜模式下，行情侧边栏展示个股资讯" />
</p>

<p align="center"><sub>证券提取 · 可点击按钮 · 行情侧边栏 · 白天与黑夜主题</sub></p>

## 它能帮你做什么

只要助手在 DSH 对话中提到股票名称或股票代码，插件就会自动完成：

1. 找到回复里的股票名称和股票代码；
2. 将确认后的内容变成可点击按钮；
3. 点击按钮，在右侧侧边栏查看这只股票的行情和资讯。

侧边栏集中展示证券名称、市场、最新价、涨跌、最高、最低、开盘、市值、量比、换手率、成交额、成交量、昨收、分时走势、日 K 线和个股资讯。

## 特性

- **自动识别股票** —— 自动识别已完成助手回复中的股票名称和股票代码，并在原文位置提供可访问按钮。
- **点击查看行情** —— 点击股票按钮后，从 DSH Web 右侧展开面板，报价信息固定在顶部。
- **分时与日 K** —— 分时图使用渐进色面积和右侧价格轴；日 K 展示最近 30 个交易日。
- **个股资讯** —— 展示最新 10 条资讯，包含标题、来源和发布时间，并处理中文编码与数据源切换。
- **主题与语言** —— 跟随 DSH 白天/黑夜主题，通过 DSH `ctx.locale` 支持中文和英文。
- **公开数据接入** —— Host 侧统一处理公开行情接口、响应校验、超时、取消、缓存和数据源降级，无需配置 API Key。

## 工作原理

```text
已完成的助手回复
        │
        ▼
提取证券候选 → Host 确认证券
        │
        ▼
证券提及按钮 → 点击打开行情侧边栏
        │
        ▼
报价 · 分时 · 日 K · 资讯
```

浏览器端通过 `/stock-mentions` RPC channel 获取 Host 侧归一化后的数据，证券解析和行情数据适配集中在独立的数据层中。

## 安装

从 npm 安装插件：

```sh
dsh plugin add dsh-stock-mentions
```

## 更新

重新执行 `add` 命令即可获取最新版：

```sh
dsh plugin add dsh-stock-mentions
```

更新后重启 Harness（`dsh web`）或刷新 DSH Web UI。

## 卸载

```sh
dsh plugin remove dsh-stock-mentions
```

## 数据与安全

- 只处理已完成助手回复中的沪深普通 A 股证券代码和规范简称。
- 证券候选经过 Host 确认后才会进入行情请求。
- 请求参数经过限制和响应校验，数据源由 Host 统一管理。
- 行情面板状态保留在当前会话的客户端状态中，不写入会话日志。
- 不需要 API Key、Cookie、Authorization 或其他服务凭据。

## 环境要求

- [DeepSeek Harness](https://github.com/deepseek-ai/dsh)（`dsh`）
- Node.js ≥ 22.19.0

## 许可证

[MIT](LICENSE) © 2026 dsh-stock-mentions contributors
