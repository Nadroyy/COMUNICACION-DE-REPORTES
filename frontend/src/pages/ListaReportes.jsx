import { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import BadgeEstado from '../components/BadgeEstado'
import BadgePrioridad from '../components/BadgePrioridad'
import { parseFechaServidor } from '../utils/dateUtils'
import { formatTicketNumber } from '../utils/ticketNumber'

const ESTADOS = ['', 'borrador', 'enviado', 'en_revision', 'aprobado', 'negado', 'resuelto', 'cerrado']
const ETIQUETAS_ESTADO = {
  '': 'Todos los estados',
  borrador: 'Borrador', enviado: 'Pendiente',
  en_revision: 'En revisión', aprobado: 'Aprobado', negado: 'Negado',
  resuelto: 'Resuelto', cerrado: 'Cerrado'
}

export default function ListaReportes() {
  const { usuario } = useAuth()
  const esAdmin = Number(usuario?.id_role) === 1
  const [searchParams, setSearchParams] = useSearchParams()
  const [reportes, setReportes] = useState([])
  const [tipos, setTipos] = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [paginacion, setPaginacion] = useState({})
  const [cargando, setCargando] = useState(true)
  const [eliminandoId, setEliminandoId] = useState(null)
  const [error, setError] = useState('')

  // Filtros desde URL
  const filtros = {
    status:  searchParams.get('status')  || '',
    type:    searchParams.get('type')    || '',
    search:  searchParams.get('search')  || '',
    author:  searchParams.get('author') || '',
    responsible: searchParams.get('responsible') || '',
    warehouse: searchParams.get('warehouse') || '',
    from:    searchParams.get('from') || '',
    to:      searchParams.get('to') || '',
    page:    searchParams.get('page')    || '1',
    sort:    searchParams.get('sort')    || 'newest'
  }

  const cargar = useCallback(async () => {
    setCargando(true)
    setError('')
    try {
      const params = new URLSearchParams()
      if (filtros.status) params.set('status', filtros.status)
      if (filtros.type)   params.set('type',   filtros.type)
      if (filtros.search) params.set('search', filtros.search)
      if (esAdmin && filtros.author) params.set('author', filtros.author)
      if (esAdmin && filtros.responsible) params.set('responsible', filtros.responsible)
      if (esAdmin && filtros.warehouse) params.set('warehouse', filtros.warehouse)
      if (esAdmin && filtros.from) params.set('from', filtros.from)
      if (esAdmin && filtros.to) params.set('to', filtros.to)
      params.set('sort', filtros.sort)
      params.set('page',  filtros.page)
      params.set('limit', '10')

      const { data } = await api.get(`/reports?${params}`)
      setReportes(data.reportes)
      setPaginacion(data.paginacion)
    } catch {
      setError('Error al cargar los reportes')
    } finally {
      setCargando(false)
    }
  }, [esAdmin, filtros.status, filtros.type, filtros.search, filtros.author, filtros.responsible, filtros.warehouse, filtros.from, filtros.to, filtros.sort, filtros.page])

  useEffect(() => { cargar() }, [cargar])

  useEffect(() => {
    api.get('/report-types').then(r => setTipos(r.data.tipos)).catch(() => {})
  }, [])

  useEffect(() => {
    if (esAdmin) api.get('/users/assignable').then(r => setUsuarios(r.data.usuarios)).catch(() => {})
  }, [esAdmin])

  const sedes = [...new Map(usuarios.filter(u => u.id_warehouse).map(u => [u.id_warehouse, u.nombre_warehouse])).entries()]
  const hayFiltros = ['status', 'type', 'search', 'author', 'responsible', 'warehouse', 'from', 'to'].some(key => filtros[key])

  const tieneMasDeUnDia = reporte => {
    const fecha = parseFechaServidor(reporte.created_at)
    return fecha && Date.now() - fecha.getTime() > 24 * 60 * 60 * 1000
  }

  const setFiltro = (key, val) => {
    const p = new URLSearchParams(searchParams)
    if (val) p.set(key, val); else p.delete(key)
    p.set('page', '1')
    setSearchParams(p)
  }

  const setPagina = (n) => {
    const p = new URLSearchParams(searchParams)
    p.set('page', String(n))
    setSearchParams(p)
  }

  const eliminarDefinitivamente = async (reporte) => {
    const confirmar = window.confirm(
      `¿Eliminar definitivamente "${reporte.titulo}"? Se borrarán también sus comentarios, tareas, adjuntos y notificaciones. Esta acción no se puede deshacer.`
    )
    if (!confirmar) return

    setEliminandoId(reporte.id_report)
    setError('')
    try {
      await api.delete(`/reports/${reporte.id_report}/permanent`)
      await cargar()
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo eliminar el ticket')
    } finally {
      setEliminandoId(null)
    }
  }

  return (
    <div className="space-y-3">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <Link to="/dashboard" className="mb-1 inline-flex text-xs font-medium text-sky-700 hover:text-sky-900 hover:underline">
            ← Volver al panel
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{esAdmin ? 'Supervisión de reportes' : 'Tickets'}</h1>
          {esAdmin && <p className="text-xs text-gray-500 mt-0.5">Vista global · {paginacion.total ?? 0} resultados</p>}
        </div>
        <Link to="/reports/new" className="btn-primary">+ Nueva solicitud</Link>
      </div>

      {/* Filtros */}
      <div className="card px-3 py-3">
        <div className="flex flex-wrap gap-2">
          {/* Búsqueda */}
          <input
            type="text"
            className="input-field flex-1 min-w-48"
            placeholder="Buscar por título..."
            value={filtros.search}
            onChange={e => setFiltro('search', e.target.value)}
          />
          {/* Estado */}
          <select
            className="input-field w-auto"
            value={filtros.status}
            onChange={e => setFiltro('status', e.target.value)}
          >
            {ESTADOS.map(s => (
              <option key={s} value={s}>{ETIQUETAS_ESTADO[s]}</option>
            ))}
          </select>
          {/* Tipo */}
          <select
            className="input-field w-auto"
            value={filtros.type}
            onChange={e => setFiltro('type', e.target.value)}
          >
            <option value="">Todas las categorías</option>
            {tipos.map(t => (
              <option key={t.id_type} value={t.slug}>{t.nombre}</option>
            ))}
          </select>
          <select
            className="input-field w-auto"
            value={filtros.sort}
            onChange={e => setFiltro('sort', e.target.value)}
            aria-label="Ordenar tickets"
          >
            <option value="newest">Últimos creados</option>
            <option value="due_soon">Próximos a vencer</option>
            <option value="oldest">Más antiguos</option>
            <option value="priority">Mayor prioridad</option>
          </select>
          {esAdmin && <>
            <select className="input-field w-auto" value={filtros.author} onChange={e => setFiltro('author', e.target.value)}>
              <option value="">Todos los autores</option>
              {usuarios.map(u => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>)}
            </select>
            <select className="input-field w-auto" value={filtros.responsible} onChange={e => setFiltro('responsible', e.target.value)}>
              <option value="">Todos los responsables</option>
              {usuarios.map(u => <option key={u.id_usuario} value={u.id_usuario}>{u.nombre}</option>)}
            </select>
            <select className="input-field w-auto" value={filtros.warehouse} onChange={e => setFiltro('warehouse', e.target.value)}>
              <option value="">Todas las sedes</option>
              {sedes.map(([id, nombre]) => <option key={id} value={id}>{nombre}</option>)}
            </select>
            <label className="flex items-center gap-1 text-xs text-gray-500">Desde
              <input type="date" className="input-field" value={filtros.from} onChange={e => setFiltro('from', e.target.value)} />
            </label>
            <label className="flex items-center gap-1 text-xs text-gray-500">Hasta
              <input type="date" className="input-field" value={filtros.to} onChange={e => setFiltro('to', e.target.value)} />
            </label>
          </>}
          {/* Limpiar */}
          {hayFiltros && (
            <button
              className="btn-secondary"
              onClick={() => setSearchParams({})}
            >
              Limpiar
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
          {error}
        </div>
      )}

      {/* Tabla */}
      <div className="card p-0 overflow-hidden">
        {cargando ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
          </div>
        ) : reportes.length === 0 ? (
          <div className="px-6 py-16 text-center text-gray-400">
            No hay tickets que coincidan con los filtros.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Título</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Tipo</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Estado</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Prioridad</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Autor</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Dirigido a</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">{esAdmin ? 'Fecha y hora' : 'Fecha'}</th>
                  {esAdmin && <th className="px-3 py-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {reportes.map(rep => (
                  <tr key={rep.id_report} className={`${tieneMasDeUnDia(rep) ? 'bg-gray-100' : ''} hover:bg-gray-50 transition-colors`}>
                    <td className="px-3 py-2">
                      <Link
                        to={`/reports/${rep.id_report}`}
                        className="font-medium text-blue-600 hover:text-blue-800 hover:underline"
                      >
                        <span className="mr-1 font-mono text-xs text-gray-500">{formatTicketNumber(rep.numero_ticket)}</span>
                        {rep.titulo}
                      </Link>
                      {rep.warehouse_nombre && (
                        <span className="ml-2 text-xs text-gray-400">{rep.warehouse_nombre}</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-gray-600">{rep.tipo_nombre}</td>
                    <td className="px-3 py-2"><BadgeEstado status={rep.status} /></td>
                    <td className="px-3 py-2"><BadgePrioridad prioridad={rep.prioridad} /></td>
                    <td className="px-3 py-2 text-gray-600">{rep.autor_nombre}</td>
                    <td className="px-3 py-2 text-gray-600">{rep.responsable_nombre || 'Sin asignar'}</td>
                    <td className="px-3 py-2 text-gray-500 text-xs whitespace-nowrap">
                      {parseFechaServidor(rep.created_at)?.toLocaleString('es-CO', esAdmin
                        ? { dateStyle: 'short', timeStyle: 'short' }
                        : { dateStyle: 'short' }) || 'Sin fecha'}
                    </td>
                    {esAdmin && (
                      <td className="px-3 py-2 text-right">
                        <button type="button" onClick={() => eliminarDefinitivamente(rep)}
                          disabled={eliminandoId === rep.id_report}
                          aria-label={`Eliminar definitivamente ${rep.titulo}`}
                          title="Eliminar definitivamente"
                          className="rounded px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
                          {eliminandoId === rep.id_report ? 'Eliminando…' : 'Eliminar'}
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Paginación */}
        {paginacion.paginas > 1 && (
          <div className="px-4 py-2.5 border-t border-gray-200 flex items-center justify-between text-sm shrink-0">
            <span className="text-gray-500">
              {paginacion.total} reportes · página {paginacion.pagina} de {paginacion.paginas}
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setPagina(paginacion.pagina - 1)}
                disabled={paginacion.pagina === 1}
                className="btn-secondary py-1 px-3 disabled:opacity-40"
              >
                ← Anterior
              </button>
              <button
                onClick={() => setPagina(paginacion.pagina + 1)}
                disabled={paginacion.pagina === paginacion.paginas}
                className="btn-secondary py-1 px-3 disabled:opacity-40"
              >
                Siguiente →
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
