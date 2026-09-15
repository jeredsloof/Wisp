import { useEffect, useRef, useState } from 'react'

type SourceLabel = { kind: 'file'; name: string } | { kind: 'spotify-tab' } | null

const supportsTabCapture = typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia

function WaveformVisualizer() {
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

    const draw = () => {
      rafId = requestAnimationFrame(draw)

      const analyser = analyserRef.current
      const width = canvas.width
      const height = canvas.height

      ctx.fillStyle = 'rgb(0, 0, 0)'
      ctx.fillRect(0, 0, width, height)

      if (!analyser) return

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

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
      <div
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
          alignItems: 'flex-start',
          maxWidth: 320,
        }}
      >
        <div style={{ display: 'flex', gap: 8 }}>
          <label
            style={{
              color: '#fff',
              fontFamily: 'system-ui, sans-serif',
              fontSize: 14,
              background: 'rgba(255,255,255,0.1)',
              padding: '6px 10px',
              borderRadius: 4,
              cursor: 'pointer',
            }}
          >
            Choose audio file
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
              onClick={startSpotifyCapture}
              style={{
                color: '#fff',
                fontFamily: 'system-ui, sans-serif',
                fontSize: 14,
                background: 'rgba(29,185,84,0.25)',
                border: '1px solid rgba(29,185,84,0.6)',
                padding: '6px 10px',
                borderRadius: 4,
                cursor: 'pointer',
              }}
            >
              Capture Spotify tab audio
            </button>
          )}
        </div>
        {source?.kind === 'file' && (
          <span style={{ color: '#9ca3af', fontFamily: 'system-ui, sans-serif', fontSize: 12 }}>
            {source.name}
          </span>
        )}
        {source?.kind === 'spotify-tab' && (
          <span style={{ color: '#9ca3af', fontFamily: 'system-ui, sans-serif', fontSize: 12 }}>
            Capturing Spotify tab audio — pick "This Tab" with "Share tab audio" checked
          </span>
        )}
        {captureError && (
          <span style={{ color: '#f87171', fontFamily: 'system-ui, sans-serif', fontSize: 12 }}>
            {captureError}
          </span>
        )}
        <audio ref={audioRef} controls onPlay={ensureFileSource} />
      </div>
    </div>
  )
}

export default WaveformVisualizer
