import { useState, useEffect, useCallback, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import api from '../services/api'
import { useAuth } from '../context/AuthContext'
import ImageDropzone from '../components/ImageDropzone'
import BadgeEstado from '../components/BadgeEstado'
import BadgePrioridad from '../components/BadgePrioridad'
import ModalTarea from '../components/ModalTarea'
import { parseFechaServidor, tiempoRelativo } from '../utils/dateUtils'
import { formatTicketNumber } from '../utils/ticketNumber'

// ── Utilidades ────────────────────────────────────────────────
const formatFecha = (fechaStr) => {
  if (!fechaStr) return null
  const fecha = parseFechaServidor(fechaStr)
  if (!fecha) return null
  return fecha.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })
}

const slaInfo = (fechaLimite) => {
  if (!fechaLimite) return null
  const [y, m, d] = String(fechaLimite).slice(0, 10).split('-')
  const limite = new Date(+y, +m - 1, +d)
  const hoy = new Date(); hoy.setHours(0,0,0,0)
  const dias = Math.round((limite - hoy) / 86400000)
  if (dias < 0) return { label: `Venció hace ${Math.abs(dias)} d`, color: 'text-red-600 bg-red-50' }
  if (dias === 0) return { label: 'Vence hoy', color: 'text-orange-600 bg-orange-50' }
  if (dias <= 2) return { label: `Vence en ${dias} d`, color: 'text-yellow-600 bg-yellow-50' }
  return { label: `${dias} días restantes`, color: 'text-green-700 bg-green-50' }
}

const ETIQ_CAMBIO = {
  status: 'Estado',
  id_responsable: 'Responsable',
  prioridad: 'Prioridad',
  titulo: 'Título',
  descripcion: 'Descripción',
}

const ETIQ_STATUS = {
  borrador: 'Borrador', enviado: 'Pendiente', en_revision: 'En revisión',
  aprobado: 'Aprobado', negado: 'Negado', resuelto: 'Resuelto', cerrado: 'Cerrado'
}

const TIPO_ICONO = {
  aviso_evento: '📢', solicitud_decision: '✅', reporte_operativo: '⚠️'
}

// Reactivar cuando la integración con TaskView esté configurada.
const TASKVIEW_HABILITADO = false

const ESTADO_TAREA = { pendiente: 'Pendiente', en_progreso: 'En progreso', hecha: 'Hecha' }
const COLOR_TAREA = {
  pendiente: 'bg-gray-100 text-gray-600',
  en_progreso: 'bg-blue-100 text-blue-700',
  hecha: 'bg-green-100 text-green-700'
}

// ── Iniciales de avatar ──────────────────────────────────────
function Avatar({ nombre, size = 'md' }) {
  const initials = (nombre || '?').split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
  const sz = size === 'sm' ? 'w-7 h-7 text-xs' : 'w-9 h-9 text-sm'
  const colors = ['bg-blue-500', 'bg-purple-500', 'bg-green-500', 'bg-orange-500', 'bg-pink-500']
  const color = colors[(nombre || '').charCodeAt(0) % colors.length]
  return (
    <span className={`${sz} ${color} rounded-full flex items-center justify-center text-white font-semibold shrink-0`}>
      {initials}
    </span>
  )
}

// ── Menú de 3 puntos ─────────────────────────────────────────
function MenuContextual({ items }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setAbierto(a => !a)}
        className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        aria-label="Más acciones">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
        </svg>
      </button>
      {abierto && (
        <div className="absolute right-0 z-20 mt-1 w-48 bg-white rounded-lg border border-gray-200 shadow-lg py-1">
          {items.map((item, i) => (
            <button key={i} type="button"
              onClick={() => { item.onClick(); setAbierto(false) }}
              className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 ${item.danger ? 'text-red-600' : 'text-gray-700'}`}>
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Barra de progreso de tareas ──────────────────────────────
function ProgressBar({ tareas }) {
  if (!tareas.length) return null
  const hechas = tareas.filter(t => t.status === 'hecha').length
  const pct = Math.round((hechas / tareas.length) * 100)
  return (
    <div className="flex items-center gap-2 text-xs text-gray-500">
      <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
      <span>{hechas}/{tareas.length}</span>
    </div>
  )
}

export default function DetalleReporte() {
  const { id } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { usuario } = useAuth()
  const esAdmin = Number(usuario?.id_role) === 1

  const [reporte, setReporte] = useState(null)
  const [comentarios, setComentarios] = useState([])
  const [tareas, setTareas] = useState([])
  const [historial, setHistorial] = useState([])
  const [adjuntos, setAdjuntos] = useState([])
  const [previsualizaciones, setPrevisualizaciones] = useState({})
  const [imagenes, setImagenes] = useState([])
  const [subiendoImagenes, setSubiendoImagenes] = useState(false)
  const [usuarios, setUsuarios] = useState([])
  const [taskviewData, setTaskviewData] = useState(null)
  const [cargando, setCargando] = useState(true)
  const [error, setError] = useState(location.state?.attachmentUploadError || '')

  const [tabActiva, setTabActiva] = useState('comentarios')
  const [nuevoComentario, setNuevoComentario] = useState('')
  const [esResolucion, setEsResolucion] = useState(false)
  const [enviandoCom, setEnviandoCom] = useState(false)
  const [showModalTarea, setShowModalTarea] = useState(false)

  const [mostrarTransferencia, setMostrarTransferencia] = useState(false)
  const [nuevoResponsable, setNuevoResponsable] = useState('')
  const [motivoTransferencia, setMotivoTransferencia] = useState('')
  const [mostrarNegacion, setMostrarNegacion] = useState(false)
  const [motivoNegacion, setMotivoNegacion] = useState('')
  const [sincronizandoTaskview, setSincronizandoTaskview] = useState(false)
  const [eliminando, setEliminando] = useState(false)
  const [responsableParaEnvio, setResponsableParaEnvio] = useState('')
  const [cambiandoEstado, setCambiandoEstado] = useState(false)

  const cargar = useCallback(async () => {
    try {
      const [detRes, histRes, tvRes] = await Promise.all([
        api.get(`/reports/${id}`),
        esAdmin ? api.get(`/reports/${id}/history`) : Promise.resolve({ data: { historial: [] } }),
        TASKVIEW_HABILITADO
          ? api.get(`/taskview/status/${id}`).catch(() => ({ data: { sincronizado: false } }))
          : Promise.resolve({ data: { sincronizado: false } })
      ])
      setReporte(detRes.data.reporte)
      setComentarios(detRes.data.comentarios)
      setTareas(detRes.data.tareas)
      setAdjuntos(detRes.data.adjuntos || [])
      setHistorial(histRes.data.historial)
      setTaskviewData(tvRes.data.sincronizado ? tvRes.data.data : null)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al cargar el reporte')
    } finally {
      setCargando(false)
    }
  }, [id, esAdmin])

  useEffect(() => { cargar() }, [cargar])
  useEffect(() => {
    let cancelado = false
    const urls = []
    Promise.all(adjuntos.map(async adjunto => {
      try {
        const { data } = await api.get(
          `/reports/${id}/attachments/${adjunto.id_attachment}/file`,
          { responseType: 'blob' }
        )
        const url = URL.createObjectURL(data)
        if (cancelado) {
          URL.revokeObjectURL(url)
          return null
        }
        urls.push(url)
        return [adjunto.id_attachment, url]
      } catch {
        return null
      }
    })).then(resultados => {
      if (cancelado) return
      setPrevisualizaciones(Object.fromEntries(resultados.filter(Boolean)))
      if (resultados.some(resultado => !resultado)) {
        setError('No se pudieron cargar una o más imágenes adjuntas')
      }
    })
    return () => {
      cancelado = true
      urls.forEach(url => URL.revokeObjectURL(url))
    }
  }, [adjuntos, id])
  useEffect(() => {
    api.get('/users/assignable').then(r => setUsuarios(r.data.usuarios)).catch(() => {})
  }, [])

  const subirImagenes = async () => {
    if (!imagenes.length) return
    const formData = new FormData()
    imagenes.forEach(imagen => formData.append('images', imagen))
    setSubiendoImagenes(true)
    setError('')
    try {
      await api.post(`/reports/${id}/attachments`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      setImagenes([])
      await cargar()
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudieron subir las imágenes')
    } finally {
      setSubiendoImagenes(false)
    }
  }

  const iniciarRevision = async () => {
    try { await api.post(`/reports/${id}/review`); cargar() }
    catch (err) { setError(err.response?.data?.error || 'No se pudo iniciar la revisión') }
  }

  const decidir = async (decision, motivo = '') => {
    try {
      await api.post(`/reports/${id}/decision`, { decision, motivo })
      setMostrarNegacion(false); setMotivoNegacion(''); cargar()
    } catch (err) { setError(err.response?.data?.error || 'No se pudo registrar la decisión') }
  }

  const transferirTicket = async (e) => {
    e.preventDefault()
    try {
      await api.post(`/reports/${id}/transfer`, { id_responsable: nuevoResponsable, motivo: motivoTransferencia })
      setMostrarTransferencia(false); setNuevoResponsable(''); setMotivoTransferencia(''); cargar()
    } catch (err) { setError(err.response?.data?.error || 'No se pudo transferir el ticket') }
  }

  const enviarBorrador = async () => {
    const idResp = responsableParaEnvio || reporte.id_responsable
    if (!idResp) { setError('Selecciona un responsable'); return }
    try {
      await api.patch(`/reports/${id}`, { status: 'enviado', id_responsable: idResp })
      setResponsableParaEnvio(''); cargar()
    } catch (err) { setError(err.response?.data?.error || 'No se pudo enviar') }
  }

  const enviarComentario = async (e) => {
    e.preventDefault()
    if (!nuevoComentario.trim()) return
    setEnviandoCom(true)
    try {
      await api.post(`/reports/${id}/comments`, { contenido: nuevoComentario, es_resolucion: esResolucion })
      setNuevoComentario(''); setEsResolucion(false); cargar()
    } catch (err) { setError(err.response?.data?.error || 'Error al enviar comentario') }
    finally { setEnviandoCom(false) }
  }

  const sincronizarTaskview = async () => {
    setSincronizandoTaskview(true); setError('')
    try {
      const res = await api.post(`/taskview/sync-report/${id}`)
      setTaskviewData({ taskview_url: res.data.taskviewUrl, sync_status: 'created' })
      if (res.data.taskviewUrl) window.open(res.data.taskviewUrl, '_blank', 'noopener,noreferrer')
    } catch (err) { setError(err.response?.data?.detalle || err.response?.data?.error || 'No se pudo sincronizar') }
    finally { setSincronizandoTaskview(false) }
  }

  const eliminarTicket = async () => {
    if (!window.confirm('El ticket se cerrará y conservará su historial. ¿Continuar?')) return
    setEliminando(true)
    try { await api.delete(`/reports/${id}`); navigate('/reports', { replace: true }) }
    catch (err) { setError(err.response?.data?.error || 'No se pudo cerrar el ticket'); setEliminando(false) }
  }

  const cambiarEstadoTarea = async (idTask, nuevoStatus) => {
    try { await api.patch(`/tasks/${idTask}`, { status: nuevoStatus }); cargar() } catch {}
  }

  const cambiarEstadoAdmin = async (nuevoStatus) => {
    if (!nuevoStatus || nuevoStatus === reporte.status) return
    setError('')
    setCambiandoEstado(true)
    try {
      await api.patch(`/reports/${id}`, { status: nuevoStatus })
      cargar()
    } catch (err) {
      setError(err.response?.data?.error || 'No se pudo cambiar el estado')
    } finally {
      setCambiandoEstado(false)
    }
  }

  if (cargando) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
    </div>
  )

  if (error && !reporte) return (
    <div className="max-w-2xl mx-auto space-y-3">
      <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">{error}</div>
      <button onClick={() => navigate(-1)} className="btn-secondary">← Volver</button>
    </div>
  )

  const esAutor = Number(reporte.id_autor) === Number(usuario?.id_usuario)
  const esResponsable = Number(reporte.id_responsable) === Number(usuario?.id_usuario)
  const puedeGestionar = esAdmin || esResponsable
  const puedeResolver = puedeGestionar && reporte.status === 'en_revision'
  const puedeTransferir = puedeGestionar && ['borrador', 'enviado', 'en_revision'].includes(reporte.status)
  const puedeEnviar = reporte.status === 'borrador' && (esAdmin || esAutor)
  const sla = slaInfo(reporte.fecha_limite)

  // Acción principal según estado
  const accionPrimaria = () => {
    if (puedeEnviar) return (
      <button onClick={enviarBorrador} className="w-full btn-primary py-2.5 text-sm font-semibold">
        📤 Enviar a responsable
      </button>
    )
    if (puedeGestionar && reporte.status === 'enviado') return (
      <div className="space-y-2">
        <button onClick={iniciarRevision} className="w-full btn-primary py-2.5 text-sm font-semibold">
          🔍 Tomar para revisión
        </button>
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => decidir('aprobar')} className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
            ✅ Aprobar
          </button>
          <button onClick={() => setMostrarNegacion(true)} className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
            ✗ Negar
          </button>
        </div>
      </div>
    )
    if (puedeGestionar && reporte.status === 'en_revision') return (
      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => decidir('aprobar')} className="w-full bg-green-600 hover:bg-green-700 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
          ✅ Aprobar solicitud
        </button>
        <button onClick={() => setMostrarNegacion(true)} className="w-full bg-red-600 hover:bg-red-700 text-white rounded-lg py-2.5 text-sm font-semibold transition-colors">
          ✗ Negar solicitud
        </button>
      </div>
    )
    return null
  }

  const menuItems = [
    ...(puedeTransferir ? [{ label: '↔ Transferir a otra persona', onClick: () => setMostrarTransferencia(true) }] : []),
    ...(esAdmin && reporte.status === 'en_revision' ? [{ label: '✗ Negar solicitud', onClick: () => setMostrarNegacion(true), danger: true }] : []),
    ...(TASKVIEW_HABILITADO ? [
      { label: taskviewData ? '↻ Actualizar en TaskView' : '⟲ Enviar a TaskView', onClick: sincronizarTaskview },
      ...(taskviewData?.taskview_url ? [{ label: '↗ Abrir en TaskView', onClick: () => window.open(taskviewData.taskview_url, '_blank') }] : [])
    ] : []),
    ...((esAdmin || esAutor) && reporte.status !== 'cerrado' ? [{ label: '🗑 Cerrar ticket', onClick: eliminarTicket, danger: true }] : []),
  ]

  return (
    <div className="max-w-6xl mx-auto space-y-4">

      {/* ── Encabezado ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <button onClick={() => navigate(-1)} className="text-gray-400 hover:text-gray-600 text-sm mb-1.5 flex items-center gap-1">
            ← Volver
          </button>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs font-mono text-gray-400 bg-gray-100 px-2 py-0.5 rounded">
              {formatTicketNumber(reporte.numero_ticket)}
            </span>
            <span className="text-xs text-gray-500">
              {TIPO_ICONO[reporte.tipo_slug] || '📋'} {reporte.tipo_nombre}
            </span>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mt-1 leading-tight">{reporte.titulo}</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Creado por <span className="font-medium text-gray-700">{reporte.autor_nombre}</span> · {tiempoRelativo(reporte.created_at)}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <BadgePrioridad prioridad={reporte.prioridad} />
          <BadgeEstado status={reporte.status} />
          <MenuContextual items={menuItems} />
        </div>
      </div>

      {/* SLA */}
      {sla && (
        <div className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full ${sla.color}`}>
          ⏱ {sla.label}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">{error}</div>
      )}

      {/* ── Layout principal ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">

        {/* Columna principal (70%) */}
        <div className="lg:col-span-2 space-y-4">

          {/* Descripción */}
          <div className="card">
            <h2 className="font-semibold text-gray-900 mb-2 text-sm uppercase tracking-wide text-gray-500">Descripción</h2>
            <p className="text-gray-700 text-sm leading-relaxed whitespace-pre-wrap">
              {reporte.descripcion || <span className="text-gray-400 italic">Sin descripción.</span>}
            </p>
            {reporte.extra_data && Object.keys(reporte.extra_data).length > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-100">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Información adicional</h3>
                <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
                  {reporte.template_fields.map(campo => (
                    <div key={campo.name}>
                      <dt className="text-xs text-gray-400">{campo.label}</dt>
                      <dd className="text-sm text-gray-800 font-medium mt-0.5">
                        {reporte.extra_data[campo.name] !== undefined ? String(reporte.extra_data[campo.name]) : '—'}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            )}
          </div>

          {/* Imágenes privadas del reporte */}
          <div className="card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-semibold text-gray-900 text-sm uppercase tracking-wide text-gray-500">Imágenes adjuntas</h2>
                <p className="text-xs text-gray-500 mt-1">Las imágenes solo son visibles para personas con acceso a este reporte.</p>
              </div>
              <span className="text-xs text-gray-400">{adjuntos.length}/5</span>
            </div>
            {adjuntos.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                {adjuntos.map(adjunto => (
                  <a key={adjunto.id_attachment}
                    href={previsualizaciones[adjunto.id_attachment] || undefined}
                    target="_blank" rel="noreferrer"
                    className="group relative rounded-lg border border-gray-200 bg-gray-50">
                    {previsualizaciones[adjunto.id_attachment] ? (
                      <img src={previsualizaciones[adjunto.id_attachment]} alt={adjunto.nombre_archivo}
                        className="w-full h-36 rounded-t-lg object-cover" />
                    ) : (
                      <div className="w-full h-36 flex items-center justify-center text-sm text-gray-400">Cargando imagen…</div>
                    )}
                    {previsualizaciones[adjunto.id_attachment] && (
                      <span aria-hidden="true"
                        className="pointer-events-none fixed inset-0 z-[70] hidden items-center justify-center bg-black/60 p-6 group-hover:flex">
                        <img src={previsualizaciones[adjunto.id_attachment]} alt=""
                          className="max-h-[85vh] max-w-[90vw] rounded-lg object-contain shadow-2xl motion-reduce:transition-none" />
                      </span>
                    )}
                    <div className="px-2.5 py-2">
                      <p className="text-xs font-medium text-gray-700 truncate">{adjunto.nombre_archivo}</p>
                      <p className="text-xs text-gray-400 truncate">{adjunto.subido_por}</p>
                    </div>
                  </a>
                ))}
              </div>
            )}
            {adjuntos.length < 5 && (
              <div className="mt-4 border-t border-gray-100 pt-4 space-y-3">
                <div>
                  <p className="label">Agregar imágenes</p>
                  <ImageDropzone
                    files={imagenes}
                    onFilesChange={setImagenes}
                    existingCount={adjuntos.length}
                    disabled={subiendoImagenes}
                  />
                </div>
                {imagenes.length > 0 && (
                  <div className="space-y-2">
                    <button type="button" onClick={subirImagenes} disabled={subiendoImagenes}
                      className="btn-primary px-3 py-2 text-sm disabled:opacity-50">
                      {subiendoImagenes ? 'Subiendo…' : `Subir ${imagenes.length} imagen${imagenes.length === 1 ? '' : 'es'}`}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pestañas: Comentarios / Tareas / Historial */}
          <div className="card p-0 overflow-hidden">
            {/* Tab bar */}
            <div className="flex border-b border-gray-200 bg-gray-50">
              {[
                { key: 'comentarios', label: '💬 Comentarios', count: comentarios.length },
                { key: 'tareas', label: '📋 Tareas', count: tareas.length },
                ...(esAdmin ? [{ key: 'historial', label: '📜 Auditoría', count: historial.length }] : []),
              ].map(tab => (
                <button key={tab.key} type="button"
                  onClick={() => setTabActiva(tab.key)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                    tabActiva === tab.key
                      ? 'border-blue-500 text-blue-600 bg-white'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}>
                  {tab.label}
                  {tab.count > 0 && (
                    <span className="ml-1.5 text-xs bg-gray-200 text-gray-600 rounded-full px-1.5 py-0.5">{tab.count}</span>
                  )}
                </button>
              ))}
              {tabActiva === 'tareas' && reporte.status !== 'cerrado' && (
                <button onClick={() => setShowModalTarea(true)}
                  className="ml-auto mr-3 my-2 text-xs text-blue-600 hover:text-blue-800 font-medium px-2">
                  + Agregar
                </button>
              )}
            </div>

            <div className="p-4">
              {/* COMENTARIOS */}
              {tabActiva === 'comentarios' && (
                <div className="space-y-3">
                  {comentarios.length === 0
                    ? <p className="text-gray-400 text-sm text-center py-6">Sin comentarios aún.</p>
                    : comentarios.map(c => (
                      <div key={c.id_comment} className={`flex gap-3 ${c.es_resolucion ? 'bg-green-50 border border-green-200 rounded-lg p-3' : ''}`}>
                        <Avatar nombre={c.autor_nombre} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-gray-800">{c.autor_nombre}</span>
                            {c.es_resolucion && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">✓ Resolución</span>}
                            <span className="text-xs text-gray-400 ml-auto">{tiempoRelativo(c.created_at)}</span>
                          </div>
                          <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{c.contenido}</p>
                        </div>
                      </div>
                    ))}
                  <form onSubmit={enviarComentario} className="flex gap-2 pt-3 border-t border-gray-100 mt-3">
                    <Avatar nombre={usuario?.nombre} size="sm" />
                    <div className="flex-1 min-w-0 space-y-2">
                      {reporte.status === 'cerrado' && (
                        <p className="text-xs text-gray-500">
                          Este ticket está cerrado, pero puedes dejar un comentario para mantener informadas a las personas con acceso.
                        </p>
                      )}
                      {puedeResolver && (
                        <label className="flex items-center gap-2 text-xs font-medium text-green-800">
                          <input type="checkbox" checked={esResolucion}
                            onChange={e => setEsResolucion(e.target.checked)} />
                          Registrar este comentario como resolución y marcar el ticket resuelto
                        </label>
                      )}
                      <div className="flex gap-2">
                        <textarea className="input-field flex-1" rows={2}
                          value={nuevoComentario} onChange={e => setNuevoComentario(e.target.value)}
                          placeholder="Escribe un comentario..." />
                        <button type="submit" disabled={enviandoCom || !nuevoComentario.trim()} className="btn-primary self-end shrink-0">
                          {enviandoCom ? '...' : 'Enviar'}
                        </button>
                      </div>
                    </div>
                  </form>
                </div>
              )}

              {/* TAREAS */}
              {tabActiva === 'tareas' && (
                <div className="space-y-3">
                  {tareas.length > 0 && <ProgressBar tareas={tareas} />}
                  {tareas.length === 0
                    ? <p className="text-gray-400 text-sm text-center py-6">Sin tareas vinculadas.</p>
                    : tareas.map(tarea => (
                      <div key={tarea.id_task} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium ${tarea.status === 'hecha' ? 'line-through text-gray-400' : 'text-gray-800'}`}>
                            {tarea.titulo}
                          </p>
                          {tarea.descripcion && <p className="text-xs text-gray-500 mt-0.5">{tarea.descripcion}</p>}
                          <div className="flex items-center gap-3 mt-1 text-xs text-gray-400">
                            {tarea.asignado_nombre && <span>👤 {tarea.asignado_nombre}</span>}
                            {tarea.fecha_limite && <span>📅 {formatFecha(tarea.fecha_limite)}</span>}
                          </div>
                        </div>
                        <select
                          className={`text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer ${COLOR_TAREA[tarea.status]}`}
                          value={tarea.status}
                          onChange={e => cambiarEstadoTarea(tarea.id_task, e.target.value)}>
                          {Object.entries(ESTADO_TAREA).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                        </select>
                      </div>
                    ))}
                </div>
              )}

              {/* HISTORIAL */}
              {tabActiva === 'historial' && (
                <div className="space-y-0">
                  {historial.length === 0
                    ? <p className="text-gray-400 text-sm text-center py-6">Sin cambios registrados.</p>
                    : historial.map((ev, i) => (
                      <div key={ev.id_audit} className="flex gap-3 relative">
                        {/* Línea vertical */}
                        {i < historial.length - 1 && (
                          <div className="absolute left-3.5 top-8 bottom-0 w-px bg-gray-200" />
                        )}
                        <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center shrink-0 z-10 mt-1">
                          <div className="w-2 h-2 rounded-full bg-blue-500" />
                        </div>
                        <div className="flex-1 pb-4">
                          <p className="text-sm text-gray-700">
                            <span className="font-medium">{ev.usuario_nombre || 'Sistema'}</span>
                            {' — '}{ev.accion.replace(/_/g, ' ')}
                          </p>
                          {ev.cambios && Object.keys(ev.cambios).length > 0 && (
                            <div className="mt-1 space-y-0.5">
                              {Object.entries(ev.cambios).map(([campo, vals]) => (
                                <p key={campo} className="text-xs text-gray-500">
                                  <span className="text-gray-400">{ETIQ_CAMBIO[campo] || campo}:</span>{' '}
                                  <span className="line-through text-gray-400">
                                    {vals.antes === null ? 'Nuevo' : (ETIQ_STATUS[vals.antes] || String(vals.antes))}
                                  </span>
                                  {' → '}
                                  <span className="font-medium text-gray-700">
                                    {ETIQ_STATUS[vals.despues] || String(vals.despues)}
                                  </span>
                                </p>
                              ))}
                            </div>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(ev.created_at).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' })}
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Panel lateral (30%) */}
        <div className="space-y-3">

          {/* Acción principal */}
          {(accionPrimaria() || esAdmin) && (
            <div className="card">
              {accionPrimaria()}

              {/* Borrador: selector de responsable */}
              {puedeEnviar && !reporte.id_responsable && (
                <select className="input-field mt-2 text-sm"
                  value={responsableParaEnvio}
                  onChange={e => setResponsableParaEnvio(e.target.value)} required>
                  <option value="">Selecciona responsable</option>
                  {usuarios.map(u => (
                    <option key={u.id_usuario} value={u.id_usuario}>
                      {u.nombre} · {u.name_role}
                    </option>
                  ))}
                </select>
              )}

              {/* Selector de estado libre para administradores, incluso si está cerrado */}
              {esAdmin && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
                    Cambiar estado (admin)
                  </label>
                  <select
                    className="input-field text-sm w-full"
                    value={reporte.status}
                    disabled={cambiandoEstado}
                    onChange={e => cambiarEstadoAdmin(e.target.value)}
                  >
                    {Object.entries(ETIQ_STATUS).map(([valor, etiqueta]) => (
                      <option key={valor} value={valor}>{etiqueta}</option>
                    ))}
                  </select>
                  {cambiandoEstado && (
                    <p className="text-xs text-gray-400 mt-1">Actualizando...</p>
                  )}
                </div>
              )}

              {/* Negar */}
              {mostrarNegacion && (
                <form onSubmit={e => { e.preventDefault(); decidir('negar', motivoNegacion) }} className="mt-3 space-y-2">
                  <textarea className="input-field text-sm" rows={3}
                    value={motivoNegacion} onChange={e => setMotivoNegacion(e.target.value)}
                    placeholder="Motivo de negación *" required />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 bg-red-600 hover:bg-red-700 text-white rounded-lg py-2 text-sm font-medium">
                      Confirmar negación
                    </button>
                    <button type="button" onClick={() => setMostrarNegacion(false)} className="flex-1 btn-secondary text-sm">
                      Cancelar
                    </button>
                  </div>
                </form>
              )}

              {/* Transferir */}
              {mostrarTransferencia && (
                <form onSubmit={transferirTicket} className="mt-3 space-y-2">
                  <select className="input-field text-sm" value={nuevoResponsable}
                    onChange={e => setNuevoResponsable(e.target.value)} required>
                    <option value="">Nuevo responsable *</option>
                    {usuarios.filter(u => u.id_usuario !== reporte.id_responsable).map(u => (
                      <option key={u.id_usuario} value={u.id_usuario}>{u.nombre} · {u.name_role}</option>
                    ))}
                  </select>
                  <textarea className="input-field text-sm" rows={2}
                    value={motivoTransferencia} onChange={e => setMotivoTransferencia(e.target.value)}
                    placeholder="Motivo de transferencia *" required />
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 btn-primary text-sm">Confirmar</button>
                    <button type="button" onClick={() => setMostrarTransferencia(false)} className="flex-1 btn-secondary text-sm">Cancelar</button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Detalles */}
          <div className="card space-y-4 text-sm">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Detalles</h3>

            {/* Creador */}
            <div className="flex items-center gap-2">
              <Avatar nombre={reporte.autor_nombre} size="sm" />
              <div>
                <p className="text-xs text-gray-400">Creador</p>
                <p className="text-gray-800 font-medium text-sm">{reporte.autor_nombre}</p>
              </div>
            </div>

            {/* Responsable */}
            <div className="flex items-center gap-2">
              <Avatar nombre={reporte.responsable_nombre || '?'} size="sm" />
              <div>
                <p className="text-xs text-gray-400">Responsable</p>
                <p className="text-gray-800 font-medium text-sm">{reporte.responsable_nombre || '—'}</p>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-3 space-y-2.5">
              {reporte.warehouse_nombre && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Sede / Bodega</span>
                  <span className="text-sm text-gray-700">{reporte.warehouse_nombre}</span>
                </div>
              )}
              {reporte.ubicacion && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Ubicación</span>
                  <span className="text-sm text-gray-700">{reporte.ubicacion}</span>
                </div>
              )}
              {reporte.fecha_hecho && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Fecha del hecho</span>
                  <span className="text-sm text-gray-700">{formatFecha(reporte.fecha_hecho)}</span>
                </div>
              )}
              {reporte.fecha_limite && (
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-400">Fecha límite</span>
                  <span className={`text-sm font-medium ${sla?.color?.split(' ')[0] || 'text-gray-700'}`}>
                    {formatFecha(reporte.fecha_limite)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Visibilidad</span>
                <span className="text-sm text-gray-700">🔒 Autor, responsable y usuarios seleccionados</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">Creado</span>
                <span className="text-sm text-gray-700">{tiempoRelativo(reporte.created_at)}</span>
              </div>
            </div>

            {TASKVIEW_HABILITADO && taskviewData?.taskview_url && (
              <a href={taskviewData.taskview_url} target="_blank" rel="noreferrer"
                className="flex items-center justify-center gap-1.5 text-xs text-blue-600 hover:text-blue-800 font-medium pt-1 border-t border-gray-100">
                ↗ Ver tarea en TaskView
              </a>
            )}
          </div>
        </div>
      </div>

      {showModalTarea && (
        <ModalTarea idReport={id} onClose={() => setShowModalTarea(false)}
          onCreada={() => { setShowModalTarea(false); cargar() }} />
      )}
    </div>
  )
}
