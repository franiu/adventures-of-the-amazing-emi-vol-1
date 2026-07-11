/**
 * Tiny typed cookie wrapper — no dependencies, no server storage.
 * Values are JSON-encoded and URI-escaped, default expiry ~1 year.
 */
const ONE_YEAR = 60 * 60 * 24 * 365

export function readCookie<T>(name: string, fallback: T): T {
  if (typeof document === 'undefined') return fallback
  const match = document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
  if (!match) return fallback
  try {
    const raw = decodeURIComponent(match.slice(name.length + 1))
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

export function writeCookie<T>(name: string, value: T, maxAge = ONE_YEAR): void {
  if (typeof document === 'undefined') return
  const encoded = encodeURIComponent(JSON.stringify(value))
  document.cookie = `${name}=${encoded}; path=/; max-age=${maxAge}; SameSite=Lax`
}

export function deleteCookie(name: string): void {
  if (typeof document === 'undefined') return
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`
}
