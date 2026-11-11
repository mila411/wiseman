import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { flushSync } from 'react-dom'
import { captureSize, frameAt } from './export'
import { scenario as defaultScenario, type Scenario } from './timeline'
import { importAudio, scheduleAudio, type AudioAssets } from './scenario-audio'
import { validateScenario } from './import-scenario'
import { waveformBars } from './waveform'
import './style.css'

type IconName = 'lock' | 'mic' | 'phone' | 'settings'

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 1 1 8 0v3m-4 4v3"/></>,
    mic: <><rect x="9" y="2" width="6" height="13" rx="3"/><path d="M5 10v2a7 7 0 0 0 14 0v-2m-7 9v3m-3 0h6"/></>,
    phone: <path d="M3 14a14 14 0 0 1 18 0l-2 4-4-2v-3a10 10 0 0 0-6 0v3l-4 2z"/>,
    settings: <><path d="M4 6h16M4 12h16M4 18h16"/><path d="M8 4v4m8 2v4m-6 2v4"/></>,
  }
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function Avatar() {
  return <span className="avatar" aria-hidden="true">
    <svg viewBox="0 0 48 48" fill="none"><circle cx="24" cy="17" r="6"/><path d="M12 36c0-6.6 5.4-11 12-11s12 4.4 12 11"/></svg>
  </span>
}

type Frame = ReturnType<typeof frameAt>

function Participant({ participant }: { participant: Frame['participants'][number] }) {
  const { name, connected, waveform, caption } = participant
  return <li className={waveform ? 'participant speaking' : 'participant'}>
    <Avatar />
    <div className="participant-details">
      <h2>{name}</h2>
      {caption && <p className="caption">
        <span lang="en" tabIndex={0}>{caption.en}</span>
        {caption.ru && <span className="caption-secondary" lang="ru" tabIndex={0}>{caption.ru}</span>}
        {caption.jaPronunciation && <span className="caption-secondary" lang="ja" tabIndex={0}>{caption.jaPronunciation}</span>}
      </p>}
    </div>
    <div className="participant-signal">
      {waveform && <svg className="waveform" viewBox={`0 0 ${waveformBars * 4} 40`} aria-hidden="true">
        {waveform.map((height, index) => <rect key={index} x={index * 4 + 1} y={(40 - height) / 2} width="2" height={height} rx="1"/>)}
      </svg>}
      <span className="participant-status"><i />{waveform ? 'Speaking' : connected ? 'Connected' : 'Disconnected'}</span>
    </div>
  </li>
}

function Conference({ frame, sessionId, presentation, disconnect }: {
  frame: Frame; sessionId: string; presentation?: Scenario['presentation']; disconnect: () => void
}) {
  const production = presentation === 'session-001'
  const privateSession = <h2 id="session-title"><Icon name="lock"/> PRIVATE SESSION</h2>
  const summary = <p>Encrypted voice conference · {frame.participants.length} participants</p>
  const connected = frame.participants.some(participant => participant.connected)
  return <main className={`conference${production ? ' research-session' : ''}${production && frame.timeMs < 900 ? ' opening' : ''}`}
    style={{ aspectRatio: `${captureSize.width} / ${captureSize.height}` }}>
    <header className="top">
      <div className="call-heading">
        {production && privateSession}
        <h1>WISEMAN</h1>
        {production && summary}
      </div>
      <div className="clock"><time dateTime={frame.utc}>{frame.utc.slice(11, 19)}</time> <span>UTC</span></div>
      <div className={frame.ended ? 'connection disconnected' : 'connection'}><i />{frame.ended
        ? 'DISCONNECTED' : production && !connected ? 'CONNECTING' : 'CONNECTED'}
        {production && connected && <svg className="signal" viewBox="0 0 16 12" aria-hidden="true">
          <path d="M2 11V9m4 2V7m4 4V4m4 7V1" stroke="currentColor" strokeWidth="1.7" fill="none"/>
        </svg>}
      </div>
    </header>
    <section className="session" aria-labelledby="session-title">
      {!production && <div className="session-heading">{privateSession}{summary}</div>}
      <ul className="participants" aria-label="Conference participants">
        {frame.participants.map(participant => <Participant key={participant.name} participant={participant}/>)}
      </ul>
    </section>
    <footer className="bottom">
      <div className="session-id">SESSION ID <strong>{sessionId}</strong></div>
      <div className="call-controls">
        <button className="utility" type="button" disabled aria-label="Microphone unavailable in prototype" title="Microphone unavailable in prototype"><Icon name="mic"/></button>
        <button className="hangup" type="button" aria-label="Disconnect" disabled={frame.ended} onClick={disconnect}><Icon name="phone"/>{!production && ' Disconnect'}</button>
        <button className="utility" type="button" disabled aria-label="Settings unavailable in prototype" title="Settings unavailable in prototype"><Icon name="settings"/></button>
      </div>
    </footer>
    {production && frame.ended && <div className="termination">
      <p>SECURE SESSION TERMINATED</p>
      <p>END OF TRANSMISSION</p>
    </div>}
  </main>
}

function App() {
  const [scenario, setScenario] = useState(defaultScenario)
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [playbackVersion, setPlaybackVersion] = useState(0)
  const [disconnectAt, setDisconnectAt] = useState<number>()
  const [assets, setAssets] = useState<AudioAssets>(new Map())
  const [importing, setImporting] = useState(false)
  const [message, setMessage] = useState('')
  const audioContext = useRef<AudioContext | null>(null)
  const position = useRef(0)
  const playRequest = useRef(0)
  const frame = frameAt(scenario, time, disconnectAt, assets)
  const duration = disconnectAt ?? scenario.durationMs
  const running = playing && time < duration

  useEffect(() => {
    if (!running) return
    const start = position.current
    const context = assets.size || scenario.presentation ? audioContext.current : null
    const now = context ? () => context.currentTime : () => performance.now() / 1000
    const anchor = now()
    const stop = context && scheduleAudio(context, scenario, assets, start, duration, anchor)
    let request: number
    const tick = () => {
      position.current = Math.min(duration, start + (now() - anchor) * 1000)
      setTime(position.current)
      request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(request)
      stop?.()
    }
  }, [assets, duration, playbackVersion, running, scenario])

  async function play(restart = false) {
    const request = ++playRequest.current
    if (assets.size || scenario.presentation) {
      try {
        audioContext.current ??= new AudioContext()
        await audioContext.current.resume()
      } catch {
        setMessage('Could not start audio playback.')
        return
      }
    }
    if (request !== playRequest.current) return
    if (restart) {
      setDisconnectAt(undefined)
      seek(0)
      setPlaybackVersion(previous => previous + 1)
    }
    setPlaying(true)
  }

  function pause() {
    playRequest.current++
    setPlaying(false)
  }

  function seek(value: number) {
    position.current = value
    setTime(value)
  }

  async function load(files: File[]) {
    pause()
    setImporting(true)
    try {
      const scripts = files.filter(file => /\.json$/i.test(file.name))
      if (scripts.length > 1) throw new Error('Select one scenario JSON file at a time.')
      const next = scripts.length ? validateScenario(JSON.parse(await scripts[0].text())) : scenario
      const clips = files.filter(file => !scripts.includes(file))
      if (clips.length) audioContext.current ??= new AudioContext()
      const imported = clips.length ? await importAudio(audioContext.current!, next, clips) : new Map()
      if (scripts.length) {
        setScenario(next)
        setDisconnectAt(undefined)
        seek(0)
      }
      setAssets(imported)
      setMessage(`Loaded ${imported.size} audio clips. ROOT is silent.`)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Could not import audio.')
    } finally {
      setImporting(false)
    }
  }

  function disconnect() {
    pause()
    setDisconnectAt(time)
    seek(time)
  }

  return <>
    <Conference frame={frame} sessionId={scenario.id} presentation={scenario.presentation} disconnect={disconnect}/>
    <section className="playback" aria-label="Prototype playback">
      <button type="button" disabled={importing || time >= duration} onClick={() => running ? pause() : void play()}>{running ? 'Pause' : 'Play'}</button>
      <button type="button" disabled={importing} onClick={() => void play(true)}>Restart</button>
      <input aria-label="Seek playback" type="range" min="0" max={duration} step="any" value={time} onChange={event => {
        pause()
        seek(Number(event.target.value))
      }}/>
      <output>{(time / 1000).toFixed(2)} s / {(duration / 1000).toFixed(2)} s</output>
    </section>
    <section className="playback" aria-label="Scenario audio">
      <label>Import scenario or audio <input type="file" accept="audio/*,.wav,.mp3,.m4a,.ogg,.json" multiple disabled={importing} onChange={event => {
        const files = Array.from(event.currentTarget.files ?? [])
        event.currentTarget.value = ''
        if (files.length) void load(files)
      }}/></label>
      <span role="status">{importing ? 'Importing audio…' : message}</span>
    </section>
  </>
}

const root = createRoot(document.getElementById('root')!)
if (new URLSearchParams(location.search).has('capture')) {
  let scenario = defaultScenario
  let assets: AudioAssets = new Map()
  const draw = (ms: number) => flushSync(() => root.render(
    <Conference frame={frameAt(scenario, ms, undefined, assets)} sessionId={scenario.id} presentation={scenario.presentation} disconnect={() => {}}/>,
  ))
  Object.assign(window, {
    wisemanCapture: {
      draw,
      async load(files: File[], source?: Scenario, durationMs = 30000) {
        const context = new OfflineAudioContext(1, Math.ceil(durationMs * 48), 48000)
        scenario = source ? validateScenario(source) : defaultScenario
        assets = await importAudio(context, scenario, files)
        scheduleAudio(context, scenario, assets, 0, durationMs, 0)
        return (await context.startRendering()).getChannelData(0)
      },
    },
  })
  draw(0)
} else {
  root.render(<App />)
}
