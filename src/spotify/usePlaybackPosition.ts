import { useEffect, useMemo, useRef } from 'react'
import type { PlaybackSnapshot } from './usePlaybackState'

interface PositionAnchor {
  basePositionMs: number
  baseSampledAt: number
  paused: boolean
  durationMs: number
}

export function usePlaybackPosition(snapshot: PlaybackSnapshot | null) {
  const anchorRef = useRef<PositionAnchor | null>(null)

  useEffect(() => {
    if (!snapshot) {
      anchorRef.current = null
      return
    }

    anchorRef.current = {
      basePositionMs: snapshot.state.position,
      baseSampledAt: snapshot.sampledAt,
      paused: snapshot.state.paused,
      durationMs: snapshot.state.duration,
    }
  }, [snapshot])

  return useMemo(() => {
    const getPositionMs = () => {
      const anchor = anchorRef.current
      if (!anchor) return 0

      const elapsed = anchor.paused ? 0 : performance.now() - anchor.baseSampledAt
      return Math.min(anchor.durationMs, Math.max(0, anchor.basePositionMs + elapsed))
    }

    return {
      getPositionMs,
      isPlaying: snapshot ? !snapshot.state.paused : false,
      trackId: snapshot?.state.track_window.current_track.id ?? null,
      durationMs: snapshot?.state.duration ?? 0,
    }
  }, [snapshot])
}
