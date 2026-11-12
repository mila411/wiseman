/// <reference types="vite/client" />

import { validateScenario } from './import-scenario'
import { importAudio } from './scenario-audio'

const scenarioFiles = import.meta.glob('../production/session-001-performance/scenario.json', {
  eager: true, import: 'default',
})
const audioUrls = import.meta.glob<string>('../production/session-001-performance/audio-foundry/*.wav', {
  eager: true, import: 'default', query: '?url',
})

export async function loadProductionSession() {
  const directory = '../production/session-001-performance'
  const source = scenarioFiles[directory + '/scenario.json']
  if (!source) throw new Error('Research Session 001 scenario is missing.')
  const scenario = validateScenario(source)
  if (scenario.presentation !== 'session-001') throw new Error('Expected Research Session 001.')

  const assetIds = new Set(scenario.events.flatMap(event =>
    event.type === 'participant_speaking_started' && event.audioAssetId ? [event.audioAssetId] : [],
  ))
  const files = await Promise.all([...assetIds].map(async id => {
    const name = id + '.wav'
    const url = audioUrls[directory + '/audio-foundry/' + name]
    if (!url) throw new Error('Missing audio clip: ' + name)
    const response = await fetch(url)
    if (!response.ok) throw new Error('Could not load audio clip: ' + name)
    return new File([await response.blob()], name, { type: 'audio/wav' })
  }))

  const decoder = new OfflineAudioContext(1, 1, 48000)
  return { scenario, assets: await importAudio(decoder, scenario, files) }
}
