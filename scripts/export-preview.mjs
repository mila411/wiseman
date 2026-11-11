import { spawn, spawnSync } from 'node:child_process'
import { once } from 'node:events'
import { mkdtemp, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { setTimeout as delay } from 'node:timers/promises'

const [destination, audioDirectory, scenarioFile] = process.argv.slice(2)
if (!destination?.toLowerCase().endsWith('.mp4')) {
  throw new Error('Usage: npm run export:preview -- preview.mp4 [audio-directory] [scenario.json]')
}
const browserPath = process.env.WISEMAN_BROWSER ?? ({
  win32: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  darwin: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
}[process.platform] ?? 'chromium')
const ffmpeg = process.env.FFMPEG ?? 'ffmpeg'
if (spawnSync(ffmpeg, ['-version'], { stdio: 'ignore' }).status !== 0) {
  throw new Error('Install FFmpeg or point FFMPEG to its executable.')
}

const dist = new URL('../dist/', import.meta.url)
await readFile(new URL('index.html', dist))
const scenario = scenarioFile ? JSON.parse(await readFile(scenarioFile, 'utf8')) : null
const names = audioDirectory ? await readdir(audioDirectory) : []
const files = await Promise.all(names.filter(name => /\.(wav|mp3|m4a|ogg|flac|aac|opus)$/i.test(name)).map(async name => ({
  name,
  data: (await readFile(join(audioDirectory, name))).toString('base64'),
})))

const output = resolve(destination)
const scratch = await mkdtemp(join(dirname(output), '.wiseman-'))
const profile = await mkdtemp(join(tmpdir(), 'wiseman-browser-'))
const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url, 'http://localhost')
  const path = pathname === '/' ? 'index.html' : pathname.slice(1)
  if (!/^(index\.html|assets\/[\w.-]+\.(js|css))$/.test(path)) {
    response.writeHead(404).end()
    return
  }
  try {
    const body = await readFile(new URL(path, dist))
    const mime = { html: 'text/html', css: 'text/css', js: 'text/javascript' }
    response.writeHead(200, { 'Content-Type': mime[path.split('.').pop()] }).end(body)
  } catch {
    response.writeHead(404).end()
  }
})

let browser, socket, encoder
try {
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  browser = spawn(browserPath, [
    '--headless=new', '--no-first-run', '--remote-debugging-port=0',
    `--user-data-dir=${profile}`, 'about:blank',
  ], { stdio: 'ignore', windowsHide: true })
  let launchError
  browser.on('error', error => { launchError = error })
  let target
  for (let attempt = 0; attempt < 100 && !target; attempt++) {
    if (launchError) throw launchError
    try {
      const [port] = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split(/\s+/)
      const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
      target = targets.find(item => item.type === 'page')
    } catch {}
    if (!target) await delay(100)
  }
  if (!target) throw new Error('Could not start a headless Edge or Chrome session. Check WISEMAN_BROWSER.')
  socket = new WebSocket(target.webSocketDebuggerUrl)
  await once(socket, 'open')
  let id = 0
  const pending = new Map()
  socket.addEventListener('message', event => {
    const message = JSON.parse(event.data)
    const callbacks = pending.get(message.id)
    if (!callbacks) return
    pending.delete(message.id)
    if (message.error) callbacks.reject(new Error(message.error.message))
    else callbacks.resolve(message.result)
  })
  socket.addEventListener('close', () => {
    for (const { reject } of pending.values()) reject(new Error('Browser connection closed.'))
    pending.clear()
  })
  function call(method, params) {
    return new Promise((resolve, reject) => {
      const requestId = ++id
      socket.send(JSON.stringify({ id: requestId, method, params }))
      pending.set(requestId, { resolve, reject })
    })
  }
  async function evaluate(expression) {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text)
    return result.result.value
  }
  await call('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
  await call('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/?capture` })
  for (let attempt = 0; attempt < 100; attempt++) {
    if (await evaluate('Boolean(window.wisemanCapture)').catch(() => false)) break
    if (attempt === 99) throw new Error('The WISEMAN capture page did not load.')
    await delay(100)
  }
  // Send each asset separately so a batch of clips need not fit in one browser message.
  await evaluate('window.previewFiles = []')
  for (const { name, data } of files) {
    await evaluate(`window.previewFiles.push(new File([Uint8Array.fromBase64(${JSON.stringify(data)})], ${JSON.stringify(name)}))`)
  }
  await evaluate(`window.wisemanCapture.load(window.previewFiles, ${JSON.stringify(scenario)})
    .then(samples => { window.previewAudio = samples })`)
  const raw = join(scratch, 'audio.f32')
  const chunks = []
  for (let offset = 0; offset < 30 * 48000; offset += 48000) {
    const bytes = await evaluate(`new Uint8Array(window.previewAudio.buffer, ${offset * 4}, 192000).toBase64()`)
    chunks.push(Buffer.from(bytes, 'base64'))
  }
  await writeFile(raw, Buffer.concat(chunks))

  const fps = 15
  const temporaryOutput = join(scratch, 'preview.mp4')
  encoder = spawn(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'image2pipe', '-framerate', String(fps), '-vcodec', 'mjpeg', '-i', 'pipe:0',
    '-f', 'f32le', '-ar', '48000', '-ac', '1', '-i', raw,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-ar', '44100', '-movflags', '+faststart', '-t', '30', temporaryOutput,
  ], { stdio: ['pipe', 'inherit', 'inherit'], windowsHide: true })
  let encoderError
  const encoded = once(encoder, 'exit').catch(error => { encoderError = error; return [null] })
  encoder.stdin.on('error', error => { encoderError = error })
  for (let frame = 0; frame < 30 * fps; frame++) {
    if (encoderError) throw encoderError
    await evaluate(`window.wisemanCapture.draw(${frame * 1000 / fps})`)
    const { data } = await call('Page.captureScreenshot', { format: 'jpeg', quality: 92 })
    if (!encoder.stdin.write(Buffer.from(data, 'base64'))) await once(encoder.stdin, 'drain')
    if ((frame + 1) % (5 * fps) === 0) console.log(`Rendered ${(frame + 1) / fps}/30 seconds`)
  }
  encoder.stdin.end()
  const [code] = await encoded
  if (encoderError) throw encoderError
  if (code !== 0) throw new Error(`FFmpeg exited with status ${code}`)
  await rename(temporaryOutput, output)
  console.log(output)
} finally {
  socket?.close()
  if (encoder?.exitCode === null) encoder.kill()
  if (browser?.pid && browser.exitCode === null) {
    browser.kill()
    await once(browser, 'exit').catch(() => {})
  }
  server.close()
  await Promise.all([
    rm(scratch, { recursive: true, force: true, maxRetries: 3 }),
    rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {}),
  ])
}
