import { describe, expect, it } from 'vitest'
import { audioCueAt } from './audio'
import { frameAt } from './export'
import { scenario, stateAt } from './timeline'
import { waveformAt } from './waveform'

const speakers = (ms: number) => stateAt(scenario, ms).participants
  .filter(participant => participant.speakingSince !== undefined)
  .map(participant => participant.name)

const captions = (ms: number) => stateAt(scenario, ms).participants.flatMap(
  participant => participant.caption ? [participant.name] : [],
)

describe('Phase 1 scenario', () => {
  it('switches speakers at exact millisecond boundaries', () => {
    for (const [ms, names] of [
      [0, ['ORACLE']], [11999, ['ORACLE']], [12000, ['GHOST']], [17999, ['GHOST']],
      [18000, ['ZERO']], [22999, ['ZERO']], [23000, ['ROOT']], [29999, ['ROOT']], [30000, []],
    ] as const) expect(speakers(ms)).toEqual(names)
  })

  it('reconstructs the same frame when seeking backward', () => {
    const early = frameAt(scenario, 3500)
    expect(frameAt(scenario, 25000).participants.find(p => p.waveform)?.name).toBe('ROOT')
    expect(frameAt(scenario, 3500)).toEqual(early)
  })

  it('repeats waveform values at the same timestamp and varies across time and identity', () => {
    const bars = waveformAt('ORACLE', 3467, 0)
    expect(bars).toHaveLength(47)
    expect(bars[23]).toBeGreaterThan(2)
    expect(waveformAt('ORACLE', 3467, 0)).toEqual(bars)
    expect(waveformAt('ORACLE', 3600, 0)).not.toEqual(bars)
    expect(waveformAt('GHOST', 3467, 0)).not.toEqual(bars)
    expect(frameAt(scenario, 12000).participants[0].waveform).toBeUndefined()
  })

  it('keeps ROOT silent even if assigned an audio track', () => {
    const tracks = { ROOT: 'root.wav', ORACLE: 'oracle.wav' }
    expect(audioCueAt(stateAt(scenario, 24000), tracks)).toBeNull()
    expect(audioCueAt(stateAt(scenario, 1000), tracks)).toEqual({ src: 'oracle.wav', offsetMs: 1000 })
    expect(frameAt(scenario, 24000).participants.find(p => p.name === 'ROOT')).toMatchObject({
      caption: { en: expect.any(String) },
      waveform: expect.any(Array),
    })
  })

  it('has no simultaneous speakers', () => {
    for (const ms of new Set(scenario.events.map(event => event.atMs))) {
      expect(speakers(ms).length).toBeLessThanOrEqual(1)
    }
  })

  it('clears every participant and caption on natural or manual termination', () => {
    for (const frame of [frameAt(scenario, 30000), frameAt(scenario, 24000, 24000)]) {
      expect(frame.ended).toBe(true)
      expect(frame.audio).toBeNull()
      expect(frame.participants).toHaveLength(5)
      expect(frame.participants.every(p => !p.connected && !p.waveform && !p.caption)).toBe(true)
    }
    expect(frameAt(scenario, 23999, 24000).ended).toBe(false)
  })

  it('shows captions only within the exact event intervals', () => {
    for (const event of scenario.events) {
      if (event.type === 'caption_started') {
        expect(captions(event.atMs - 1)).toEqual([])
        expect(captions(event.atMs)).toEqual([event.participant])
      }
      if (event.type === 'caption_ended') {
        expect(captions(event.atMs - 1)).toEqual([event.participant])
        expect(captions(event.atMs)).toEqual([])
      }
    }
  })
})
