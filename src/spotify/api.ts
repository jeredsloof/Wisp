import type { AudioAnalysis } from './types'

const API_BASE = 'https://api.spotify.com/v1'

export class SpotifyApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function spotifyFetch<T>(path: string, accessToken: string): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    throw new SpotifyApiError(response.status, `Spotify API request failed: ${response.status}`)
  }

  return (await response.json()) as T
}

export function getAudioAnalysis(trackId: string, accessToken: string): Promise<AudioAnalysis> {
  return spotifyFetch<AudioAnalysis>(`/audio-analysis/${trackId}`, accessToken)
}
