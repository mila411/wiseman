import { audioCueAt } from './audio'
import { assetAt, audioWaveform, type AudioAssets } from './scenario-audio'
import { stateAt, type Scenario } from './timeline'
import { waveformAt } from './waveform'

export const captureSize = { width: 1920, height: 1080 }

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
      return {
        ...participant,
        waveform: asset
          ? audioWaveform(asset, session.timeMs - start)
          : waveformAt(participant.name, session.timeMs, start),
      }
    }),
  }
}
