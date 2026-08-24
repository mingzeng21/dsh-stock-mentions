# Add a generic settled-Markdown annotation extension

Stock mentions use a generic pure-data annotation input on `MarkdownText`, with `ui-conversation` supplying annotations for settled assistant text and the plugin supplying the resolver and activation behavior. `ui-primitives` remains Cordis-free and owns safe range splitting, exclusion of links/code/math/HTML, button semantics and keyboard behavior.

The alternative of adding a stock-specific renderer, scanning generated DOM, or reusing file mentions would duplicate or distort existing responsibilities. The extension is asynchronous outside React render: the first settled render remains ordinary text, and resolved annotations cause a later render without modifying the stored Markdown.
