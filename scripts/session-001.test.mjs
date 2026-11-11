import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'vitest'
import { plan, readCues, wavDurationMs } from './session-001.mjs'

const script = await readFile(new URL('../docs/SCRIPT_SESSION_001.md', import.meta.url), 'utf8')
const cues = readCues(script)

test('preserves each dialogue paragraph and the Russian line in order', () => {
  assert.deepEqual(cues.flatMap(cue => cue.en ?? []), [...script.matchAll(/^> (.+)$/gm)].map(match => match[1]))
  assert.equal(cues.length, 102)
  assert.equal(new Set(cues.map(cue => cue.id)).size, cues.length)
  assert.ok(cues.filter(cue => cue.speaker === 'ROOT').every(cue => !cue.audioAssetId && !cue.voice))
  assert.equal(new Set(cues.flatMap(cue => cue.voice ?? [])).size, 4)
  const russian = cues.find(cue => cue.ru)
  assert.equal(russian.speaker, 'ROOT')
  assert.equal(russian.ru, 'Нет, подожди... чёрт.')
  assert.equal(russian.jaPronunciation, 'ニェート、パダジー……チョルト。')
})

test('uses exact WAV duration and schedules every cue without overlaps', () => {
  const wav = Buffer.alloc(44 + 24000)
  wav.write('RIFF', 0)
  wav.write('WAVEfmt ', 8)
  wav.writeUInt32LE(16, 16)
  wav.writeUInt32LE(48000, 28)
  wav.write('data', 36)
  wav.writeUInt32LE(24000, 40)
  assert.equal(wavDurationMs(wav), 500)
  const voiced = cues.filter(cue => cue.audioAssetId)
  const measured = new Map(voiced.map(cue => [cue.id, wavDurationMs(wav)]))
  const result = plan(cues, measured)
  assert.equal(result.scenario.durationMs, 465000)
  for (const [index, cue] of result.cues.entries()) {
    assert.ok(index === 0 || cue.startMs >= result.cues[index - 1].endMs)
    if (cue.audioAssetId) assert.equal(cue.endMs - cue.startMs, 500)
  }
  let speaking
  for (const event of result.scenario.events) {
    if (event.type === 'participant_speaking_started') {
      assert.equal(speaking, undefined)
      speaking = event.participant
    }
    if (event.type === 'caption_started') assert.equal(event.participant, speaking)
    if (event.type === 'participant_speaking_ended') {
      assert.equal(speaking, event.participant)
      speaking = undefined
    }
  }
  const russianIndex = result.cues.findIndex(cue => cue.ru)
  const russian = result.cues[russianIndex]
  assert.equal(russian.startMs - result.cues[russianIndex - 1].endMs, 700)
  assert.equal(result.cues[russianIndex + 1].startMs - russian.endMs, 1000)
})

test('extends the timeline when measured speech does not fit the estimated act', () => {
  const result = plan(cues, new Map([[cues[0].id, 120000]]))
  assert.equal(result.cues[0].endMs - result.cues[0].startMs, 120000)
  assert.ok(result.scenario.durationMs > 465000)
  assert.ok(result.cues[1].startMs >= result.cues[0].endMs)
})
