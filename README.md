# WISEMAN

WISEMAN is a fictional voice-conference simulation. The local app opens Research Session 001.

## macOS setup

Install Node.js 24 and run these commands from the repository root:

```sh
npm ci
npm run dev
```

Open the URL Vite prints. The repository includes the scenario and WAV files needed for playback. Audio generation tools are optional for running the app.

## Windows setup

Install Node.js 24 and open PowerShell in the project directory.

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

## Scenario and playback

- `src/scenario.json` lists the participants, UTC start time, and ordered events in milliseconds. Starts are inclusive and ends are exclusive. For a speaker handoff, place the ending event first when two events share a timestamp.
- `src/timeline.ts` derives session state at any playback timestamp. `src/waveform.ts` derives waveform samples from the speaker and playback position.
- Interactive playback uses the scenario and WAV files under `production/session-001-performance`. Keep these local assets available when starting Vite or building the app.
- Audio starts with the speaking event and stops at the speaking end or disconnect. The waveform uses sample peaks from the decoded clip. Missing clips and ROOT use the existing visual waveform and remain silent. The bundled scenario has speaking turns for ORACLE, GHOST, ZERO, and ROOT. A scenario with a SPECTER turn can use a SPECTER clip as well.
- `src/session-frame.ts` derives captions, waveforms, and participant state at the current playback position.

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
