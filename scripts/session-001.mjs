import { mkdir, readFile, writeFile, rename } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { createFoundryTts, voiceFor } from './foundry-tts.mjs'

const speakers = ['ORACLE', 'GHOST', 'ZERO', 'SPECTER', 'ROOT']
const marks = [0, 65000, 140000, 215000, 280000, 370000, 435000, 465000]
const acts = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

export function readCues(source) {
  const cues = []
  let act, speaker
  function add(en, ru = null, jaPronunciation = null) {
    if (!act || !speaker) throw new Error('Dialogue without an act or speaker.')
    const order = cues.length + 1
    const id = `S001-U${String(order).padStart(3, '0')}`
    cues.push({ id, order, act, speaker, en, ru, jaPronunciation, speaking: true,
      audioAssetId: speaker === 'ROOT' ? null : id, voice: voiceFor(speaker) })
  }
  const lines = source.replace(/\r/g, '').split('\n')
  for (let index = 0; index < lines.length; index++) {
    const line = lines[index]
    const heading = /^## ACT ([IV]+) — /.exec(line)
    if (heading) {
      act = heading[1]
      speaker = undefined
      continue
    }
    const role = /^(ORACLE|GHOST|ZERO|SPECTER|ROOT)(?: \[字幕のみ\])?$/.exec(line)
    if (role) speaker = role[1]
    if (line.startsWith('> ')) add(line.slice(2))
    if (line === '# Нет, подожди... чёрт.') {
      add(null, line.slice(2), lines[index + 2])
    }
  }
  if (acts.some(act => !cues.some(cue => cue.act === act)) || cues.filter(cue => cue.ru).length !== 1) {
    throw new Error('The source must contain ACT I–VII and one Russian cue.')
  }
  return cues
}

export function wavDurationMs(wav) {
  if (wav.toString('ascii', 0, 4) !== 'RIFF' || wav.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Expected a RIFF/WAVE audio asset.')
  }
  let byteRate = 0
  let dataSize = 0
  for (let offset = 12; offset + 8 <= wav.length;) {
    const name = wav.toString('ascii', offset, offset + 4)
    const size = wav.readUInt32LE(offset + 4)
    const start = offset + 8
    if (start + size > wav.length) throw new Error('Incomplete WAV audio asset.')
    if (name === 'fmt ' && size >= 16) byteRate = wav.readUInt32LE(start + 8)
    if (name === 'data') dataSize = size
    offset = start + size + (size % 2)
  }
  if (!byteRate || !dataSize) throw new Error('WAV audio asset has no duration.')
  return Math.ceil(dataSize * 1000 / byteRate)
}

export function plan(cues, measured = new Map()) {
  const events = speakers.map((participant, index) => ({
    atMs: 900 + index * 650, type: 'participant_joined', participant,
  }))
  const timed = []
  let overrun = 0
  for (const [index, act] of acts.entries()) {
    const rows = cues.filter(cue => cue.act === act)
    const intro = index === 0 ? 5200 : 0
    const tail = index === 6 ? 11500 : 0
    const start = marks[index] + overrun + intro
    const target = marks[index + 1] + overrun - tail
    const holds = rows.map(cue => {
      if (cue.audioAssetId && measured.has(cue.id)) return measured.get(cue.id)
      if (cue.ru) return 2250
      const words = cue.en.trim().split(/\s+/).length
      return Math.max(950, Math.round(words * (cue.speaker === 'ROOT' ? 255 : 305) + 240))
    })
    const gaps = rows.map((cue, row) => {
      const next = rows[row + 1]
      if (cue.ru) return 1000
      if (next?.ru) return 700
      if (cue.en === "Let's get to work.") return 1000
      if (cue.en === "We're here to establish what actually happened.") return 2000
      return cue.speaker === next?.speaker ? 160 : 350
    })
    const total = holds.reduce((a, b) => a + b, 0) + gaps.reduce((a, b) => a + b, 0)
    const slack = Math.max(0, target - start - total)
    const spread = rows.map((cue, row) => !cue.ru && !rows[row + 1]?.ru &&
      cue.en !== "Let's get to work." &&
      cue.en !== "We're here to establish what actually happened." &&
      (cue.speaker !== rows[row + 1]?.speaker || row === rows.length - 1))
    const slots = spread.filter(Boolean).length
    const step = Math.floor(slack / slots)
    let cursor = start
    for (const [row, cue] of rows.entries()) {
      const startMs = cursor
      const endMs = startMs + holds[row]
      const speakingEnd = cue.ru || rows[row + 1]?.ru ? endMs + gaps[row] : endMs
      timed.push({ ...cue, startMs, endMs })
      events.push(
        { atMs: startMs, type: 'participant_speaking_started', participant: cue.speaker,
          ...(cue.audioAssetId ? { audioAssetId: cue.audioAssetId } : {}) },
        { atMs: startMs, type: 'caption_started', participant: cue.speaker,
          caption: { en: cue.en ?? '', ...(cue.ru ? { ru: cue.ru, jaPronunciation: cue.jaPronunciation } : {}) } },
        { atMs: endMs, type: 'caption_ended', participant: cue.speaker },
        { atMs: speakingEnd, type: 'participant_speaking_ended', participant: cue.speaker },
      )
      cursor = endMs + gaps[row] + (spread[row] ? step : 0)
    }
    overrun += Math.max(0, cursor - target)
  }
  const durationMs = marks.at(-1) + overrun
  for (const [index, participant] of ['SPECTER', 'ZERO', 'GHOST', 'ROOT', 'ORACLE'].entries()) {
    events.push({ atMs: durationMs - 9300 + index * 950, type: 'participant_left', participant })
  }
  events.push({ atMs: durationMs - 4550, type: 'session_ended' })
  return { cues: timed, scenario: { id: '7F92A1', presentation: 'session-001', utcStart: '2026-02-18T23:41:08Z',
    durationMs, participants: speakers, events } }
}

async function run() {
  const [mode = 'estimate', directory = 'production/session-001'] = process.argv.slice(2)
  if (!['estimate', 'measure', 'smoke', 'synthesize'].includes(mode)) {
    throw new Error('Use estimate, measure, smoke, or synthesize.')
  }
  const output = resolve(directory)
  const audio = join(output, mode === 'synthesize' ? 'audio-foundry' : 'audio')
  if (mode === 'smoke') {
    const wav = await createFoundryTts()('ORACLE', 'This is a short audio connection test.')
    const duration = wavDurationMs(wav)
    await mkdir(output, { recursive: true })
    await writeFile(join(output, 'foundry-smoke.wav'), wav)
    console.log(`Foundry connection verified. WAV duration: ${duration} ms.`)
    return
  }
  const source = await readFile(new URL('../docs/SCRIPT_SESSION_001.md', import.meta.url), 'utf8')
  const cues = readCues(source)
  const measured = new Map()
  if (mode === 'synthesize') {
    if (!process.argv.includes('--approve-paid-tts')) throw new Error('Pass --approve-paid-tts after confirming Foundry TTS charges.')
    const synthesize = createFoundryTts()
    await mkdir(audio, { recursive: true })
    for (const cue of cues.filter(cue => cue.audioAssetId)) {
      const path = join(audio, `${cue.audioAssetId}.wav`)
      try {
        wavDurationMs(await readFile(path))
        continue
      } catch (error) {
        if (error.code !== 'ENOENT') throw error
      }
      const wav = await synthesize(cue.speaker, cue.en).catch(error => {
        throw new Error(`${cue.id}: ${error.message}`, { cause: error })
      })
      wavDurationMs(wav)
      await writeFile(path + '.tmp', wav)
      await rename(path + '.tmp', path)
    }
  }
  if (mode !== 'estimate') {
    for (const cue of cues.filter(cue => cue.audioAssetId)) {
      measured.set(cue.id, wavDurationMs(await readFile(join(audio, `${cue.audioAssetId}.wav`))))
    }
  }
  const production = plan(cues, measured)
  await mkdir(output, { recursive: true })
  for (const [name, value] of [
    ['cues.json', { timing: mode === 'estimate' ? 'estimated' : 'measured', cues: production.cues }],
    ['scenario.json', production.scenario],
  ]) {
    await writeFile(join(output, name), JSON.stringify(value, null, 2) + '\n')
  }
  console.log(`${production.cues.length} cues, ${measured.size} measured voice clips, ${production.scenario.durationMs / 1000}s`)
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await run()
