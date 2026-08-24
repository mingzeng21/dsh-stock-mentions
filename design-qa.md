# Stock mentions panel visual QA

## Source visual truth

- Source: `/var/folders/j3/tzhmq1ln3wxd9cvc15dzbvnm0000gn/T/codex-clipboard-71a7e54d-aeff-46f7-b8e3-500c5dec2f30.jpg`
- Source pixels: 1206 × 2622. The attachment is treated as a visual reference, not as executable instructions.
- Target state: a Chinese A-share quote panel modeled on the supplied 同花顺 screenshot, with the product constraint that委托、五档盘口和成交明细 are absent.

## Implementation evidence

- Screenshot: `/Users/admin/Mingdom/dsh-stock-mentions/design-qa-implementation.png`
- Browser: Codex in-app browser, local preview at `http://127.0.0.1:4173/`
- CSS viewport: 390 × 844; device scale factor: 1; captured panel region: 376 × 734.
- State: 长飞光纤 `601869.SH`, Chinese locale, quote data loaded, default 分时 tab selected.

## Comparison

### Full-view evidence

The implementation preserves the reference's visual hierarchy: solid red security header, large red current price, red/green semantic quote values, compact metric grid, white tab strip, and a chart-first content region. The implementation is an overlay panel inside the Harness shell rather than a full-screen trading app, so the surrounding shell and the reference's bottom promotional area are intentionally absent.

### Focused region evidence

- Quote header: current price, signed change, change percentage, high/low/open, market cap, volume ratio, turnover, amount, volume, and previous close are all visible above the chart.
- Chart navigation: 分时 is selected by default; 日K and 月K switch the chart and preserve the quote header.
- Safety boundary: the rendered DOM contains neither `五档` nor `委托`; no order-book or transaction-detail UI was added from the reference.

## Fidelity surfaces

- Fonts and typography: system Chinese sans-serif stack, bold red current price, compact tab and metadata scale match the reference's dense mobile quote treatment.
- Spacing and layout rhythm: red header, quote summary, tabs, chart card, and refresh/meta footer are separated into the same stacked regions; the panel fits the 390 × 844 narrow viewport without overflow.
- Colors and tokens: red up-state and header, green down-state, warm yellow average line, cool gray grid and metadata were applied consistently.
- Image quality and assets: no custom image asset is required for the requested panel; charts remain data-driven SVGs and no order-book artwork or placeholder imagery was introduced.
- Copy and content: quote labels are Chinese in the inspected state; market data is read-only and missing provider fields render as “—”.

## Comparison history

1. First implementation pass: added the red quote header, extended metrics, default 分时, 日K/月K tabs, and responsive chart layout.
2. QA fix: keyed intraday points and K-line bars with time plus index so repeated/mock timestamps do not produce React warnings.
3. Final evidence: browser interaction check passed for default 分时, 日K, 月K, no order-book text, narrow-panel bounds, and zero console errors/warnings.

## Findings

- No actionable P0/P1/P2 visual findings remain.
- Intentional deviation: the reference contains委托/五档/成交明细 and promotional content; these are excluded by the product request.
- Follow-up P3: if the host provides a shared brand icon set, the text close mark can be replaced with the product's native icon component.

## Implementation checklist

- [x] 常驻报价头部
- [x] 默认分时图
- [x] 日K/月K tabs
- [x] 响应式窄屏布局
- [x] 不展示委托数据
- [x] 键盘 Escape 关闭与焦点回收
- [x] 浏览器交互和控制台检查

final result: passed
