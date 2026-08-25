# dsh-stock-mentions

Mention a stock name or code in a DSH conversation and it becomes a clickable button—click once to open quotes and company news in the right sidebar.

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com) [![npm version](https://img.shields.io/npm/v/dsh-stock-mentions.svg)](https://www.npmjs.com/package/dsh-stock-mentions) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![Node: >=22.19.0](https://img.shields.io/badge/Node-%3E%3D22.19.0-339933.svg)](https://nodejs.org)

[中文](README.md) | English

`dsh-stock-mentions` is a DeepSeek Harness plugin that extracts Shanghai and Shenzhen ordinary A-share names and codes from DSH output text, then renders confirmed stocks as accessible buttons. Click a button to open a market sidebar on the right side of DSH Web with a quote snapshot, intraday chart, the latest 30 trading days of daily K-lines, and company news.

## See it in action

<p align="center">
  <img src="https://raw.githubusercontent.com/mingzeng21/dsh-stock-mentions/main/docs/screenshots/sc1.png" width="49%" alt="Security buttons and market sidebar in light mode" />
  <img src="https://raw.githubusercontent.com/mingzeng21/dsh-stock-mentions/main/docs/screenshots/sc-2.png" width="49%" alt="Market sidebar showing company news in dark mode" />
</p>

<p align="center"><sub>Security extraction · Clickable buttons · Market sidebar · Theme follows DSH settings</sub></p>

## What it does

When DSH output text contains a stock name or code, the plugin:

1. finds the stock name or code in the DSH output text;
2. turns the confirmed stock into a clickable button;
3. opens the market sidebar when the button is clicked.

The sidebar presents the security name, market, latest price, change, high, low, open, market cap, volume ratio, turnover, amount, volume, previous close, intraday movement, daily K-lines, and company news in one compact view.

## Features

- **Automatic stock recognition** — Finds stock names and codes in DSH output text and adds accessible buttons at their original positions.
- **Click to view quotes** — Opens from the right side of DSH Web after a stock button is clicked, with quote data kept at the top.
- **Intraday and daily charts** — Uses a gradual area fill and right-side price axis for intraday data; daily K-lines cover the latest 30 trading days.
- **Company news** — Shows the latest 10 items with title, source, and publication time, with Chinese decoding and provider switching handled in the data layer.
- **Theme and locale** — Theme follows DSH settings; Chinese and English are provided through DSH `ctx.locale`.
- **Public data integration** — The Host owns public market requests, response validation, timeouts, cancellation, caching, and provider fallback; no API key is required.

## How it works

```text
DSH output text
          │
          ▼
Extract candidates → Host confirms security
          │
          ▼
Security button → Click to open market sidebar
          │
          ▼
Quote · Intraday · Daily K-line · News
```

The browser client receives normalized data through the `/stock-mentions` RPC channel. Security resolution and market-data adapters live in an independent Host-side data layer.

## Install

Install the plugin from the [npm package page](https://www.npmjs.com/package/dsh-stock-mentions):

```sh
dsh plugin add dsh-stock-mentions
```

## Update

Run the same `add` command to get the latest version:

```sh
dsh plugin add dsh-stock-mentions
```

Restart the Harness (`dsh web`) or refresh the DSH Web UI after updating.

## Uninstall

```sh
dsh plugin remove dsh-stock-mentions
```

## Data and security

- Processes Shanghai and Shenzhen ordinary A-share codes and official short names from DSH output text.
- Sends market requests only after the Host confirms a security candidate.
- Keeps request constraints and response validation in the Host data layer.
- Keeps market-panel state in the current client session instead of the conversation log.
- Requires no API key, cookie, authorization header, or other service credentials.

## Requirements

- [DeepSeek Harness](https://github.com/deepseek-ai/dsh) (`dsh`)
- Node.js ≥ 22.19.0

## License

[MIT](LICENSE) © 2026 dsh-stock-mentions contributors
