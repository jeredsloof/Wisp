import { useEffect, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import AsciiRenderer from './components/AsciiRenderer'
import MusicParticles from './components/MusicParticles'
import SpotifyConnectOverlay from './components/SpotifyConnectOverlay'
import { useSpotifyAuth } from './spotify/useSpotifyAuth'
import { usePlaybackState } from './spotify/usePlaybackState'
import { usePlaybackPosition } from './spotify/usePlaybackPosition'
import { fetchAudioAnalysis, type CachedAnalysis } from './spotify/audioAnalysisCache'

function App() {
  const { status, errorMessage, login, getAccessToken } = useSpotifyAuth()
  const { deviceId, snapshot, error: playbackError } = usePlaybackState(getAccessToken, status === 'ready')
  const { getPositionMs, isPlaying, trackId } = usePlaybackPosition(snapshot)
  const [analysis, setAnalysis] = useState<CachedAnalysis | null>(null)
  const [asciiContainer, setAsciiContainer] = useState<HTMLDivElement | null>(null)

  useEffect(() => {
    if (!trackId) {
      setAnalysis(null)
      return
    }

    let cancelled = false
    fetchAudioAnalysis(trackId, getAccessToken).then((result) => {
      if (!cancelled) setAnalysis(result)
    })

    return () => {
      cancelled = true
    }
  }, [trackId, getAccessToken])

  return (
    <>
      <SpotifyConnectOverlay
        authStatus={status}
        authErrorMessage={errorMessage}
        deviceId={deviceId}
        isPlaying={isPlaying}
        playbackError={playbackError}
        analysisUnavailable={analysis === 'unavailable'}
        onLogin={login}
      />
      <div ref={setAsciiContainer} className="ascii-container" />
      {asciiContainer && (
        <Canvas
          camera={{ position: [3, 3, 3], fov: 50 }}
          style={{ position: 'fixed', inset: 0, visibility: 'hidden' }}
        >
          <ambientLight intensity={0.5} />
          <directionalLight position={[5, 5, 5]} intensity={1} />
          <MusicParticles analysis={analysis} getPositionMs={getPositionMs} isPlaying={isPlaying} />
          <AsciiRenderer container={asciiContainer} />
          <OrbitControls domElement={asciiContainer} />
        </Canvas>
      )}
    </>
  )
}

export default App
