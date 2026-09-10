# DSH v0.1.5-alpha.1 compatibility assessment

Date: 2026-09-09

Compared this plugin with the local `deepseek-harness` checkout at tag
`dsh-v0.1.5-alpha.1`, the latest tag listed by the official repository.

## Verdict

The Host RPC registration needs one compatibility fix: the plugin must inject
both `connection` and `webServer`.

Current DSH keeps `connection.rpc` carrier-neutral, but a standalone RPC
channel is registered through the owning Context's `webServer`. A plugin that
only injects `connection` therefore fails during loader composition with:

```text
cannot get property "webServer" without inject
```

The client-side `shell.overlay` and assistant action slots used by this plugin
are still present in the current Web UI, so no further client seam change is
required for this release. Stock buttons remain in the finalized assistant
action row because DSH still does not expose a generic inline Markdown
annotation entry point.

## Compatibility boundary

The package targets the DSH `0.1.5-alpha.1` package family. The published Host
bundle must be rebuilt after changing `src/index.ts`; DSH loads `lib/index.js`,
not TypeScript source files.

The required Host declaration is:

```ts
export const inject = ['connection', 'webServer']
```

The route remains authenticated by DSH's Connection transport. The plugin does
not register a second HTTP server or bypass the Connection trust boundary.
