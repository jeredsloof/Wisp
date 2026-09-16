import WaveformVisualizer from './components/WaveformVisualizer'
import { useSpotifyAuth } from './spotify/useSpotifyAuth'
import { usePlaybackState } from './spotify/usePlaybackState'
import { usePlaybackPosition } from './spotify/usePlaybackPosition'

function App() {
  const { status, errorMessage, login, getAccessToken } = useSpotifyAuth()
  const { deviceId, snapshot, error: playbackError } = usePlaybackState(getAccessToken, status === 'ready')
  const { isPlaying } = usePlaybackPosition(snapshot)

  return (
    <WaveformVisualizer
      spotifyAuthStatus={status}
      spotifyAuthErrorMessage={errorMessage}
      spotifyDeviceId={deviceId}
      spotifyIsPlaying={isPlaying}
      spotifyPlaybackError={playbackError}
      onSpotifyLogin={login}
    />
  )
}

export default App
