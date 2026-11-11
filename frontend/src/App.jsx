import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'

import Dashboard     from './pages/Dashboard'
import ListaReportes from './pages/ListaReportes'
import CrearReporte  from './pages/CrearReporte'
import DetalleReporte from './pages/DetalleReporte'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Protegidas */}
          <Route path="/dashboard" element={
            <ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>
          } />
          <Route path="/reports" element={
            <ProtectedRoute><Layout><ListaReportes /></Layout></ProtectedRoute>
          } />
          <Route path="/reports/new" element={
            <ProtectedRoute><Layout><CrearReporte /></Layout></ProtectedRoute>
          } />
          <Route path="/reports/:id" element={
            <ProtectedRoute><Layout><DetalleReporte /></Layout></ProtectedRoute>
          } />

          {/* Redirecciones */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
