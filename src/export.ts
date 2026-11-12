import { audioCueAt } from './audio'
import { assetAt, audioWaveform, captionAudioProgress, type AudioAssets } from './scenario-audio'
import { stateAt, type Caption, type Scenario } from './timeline'
import { waveformAt } from './waveform'

export const captureSize = { width: 1920, height: 1080 }

function revealCaption(text: Caption, progress: (characters: number) => number): Caption {
  const reveal = (line: string) => {
    const characters = Array.from(line)
    return characters.slice(0, progress(characters.length)).join('')
  }
  return {
    en: reveal(text.en),
    ru: text.ru && reveal(text.ru),
    jaPronunciation: text.jaPronunciation && reveal(text.jaPronunciation),
  }
}

function timedCaption(text: Caption, elapsed: number, duration: number): Caption | undefined {
  const delay = Math.min(300, duration / 4)
  if (elapsed < delay) return undefined
  const revealWindow = duration - delay - Math.min(220, duration / 4)
  return revealCaption(text, length =>
    1 + Math.floor((elapsed - delay) / Math.min(38, revealWindow / Math.max(1, length - 1))),
  )
}

export function frameAt(scenario: Scenario, playbackMs: number, disconnectAtMs?: number, assets?: AudioAssets) {
  const source = disconnectAtMs === undefined ? scenario : {
    ...scenario,
    events: [
      ...scenario.events.filter(event => event.atMs < disconnectAtMs),
      { type: 'session_ended' as const, atMs: disconnectAtMs },
    ],
  }
  const session = stateAt(source, playbackMs)
  return {
    ...session,
    audio: audioCueAt(session),
    participants: session.participants.map(participant => {
      const start = participant.speakingSince
      if (start === undefined) return { ...participant, waveform: undefined }
      const asset = assets && assetAt(assets, participant.name, start)
      let { caption } = participant
      const { captionStartedAt } = participant
      if (scenario.presentation === 'session-001' && participant.name !== 'ROOT' &&
          caption && captionStartedAt !== undefined) {
        const captionEnd = scenario.events.find(event =>
          event.atMs > captionStartedAt &&
          (event.type === 'session_ended' ||
            (event.participant === participant.name &&
              (event.type === 'caption_ended' || event.type === 'caption_started' ||
               event.type === 'participant_speaking_ended' || event.type === 'participant_left'))),
        )?.atMs ?? scenario.durationMs
        if (asset) {
          const progress = captionAudioProgress(asset, session.timeMs - start, captionStartedAt - start, captionEnd - start)
          caption = progress === undefined ? undefined :
            revealCaption(caption, length => Math.max(1, Math.floor(length * progress)))
        } else {
          caption = timedCaption(caption, session.timeMs - captionStartedAt, captionEnd - captionStartedAt)
        }
      }
      return {
        ...participant,
        caption,
        waveform: asset
          ? audioWaveform(asset, session.timeMs - start)
          : waveformAt(participant.name, session.timeMs, start),
      }
    }),
  }
}
