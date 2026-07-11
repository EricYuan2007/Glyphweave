function normalizedBase(basePath: string): string {
  if (!basePath || basePath === '/') return ''
  return `/${basePath.replace(/^\/+|\/+$/g, '')}`
}

export function sitePath(pathname: string, basePath: string): string {
  if (/^(?:[a-z]+:|\/\/|#)/i.test(pathname)) return pathname
  const base = normalizedBase(basePath)
  if (pathname === '/') return `${base}/`
  return `${base}/${pathname.replace(/^\/+/, '')}`
}

export function withoutSiteBase(pathname: string, basePath: string): string {
  const base = normalizedBase(basePath)
  if (!base || pathname === base) return pathname === base ? '/' : pathname
  return pathname.startsWith(`${base}/`) ? pathname.slice(base.length) : pathname
}
