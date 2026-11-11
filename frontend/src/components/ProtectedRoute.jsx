import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children }) {
  const { usuario, cargando } = useAuth()

  if (cargando) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  if (!usuario) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-semibold text-gray-900">Sesión del sistema no disponible</h1>
          <p className="mt-2 text-sm text-gray-600">
            Inicia sesión en el sistema principal y vuelve a abrir el módulo de tickets.
          </p>
        </div>
      </main>
    )
  }

  return children
}
