# dsh-stock-mentions

Recognize Shanghai and Shenzhen ordinary A-share names and codes in DeepSeek Harness (DSH) assistant replies, then expose confirmed stocks as clickable buttons in the assistant action row. Clicking a button opens a market panel with quotes, intraday data, daily K-lines, and company news.

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com) [![npm version](https://img.shields.io/npm/v/dsh-stock-mentions.svg)](https://www.npmjs.com/package/dsh-stock-mentions) [![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE) [![Node: >=22.19.0](https://img.shields.io/badge/Node-%3E%3D22.19.0-339933.svg)](https://nodejs.org)

[中文](README.md) | English

> Current target: DSH `v0.1.2-alpha.3`. This DSH release does not yet expose a generic Markdown text-annotation entry point, so stock buttons currently appear in the action row of a finalized assistant answer rather than at the original text position. Inline buttons can return after DSH adds that extension point.

## Screenshots

<p align="center">
  <img src="https://raw.githubusercontent.com/mingzeng21/dsh-stock-mentions/main/docs/screenshots/sc1.png" width="49%" alt="Stock button and market panel in light mode" />
  <img src="https://raw.githubusercontent.com/mingzeng21/dsh-stock-mentions/main/docs/screenshots/sc-2.png" width="49%" alt="Company news panel in dark mode" />
</p>

## Quick start

### Requirements

- [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) `v0.1.2-alpha.3` or a compatible `0.1.2-alpha` release
- Node.js `>=22.19.0`
- An initialized DSH `web` profile

### Install

Install the plugin into the Web profile with the DSH CLI:

```sh
dsh plugin --profile web add dsh-stock-mentions
dsh web
```

If DSH Web is already running, stop and restart `dsh web` after installing or updating, then refresh the browser page.

### Verify the feature

Ask the assistant to include a clear stock name or code, for example:

```text
请简要介绍贵州茅台（600519.SH）的主营业务，并列出需要关注的风险。
```

After the answer finishes, find the “贵州茅台” button in the action row below the answer. Click it to open the market panel on the right.

## Local development and testing

This repository has no standalone development server. Validate the UI through the DSH Web host.

Install dependencies and run the complete verification from the plugin directory:

```sh
cd /path/to/dsh-stock-mentions
npm install
npm run verify
```

Test the plugin with a DSH checkout running from source:

```sh
cd /path/to/deepseek-harness
pnpm dsh plugin --profile web add /path/to/dsh-stock-mentions
pnpm dsh web
```

After changing plugin code, run `npm run build` or `npm run verify`, then restart DSH Web. A local install uses a `link:` package, so reinstalling is usually unnecessary.

Useful checks:

```sh
# Confirm that the plugin is in the web profile
pnpm dsh web --dump-config > /tmp/dsh-web-config.txt
grep -n "stock-mentions" /tmp/dsh-web-config.txt

# Run tests, build, or package verification separately
npm test
npm run build
npm run verify:package
```

Run `npm install` and `npm run verify` as separate commands. Passing multiple commands directly as `npm install` arguments can produce npm’s `edgesOut` error. If `rg` is not installed, use `grep` as shown above.

## Features

- Recognizes Shanghai and Shenzhen ordinary A-share names and codes in finalized assistant replies.
- Shows a button only after the Host uniquely confirms the security, reducing false matches for dates, amounts, and ordinary numbers.
- Displays latest price, change, high, low, open, market cap, volume ratio, turnover, amount, volume, and previous close.
- Supports intraday movement and daily K-lines for the latest 30 trading days, using adjusted daily data.
- Shows the latest 10 company-news items by default.
- Uses a 360px default panel width to match DSH’s details-column default; below 320px it switches to a compact single-column layout.
- Follows DSH theme settings and receives Chinese/English strings through DSH locale injection.
- Keeps timeouts, cancellation, caching, response validation, and provider fallback in the Host data layer.

## Recognition scope

Supported code formats include:

```text
600519.SH
000001.SZ
688001.SH
```

Official short names are also supported after unique Host confirmation, such as “贵州茅台” and “平安银行”. The plugin accepts ordinary A-shares listed in Shanghai or Shenzhen and excludes indices, funds, ETFs, bonds, B-shares, Beijing-listed securities, and sector codes.

The plugin does not parse:

- user messages, reasoning, tool results, or unfinished streaming text;
- Markdown links, fenced code blocks, math expressions, or literal HTML;
- names, codes, or security types that cannot be uniquely confirmed.

## Data and security

The browser client does not call market-data websites directly. It requests normalized data from the Host through the versioned `/stock-mentions` RPC channel. The Host uses fixed public providers, including Eastmoney, Tencent Finance, Sina Finance, and Tonghuashun, with resource-specific fallback order.

- No API key, cookie, authorization header, or other service credential is required.
- The browser submits only constrained candidates and normalized symbols.
- The full assistant reply, arbitrary URLs, and user credentials are not sent upstream.
- Market-panel state stays in the current client session and is not written to the conversation log.
- The plugin is read-only: it does not trade, manage watchlists or positions, or provide investment advice.

## Uninstall

```sh
dsh plugin --profile web remove dsh-stock-mentions
```

## Development verification

```sh
npm run verify
```

This runs TypeScript checks, the Vitest suite, the production build, and npm package validation.

## License

[MIT](LICENSE) © 2026 dsh-stock-mentions contributors
