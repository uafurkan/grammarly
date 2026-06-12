import { HashRouter, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Documents from './pages/Documents'
import EditorPage from './pages/Editor'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs" element={<Documents />} />
        <Route path="/doc/:id" element={<EditorPage />} />
      </Routes>
    </HashRouter>
  )
}
