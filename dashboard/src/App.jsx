import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Proxies from './pages/Proxies'
import MLXControl from './pages/MLXControl'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="proxies" element={<Proxies />} />
          <Route path="mlx" element={<MLXControl />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
