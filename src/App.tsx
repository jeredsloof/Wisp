import WaveformVisualizer from './components/WaveformVisualizer'
import SpotifyConnectOverlay from './components/SpotifyConnectOverlay'
import { useSpotifyAuth } from './spotify/useSpotifyAuth'
import { usePlaybackState } from './spotify/usePlaybackState'
import { usePlaybackPosition } from './spotify/usePlaybackPosition'

function App() {
  const { status, errorMessage, login, getAccessToken } = useSpotifyAuth()
  const { deviceId, snapshot, error: playbackError } = usePlaybackState(getAccessToken, status === 'ready')
  const { isPlaying } = usePlaybackPosition(snapshot)

  return (
    <>
      <SpotifyConnectOverlay
        authStatus={status}
        authErrorMessage={errorMessage}
        deviceId={deviceId}
        isPlaying={isPlaying}
        playbackError={playbackError}
        onLogin={login}
      />
      <WaveformVisualizer />
    </>
  )
}

export default App
