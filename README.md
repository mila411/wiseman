# WISEMAN

WISEMAN is a fictional, local, 30-second voice-conference simulation. Audio files stay on the machine running the preview.

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
- Use **Import scenario or audio** below the conference to select local WAV or other browser-decodable audio files. You can include a scenario JSON file, which resets playback to the start. Name a reusable clip after its participant (for example, `ORACLE.wav`), or name it after a participant and a speaking start timestamp (for example, `ORACLE-0.wav`). The timestamp-specific clip takes precedence. Each import replaces the previous set after every file decodes successfully.
- Audio starts with the speaking event, seeks with playback, and stops at the speaking end or disconnect. The waveform uses sample peaks from the decoded clip. Missing clips and ROOT use the existing visual waveform and remain silent. The bundled scenario has speaking turns for ORACLE, GHOST, ZERO, and ROOT. A scenario with a SPECTER turn can use a SPECTER clip as well.
- `src/export.ts` exposes frame data for a specified timestamp and the 1920 by 1080 capture dimensions.
- For a cinematic capture, use a 1920 by 1080 browser viewport at 100% zoom with the page scrolled to the top. The playback controls sit immediately below the frame.

## Export a 30-second MP4

Install FFmpeg with H.264 (`libx264`) and AAC encoding and make it available on PATH, or set `FFMPEG` to its executable path. The exporter uses Edge on Windows, Chrome on macOS, or Chromium on Linux by default. Set `WISEMAN_BROWSER` if your browser is elsewhere.

```powershell
npm.cmd run build
npm.cmd run export:preview -- preview.mp4 ./audio
npm.cmd run export:preview -- preview.mp4 ./audio ./alternate-scenario.json
```

The exporter renders the first 30 seconds at 1920×1080 and 15 fps. It uses the same conference UI and mixes the local audio from the same speaking intervals. Omit the audio directory for a silent MP4. An alternate scenario uses the same format as `src/scenario.json`.
