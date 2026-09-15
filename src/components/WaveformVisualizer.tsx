import { useEffect, useRef, useState } from 'react'

function WaveformVisualizer() {
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null)
  const objectUrlRef = useRef<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)

  const ensureAudioGraph = () => {
    const audio = audioRef.current
    if (!audio || audioCtxRef.current) return

    const audioCtx = new AudioContext()
    const analyser = audioCtx.createAnalyser()
    analyser.fftSize = 2048

    const source = audioCtx.createMediaElementSource(audio)
    source.connect(analyser)
    analyser.connect(audioCtx.destination)

    audioCtxRef.current = audioCtx
    analyserRef.current = analyser
    sourceRef.current = source
  }

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file || !audioRef.current) return

    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current)
    }

    const url = URL.createObjectURL(file)
    objectUrlRef.current = url
    setFileName(file.name)
    audioRef.current.src = url
    audioRef.current.play()
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
        }}
      >
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
        {fileName && (
          <span style={{ color: '#9ca3af', fontFamily: 'system-ui, sans-serif', fontSize: 12 }}>
            {fileName}
          </span>
        )}
        <audio ref={audioRef} controls onPlay={ensureAudioGraph} />
      </div>
    </div>
  )
}

export default WaveformVisualizer
