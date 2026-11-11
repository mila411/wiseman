import type { Scenario } from './timeline'

export function validateScenario(value: unknown): Scenario {
  if (!value || typeof value !== 'object') throw new Error('Invalid scenario.')
  const candidate = value as Scenario
  const { id, utcStart, durationMs, participants, events } = candidate
  if (typeof id !== 'string' || !id.trim() ||
      typeof utcStart !== 'string' || !Number.isFinite(Date.parse(utcStart)) ||
      !Number.isSafeInteger(durationMs) || durationMs <= 0 ||
      !Array.isArray(participants) || participants.length !== 5 ||
      participants.some(name => typeof name !== 'string' || !/^[A-Z0-9_]+$/.test(name)) ||
      new Set(participants).size !== participants.length || !participants.includes('ROOT') ||
      !Array.isArray(events)) {
    throw new Error('Invalid scenario header.')
  }
  let previous = 0
  for (const event of events) {
    if (!event || !Number.isSafeInteger(event.atMs) || event.atMs < previous || event.atMs > durationMs) {
      throw new Error('Scenario events must have ordered timestamps within the session.')
    }
    previous = event.atMs
    if (event.type === 'session_ended') continue
    if (!participants.includes(event.participant)) throw new Error('Unknown participant in scenario event.')
    switch (event.type) {
      case 'participant_joined':
      case 'participant_speaking_started':
      case 'participant_speaking_ended':
      case 'caption_ended':
        break
      case 'caption_started': {
        const { caption } = event
        if (!caption || typeof caption.en !== 'string' ||
            (caption.ru !== undefined && typeof caption.ru !== 'string') ||
            (caption.jaPronunciation !== undefined && typeof caption.jaPronunciation !== 'string')) {
          throw new Error('Invalid scenario caption.')
        }
        break
      }
      default:
        throw new Error('Unknown scenario event.')
    }
  }
  return candidate
}
