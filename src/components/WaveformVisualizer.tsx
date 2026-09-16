import { useEffect, useRef, useState } from 'react'
import type { SpotifyAuthStatus } from '../spotify/useSpotifyAuth'
import type { PlaybackError } from '../spotify/usePlaybackState'
import './WaveformVisualizer.css'

type SourceLabel = { kind: 'file'; name: string } | { kind: 'spotify-tab' } | null
type VisualMode = 'waveform' | 'ascii'
type AsciiStyle = 'classic' | 'blocks' | 'matrix' | 'binary'

const ASCII_CHARSETS: Record<AsciiStyle, string> = {
  classic: ' .:-=+*#%@',
  blocks: ' ░▒▓█',
  matrix: ' .:+*#@01$&',
  binary: ' 01',
}

const ASCII_STYLE_LABELS: Record<AsciiStyle, string> = {
  classic: 'Classic',
  blocks: 'Blocks',
  matrix: 'Matrix',
  binary: 'Binary',
}

const supportsTabCapture = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia

interface WaveformVisualizerProps {
  spotifyAuthStatus: SpotifyAuthStatus
  spotifyAuthErrorMessage: string | null
  spotifyDeviceId: string | null
  spotifyIsPlaying: boolean
  spotifyPlaybackError: PlaybackError | null
  onSpotifyLogin: () => void
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

function WaveformVisualizer({
  spotifyAuthStatus,
  spotifyAuthErrorMessage,
  spotifyDeviceId,
  spotifyIsPlaying,
  spotifyPlaybackError,
  onSpotifyLogin,
}: WaveformVisualizerProps) {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const fileSourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const captureSourceRef = useRef<MediaStreamAudioSourceNode | null>(null)
  const captureStreamRef = useRef<MediaStream | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [source, setSource] = useState<SourceLabel>(null)
  const [captureError, setCaptureError] = useState<string | null>(null)
  const [mode, setMode] = useState<VisualMode>('waveform')
  const [asciiStyle, setAsciiStyle] = useState<AsciiStyle>('classic')
  const [cellSize, setCellSize] = useState(14)
  const [asciiColor, setAsciiColor] = useState('#39ff14')

  const modeRef = useRef(mode)
  const asciiStyleRef = useRef(asciiStyle)
  const cellSizeRef = useRef(cellSize)
  const asciiColorRef = useRef(asciiColor)

  useEffect(() => {
    modeRef.current = mode
  }, [mode])
  useEffect(() => {
    asciiStyleRef.current = asciiStyle
  }, [asciiStyle])
  useEffect(() => {
    cellSizeRef.current = cellSize
  }, [cellSize])
  useEffect(() => {
    asciiColorRef.current = asciiColor
  }, [asciiColor])

  const ensureAudioContext = () => {
    if (audioCtxRef.current) return audioCtxRef.current

    const audioCtx = new AudioContext()
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048

    audioCtxRef.current = audioCtx
    analyserRef.current = analyser
    return audioCtx
  }

  const stopCapture = () => {
    captureSourceRef.current?.disconnect()
    captureSourceRef.current = null
    captureStreamRef.current?.getTracks().forEach((track) => track.stop())
    captureStreamRef.current = null
  }

  const ensureFileSource = () => {
    const audio = audioRef.current
    const audioCtx = ensureAudioContext()
    if (!audio || fileSourceRef.current) return

    const source = audioCtx.createMediaElementSource(audio)
    source.connect(analyserRef.current!)
    analyserRef.current!.connect(audioCtx.destination)
    fileSourceRef.current = source
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !audioRef.current) return

    stopCapture()
    setCaptureError(null)

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }

    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setSource({ kind: 'file', name: file.name })
    audioRef.current.src = url
    audioRef.current.play()
  }

  const startSpotifyCapture = async () => {
    setCaptureError(null)
    audioRef.current?.pause()

    try {
      const audioCtx = ensureAudioContext()
      await audioCtx.resume()

      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true })
      const audioTracks = stream.getAudioTracks()

      if (audioTracks.length === 0) {
        stream.getTracks().forEach((track) => track.stop())
        setCaptureError('No audio was shared. Pick "This Tab" and check "Share tab audio".')
        return
      }

      stream.getVideoTracks().forEach((track) => track.stop())
      stopCapture()

      const audioOnlyStream = new MediaStream(audioTracks)
      const captureSource = audioCtx.createMediaStreamSource(audioOnlyStream)
      captureSource.connect(analyserRef.current!)

      captureSourceRef.current = captureSource
      captureStreamRef.current = stream
      setSource({ kind: 'spotify-tab' })

      audioTracks[0].addEventListener('ended', () => {
        stopCapture()
        setSource((current) => (current?.kind === 'spotify-tab' ? null : current))
      })
    } catch {
      setCaptureError('Tab audio capture was not permitted, or is unsupported in this browser.')
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }
    resize()
    window.addEventListener('resize', resize)

    let rafId: number

    const drawWaveform = (
      ctx: CanvasRenderingContext2D,
      analyser: AnalyserNode,
      width: number,
      height: number,
    ) => {
      const bufferLength = analyser.fftSize
      const dataArray = new Uint8Array(bufferLength)
      analyser.getByteTimeDomainData(dataArray)

      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgb(0, 255, 0)'
      ctx.beginPath()

      const sliceWidth = width / bufferLength
      let x = 0

      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0
        const y = (v * height) / 2

        if (i === 0) {
          ctx.moveTo(x, y)
        } else {
          ctx.lineTo(x, y)
        }

        x += sliceWidth
      }

      ctx.lineTo(width, height / 2)
      ctx.stroke()
    }

    const drawAscii = (
      ctx: CanvasRenderingContext2D,
      analyser: AnalyserNode,
      width: number,
      height: number,
    ) => {
      const cell = Math.max(4, cellSizeRef.current)
      const charset = ASCII_CHARSETS[asciiStyleRef.current]

      const bufferLength = analyser.frequencyBinCount
      const freqData = new Uint8Array(bufferLength)
      analyser.getByteFrequencyData(freqData)

      const cols = Math.ceil(width / cell)
      const rows = Math.ceil(height / cell)

      ctx.font = `${cell}px monospace`
      ctx.textBaseline = 'top'
      ctx.fillStyle = asciiColorRef.current

      for (let c = 0; c < cols; c++) {
        const binIndex = Math.floor((c / cols) * bufferLength)
        const amplitude = freqData[binIndex] / 255
        const barRows = Math.max(1, Math.round(amplitude * rows))

        for (let i = 0; i < barRows; i++) {
          const row = rows - 1 - i
          const relative = i / barRows
          const charIndex = Math.min(charset.length - 1, Math.floor(relative * charset.length))
          const char = charset[charIndex]
          ctx.fillText(char, c * cell, row * cell)
        }
      }
    }

    const draw = () => {
      rafId = requestAnimationFrame(draw)

      const analyser = analyserRef.current
      const width = canvas.width
      const height = canvas.height

      ctx.fillStyle = 'rgb(0, 0, 0)'
      ctx.fillRect(0, 0, width, height)

      if (!analyser) return

      if (modeRef.current === 'ascii') {
        drawAscii(ctx, analyser, width, height)
      } else {
        drawWaveform(ctx, analyser, width, height)
      }
    }

    draw()

    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('resize', resize)
    }
  }, [])

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current)
      }
      stopCapture()
      audioCtxRef.current?.close()
    }
  }, [])

  let spotifyMessage: string | null = null
  if (spotifyAuthStatus === 'authenticating') {
    spotifyMessage = 'Connecting to Spotify…'
  } else if (spotifyAuthStatus === 'error') {
    spotifyMessage = spotifyAuthErrorMessage ?? 'Something went wrong connecting to Spotify.'
  } else if (spotifyPlaybackError) {
    spotifyMessage = playbackErrorMessage(spotifyPlaybackError)
  } else if (spotifyAuthStatus === 'ready' && !spotifyDeviceId) {
    spotifyMessage = 'Loading player…'
  } else if (spotifyAuthStatus === 'ready' && !spotifyIsPlaying) {
    spotifyMessage = 'Open Spotify on your phone or desktop and switch playback to "Wisp".'
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />

      <div className="menu-panel" style={{ '--accent': asciiColor } as React.CSSProperties}>
        <div className="menu-panel__header">
          <span className="menu-panel__dot" />
          <span className="menu-panel__title">Wisp</span>
        </div>

        <div className="menu-panel__section">
          <span className="menu-panel__section-title">Spotify</span>
          {spotifyAuthStatus === 'logged-out' && (
            <button
              type="button"
              className="menu-panel__button menu-panel__button--spotify"
              onClick={onSpotifyLogin}
            >
              Connect Spotify
            </button>
          )}
          {spotifyMessage && <p className="menu-panel__status">{spotifyMessage}</p>}
        </div>

        <div className="menu-panel__section">
          <span className="menu-panel__section-title">Audio source</span>
          <div className="menu-panel__button-row">
            <label className="menu-panel__button">
              Choose file
              <input
                type="file"
                accept="audio/*"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
            {supportsTabCapture && (
              <button
                type="button"
                className="menu-panel__button menu-panel__button--accent"
                onClick={startSpotifyCapture}
              >
                Capture tab audio
              </button>
            )}
          </div>
          {source?.kind === 'file' && <p className="menu-panel__status">{source.name}</p>}
          {source?.kind === 'spotify-tab' && (
            <p className="menu-panel__status">
              Capturing Spotify tab audio — pick "This Tab" with "Share tab audio" checked
            </p>
          )}
          {captureError && <p className="menu-panel__status menu-panel__status--error">{captureError}</p>}
          <audio
            ref={audioRef}
            controls
            onPlay={ensureFileSource}
            className="menu-panel__audio"
            style={{ colorScheme: 'dark' }}
          />
        </div>

        <div className="menu-panel__section">
          <div className="menu-panel__toggle-row">
            <span className="menu-panel__section-title">ASCII mode</span>
            <label className="menu-panel__switch">
              <input
                type="checkbox"
                checked={mode === 'ascii'}
                onChange={() => setMode((m) => (m === 'ascii' ? 'waveform' : 'ascii'))}
              />
              <span className="menu-panel__switch-track">
                <span className="menu-panel__switch-thumb" />
              </span>
            </label>
          </div>

          {mode === 'ascii' && (
            <>
              <div className="menu-panel__row">
                <span className="menu-panel__label">Style</span>
                <select
                  className="menu-panel__select"
                  value={asciiStyle}
                  onChange={(e) => setAsciiStyle(e.target.value as AsciiStyle)}
                >
                  {(Object.keys(ASCII_CHARSETS) as AsciiStyle[]).map((key) => (
                    <option key={key} value={key}>
                      {ASCII_STYLE_LABELS[key]}
                    </option>
                  ))}
                </select>
                <p className="menu-panel__preview">{ASCII_CHARSETS[asciiStyle]}</p>
              </div>

              <div className="menu-panel__row">
                <span className="menu-panel__label">
                  Cell size
                  <span className="menu-panel__value">{cellSize}px</span>
                </span>
                <input
                  className="menu-panel__range"
                  type="range"
                  min={6}
                  max={32}
                  step={1}
                  value={cellSize}
                  onChange={(e) => setCellSize(Number(e.target.value))}
                  style={{ '--range-fill': `${((cellSize - 6) / (32 - 6)) * 100}%` } as React.CSSProperties}
                />
              </div>

              <div className="menu-panel__row">
                <span className="menu-panel__label">Color</span>
                <div className="menu-panel__swatch-row">
                  <input
                    className="menu-panel__swatch"
                    type="color"
                    value={asciiColor}
                    onChange={(e) => setAsciiColor(e.target.value)}
                  />
                  <span className="menu-panel__hex">{asciiColor}</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

export default WaveformVisualizer
