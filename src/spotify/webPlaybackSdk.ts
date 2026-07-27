let sdkPromise: Promise<typeof Spotify> | null = null

export function loadSpotifyWebPlaybackSdk(): Promise<typeof Spotify> {
  if (sdkPromise) return sdkPromise

  if (window.Spotify) {
    sdkPromise = Promise.resolve(window.Spotify)
    return sdkPromise
  }

  sdkPromise = new Promise((resolve) => {
    window.onSpotifyWebPlaybackSDKReady = () => {
      resolve(window.Spotify)
    }

    const script = document.createElement('script')
    script.src = 'https://sdk.scdn.co/spotify-player.js'
    script.async = true
    document.body.appendChild(script)
  })

  return sdkPromise
}
