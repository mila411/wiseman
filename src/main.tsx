import { useEffect, useState } from 'react'
import { captureSize, frameAt } from './export'
import { scenario } from './timeline'
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
  const { name, connected, waveform } = participant
  return <article className={waveform ? 'participant speaking' : 'participant'}>
    <Avatar />
    <h2>{name}</h2>
    <div className="participant-status"><i />{waveform ? 'Speaking' : connected ? 'Connected' : 'Disconnected'}</div>
    <svg className="waveform" viewBox={`0 0 ${waveformBars * 4} 40`} aria-hidden="true">
      {waveform
        ? waveform.map((height, index) => <rect key={index} x={index * 4 + 1} y={(40 - height) / 2} width="2" height={height} rx="1"/>)
        : <path d={`M1 20H${waveformBars * 4 - 1}`}/>}
    </svg>
  </article>
}

function Conference({ frame, disconnect }: { frame: Frame; disconnect: () => void }) {
  const speaker = frame.participants.find(participant => participant.caption)
  const caption = speaker?.caption
  return <main className="conference" style={{ aspectRatio: `${captureSize.width} / ${captureSize.height}` }}>
    <header className="top">
      <div className="private"><Icon name="lock"/> PRIVATE SESSION</div>
      <div className="clock"><time dateTime={frame.utc}>{frame.utc.slice(11, 19)}</time> <span>UTC</span></div>
      <div className={frame.ended ? 'connection disconnected' : 'connection'}><i />{frame.ended ? 'DISCONNECTED' : 'CONNECTED'}</div>
    </header>
    <section className="session" aria-labelledby="session-title">
      <h1 id="session-title">WISEMAN</h1>
      <p>Encrypted voice conference <span aria-hidden="true">·</span> {frame.participants.length} participants</p>
      <div className="participants">{frame.participants.map(participant => <Participant key={participant.name} participant={participant}/>)}</div>
      <div className="caption-slot">
        {caption && <div className="caption">
          <span className="caption-speaker">{speaker.name}</span>
          <span className="caption-text" lang="en">{caption.en}</span>
          {caption.ru && <span className="caption-secondary" lang="ru">{caption.ru}</span>}
          {caption.jaPronunciation && <span className="caption-secondary" lang="ja">{caption.jaPronunciation}</span>}
        </div>}
      </div>
    </section>
    <footer className="bottom">
      <div className="session-id">SESSION ID <strong>{scenario.id}</strong></div>
      <div className="call-controls">
        <button className="utility" type="button" disabled aria-label="Microphone unavailable in prototype" title="Microphone unavailable in prototype"><Icon name="mic"/></button>
        <button className="hangup" type="button" disabled={frame.ended} onClick={disconnect}><Icon name="phone"/> Disconnect</button>
        <button className="utility" type="button" disabled aria-label="Settings unavailable in prototype" title="Settings unavailable in prototype"><Icon name="settings"/></button>
      </div>
      <div className="simulation">LOCAL SIMULATION</div>
    </footer>
  </main>
}

function App() {
  const [time, setTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [disconnectAt, setDisconnectAt] = useState<number>()
  const frame = frameAt(scenario, time, disconnectAt)
  const duration = disconnectAt ?? scenario.durationMs
  const running = playing && time < duration

  useEffect(() => {
    if (!running) return
    let request: number
    let last: number | undefined
    const tick = (timestamp: number) => {
      const delta = last === undefined ? 0 : timestamp - last
      last = timestamp
      setTime(previous => Math.min(duration, previous + delta))
      request = requestAnimationFrame(tick)
    }
    request = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(request)
  }, [duration, running])

  function restart() {
    setDisconnectAt(undefined)
    setTime(0)
    setPlaying(true)
  }

  function disconnect() {
    setPlaying(false)
    setDisconnectAt(time)
    setTime(time)
  }

  return <>
    <Conference frame={frame} disconnect={disconnect}/>
    <section className="playback" aria-label="Prototype playback">
      <button type="button" disabled={time >= duration} onClick={() => setPlaying(!running)}>{running ? 'Pause' : 'Play'}</button>
      <button type="button" onClick={restart}>Restart</button>
      <input aria-label="Seek playback" type="range" min="0" max={duration} step="any" value={time} onChange={event => {
        setPlaying(false)
        setTime(Number(event.target.value))
      }}/>
      <output>{(time / 1000).toFixed(2)} s / {(duration / 1000).toFixed(2)} s</output>
    </section>
  </>
}

import { createRoot } from 'react-dom/client'
createRoot(document.getElementById('root')!).render(<App />)
