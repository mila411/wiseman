export const waveformBars = 47

export function waveformAt(participant: string, timeMs: number, speakingSince: number) {
  const t = Math.max(0, timeMs - speakingSince) / 1000
  const phase = Array.from(participant).reduce((value, char) => value * 31 + char.charCodeAt(0), 0) % 101
  const attack = 1 - Math.exp(-24 * t)
  const syllables = 0.38 + 0.62 * Math.pow(0.5 + 0.5 * Math.sin(9 * t + phase + Math.sin(3 * t)), 1.6)

  return Array.from({ length: waveformBars }, (_, index) => {
    const position = index / (waveformBars - 1)
    const shape = Math.pow(Math.sin(Math.PI * position), 1.35)
    const motion = 0.5 + 0.5 * Math.sin(index * 0.79 + t * 12 + phase + Math.sin(index * 0.32 - t * 5))
    return 2 + attack * shape * syllables * (7 + 29 * motion)
  })
}
