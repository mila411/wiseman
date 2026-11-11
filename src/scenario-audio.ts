import { stateAt, type Scenario } from './timeline'
import { waveformBars } from './waveform'

export type AudioAsset = { buffer: AudioBuffer; peaks: Float32Array }
export type AudioAssets = ReadonlyMap<string, AudioAsset>
const bucketMs = 5

export function analyzeAudio(buffer: AudioBuffer): AudioAsset {
  const bucketSize = Math.max(1, Math.round(buffer.sampleRate * bucketMs / 1000))
  const peaks = new Float32Array(Math.ceil(buffer.length / bucketSize))
  for (let channel = 0; channel < buffer.numberOfChannels; channel++) {
    const samples = buffer.getChannelData(channel)
    for (let i = 0; i < samples.length; i++) {
      const bucket = Math.floor(i / bucketSize)
      peaks[bucket] = Math.max(peaks[bucket], Math.abs(samples[i]))
    }
  }
  return { buffer, peaks }
}

export function assetAt(assets: AudioAssets, name: string, startMs: number) {
  if (name.toUpperCase() === 'ROOT') return undefined
  return assets.get(`${name.toUpperCase()}-${startMs}`) ?? assets.get(name.toUpperCase())
}

export function audioWaveform(asset: AudioAsset, offsetMs: number) {
  const bucketSize = Math.max(1, Math.round(asset.buffer.sampleRate * bucketMs / 1000))
  const center = Math.floor(offsetMs * asset.buffer.sampleRate / 1000 / bucketSize)
  return Array.from({ length: waveformBars }, (_, index) => {
    const peak = asset.peaks[center + index - waveformBars + 1] ?? 0
    return 2 + 36 * Math.min(1, peak)
  })
}

export async function importAudio(context: BaseAudioContext, scenario: Scenario, files: readonly File[]) {
  const allowed = new Set(scenario.participants.filter(name => name.toUpperCase() !== 'ROOT').map(name => name.toUpperCase()))
  for (const event of scenario.events) {
    if (event.type === 'participant_speaking_started' && allowed.has(event.participant.toUpperCase())) {
      allowed.add(`${event.participant.toUpperCase()}-${event.atMs}`)
    }
  }
  const assets = new Map<string, AudioAsset>()
  for (const file of files) {
    const key = file.name.replace(/\.[^.]+$/, '').toUpperCase()
    if (key === 'ROOT' || key.startsWith('ROOT-')) continue
    if (!allowed.has(key)) throw new Error(`Unknown audio cue: ${file.name}`)
    if (assets.has(key)) throw new Error(`Duplicate audio cue: ${file.name}`)
    try {
      const buffer = await context.decodeAudioData(await file.arrayBuffer())
      assets.set(key, analyzeAudio(buffer))
    } catch {
      throw new Error(`Could not decode ${file.name}`)
    }
  }
  return assets
}

export function scheduleAudio(
  context: BaseAudioContext,
  scenario: Scenario,
  assets: AudioAssets,
  fromMs: number,
  untilMs: number,
  anchor: number,
) {
  const end = Math.min(untilMs, scenario.durationMs)
  const boundaries = [...new Set([
    fromMs,
    ...scenario.events.flatMap(event =>
      event.atMs > fromMs && event.atMs < end &&
      (event.type === 'participant_speaking_started' || event.type === 'participant_speaking_ended' ||
        event.type === 'session_ended' || event.type === 'participant_joined') ? [event.atMs] : []),
    end,
  ])].sort((a, b) => a - b)
  const sources: AudioBufferSourceNode[] = []
  const intervals = new Map<string, { asset: AudioAsset; from: number; to: number; start: number }>()
  for (let index = 0; index < boundaries.length - 1; index++) {
    const from = boundaries[index]
    const to = boundaries[index + 1]
    for (const { name, speakingSince } of stateAt(scenario, from).participants) {
      if (speakingSince === undefined) continue
      const asset = assetAt(assets, name, speakingSince)
      if (!asset) continue
      const key = `${name}-${speakingSince}`
      const interval = intervals.get(key)
      if (interval) interval.to = to
      else intervals.set(key, { asset, from, to, start: speakingSince })
    }
  }
  for (const { asset, from, to, start } of intervals.values()) {
    const offset = (from - start) / 1000
    const length = Math.min((to - from) / 1000, asset.buffer.duration - offset)
    if (length <= 0) continue
    const source = context.createBufferSource()
    source.buffer = asset.buffer
    source.connect(context.destination)
    source.start(anchor + (from - fromMs) / 1000, offset, length)
    sources.push(source)
  }
  return () => sources.forEach(source => {
    source.stop()
    source.disconnect()
  })
}
