import type { SpotifyTokens } from './types'

const STORAGE_KEY = 'wisp.spotify.tokens'

let cachedTokens: SpotifyTokens | null = null

export function saveTokens(tokens: SpotifyTokens): void {
  cachedTokens = tokens
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(tokens))
}

export function loadTokens(): SpotifyTokens | null {
  if (cachedTokens) return cachedTokens

  const raw = sessionStorage.getItem(STORAGE_KEY)
  if (!raw) return null

  cachedTokens = JSON.parse(raw) as SpotifyTokens
  return cachedTokens
}

export function clearTokens(): void {
  cachedTokens = null
  sessionStorage.removeItem(STORAGE_KEY)
}
