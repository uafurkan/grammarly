import { HashRouter, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Documents from './pages/Documents'
import EditorPage from './pages/Editor'
import SheetEditor from './pages/SheetEditor'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs" element={<Documents />} />
        <Route path="/doc/:id" element={<EditorPage />} />
        <Route path="/sheet/:id" element={<SheetEditor />} />
      </Routes>
    </HashRouter>
  )
}
