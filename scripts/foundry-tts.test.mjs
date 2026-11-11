import { expect, it, vi } from 'vitest'
import { createFoundryTts } from './foundry-tts.mjs'

const endpoint = 'https://example.openai.azure.com'

it('requests WAVs from the deployment with Entra auth and four distinct voices', async () => {
  const getToken = vi.fn().mockResolvedValue({ value: 'mock-token', expiresAt: Date.now() + 3600000 })
  const send = vi.fn(async () => new Response('mock audio'))
  const synthesize = createFoundryTts({ endpoint, deployment: 'test-deployment', getToken, send })
  await expect(synthesize('ROOT', 'Silent cue.')).rejects.toThrow('No TTS voice')
  expect(send).not.toHaveBeenCalled()
  expect(getToken).not.toHaveBeenCalled()
  for (const name of ['ORACLE', 'GHOST', 'ZERO', 'SPECTER']) {
    expect((await synthesize(name, 'Read this text exactly.')).toString()).toBe('mock audio')
  }
  expect(getToken).toHaveBeenCalledTimes(1)
  const voices = send.mock.calls.map(([url, request]) => {
    expect(url.href).toBe(endpoint + '/openai/v1/audio/speech')
    expect(request.headers.Authorization).toBe('Bearer mock-token')
    const body = JSON.parse(request.body)
    expect(body).toMatchObject({ model: 'test-deployment', input: 'Read this text exactly.', response_format: 'wav' })
    return body.voice
  })
  expect(new Set(voices).size).toBe(4)
})

it('reports the HTTP status and Azure error without retrying the request', async () => {
  const getToken = async () => ({ value: 'mock-token', expiresAt: Date.now() + 3600000 })
  const send = vi.fn(async () => Response.json(
    { error: { code: 'PermissionDenied', message: 'Missing inference permission.' } },
    { status: 403 },
  ))
  await expect(createFoundryTts({ endpoint, getToken, send })('ORACLE', 'Test.'))
    .rejects.toThrow('Foundry TTS HTTP 403: PermissionDenied — Missing inference permission.')
  expect(send).toHaveBeenCalledTimes(1)
})
