import type { SpotifyAuthStatus } from '../spotify/useSpotifyAuth'
import type { PlaybackError } from '../spotify/usePlaybackState'
import './SpotifyConnectOverlay.css'

interface SpotifyConnectOverlayProps {
  authStatus: SpotifyAuthStatus
  authErrorMessage: string | null
  deviceId: string | null
  isPlaying: boolean
  playbackError: PlaybackError | null
  analysisUnavailable: boolean
  onLogin: () => void
}

function playbackErrorMessage(error: PlaybackError): string {
  switch (error.kind) {
    case 'account_error':
      return 'Spotify Premium is required for in-browser playback.'
    case 'authentication_error':
      return 'Spotify authentication failed. Try reconnecting.'
    case 'initialization_error':
      return 'Could not initialize the Spotify player in this browser.'
    case 'playback_error':
      return `Playback error: ${error.message}`
  }
}

function SpotifyConnectOverlay({
  authStatus,
  authErrorMessage,
  deviceId,
  isPlaying,
  playbackError,
  analysisUnavailable,
  onLogin,
}: SpotifyConnectOverlayProps) {
  let message: string | null = null

  if (authStatus === 'logged-out') {
    message = null
  } else if (authStatus === 'authenticating') {
    message = 'Connecting to Spotify…'
  } else if (authStatus === 'error') {
    message = authErrorMessage ?? 'Something went wrong connecting to Spotify.'
  } else if (playbackError) {
    message = playbackErrorMessage(playbackError)
  } else if (!deviceId) {
    message = 'Loading player…'
  } else if (!isPlaying) {
    message = 'Open Spotify on your phone or desktop and switch playback to "Wisp".'
  } else if (analysisUnavailable) {
    message = 'No audio analysis available for this track.'
  }

  return (
    <div className="spotify-overlay">
      {authStatus === 'logged-out' && (
        <button type="button" className="spotify-overlay__button" onClick={onLogin}>
          Connect Spotify
        </button>
      )}
      {message && <p className="spotify-overlay__message">{message}</p>}
    </div>
  )
}

export default SpotifyConnectOverlay
