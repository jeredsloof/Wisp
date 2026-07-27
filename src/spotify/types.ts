export interface SpotifyTokens {
  accessToken: string
  refreshToken: string
  expiresAt: number
}

export interface AudioAnalysisInterval {
  start: number
  duration: number
  confidence: number
}

export interface AudioAnalysisSegment extends AudioAnalysisInterval {
  loudness_start: number
  loudness_max: number
  loudness_max_time: number
  pitches: number[]
  timbre: number[]
}

export interface AudioAnalysis {
  segments: AudioAnalysisSegment[]
  beats: AudioAnalysisInterval[]
  bars: AudioAnalysisInterval[]
  tatums: AudioAnalysisInterval[]
}
