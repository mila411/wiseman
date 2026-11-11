import { audioCueAt } from './audio'
import { stateAt, type Scenario } from './timeline'
import { waveformAt } from './waveform'

export const captureSize = { width: 1920, height: 1080 }

export function frameAt(scenario: Scenario, playbackMs: number, disconnectAtMs?: number) {
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
    participants: session.participants.map(participant => ({
      ...participant,
      waveform: participant.speakingSince === undefined
        ? undefined
        : waveformAt(participant.name, session.timeMs, participant.speakingSince),
    })),
  }
}
