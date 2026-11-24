// Génération des visuels éditoriaux de démonstration (§ seed)
// Utilisation : bun scripts/generate-images.mjs  (idempotent, ignore les fichiers existants)

import ZAI from 'z-ai-web-dev-sdk'
import sharp from 'sharp'
import fs from 'fs'

const OUT = '/home/z/my-project/public/images'
fs.mkdirSync(OUT, { recursive: true })

const STYLE =
  'editorial news photography, natural colors, high quality, detailed, no text, no watermark, photojournalism'

const SPECS = [
  ['hero-politique.jpg', 'French parliament hemicycle during an intense night session, deputies at desks, warm dramatic lighting'],
  ['hero-economie.jpg', 'Stock exchange trading screens with rising green financial charts, financial district glass towers at dusk'],
  ['hero-economie-2.jpg', 'Modern energy infrastructure with wind turbines and power lines at golden hour'],
  ['hero-sport.jpg', 'Football stadium at night under floodlights during a decisive match, players celebrating a goal'],
  ['hero-tech.jpg', 'Students and engineers collaborating with artificial intelligence on large screens in a modern tech campus'],
  ['hero-culture.jpg', 'Film festival red carpet at night with photographers flashes and elegant crowd'],
  ['hero-culture-2.jpg', 'Art exhibition gallery with visitors contemplating large modern paintings'],
  ['hero-culture-3.jpg', 'Autumn city street with theater posters and a cultural venue entrance, warm evening light'],
  ['hero-education.jpg', 'School classroom with a teacher helping pupils, bright natural light, notebooks and books'],
  ['hero-international.jpg', 'International summit meeting room with rows of national flags, diplomatic conference table'],
  ['hero-sante.jpg', 'Hospital emergency department corridor with medical staff in scrubs moving quickly, urgency atmosphere'],
  ['hero-societe.jpg', 'Construction site of new apartment buildings with cranes at sunrise'],
  ['hero-societe-2.jpg', 'Seaside resort promenade with tourists walking at late summer, soft light'],
  ['hero-societe-3.jpg', 'Family caregiver helping an elderly person at home, warm interior, compassionate moment'],
  ['hero-transports.jpg', 'Modern high-speed express train leaving a glass-roofed railway station, motion blur'],
  ['hero-interview.jpg', 'Radio studio interview table with professional microphone and headphones, warm light, on-air sign'],
  ['hero-police.jpg', 'Police investigation scene at night in a city street, patrol car lights reflecting on wet asphalt'],
  ['hero-police-2.jpg', 'Speed radar camera tower on a highway at dusk with car light trails'],
  ['hero-port.jpg', 'Container port at night with large cranes and dock workers, industrial atmosphere, artificial lights'],
  ['radio-journal.jpg', 'Professional radio broadcast studio microphone with glowing on-air sign, morning light'],
  ['radio-memoire.jpg', 'Vintage radio receivers and cassette tapes on a wooden table, nostalgic warm tones'],
  ['radio-grandformat.jpg', 'Audio documentary concept with headphones resting on a folded map and a reporter notebook, moody light'],
]

async function genOne(zai, [file, subject], attempt = 1) {
  const out = `${OUT}/${file}`
  if (fs.existsSync(out) && fs.statSync(out).size > 10000) {
    console.log('SKIP', file)
    return true
  }
  try {
    const res = await zai.images.generations.create({ prompt: `${subject}, ${STYLE}`, size: '1344x768' })
    const base64 = res?.data?.[0]?.base64
    if (!base64) throw new Error('réponse vide')
    await sharp(Buffer.from(base64, 'base64'))
      .resize(1280, 720, { fit: 'cover' })
      .jpeg({ quality: 80, mozjpeg: true })
      .toFile(out)
    console.log('OK  ', file)
    return true
  } catch (err) {
    console.error(`FAIL ${file} (essai ${attempt}) :`, err.message)
    if (attempt < 3) {
      await new Promise((r) => setTimeout(r, 1500 * attempt))
      return genOne(zai, [file, subject], attempt + 1)
    }
    return false
  }
}

async function main() {
  const zai = await ZAI.create()
  const queue = [...SPECS]
  const workers = Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const spec = queue.shift()
      if (!spec) break
      await genOne(zai, spec)
    }
  })
  await Promise.all(workers)
  const missing = SPECS.map(([f]) => f).filter((f) => !fs.existsSync(`${OUT}/${f}`))
  console.log(missing.length ? `MANQUANTS : ${missing.join(', ')}` : 'TOUS GÉNÉRÉS ✓')
  process.exit(0)
}

main()
