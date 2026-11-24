// Génère 3 fichiers audio de démonstration (ambiances sonores procédurales)
// pour que le lecteur FM fonctionne hors-ligne. Sortie : public/audio/*.wav
// Utilisation : bun scripts/generate-audio.mjs  (idempotent)

import fs from 'fs'
import path from 'path'

const OUT = '/home/z/my-project/public/audio'
fs.mkdirSync(OUT, { recursive: true })

const RATE = 22050

// Séquences d'accords (progressions douces) par fichier
const TRACKS = {
  'demo-journal.wav': {
    seconds: 186,
    root: 220, // La
    chords: [
      [0, 4, 7, 11], // Amaj7
      [-3, 0, 4, 7], // Fmaj7
      [-5, -1, 2, 7], // G? voix douce
      [-1, 2, 6, 9], // B?
    ],
  },
  'demo-memoire.wav': {
    seconds: 204,
    root: 196, // Sol
    chords: [
      [0, 3, 7, 10], // Gm7
      [-5, -1, 2, 5], // Dm7
      [-3, 0, 4, 7], // Bbmaj7
      [-7, -3, 0, 4], // F
    ],
  },
  'demo-grandformat.wav': {
    seconds: 222,
    root: 174.6, // Fa
    chords: [
      [0, 4, 7, 9], // Fmaj6
      [2, 5, 9, 12], // Gm? remontée
      [-3, 0, 4, 9], // Dm6
      [-5, -1, 2, 7], // C7 susp
    ],
  },
}

function writeWav(file, samples) {
  const dataLen = samples.length * 2
  const buf = Buffer.alloc(44 + dataLen)
  buf.write('RIFF', 0)
  buf.writeUInt32LE(36 + dataLen, 4)
  buf.write('WAVE', 8)
  buf.write('fmt ', 12)
  buf.writeUInt32LE(16, 16)
  buf.writeUInt16LE(1, 20) // PCM
  buf.writeUInt16LE(1, 22) // mono
  buf.writeUInt32LE(RATE, 24)
  buf.writeUInt32LE(RATE * 2, 28)
  buf.writeUInt16LE(2, 32)
  buf.writeUInt16LE(16, 34)
  buf.write('data', 36)
  buf.writeUInt32LE(dataLen, 40)
  for (let i = 0; i < samples.length; i++) {
    let v = Math.max(-1, Math.min(1, samples[i]))
    buf.writeInt16LE((v * 32767) | 0, 44 + i * 2)
  }
  fs.writeFileSync(file, buf)
  console.log('OK  ', path.basename(file), `${(buf.length / 1024 / 1024).toFixed(1)} Mo`)
}

function render({ seconds, root, chords }) {
  const n = Math.floor(seconds * RATE)
  const out = new Float64Array(n)
  const beat = 0.72 // secondes par pas d'arpège
  const stepsPerChord = 8
  const chordDur = beat * stepsPerChord

  for (let i = 0; i < n; i++) {
    const t = i / RATE
    const chord = chords[Math.floor(t / chordDur) % chords.length]
    const step = Math.floor((t % chordDur) / beat)
    // Note d'arpège + nappe tenue (2 voix) + sub bass
    const arpFreq = root * Math.pow(2, (chord[step % chord.length] + 12) / 12)
    const pad1 = root * Math.pow(2, chord[0] / 12)
    const pad2 = root * Math.pow(2, chord[2] / 12)
    const sub = root / 2

    // Enveloppes douces
    const stepPhase = (t % beat) / beat
    const arpEnv = Math.pow(1 - stepPhase, 2.2) * 0.32
    const fadeIn = Math.min(1, t / 3)
    const fadeOut = Math.min(1, (seconds - t) / 3)

    const v =
      Math.sin(2 * Math.PI * arpFreq * t) * arpEnv +
      Math.sin(2 * Math.PI * pad1 * t) * 0.14 +
      Math.sin(2 * Math.PI * pad2 * t + 0.7) * 0.12 +
      Math.sin(2 * Math.PI * sub * t) * 0.1
    out[i] = v * 0.75 * fadeIn * Math.max(0, fadeOut)
  }
  return out
}

for (const [file, spec] of Object.entries(TRACKS)) {
  const out = path.join(OUT, file)
  if (fs.existsSync(out) && fs.statSync(out).size > 100000) {
    console.log('SKIP', file)
    continue
  }
  writeWav(out, render(spec))
}
console.log('AUDIO PRÊT ✓')
