import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Dashboard from './pages/Dashboard'
import Accounts from './pages/Accounts'
import Proxies from './pages/Proxies'
import MLXControl from './pages/MLXControl'
import Tasks from './pages/Tasks'
import History from './pages/History'
import Toast from './components/Toast'
import './index.css'

export default function App() {
  return (
    <BrowserRouter>
      <Toast />
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="accounts" element={<Accounts />} />
          <Route path="proxies" element={<Proxies />} />
          <Route path="mlx" element={<MLXControl />} />
          <Route path="tasks" element={<Tasks />} />
          <Route path="history" element={<History />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
