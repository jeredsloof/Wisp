import { generateCodeChallenge, generateCodeVerifier, generateState } from './pkce'
import { clearTokens, loadTokens, saveTokens } from './tokenStore'
import type { SpotifyTokens } from './types'

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SCOPES = 'streaming user-read-email user-read-private'

const VERIFIER_KEY = 'wisp.spotify.pkce_verifier'
const STATE_KEY = 'wisp.spotify.pkce_state'

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID
const REDIRECT_URI = import.meta.env.VITE_SPOTIFY_REDIRECT_URI

const EXPIRY_REFRESH_BUFFER_MS = 60_000

export async function redirectToSpotifyAuthorize(): Promise<void> {
  const verifier = generateCodeVerifier()
  const challenge = await generateCodeChallenge(verifier)
  const state = generateState()

  sessionStorage.setItem(VERIFIER_KEY, verifier)
  sessionStorage.setItem(STATE_KEY, state)

  const params = new URLSearchParams({
    response_type: 'code',
    client_id: CLIENT_ID,
    scope: SCOPES,
    redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256',
    code_challenge: challenge,
    state,
  })

  window.location.assign(`${AUTHORIZE_URL}?${params.toString()}`)
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

async function exchangeCodeForTokens(code: string, verifier: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    client_id: CLIENT_ID,
    code_verifier: verifier,
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new Error(`Spotify token exchange failed: ${response.status}`)
  }

  const data = (await response.json()) as TokenResponse
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? '',
    expiresAt: Date.now() + data.expires_in * 1000,
  }
}

export type CallbackResult = 'ok' | 'no-callback' | 'error'

export async function handleRedirectCallback(): Promise<CallbackResult> {
  const url = new URL(window.location.href)
  const code = url.searchParams.get('code')
  const returnedState = url.searchParams.get('state')
  const error = url.searchParams.get('error')

  if (!code && !error) {
    return 'no-callback'
  }

  const expectedState = sessionStorage.getItem(STATE_KEY)
  const verifier = sessionStorage.getItem(VERIFIER_KEY)
  sessionStorage.removeItem(STATE_KEY)
  sessionStorage.removeItem(VERIFIER_KEY)

  history.replaceState(null, '', window.location.pathname)

  if (error || !code || !verifier || !returnedState || returnedState !== expectedState) {
    return 'error'
  }

  try {
    const tokens = await exchangeCodeForTokens(code, verifier)
    saveTokens(tokens)
    return 'ok'
  } catch {
    return 'error'
  }
}

export async function refreshTokens(refreshToken: string): Promise<SpotifyTokens> {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: CLIENT_ID,
  })

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  })

  if (!response.ok) {
    throw new Error(`Spotify token refresh failed: ${response.status}`)
  }

  const data = (await response.json()) as TokenResponse
  const tokens: SpotifyTokens = {
    accessToken: data.access_token,
    refreshToken: data.refresh_token ?? refreshToken,
    expiresAt: Date.now() + data.expires_in * 1000,
  }
  saveTokens(tokens)
  return tokens
}

export async function getValidAccessToken(): Promise<string> {
  const tokens = loadTokens()
  if (!tokens) {
    throw new Error('Not authenticated with Spotify')
  }

  if (tokens.expiresAt - Date.now() > EXPIRY_REFRESH_BUFFER_MS) {
    return tokens.accessToken
  }

  try {
    const refreshed = await refreshTokens(tokens.refreshToken)
    return refreshed.accessToken
  } catch (err) {
    clearTokens()
    throw err
  }
}

export function logout(): void {
  clearTokens()
}
