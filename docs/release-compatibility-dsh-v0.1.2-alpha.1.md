# DSH v0.1.2-alpha.1 compatibility assessment

Date: 2026-08-30

Compared the plugin against the local `deepseek-harness` checkout at tag
`dsh-v0.1.2-alpha.1`, with the previous baseline `dsh-v0.1.1-rc.2`, and the
[official release notes](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.1).

## Verdict

The release affects this plugin materially. A compatibility-only update is
required, and the stock-mention feature also needs a new integration seam.
The existing panel overlay is still structurally compatible, but the current
annotation integration is no longer connected to DSH's renderer.

## Findings

### High impact: stock annotations have no current consumer

The plugin provides `chatTextAnnotations` and implements
`MarkdownTextAnnotation` through `@deepseek-ai/dsh-client-ui-conversation` and
`@deepseek-ai/dsh-client-ui-primitives`. In the release checkout:

- `chatTextAnnotations`, `ChatTextAnnotations`, and
  `MarkdownTextAnnotation` are absent from the client source.
- `ui-chat`'s `AssistantMarkdown` renders `MarkdownText` directly.
- `MarkdownText` accepts text, streaming, labels, and file mentions, but no
  generic annotation input.

Therefore the plugin can appear loaded while stock mention buttons are never
rendered. Rebuilding from source should also fail because the old types and
runtime package imports no longer resolve.

### Medium impact: client runtime was split and renamed

The old `@deepseek-ai/dsh-client-runtime` package was removed. Session types
now come from `@deepseek-ai/dsh-session/types`; session UI services live under
`@deepseek-ai/dsh-client-ui-session`.

The plugin still references the removed runtime package in its source,
`dsh.client.inject`, and `tsdown.config.ts`.

### Medium impact: Host RPC registration changed

The release's `HostConnectionRpc.handle` accepts only `(channel, handler)`.
The plugin still passes `{ authority: 'trusted-host' }` as a third argument.
The new connection layer authenticates the transport centrally, so the third
argument should be removed.

### Low impact: overlay contract remains valid

`ui-layout` still exposes `shell.overlay` as a root list slot and renders it in
the frame. The plugin's overlay registration remains the right mounting
direction. The panel CSS references `--dsh-sidebar-width`, which is not defined
by the current harness source; this should be checked during visual smoke
testing rather than treated as a release blocker.

## Recommended work

1. Update the compatibility layer: import `SessionId` from
   `@deepseek-ai/dsh-session/types`, replace the deleted runtime metadata with
   current packages, remove the RPC authority option, and update peer/dev
   dependency ranges to the `0.1.2-alpha.1` package family.
2. Do not ship the current annotation code as a functional migration. Add or
   request an upstream generic Markdown annotation contract in the new
   `ui-chat`/`ui-primitives` split, then adapt the plugin to that contract.
   Replacing the built-in `assistant-step` renderer from the plugin would be a
   more fragile fallback.
3. Add a current-tag compatibility test that typechecks the plugin against the
   harness packages and exercises an authenticated stock RPC round trip.
4. Add a browser smoke check for settled assistant text, streaming text,
   session switching, panel open/close, and the overlay's right edge.

The release's API proxy migration, Web UI launch token, and WebFetch default do
not directly affect this plugin's Host RPC/data-source path, subject to the
normal DSH web authentication flow.
