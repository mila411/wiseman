# WISEMAN

WISEMAN is a fictional voice-conference simulation. The local app opens Research Session 001.

## macOS setup

Install Node.js 22 or later and run these commands from the repository root:

```sh
npm ci
npm run dev
```

Open the URL Vite prints. The repository includes the scenario and WAV files needed for playback. Audio generation and video export tools are optional for running the app.

## Windows setup

Install Node.js 22 or later and open PowerShell in the project directory.

```powershell
npm.cmd ci --cache .npm-cache
npm.cmd run dev
```

Open the local URL Vite prints. The app loads the measured scenario and its WAV clips, then starts playback automatically when the browser permits audio autoplay. Select **WISEMAN** to play or pause, including when the browser blocks autoplay. Select **PRIVATE SESSION** to restart from the beginning. Disconnect ends the current run at the current playback timestamp. Microphone and settings are disabled in Phase 1.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd exec -- vite preview
```

## Scenario and capture

- `src/scenario.json` lists the participants, UTC start time, and ordered events in milliseconds. Starts are inclusive and ends are exclusive. For a speaker handoff, place the ending event first when two events share a timestamp.
- `src/timeline.ts` derives session state at any playback timestamp. `src/waveform.ts` derives waveform samples from the speaker and playback position.
- Interactive playback uses the scenario and WAV files under `production/session-001-performance`. Keep these local assets available when starting Vite or building the app.
- Audio starts with the speaking event and stops at the speaking end or disconnect. The waveform uses sample peaks from the decoded clip. Missing clips and ROOT use the existing visual waveform and remain silent. The bundled scenario has speaking turns for ORACLE, GHOST, ZERO, and ROOT. A scenario with a SPECTER turn can use a SPECTER clip as well.
- `src/export.ts` exposes frame data for a specified timestamp and the 1920 by 1080 capture dimensions.
- For a cinematic capture, use a 1920 by 1080 browser viewport at 100% zoom with the page scrolled to the top.

## Export a 30-second MP4

Install FFmpeg with H.264 (`libx264`) and AAC encoding and make it available on PATH, or set `FFMPEG` to its executable path. The exporter uses Edge on Windows, Chrome on macOS, or Chromium on Linux by default. Set `WISEMAN_BROWSER` if your browser is elsewhere.

```powershell
npm.cmd run build
npm.cmd run export:preview -- preview.mp4 ./audio
npm.cmd run export:preview -- preview.mp4 ./audio ./alternate-scenario.json
```

The exporter renders the first 30 seconds at 1920×1080 and 15 fps. It uses the same conference UI and mixes the local audio from the same speaking intervals. Omit the audio directory for a silent MP4. An alternate scenario uses the same format as `src/scenario.json`.

## Research Session 001

The source script is in `docs/SCRIPT_SESSION_001.md` and the current performance edits are in `scripts/session-001-performance-directions.mjs`. The measured dialogue and timings are in `production/session-001-performance/cues.json`. The separate fact check is in `docs/SESSION_001_FACT_CHECK.md`.

The app uses the existing measured production assets. To generate an estimated timeline separately, run `npm.cmd run session:001 -- estimate production/session-001-estimate`. The scripted Russian line includes its original Cyrillic and katakana pronunciation. The other cues have empty Russian and pronunciation fields because the source contains no translations for those lines.

For production narration, sign in to Azure CLI with Microsoft Entra ID in the resource tenant. At the Azure OpenAI resource scope, give the signed-in identity the **Cognitive Services OpenAI User** role. Set the resource URL and deployment name, then run the one-request connection test:

```powershell
az login --tenant <tenant-id>
$env:WISEMAN_OPENAI_ENDPOINT = 'https://wiseman-tts-project-resource.openai.azure.com'
$env:WISEMAN_OPENAI_DEPLOYMENT = 'gpt-4o-mini-tts'
npm.cmd run session:001 -- smoke
```

The CLI obtains a bearer token for `https://cognitiveservices.azure.com/.default`. The connection test writes `production/session-001/foundry-smoke.wav`. If Azure CLI fails before sending the request, check sign-in and access to its profile directory. For a 401, check the resource tenant and token audience. For a 403, check the resource-level role and network restrictions.

After approving the batch charges:

```powershell
node scripts/session-001-performance.mjs --approve-paid-tts
```

The generator requests alloy for ORACLE, echo for GHOST, ash for ZERO, and coral for SPECTER. It saves WAVs by cue ID in `production/session-001-performance/audio-foundry` and reuses existing takes. ROOT stays silent. To rebuild timings from the existing WAVs, run `node scripts/session-001-performance.mjs --retime`.

```powershell
npm.cmd run build
npm.cmd run export:preview -- session-001.mp4 production/session-001-performance/audio-foundry production/session-001-performance/scenario.json --full --fps=60
```

The full exporter captures each frame at 1920×1080. Use `--fps=30` if render time is impractical at 60 fps. A 7:45 runtime needs 27,900 captures at 60 fps. Playback and export use the same source events and clip IDs.
