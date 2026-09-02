import type { AudioAnalysis, AudioAnalysisInterval, AudioAnalysisSegment } from './types'

function findActiveIndex(items: AudioAnalysisInterval[], positionSec: number): number {
  if (items.length === 0) return -1

  let lo = 0
  let hi = items.length - 1
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2)
    if (items[mid].start <= positionSec) {
      lo = mid
    } else {
      hi = mid - 1
    }
  }
  return items[lo].start <= positionSec ? lo : -1
}

export function getActiveSegmentIndex(analysis: AudioAnalysis, positionSec: number): number {
  return findActiveIndex(analysis.segments, positionSec)
}

export function getActiveBeatIndex(analysis: AudioAnalysis, positionSec: number): number {
  return findActiveIndex(analysis.beats, positionSec)
}

export function getActiveBarIndex(analysis: AudioAnalysis, positionSec: number): number {
  return findActiveIndex(analysis.bars, positionSec)
}

/** Pitch-class energy vector for the active segment, lerped toward the next segment. Writes into `out`. */
export function getPitchEnergyVector(
  analysis: AudioAnalysis,
  segmentIndex: number,
  positionSec: number,
  out: number[],
): number[] {
  if (segmentIndex === -1) {
    out.fill(0)
    return out
  }

  const segment = analysis.segments[segmentIndex]
  const next = analysis.segments[segmentIndex + 1]
  if (!next) {
    for (let i = 0; i < 12; i++) out[i] = segment.pitches[i]
    return out
  }

  const t = Math.min(1, (positionSec - segment.start) / segment.duration)
  for (let i = 0; i < 12; i++) out[i] = segment.pitches[i] + (next.pitches[i] - segment.pitches[i]) * t
  return out
}

/** Segment loudness (dB, roughly -60..0) normalized to a 0..1 scale. */
export function getNormalizedLoudness(analysis: AudioAnalysis, segmentIndex: number): number {
  if (segmentIndex === -1) return 0

  const segment: AudioAnalysisSegment = analysis.segments[segmentIndex]
  const db = Math.max(segment.loudness_start, segment.loudness_max)
  return Math.min(1, Math.max(0, (db + 60) / 60))
}

/** Returns the beat that was crossed this frame (start <= currPositionSec, start > prevPositionSec), if any. */
export function getBeatCrossedThisFrame(
  analysis: AudioAnalysis,
  prevPositionSec: number,
  currPositionSec: number,
): AudioAnalysisInterval | null {
  const prevIndex = getActiveBeatIndex(analysis, prevPositionSec)
  const currIndex = getActiveBeatIndex(analysis, currPositionSec)
  if (currIndex === -1 || currIndex === prevIndex) return null
  return analysis.beats[currIndex]
}
