import { getAudioAnalysis, SpotifyApiError } from './api'
import type { AudioAnalysis } from './types'

export type CachedAnalysis = AudioAnalysis | 'unavailable'

const cache = new Map<string, Promise<CachedAnalysis>>()

export function fetchAudioAnalysis(
  trackId: string,
  getAccessToken: () => Promise<string>,
): Promise<CachedAnalysis> {
  const cached = cache.get(trackId)
  if (cached) return cached

  const promise = (async (): Promise<CachedAnalysis> => {
    const accessToken = await getAccessToken()
    try {
      return await getAudioAnalysis(trackId, accessToken)
    } catch (err) {
      if (err instanceof SpotifyApiError && err.status === 404) {
        return 'unavailable'
      }
      throw err
    }
  })()

  cache.set(trackId, promise)
  return promise
}
