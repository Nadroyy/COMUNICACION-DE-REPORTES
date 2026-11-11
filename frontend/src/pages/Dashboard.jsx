import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import BadgeEstado from '../components/BadgeEstado'
import BadgePrioridad from '../components/BadgePrioridad'
import { parseFechaServidor } from '../utils/dateUtils'
import { formatTicketNumber } from '../utils/ticketNumber'

const tieneMasDeUnDia = reporte => {
  const fecha = parseFechaServidor(reporte.created_at)
  return fecha && Date.now() - fecha.getTime() > 24 * 60 * 60 * 1000
}

// Tarjeta de contador por estado
function TarjetaStat({ label, valor, color, to }) {
  const contenido = (
    <>
      <p className="text-xl font-bold text-gray-900">{valor ?? '—'}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </>
  )
  if (to) return <Link to={to} className={`card border-l-4 p-3 block hover:bg-gray-50 transition-colors ${color}`}>{contenido}</Link>
  return (
    <div className={`card border-l-4 p-3 ${color}`}>
      {contenido}
    </div>
  )
}

export default function Dashboard() {
  const { usuario } = useAuth()
  const esAdmin = Number(usuario?.id_role) === 1
  const [stats, setStats] = useState(null)
  const [recientes, setRecientes] = useState([])
  const [misTickets, setMisTickets] = useState([])
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState('')

  const reportesDirigidos = esAdmin ? misTickets : []
  const reportesGlobales = esAdmin
    ? recientes.filter(rep => !misTickets.some(mio => mio.id_report === rep.id_report))
    : recientes

  useEffect(() => {
    const cargar = async () => {
      try {
        const solicitudes = [
          api.get('/reports/stats'),
          api.get('/reports?limit=10&page=1')
        ]
        if (esAdmin) solicitudes.push(api.get('/reports?scope=mine&limit=1000&page=1'))
        const [statsRes, reportesRes, misTicketsRes] = await Promise.all(solicitudes)
        setStats(statsRes.data.stats)
        setRecientes(reportesRes.data.reportes)
        setMisTickets(misTicketsRes?.data.reportes || [])
      } catch (err) {
        setError('Error al cargar el dashboard')
      } finally {
        setCargando(false)
      }
    }
    cargar()
  }, [esAdmin])

  if (cargando) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-gray-900">{esAdmin ? 'Administración de reportes' : 'Tickets'}</h1>
            {esAdmin && <span className="rounded bg-blue-100 px-2 py-0.5 text-xs font-semibold text-blue-800">Administrador</span>}
          </div>
          <p className="text-gray-500 text-xs mt-0.5">
            {esAdmin ? 'Vista global de solicitudes' : `Bienvenido, ${usuario?.nombre}`}
          </p>
        </div>
        <Link to="/reports/new" className="btn-primary">
          + Nueva solicitud
        </Link>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Contadores */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <TarjetaStat label="Total"       valor={stats?.total}       color="border-gray-400" />
        {esAdmin && <TarjetaStat label="Borradores" valor={stats?.borrador} color="border-gray-300" to="/reports?status=borrador" />}
        <TarjetaStat label="Pendientes"  valor={stats?.enviado}     color="border-blue-500" to={esAdmin ? '/reports?status=enviado' : undefined} />
        <TarjetaStat label="En revisión" valor={stats?.en_revision} color="border-yellow-500" to={esAdmin ? '/reports?status=en_revision' : undefined} />
        <TarjetaStat label="Aprobados"   valor={stats?.aprobado}    color="border-green-500" to={esAdmin ? '/reports?status=aprobado' : undefined} />
        <TarjetaStat label="Negados"     valor={stats?.negado}      color="border-red-500" to={esAdmin ? '/reports?status=negado' : undefined} />
        {esAdmin && <TarjetaStat label="Resueltos" valor={stats?.resuelto} color="border-teal-500" to="/reports?status=resuelto" />}
        <TarjetaStat label="Cerrados"    valor={stats?.cerrado}     color="border-gray-500" to={esAdmin ? '/reports?status=cerrado' : undefined} />
      </div>

      {esAdmin && (
        <div className="flex flex-wrap items-center gap-2 border-y border-gray-200 py-3">
          <span className="mr-1 text-sm font-semibold text-gray-700">Gestión global</span>
          <Link to="/reports" className="btn-secondary py-1.5">Todos los reportes</Link>
          <Link to="/reports?status=enviado" className="btn-secondary py-1.5">Atender pendientes</Link>
          <Link to="/reports?status=en_revision" className="btn-secondary py-1.5">Revisiones activas</Link>
        </div>
      )}

      {esAdmin ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            ['Mis tickets', 'Tickets creados por ti, asignados o compartidos contigo.', reportesDirigidos, 'border-blue-500'],
            ['Tickets globales', 'Tickets visibles para la gestión general.', reportesGlobales, 'border-gray-400']
          ].map(([titulo, descripcion, lista, color]) => (
            <div key={titulo} className={`card border-t-4 ${color} p-0 overflow-hidden`}>
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                <div>
                  <h2 className="font-semibold text-gray-900">{titulo}</h2>
                  <p className="text-xs text-gray-500 mt-0.5">{descripcion}</p>
                </div>
                <Link to="/reports" className="text-sm text-blue-600 hover:underline">Ver todos →</Link>
              </div>
              {lista.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-400">No hay tickets recientes.</p>
              ) : (
                <div className="divide-y divide-gray-100">
                  {lista.map(rep => (
                    <Link
                      key={rep.id_report}
                      to={`/reports/${rep.id_report}`}
                      className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${tieneMasDeUnDia(rep) ? 'bg-gray-100' : ''}`}
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          <span className="mr-1 font-mono text-xs text-gray-500">{formatTicketNumber(rep.numero_ticket)}</span>
                          {rep.titulo}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {rep.tipo_nombre} · {rep.autor_nombre} · Dirigido a: {rep.responsable_nombre || 'Sin asignar'} ·{' '}
                          {parseFechaServidor(rep.created_at)?.toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) || 'Sin fecha'}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <BadgePrioridad prioridad={rep.prioridad} />
                        <BadgeEstado status={rep.status} />
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="card p-0 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Tickets recientes</h2>
            <Link to="/reports" className="text-sm text-blue-600 hover:underline">Ver todos →</Link>
          </div>
          {recientes.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400">
              <p>No hay tickets aún.</p>
              <Link to="/reports/new" className="text-blue-600 hover:underline text-sm mt-2 inline-block">Crear el primero</Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {recientes.map(rep => (
                <Link key={rep.id_report} to={`/reports/${rep.id_report}`} className={`flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors ${tieneMasDeUnDia(rep) ? 'bg-gray-100' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      <span className="mr-1 font-mono text-xs text-gray-500">{formatTicketNumber(rep.numero_ticket)}</span>
                      {rep.titulo}
                    </p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {rep.tipo_nombre} · {rep.autor_nombre} · Dirigido a: {rep.responsable_nombre || 'Sin asignar'} · {parseFechaServidor(rep.created_at)?.toLocaleString('es-CO', { dateStyle: 'short' }) || 'Sin fecha'}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <BadgePrioridad prioridad={rep.prioridad} />
                    <BadgeEstado status={rep.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
