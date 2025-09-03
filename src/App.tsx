import { HashRouter, Route, Routes } from 'react-router'
import HomePage from './pages/Home'

/**
 * App.tsx
 * Main routing entry. Currently only routes to the Home page hosting the game.
 */
export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
      </Routes>
    </HashRouter>
  )
}
