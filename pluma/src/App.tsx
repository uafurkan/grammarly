import { HashRouter, Route, Routes } from 'react-router-dom'
import Home from './pages/Home'
import Documents from './pages/Documents'
import EditorPage from './pages/Editor'
import SheetEditor from './pages/SheetEditor'
import PdfEditor from './pages/PdfEditor'
import WordInstall from './pages/WordInstall'
import ExtensionInstall from './pages/ExtensionInstall'
import Guide from './components/Guide'

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/docs" element={<Documents />} />
        <Route path="/doc/:id" element={<EditorPage />} />
        <Route path="/sheet/:id" element={<SheetEditor />} />
        <Route path="/pdf/:id" element={<PdfEditor />} />
        <Route path="/word" element={<WordInstall />} />
        <Route path="/extension" element={<ExtensionInstall />} />
      </Routes>
      <Guide />
    </HashRouter>
  )
}
