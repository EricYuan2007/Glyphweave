# Security model

Authors and executable configuration are trusted. This local build tool is not a
server sandbox. See the root [security policy](../SECURITY.md) for private reporting.

The adapter validates URL protocols after removing ASCII controls and uses an
allowlist for HTML, MathML and static SVG. Only numeric Typst layout styles survive.
Scripts, event handlers, active SVG content and arbitrary author CSS do not pass.
Shiki highlighting and owned buttons run afterward as trusted transforms. Literal
paths in prose/code are allowed; resource URL paths are validated separately.

Asset real paths must remain inside the article assets directory and extensions
must be allowed. Source paths must remain inside their article. Output directories
must be project-local, non-overlapping with content and free of symlink aliases.
Clean additionally requires a matching ownership marker and an available build lock.

Public export follows the current index/manifests. Never deploy raw HTML, logs or
historical generations. Unlisted means undiscoverable through site listings, not
private. Previously downloaded public files cannot be recalled by rebuilding.

For hostile authors or online concurrent publication, add operating-system isolation,
resource quotas and a dedicated storage/deployment boundary. Realpath checks and
HTML sanitization do not provide that isolation.
