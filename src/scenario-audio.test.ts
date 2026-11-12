import { describe, expect, it, vi } from 'vitest'
import { analyzeAudio, audioWaveform, importAudio, scheduleAudio } from './scenario-audio'
import { frameAt } from './session-frame'
import { scenario, type Scenario } from './timeline'

const samples = new Float32Array(20000)
samples[499] = -0.5
const buffer = {
  sampleRate: 1000,
  numberOfChannels: 1,
  length: samples.length,
  duration: 20,
  getChannelData: () => samples,
} as unknown as AudioBuffer

describe('scenario audio', () => {
  it('uses decoded sample peaks to draw deterministic waveform bars', () => {
    const asset = analyzeAudio(buffer)
    expect(audioWaveform(asset, 0).every(height => height === 2)).toBe(true)
    expect(audioWaveform(asset, 499).at(-1)).toBe(20)
    expect(audioWaveform(asset, 1000).every(height => height === 2)).toBe(true)
  })

  it('keeps captions hidden through leading silence and pauses their reveal between voiced regions', () => {
    const recording = new Float32Array(5000)
    recording[850] = 0.5
    recording.fill(0.2, 1200, 1800)
    recording.fill(0.2, 2400, 3200)
    const asset = analyzeAudio({ ...buffer, length: recording.length, getChannelData: () => recording })
    const production = { ...scenario, presentation: 'session-001' as const }
    const assets = new Map([['ORACLE', asset]])
    const caption = (time: number) => frameAt(production, time, undefined, assets).participants[0].caption?.en
    expect(caption(1299)).toBeUndefined()
    expect(caption(1300)).toBe('E')
    expect(caption(1950)).toBe(caption(2450))
    expect(caption(3400)).toBe("Everyone is here. Let's begin.")
    expect(caption(1300)).toBe('E')
  })

  it('ignores ROOT files before decoding and rejects duplicate cues', async () => {
    const decodeAudioData = vi.fn().mockResolvedValue(buffer)
    const context = { decodeAudioData } as unknown as BaseAudioContext
    const file = (name: string) => ({ name, arrayBuffer: async () => new ArrayBuffer(1) }) as File
    const assets = await importAudio(context, scenario, [file('ROOT.wav'), file('ORACLE-0.wav')])
    expect([...assets.keys()]).toEqual(['ORACLE-0'])
    expect(decodeAudioData).toHaveBeenCalledTimes(1)
    await expect(importAudio(context, scenario, [file('ORACLE.wav'), file('oracle.mp3')])).rejects.toThrow('Duplicate')
  })

  it('schedules all four speakers on the same clock, seeks into clips, and keeps ROOT silent', () => {
    const withSpecter: Scenario = {
      ...scenario,
      events: scenario.events.flatMap<Scenario['events'][number]>(event => event.type === 'participant_speaking_ended' &&
        event.participant === 'ORACLE' ? [
          { ...event, atMs: 6000 },
          { type: 'participant_speaking_started', participant: 'SPECTER', atMs: 6000 },
          { type: 'participant_speaking_ended', participant: 'SPECTER', atMs: 12000 },
        ] : [event]).sort((a, b) => a.atMs - b.atMs),
    }
    const asset = analyzeAudio(buffer)
    const assets = new Map(withSpecter.participants.map(name => [name, asset]))
    const starts = vi.fn()
    const stop = vi.fn()
    const context = {
      createBufferSource: () => ({ start: starts, stop, connect: vi.fn(), disconnect: vi.fn() }),
    } as unknown as BaseAudioContext
    const cleanup = scheduleAudio(context, withSpecter, assets, 3000, 30000, 10)
    expect(starts.mock.calls).toEqual([[10, 3, 3], [13, 0, 6], [19, 0, 6], [25, 0, 5]])
    cleanup()
    expect(stop).toHaveBeenCalledTimes(4)
  })
})
