import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Color, type BufferGeometry, type Points } from 'three'
import {
  getActiveBarIndex,
  getBeatCrossedThisFrame,
  getNormalizedLoudness,
  getPitchEnergyVector,
} from '../spotify/analysisLookup'
import type { CachedAnalysis } from '../spotify/audioAnalysisCache'

interface MusicParticlesProps {
  analysis: CachedAnalysis | null
  getPositionMs: () => number
  isPlaying: boolean
}

const GROUP_COUNT = 12
const PARTICLES_PER_GROUP = 250
const PARTICLE_COUNT = GROUP_COUNT * PARTICLES_PER_GROUP
const BASE_RADIUS = 2.5
const PULSE_DECAY_PER_SEC = 3

function buildParticleLayout() {
  const positions = new Float32Array(PARTICLE_COUNT * 3)
  const colors = new Float32Array(PARTICLE_COUNT * 3)
  const group = new Uint8Array(PARTICLE_COUNT)
  const baseAngle = new Float32Array(PARTICLE_COUNT)
  const baseRadius = new Float32Array(PARTICLE_COUNT)
  const baseHeight = new Float32Array(PARTICLE_COUNT)
  const groupColor = new Float32Array(GROUP_COUNT * 3)

  const tmpColor = new Color()
  for (let g = 0; g < GROUP_COUNT; g++) {
    tmpColor.setHSL(g / GROUP_COUNT, 0.7, 0.55)
    groupColor[g * 3] = tmpColor.r
    groupColor[g * 3 + 1] = tmpColor.g
    groupColor[g * 3 + 2] = tmpColor.b
  }

  for (let i = 0; i < PARTICLE_COUNT; i++) {
    const g = Math.floor(i / PARTICLES_PER_GROUP)
    const slice = (Math.PI * 2) / GROUP_COUNT
    group[i] = g
    baseAngle[i] = g * slice + (Math.random() - 0.5) * slice * 0.8
    baseRadius[i] = BASE_RADIUS + (Math.random() - 0.5) * 0.8
    baseHeight[i] = (Math.random() - 0.5) * 1.5

    positions[i * 3] = Math.cos(baseAngle[i]) * baseRadius[i]
    positions[i * 3 + 1] = baseHeight[i]
    positions[i * 3 + 2] = Math.sin(baseAngle[i]) * baseRadius[i]

    colors[i * 3] = groupColor[g * 3]
    colors[i * 3 + 1] = groupColor[g * 3 + 1]
    colors[i * 3 + 2] = groupColor[g * 3 + 2]
  }

  return { positions, colors, group, baseAngle, baseRadius, baseHeight, groupColor }
}

function MusicParticles({ analysis, getPositionMs, isPlaying }: MusicParticlesProps) {
  const layout = useMemo(buildParticleLayout, [])
  const geometryRef = useRef<BufferGeometry>(null)
  const pointsRef = useRef<Points>(null)
  const prevPositionSecRef = useRef(0)
  const pulseRef = useRef(0)
  const rotationRef = useRef(0)

  useFrame((_, delta) => {
    const geometry = geometryRef.current
    if (!geometry) return

    const positions = geometry.attributes.position.array as Float32Array
    const colors = geometry.attributes.color.array as Float32Array
    const { group, baseAngle, baseRadius, baseHeight, groupColor } = layout

    const hasAnalysis = analysis && analysis !== 'unavailable' && isPlaying
    const positionSec = getPositionMs() / 1000

    let energy: number[]
    let loudness: number
    let barPulse = 0

    if (hasAnalysis) {
      energy = getPitchEnergyVector(analysis, positionSec)
      loudness = getNormalizedLoudness(analysis, positionSec)

      const crossedBeat = getBeatCrossedThisFrame(analysis, prevPositionSecRef.current, positionSec)
      if (crossedBeat) {
        pulseRef.current = Math.min(1, pulseRef.current + crossedBeat.confidence)
      }
      const barIndex = getActiveBarIndex(analysis, positionSec)
      barPulse = barIndex >= 0 ? analysis.bars[barIndex].confidence : 0
    } else {
      const t = performance.now() / 1000
      energy = new Array(GROUP_COUNT).fill(0).map((_, g) => 0.15 + 0.1 * Math.sin(t * 0.6 + g))
      loudness = 0.25
    }

    prevPositionSecRef.current = positionSec
    pulseRef.current *= Math.exp(-PULSE_DECAY_PER_SEC * delta)
    rotationRef.current += delta * (hasAnalysis ? 0.1 + loudness * 0.2 : 0.05)

    const rotation = rotationRef.current
    const cosR = Math.cos(rotation)
    const sinR = Math.sin(rotation)

    for (let i = 0; i < PARTICLE_COUNT; i++) {
      const g = group[i]
      const groupEnergy = energy[g] ?? 0
      const radiusScale = 1 + groupEnergy * 1.5 * (0.5 + loudness) + pulseRef.current * 0.6
      const r = baseRadius[i] * radiusScale
      const angle = baseAngle[i]

      const x = Math.cos(angle) * r
      const z = Math.sin(angle) * r

      positions[i * 3] = x * cosR - z * sinR
      positions[i * 3 + 1] = baseHeight[i] + groupEnergy * 1.2 + barPulse * 0.3
      positions[i * 3 + 2] = x * sinR + z * cosR

      const brightness = 0.4 + groupEnergy * 0.6 * (0.5 + loudness) + pulseRef.current * 0.4
      colors[i * 3] = groupColor[g * 3] * brightness
      colors[i * 3 + 1] = groupColor[g * 3 + 1] * brightness
      colors[i * 3 + 2] = groupColor[g * 3 + 2] * brightness
    }

    geometry.attributes.position.needsUpdate = true
    geometry.attributes.color.needsUpdate = true
  })

  return (
    <points ref={pointsRef}>
      <bufferGeometry ref={geometryRef}>
        <bufferAttribute attach="attributes-position" args={[layout.positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[layout.colors, 3]} />
      </bufferGeometry>
      <pointsMaterial size={0.06} vertexColors sizeAttenuation transparent opacity={0.9} />
    </points>
  )
}

export default MusicParticles
