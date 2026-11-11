import data from './scenario.json'

export interface Caption {
  en: string
  ru?: string
  jaPronunciation?: string
}

type Event = { atMs: number } & (
  | { type: 'session_ended' }
  | { type: 'caption_started'; participant: string; caption: Caption }
  | {
      type: 'participant_joined' | 'participant_speaking_started' |
        'participant_speaking_ended' | 'caption_ended'
      participant: string
    }
)

export interface Scenario {
  id: string
  utcStart: string
  durationMs: number
  participants: string[]
  events: Event[]
}

export const scenario = data as Scenario

export function stateAt(scenario: Scenario, playbackMs: number) {
  const timeMs = Math.max(0, Math.min(playbackMs, scenario.durationMs))
  const connected = new Set<string>()
  const speaking = new Map<string, number>()
  const captions = new Map<string, Caption>()
  let ended = false

  for (const event of scenario.events) {
    if (event.atMs > timeMs || ended) break
    switch (event.type) {
      case 'participant_joined':
        connected.add(event.participant)
        break
      case 'participant_speaking_started':
        if (connected.has(event.participant)) speaking.set(event.participant, event.atMs)
        break
      case 'participant_speaking_ended':
        speaking.delete(event.participant)
        captions.delete(event.participant)
        break
      case 'caption_started':
        captions.set(event.participant, event.caption)
        break
      case 'caption_ended':
        captions.delete(event.participant)
        break
      case 'session_ended':
        ended = true
        connected.clear()
        speaking.clear()
        captions.clear()
        break
    }
  }

  return {
    timeMs,
    ended,
    utc: new Date(Date.parse(scenario.utcStart) + timeMs).toISOString(),
    participants: scenario.participants.map(name => ({
      name,
      connected: connected.has(name),
      speakingSince: speaking.get(name),
      caption: speaking.has(name) ? captions.get(name) : undefined,
    })),
  }
}

export type SessionFrame = ReturnType<typeof stateAt>
