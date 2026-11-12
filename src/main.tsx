import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { frameAt } from './session-frame'
import type { Scenario } from './timeline'
import { scheduleAudio } from './scenario-audio'
import { loadProductionSession } from './production-session'
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
const meetingTitle = 'WISEMAN - Regarding the Latest iOS Vulnerability'

function Participant({ participant }: { participant: Frame['participants'][number] }) {
  const { name, connected, waveform } = participant
  return <div className={waveform ? 'participant speaking' : 'participant'}>
    <Avatar />
    <h2>{name}</h2>
    <span className="participant-status"><i />{waveform ? 'Speaking' : connected ? 'Connected' : 'Disconnected'}</span>
    <svg className="waveform" viewBox={`0 0 ${waveformBars * 4} 40`} aria-hidden="true">
      {waveform
        ? waveform.map((height, index) => <rect key={index} x={index * 4 + 1} y={(40 - height) / 2} width="2" height={height} rx="1"/>)
        : <path d={`M1 20H${waveformBars * 4 - 1}`}/>}
    </svg>
  </div>
}

const exampleNetworks = ['192.0.2', '198.51.100', '203.0.113']

function SourceActivity({ live }: { live: boolean }) {
  const [entries, setEntries] = useState<{ id: number; utc: string; event: string; source: string }[]>([])
  const nextId = useRef(0)

  useEffect(() => {
    if (!live) return
    let timer: number
    function append() {
      const rotate = Math.random() < 0.7
      const entry = {
        id: nextId.current++,
        utc: new Date().toISOString(),
        event: rotate ? 'MASK ROTATED' : 'ALIAS CHANGED',
        source: rotate
          ? `${exampleNetworks[Math.floor(Math.random() * exampleNetworks.length)]}.${1 + Math.floor(Math.random() * 254)}`
          : `RELAY-${String(1 + Math.floor(Math.random() * 99)).padStart(2, '0')}`,
      }
      setEntries(previous => [...previous.slice(-2), entry])
      timer = window.setTimeout(append, 1000 + Math.random() * 3000)
    }
    append()
    return () => window.clearTimeout(timer)
  }, [live])

  return <aside className="source-activity" aria-label="Simulated source activity">
    <header><span>SOURCE ACTIVITY</span><span className={live ? 'source-live' : undefined}><i />{live ? 'LIVE' : 'OFFLINE'}</span></header>
    <ol>
      {entries.map(({ id, utc, event, source }) => <li key={id}>
        <time dateTime={utc} title="UTC">{utc.slice(11, 19)}</time><span>{event}</span><span>{source}</span>
      </li>)}
    </ol>
  </aside>
}

function UtcClock() {
  const [utc, setUtc] = useState(() => new Date().toISOString())

  useEffect(() => {
    let timer: number
    function tick() {
      const now = new Date()
      setUtc(now.toISOString())
      timer = window.setTimeout(tick, 1000 - now.getUTCMilliseconds())
    }
    tick()
    return () => window.clearTimeout(timer)
  }, [])

  return <div className="clock"><time dateTime={utc}>{utc.slice(11, 19)}</time> <span>UTC</span></div>
}

function Conference({ frame, sessionId, presentation, disconnect, playback }: {
  frame: Frame; sessionId: string; presentation?: Scenario['presentation']; disconnect: () => void
  playback: { version: number; running: boolean; ended: boolean; toggle: () => void; restart: () => void }
}) {
  const production = presentation === 'session-001'
  const privateLabel = <><Icon name="lock"/> PRIVATE SESSION</>
  const privateSession = <div className="private">
    <span className="service-name"><span aria-hidden="true">🧅</span> NULL LINE</span>
    <button className="heading-control" type="button" aria-label="PRIVATE SESSION — Restart" onClick={playback.restart}>{privateLabel}</button>
  </div>
  const connectedCount = frame.participants.filter(participant => participant.connected).length
  const summary = <p>Private voice session · {connectedCount} {connectedCount === 1 ? 'participant' : 'participants'}</p>
  const connected = connectedCount > 0
  const participantColumns = frame.participants.map(participant => participant.connected ? '20%' : '0%').join(' ')
  const sourceLive = !frame.ended && (!production || connected)
  return <main className={`conference${production && playback.running && frame.timeMs < 900 ? ' opening' : ''}`}>
    <header className="top">
      {privateSession}
      <UtcClock/>
      <div className={frame.ended ? 'connection disconnected' : 'connection'}><i />{frame.ended
        ? 'DISCONNECTED' : production && !connected ? 'CONNECTING' : 'CONNECTED'}</div>
    </header>
    <section className="session" aria-labelledby="session-title">
      <h1 id="session-title">
        <button className="heading-control" type="button" aria-label={meetingTitle + (playback.running ? ' — Pause' : ' — Play')}
          disabled={playback.ended} onClick={playback.toggle}>{meetingTitle}</button>
      </h1>
      {summary}
      <ul className="participants" aria-label="Conference participants" key={playback.version}
          style={{ gridTemplateColumns: participantColumns }}>
        {frame.participants.map(participant => (
          <li className="participant-slot" key={participant.name} aria-hidden={!participant.connected}>
            <Participant participant={participant}/>
          </li>
        ))}
      </ul>
      <div className="caption-slot">
        {frame.participants.map(({ name, caption }) => caption && (
          <p className="caption" key={name}>
            <span className="caption-speaker">{name}</span>
            <span lang="en" tabIndex={0}>{caption.en}</span>
            {caption.ru && <span className="caption-secondary" lang="ru" tabIndex={0}>{caption.ru}</span>}
            {caption.jaPronunciation && <span className="caption-secondary" lang="ja" tabIndex={0}>{caption.jaPronunciation}</span>}
          </p>
        ))}
      </div>
    </section>
    <SourceActivity key={playback.version} live={sourceLive}/>
    <footer className="bottom">
      <div className="session-id">SESSION ID <strong>{sessionId}</strong></div>
      <div className="call-controls">
        <button className="utility" type="button" disabled aria-label="Microphone unavailable in prototype" title="Microphone unavailable in prototype"><Icon name="mic"/></button>
        <button className="hangup" type="button" aria-label="Disconnect" disabled={frame.ended} onClick={disconnect}><Icon name="phone"/> Disconnect</button>
        <button className="utility" type="button" disabled aria-label="Settings unavailable in prototype" title="Settings unavailable in prototype"><Icon name="settings"/></button>
      </div>
      <div className="source-status"><span>ONION SERVICE</span><span>{sourceLive ? 'SOURCE MASK ACTIVE' : 'SOURCE MASK INACTIVE'}</span></div>
    </footer>
    {production && frame.ended && <div className="termination">
      <p>SECURE SESSION TERMINATED</p>
      <p>END OF TRANSMISSION</p>
    </div>}
  </main>
}

function App({ scenario, assets }: Awaited<ReturnType<typeof loadProductionSession>>) {
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [playbackVersion, setPlaybackVersion] = useState(0)
  const [disconnectAt, setDisconnectAt] = useState<number>()
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

  useEffect(() => {
    const context = new AudioContext()
    audioContext.current = context
    let active = true
    void context.resume().then(() => {
      if (active && playRequest.current === 0) {
        setPlaying(true)
      }
    }).catch(() => {})
    return () => {
      active = false
      audioContext.current = null
      void context.close()
    }
  }, [])

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
    setMessage('')
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

  function disconnect() {
    pause()
    setDisconnectAt(time)
    seek(time)
  }

  return <>
    <Conference frame={frame} sessionId={scenario.id} presentation={scenario.presentation} disconnect={disconnect}
      playback={{
        version: playbackVersion,
        running,
        ended: time >= duration,
        toggle: () => running ? pause() : void play(),
        restart: () => void play(true),
      }}/>
    {message && <p role="alert">{message}</p>}
  </>
}

const root = createRoot(document.getElementById('root')!)
root.render(<p role="status">Loading Research Session 001…</p>)
void loadProductionSession().then(session => {
  root.render(<App {...session}/>)
}).catch(error => {
  root.render(<p role="alert">{error instanceof Error ? error.message : 'Could not load Research Session 001.'}</p>)
})
