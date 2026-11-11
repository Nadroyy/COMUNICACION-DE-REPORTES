export const AUTH_TOKEN_KEYS = ['hostJwt', 'token', 'jwt', 'authToken']
export const AUTH_EMAIL_KEYS = ['userEmail', 'email']

export function readStorageValue(storage, keys) {
  if (!storage) return null

  for (const key of keys) {
    const value = storage.getItem(key)
    if (value) return value
  }

  return null
}

export function sanitizeAuthUrl(locationHref) {
  const url = new URL(locationHref)
  const fragmentParams = new URLSearchParams(url.hash.slice(1))

  url.searchParams.delete('token')
  url.searchParams.delete('email')
  fragmentParams.delete('token')
  fragmentParams.delete('email')

  url.hash = fragmentParams.toString() ? `#${fragmentParams}` : ''

  return `${url.pathname}${url.search}${url.hash}`
}

export function resolveAuthFromWindow(windowRef = globalThis.window) {
  const sessionStore = windowRef?.sessionStorage
  const localStore = windowRef?.localStorage

  const url = new URL(windowRef.location.href)
  const fragmentParams = new URLSearchParams(url.hash.slice(1))
  const tokenFromFragment = fragmentParams.get('token')?.split('?')[0]
  const tokenFromUrl = url.searchParams.get('token') || tokenFromFragment
  const emailFromUrl = url.searchParams.get('email') || fragmentParams.get('email')

  let token = tokenFromUrl || readStorageValue(sessionStore, AUTH_TOKEN_KEYS) || readStorageValue(localStore, AUTH_TOKEN_KEYS)
  let email = emailFromUrl || readStorageValue(localStore, AUTH_EMAIL_KEYS) || readStorageValue(sessionStore, AUTH_EMAIL_KEYS)

  if (!token && windowRef?.parent && windowRef.parent !== windowRef) {
    try {
      token = readStorageValue(windowRef.parent.sessionStorage, AUTH_TOKEN_KEYS) || readStorageValue(windowRef.parent.localStorage, AUTH_TOKEN_KEYS)
      email = email || readStorageValue(windowRef.parent.localStorage, AUTH_EMAIL_KEYS) || readStorageValue(windowRef.parent.sessionStorage, AUTH_EMAIL_KEYS)
    } catch {
      // Some embedded integrations may block access to the parent storage.
    }
  }

  return {
    token,
    email,
    shouldCleanupUrl: Boolean(tokenFromUrl || emailFromUrl),
    cleanUrl: sanitizeAuthUrl(windowRef.location.href)
  }
}
