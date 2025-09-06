/**
 * Home.tsx
 * The Home page that hosts the Digital Lagori game. Provides the header, level selector, and the game canvas.
 */

import { useState } from 'react'
import { Button } from '../components/ui/button'
import LagoriGame, { LevelKey, LEVELS } from '../widgets/lagori/LagoriGame'

/**
 * HomePage component
 * Renders the title, a small hero banner, level selection controls, and the game itself.
 */
export default function HomePage() {
  const [level, setLevel] = useState<LevelKey>('intermediate')
  const [gameKey, setGameKey] = useState<number>(Date.now())

  /** Restart the whole game instance (clears score and round state). */
  const hardRestart = () => setGameKey(Date.now())

  return (
    <div className="min-h-screen w-full bg-neutral-50 text-neutral-900">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-4">
          <div className="relative h-14 w-14 overflow-hidden rounded-md ring-1 ring-neutral-200">
            {/* Smart placeholder image for theme */}
            <img src="https://pub-cdn.sider.ai/u/U0O9H254YZA/web-coder/68a195bc38697d89a1036db5/resource/29b06f71-9e95-4fc1-b730-75ffcac20d71.jpg" className="object-cover h-full w-full" />
          </div>
          <div className="flex-1">
            <h1 className="text-xl font-semibold">डिजिटल लगोरी (सात पत्थर)</h1>
            <p className="text-sm text-neutral-600">
              फेंकने के लिए खींचें, चलने के लिए WASD/एरो कुंजियाँ, स्पेस/क्लिक दबाकर पत्थर रखें जब प्रतिद्वंद्वी पीछा करे
            </p>
          </div>

          {/* Level selector */}
          <div className="flex items-center gap-2">
            {(Object.keys(LEVELS) as LevelKey[]).map((k) => (
              <Button
                key={k}
                variant={level === k ? 'default' : 'outline'}
                className={level === k ? '' : 'bg-transparent'}
                onClick={() => setLevel(k)}
              >
                {LEVELS[k].name}
              </Button>
            ))}
            <Button variant="outline" className="bg-transparent" onClick={hardRestart}>
              पुनः प्रारंभ करें
            </Button>
          </div>
        </div>
      </header>

      {/* Game area */}
      <main className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-6">
        <LagoriGame key={gameKey} levelKey={level} />
      </main>

      {/* Footer tiny hint */}
      <footer className="mx-auto max-w-6xl px-4 pb-8 text-xs text-neutral-500">
        Tip: On touch devices, drag anywhere to aim, lift your finger to throw. Tap near the pile while close to stack stones.
      </footer>
    </div>
  )
}
