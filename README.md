# WISEMAN

WISEMAN is a fictional, local, 30-second voice-conference simulation. Phase 1 runs without a backend or audio playback.

## Windows setup

Install Node.js 22 or later and open PowerShell in the project directory.

```powershell
npm.cmd ci --cache .npm-cache
npm.cmd run dev
```

Open the local URL Vite prints. The prototype starts paused at 0 seconds. The playback controls below the conference frame support play, pause, restart, and seeking. Disconnect ends the current run at the current playback timestamp. Restart starts a fresh run. Microphone and settings are disabled in Phase 1.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd exec -- vite preview
```

## Scenario and capture

- `src/scenario.json` lists the participants, UTC start time, and ordered events in milliseconds. Starts are inclusive and ends are exclusive. For a speaker handoff, place the ending event first when two events share a timestamp.
- `src/timeline.ts` derives session state at any playback timestamp. `src/waveform.ts` derives waveform samples from the speaker and playback position.
- `src/audio.ts` maps optional future local audio tracks to the current speaker and offset. ROOT always returns a silent cue.
- `src/export.ts` exposes frame data for a specified timestamp and the 1920 by 1080 capture dimensions.
- For a cinematic capture, use a 1920 by 1080 browser viewport at 100% zoom with the page scrolled to the top. The playback controls sit immediately below the frame.
