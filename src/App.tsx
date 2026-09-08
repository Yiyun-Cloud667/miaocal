import { Routes, Route } from 'react-router'
import Home from './pages/Home'
import WidgetView from './sections/WidgetView'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/widget" element={<WidgetView />} />
    </Routes>
  )
}
