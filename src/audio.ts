import type { SessionFrame } from './timeline'

export type AudioCue = { src: string; offsetMs: number }
export type AudioTracks = Readonly<Partial<Record<string, string>>>

export function audioCueAt(frame: SessionFrame, tracks: AudioTracks = {}): AudioCue | null {
  const speaker = frame.participants.find(participant => participant.speakingSince !== undefined)
  if (!speaker || speaker.name === 'ROOT' || speaker.speakingSince === undefined) return null
  const src = tracks[speaker.name]
  return src ? { src, offsetMs: frame.timeMs - speaker.speakingSince } : null
}
