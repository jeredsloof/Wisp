import { useEffect, useRef, useState } from 'react'
import { loadSpotifyWebPlaybackSdk } from './webPlaybackSdk'

export interface PlaybackSnapshot {
  state: Spotify.PlaybackState
  sampledAt: number
}

export type PlaybackErrorKind =
  | 'initialization_error'
  | 'authentication_error'
  | 'account_error'
  | 'playback_error'

export interface PlaybackError {
  kind: PlaybackErrorKind
  message: string
}

export function usePlaybackState(getAccessToken: () => Promise<string>, enabled: boolean) {
  const [deviceId, setDeviceId] = useState<string | null>(null)
  const [snapshot, setSnapshot] = useState<PlaybackSnapshot | null>(null)
  const [error, setError] = useState<PlaybackError | null>(null)
  const playerRef = useRef<Spotify.Player | null>(null)

  useEffect(() => {
    if (!enabled || playerRef.current) return

    let cancelled = false

    loadSpotifyWebPlaybackSdk().then((Spotify) => {
      if (cancelled) return

      const player = new Spotify.Player({
        name: 'Wisp',
        getOAuthToken: (callback) => {
          getAccessToken().then(callback)
        },
      })
      playerRef.current = player

      player.addListener('ready', ({ device_id }) => setDeviceId(device_id))
      player.addListener('not_ready', () => setDeviceId(null))
      player.addListener('player_state_changed', (state) => {
        setSnapshot({ state, sampledAt: performance.now() })
      })

      const errorKinds: PlaybackErrorKind[] = [
        'initialization_error',
        'authentication_error',
        'account_error',
        'playback_error',
      ]
      for (const kind of errorKinds) {
        player.addListener(kind, ({ message }) => setError({ kind, message }))
      }

      player.connect()
    })

    return () => {
      cancelled = true
      playerRef.current?.disconnect()
      playerRef.current = null
    }
  }, [enabled, getAccessToken])

  return { deviceId, snapshot, error }
}
