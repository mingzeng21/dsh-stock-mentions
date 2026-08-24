# Keep the stock-mentions data layer standalone

`dsh-stock-mentions` owns its own security resolution, public-data adapters, normalization, caching, request control, RPC contract and client panel. It may copy or adapt implementation ideas from `dsh-stock-market`, but it must not import, inject, register against, or share runtime contracts with that plugin because the two products have independent lifecycles and boundaries.

The plugin remains UI-only: it does not register Agent stock tools, does not send arbitrary upstream URLs from the browser, and does not require user credentials for its initial public-source providers. Provider failures are isolated to the affected panel resource and are reported with source and degradation metadata.
