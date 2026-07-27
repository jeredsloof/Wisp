import { useCallback, useEffect, useRef, useState } from 'react'
import { getValidAccessToken, handleRedirectCallback, logout, redirectToSpotifyAuthorize } from './auth'
import { loadTokens } from './tokenStore'

export type SpotifyAuthStatus = 'logged-out' | 'authenticating' | 'ready' | 'error'

export function useSpotifyAuth() {
  const [status, setStatus] = useState<SpotifyAuthStatus>('authenticating')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const initialized = useRef(false)

  useEffect(() => {
    if (initialized.current) return
    initialized.current = true

    handleRedirectCallback().then((result) => {
      if (result === 'error') {
        setStatus('error')
        setErrorMessage('Spotify sign-in failed. Please try again.')
        return
      }

      setStatus(loadTokens() ? 'ready' : 'logged-out')
    })
  }, [])

  const login = useCallback(() => {
    setStatus('authenticating')
    void redirectToSpotifyAuthorize()
  }, [])

  const handleLogout = useCallback(() => {
    logout()
    setStatus('logged-out')
  }, [])

  const getAccessToken = useCallback(() => getValidAccessToken(), [])

  return { status, errorMessage, login, logout: handleLogout, getAccessToken }
}
