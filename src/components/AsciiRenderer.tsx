import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { AsciiEffect } from 'three/examples/jsm/effects/AsciiEffect.js'

interface AsciiRendererProps {
  container: HTMLDivElement
  characters?: string
  resolution?: number
}

const ASCII_FPS = 30
const ASCII_FRAME_INTERVAL = 1 / ASCII_FPS

function AsciiRenderer({ container, characters = ' .:-=+*#%@', resolution = 0.13 }: AsciiRendererProps) {
  const { gl, scene, camera, size } = useThree()

  const effect = useMemo(
    () => new AsciiEffect(gl, characters, { color: true, resolution }),
    [gl, characters, resolution],
  )

  useEffect(() => {
    effect.domElement.style.width = '100%'
    effect.domElement.style.height = '100%'
    container.appendChild(effect.domElement)
    return () => {
      container.removeChild(effect.domElement)
    }
  }, [effect, container])

  useEffect(() => {
    effect.setSize(size.width, size.height)
  }, [effect, size])

  const accumulatorRef = useRef(0)

  useFrame((_, delta) => {
    accumulatorRef.current += delta
    if (accumulatorRef.current < ASCII_FRAME_INTERVAL) return
    accumulatorRef.current = 0
    effect.render(scene, camera)
  }, 1)

  return null
}

export default AsciiRenderer
