# DSH v0.1.2-alpha.3 compatibility assessment

Date: 2026-09-01

Compared the plugin with the local `deepseek-harness` checkout at commit
`dd6322d604` (the commit referenced by the official release), the previous
`dsh-v0.1.2-alpha.2` tag, and the
[official alpha.3 release notes](https://github.com/deepseek-ai/deepseek-harness/releases/tag/dsh-v0.1.2-alpha.3).

## Verdict

Alpha.3 does not introduce a new direct break for the plugin beyond the
alpha.1 migration already implemented. The plugin's current dependency ranges
(`^0.1.2-alpha.1`) cover the alpha.3 package family. The plugin now also uses
alpha.3's finalized assistant action slot as a compatibility entry point.

The remaining limitation is that alpha.3 still does not provide or consume the
plugin's generic `chatTextAnnotations` service, so stock mentions are not
rendered inline in the shipped DSH UI. They are now actionable from the
finalized assistant action row.

## Alpha.3 changes relevant to this plugin

### No new annotation seam

In the alpha.3 checkout, `ui-chat` still renders `MarkdownText` directly, and
`MarkdownText` still accepts text, streaming, labels, and file mentions only.
`chatTextAnnotations` and `MarkdownTextAnnotation` are absent from the current
client source.

The alpha.3 Markdown change uses source offsets as stable React block keys. It
does not add an annotation input and does not reconnect the plugin provider.
Evidence: [AssistantMarkdown](/Users/admin/Mingdom/deepseek-harness/packages/client/ui-chat/src/client/chat/AssistantMarkdown.tsx:50),
[MarkdownText](/Users/admin/Mingdom/deepseek-harness/packages/client/ui-primitives/src/markdown/MarkdownText.tsx:161).

### RPC remains compatible

The alpha.3 connection changes concern generation readiness and retry behavior;
the two-argument `HostConnectionRpc.handle(channel, handler)` contract remains
unchanged. The plugin's alpha.1 migration removing the old authority option is
still correct.
Evidence: [HostConnectionRpc](/Users/admin/Mingdom/deepseek-harness/packages/client/connection/src/rpc.ts:133).

### Overlay remains compatible

`shell.overlay` remains a root list slot rendered by `ui-layout`. Alpha.3's
long-conversation and turn-navigation changes do not alter the plugin's overlay
registration. The plugin now anchors the overlay to the viewport's right edge
and uses a 360px default width, matching alpha.3's `DETAILS_DEFAULT`; its
content switches to a single-column quote layout below 320px via a container
query. This avoids coupling the stock panel to the left sidebar's width and
prevents the old 420px panel from overwhelming the narrow DSH layout.
Evidence: [ui-layout slot declaration](/Users/admin/Mingdom/deepseek-harness/packages/client/ui-layout/src/client/index.ts:86),
[plugin overlay registration](/Users/admin/Mingdom/dsh-stock-mentions/src/client/index.ts:41).

### Other release changes

The release improves long-conversation paging/rendering, image delivery and
connection-stall handling, and removes the optional SQLite Session persistence
backend. The plugin does not use SQLite persistence, session persistence APIs,
or image delivery, so these changes do not require plugin code changes.

## Recommendation

1. Keep the current plugin compatibility migration and dependency ranges.
2. A plugin release containing the alpha.3 action-row fallback can be published
   after local browser verification, but it must not claim that inline stock
   annotations are restored.
3. The next functional change should be coordinated with an upstream DSH
   generic Markdown annotation contract in `ui-chat`/`ui-primitives`.
