import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { createFoundryTts } from './foundry-tts.mjs'
import { plan, readCues, wavDurationMs } from './session-001.mjs'
import { performanceFor } from './session-001-performance-directions.mjs'

const output = new URL('../production/session-001-performance/', import.meta.url)
const takes = new URL('audio-foundry/', output)
const source = await readFile(new URL('../docs/SCRIPT_SESSION_001.md', import.meta.url), 'utf8')
const cues = readCues(source).map(performanceFor)
const voiced = cues.filter(cue => cue.audioAssetId)
const interrupted = new Set(cues.flatMap((cue, index) => cue.overlapMs ? [cues[index - 1].id] : []))
const paid = process.argv.includes('--approve-paid-tts')
const retime = process.argv.includes('--retime')
if (paid && retime) throw new Error('Choose --retime or --approve-paid-tts.')
const useMeasuredTiming = paid || retime
const measured = new Map()
let calls = 0

async function existing(file) {
  try {
    return await readFile(file)
  } catch (error) {
    if (error.code !== 'ENOENT') throw error
    return undefined
  }
}

function trimTrailingSilence(wav) {
  // Foundry returns mono 24 kHz, 16-bit PCM. Keep 40 ms after the last audible window.
  const windowBytes = 480
  let pcm = false
  for (let offset = 12; offset + 8 <= wav.length;) {
    const name = wav.toString('ascii', offset, offset + 4)
    const size = wav.readUInt32LE(offset + 4)
    const start = offset + 8
    const end = start + size
    if (name === 'fmt ' && size >= 16) {
      pcm = wav.readUInt16LE(start) === 1 && wav.readUInt16LE(start + 2) === 1 &&
        wav.readUInt32LE(start + 4) === 24000 && wav.readUInt16LE(start + 14) === 16
    }
    if (name === 'data' && pcm && size % 2 === 0) {
      let audibleEnd = end
      while (audibleEnd - windowBytes >= start) {
        let energy = 0
        for (let sample = audibleEnd - windowBytes; sample < audibleEnd; sample += 2) {
          energy += wav.readInt16LE(sample) ** 2
        }
        if (energy / (windowBytes / 2) >= 184 ** 2) break
        audibleEnd -= windowBytes
      }
      const trimAt = Math.min(end, audibleEnd + 4 * windowBytes)
      if (trimAt === end || audibleEnd - start < windowBytes) return wav
      const trimmed = Buffer.concat([wav.subarray(0, trimAt), wav.subarray(end)])
      trimmed.writeUInt32LE(trimmed.length - 8, 4)
      trimmed.writeUInt32LE(trimAt - start, offset + 4)
      return trimmed
    }
    offset = end + size % 2
  }
  return wav
}

if (paid) {
  const synthesize = createFoundryTts()
  await mkdir(takes, { recursive: true })
  for (const [index, cue] of voiced.entries()) {
    const file = new URL(cue.id + '.wav', takes)
    let clip = await existing(file)
    if (!clip) {
      clip = await synthesize(cue.speaker, cue.en, cue.direction)
      calls++
      wavDurationMs(clip)
      if (interrupted.has(cue.id)) clip = trimTrailingSilence(clip)
      await writeFile(file, clip, { flag: 'wx' })
    }
    measured.set(cue.id, wavDurationMs(clip))
    console.log(`${index + 1}/${voiced.length} ${cue.id}`)
  }
}

if (retime) {
  for (const cue of voiced) {
    const clip = await readFile(new URL(cue.id + '.wav', takes))
    measured.set(cue.id, wavDurationMs(clip))
  }
}

const production = plan(cues.map(({ direction, ...cue }) => cue), measured)
await mkdir(output, { recursive: true })
const writeJson = (name, value) => writeFile(new URL(name, output), JSON.stringify(value, null, 2) + '\n')
await writeJson(useMeasuredTiming ? 'cues.json' : 'cues-estimated.json', {
  timing: useMeasuredTiming ? 'measured' : 'estimated', cues: production.cues,
})
await writeJson(useMeasuredTiming ? 'scenario.json' : 'scenario-estimated.json', production.scenario)
console.log(`${production.cues.length} cues; ${voiced.length} voiced; ${calls} new TTS requests; ${production.scenario.durationMs / 1000}s.`)
