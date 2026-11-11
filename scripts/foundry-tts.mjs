import { exec, execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)
const runWindows = promisify(exec)
const tokenArgs = [
  'account', 'get-access-token', '--scope', 'https://cognitiveservices.azure.com/.default',
  '--output', 'json', '--only-show-errors',
]

async function getCliToken() {
  try {
    const options = { windowsHide: true, timeout: 30000 }
    // The Windows launcher is a batch file. Only constant arguments go through the shell.
    const { stdout } = process.platform === 'win32'
      ? await runWindows(`az.cmd ${tokenArgs.join(' ')}`, options)
      : await run('az', tokenArgs, options)
    const data = JSON.parse(stdout)
    if (!data.accessToken) throw new Error('Azure CLI did not return an access token.')
    return {
      value: data.accessToken,
      expiresAt: Number(data.expires_on) * 1000 || Date.now() + 5 * 60 * 1000,
    }
  } catch (error) {
    const stderr = error.stderr?.trim()
    const detail = stderr?.startsWith('Traceback') ? stderr.split(/\r?\n/).at(-1) : stderr
    throw new Error(`Azure CLI token acquisition failed: ${detail || error.message}`)
  }
}

const voices = {
  ORACLE: { voice: 'alloy', delivery: 'Measured and calm, with clear leadership.' },
  GHOST: { voice: 'echo', delivery: 'Matter-of-fact and concise, with a steady lower register.' },
  ZERO: { voice: 'ash', delivery: 'Analytical, precise, and thoughtful.' },
  SPECTER: { voice: 'coral', delivery: 'Composed and conversational, with crisp articulation.' },
}

export function voiceFor(speaker) {
  return Object.hasOwn(voices, speaker) ? voices[speaker].voice : null
}

export function createFoundryTts({
  endpoint = process.env.WISEMAN_OPENAI_ENDPOINT,
  deployment = process.env.WISEMAN_OPENAI_DEPLOYMENT ?? 'gpt-4o-mini-tts',
  getToken = getCliToken,
  send = fetch,
} = {}) {
  const resource = endpoint && new URL(endpoint)
  if (!resource || resource.protocol !== 'https:' || !/^[a-z0-9-]+\.openai\.azure\.com$/.test(resource.hostname) ||
      resource.port || resource.username || resource.password || resource.pathname !== '/' || resource.search || resource.hash) {
    throw new Error('Set WISEMAN_OPENAI_ENDPOINT to the Azure OpenAI resource URL.')
  }
  const url = new URL('/openai/v1/audio/speech', resource)
  let token
  return async function synthesize(speaker, input) {
    if (!voiceFor(speaker)) throw new Error(`No TTS voice assigned to ${speaker}.`)
    if (typeof input !== 'string' || !input.trim() || input.length > 4096) throw new Error('Invalid TTS input.')
    if (!token || token.expiresAt <= Date.now() + 120000) token = await getToken()
    const { voice, delivery } = voices[speaker]
    const response = await send(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token.value}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: deployment,
        voice,
        input,
        instructions: `Speak in natural American English. Read only the input text. ${delivery}`,
        response_format: 'wav',
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}))
      const detail = [payload.error?.code, payload.error?.message].filter(Boolean).join(' — ')
      throw new Error(`Foundry TTS HTTP ${response.status}${detail ? `: ${detail}` : ''}`)
    }
    return Buffer.from(await response.arrayBuffer())
  }
}
