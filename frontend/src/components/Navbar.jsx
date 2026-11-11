import { useEffect, useState, useCallback, useRef } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../services/api'
import { conectarNotificaciones } from '../services/realtime'
import { tiempoRelativo } from '../utils/dateUtils'

// ─── Icono campana ──────────────────────────────────────────────────────────
function IconBell({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  )
}

// ─── Icono check ────────────────────────────────────────────────────────────
function IconCheck({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

// ─── Icono cierre ───────────────────────────────────────────────────────────
function IconX({ className = '' }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={className} aria-hidden="true">
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  )
}

function NotificacionToast({ notificacion, cantidadAdicional, onAbrir, onCerrar }) {
  useEffect(() => {
    const timeout = setTimeout(onCerrar, 8000)
    return () => clearTimeout(timeout)
  }, [notificacion.id_notif, onCerrar])

  return (
    <div
      role="status"
      aria-live="polite"
      className="notification-toast-enter fixed right-4 top-4 z-50 w-[min(400px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-blue-200 bg-white shadow-2xl"
    >
      <div className="flex items-start gap-3 p-4">
        <IconTipo tipo={notificacion.tipo} />
        <button
          type="button"
          onClick={() => onAbrir(notificacion)}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block text-xs font-bold uppercase tracking-wide text-blue-700">
            Nueva notificación
            {cantidadAdicional > 0 && ` · +${cantidadAdicional}`}
          </span>
          <span className="mt-1 block text-sm font-semibold text-gray-900">
            {notificacion.mensaje}
          </span>
          {notificacion.titulo && (
            <span className="mt-1 block truncate text-xs text-gray-500">
              Reporte: {notificacion.titulo}
            </span>
          )}
          <span className="mt-2 block text-xs font-medium text-blue-700">
            Ver reporte →
          </span>
        </button>
        <button
          type="button"
          onClick={onCerrar}
          aria-label="Cerrar notificación"
          className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
        >
          <IconX className="h-4 w-4" />
        </button>
      </div>
      <div className="h-1 bg-blue-100">
        <div className="notification-toast-progress h-full bg-blue-600" />
      </div>
    </div>
  )
}

// ─── Icono tipo ─────────────────────────────────────────────────────────────
function IconTipo({ tipo }) {
  const map = {
    asignacion:    { bg: 'bg-blue-100',   text: 'text-blue-600',  label: '👤' },
    ticket_creado: { bg: 'bg-green-100',  text: 'text-green-600', label: '🎫' },
    comentario_nuevo: { bg: 'bg-yellow-100', text: 'text-yellow-600', label: '💬' },
    cambio_estado: { bg: 'bg-purple-100', text: 'text-purple-600', label: '🔄' },
  }

  const { bg, text, label } = map[tipo] || { bg: 'bg-gray-100', text: 'text-gray-600', label: '🔔' }
  return (
    <span className={`inline-flex items-center justify-center w-9 h-9 rounded-full shrink-0 text-base ${bg} ${text}`}>
      {label}
    </span>
  )
}

// ─── Drawer de notificaciones ───────────────────────────────────────────────
function NotificacionesDrawer({ abierto, onCerrar, notificaciones, noLeidas, onAbrir, onMarcarTodas }) {
  // Cerrar con Escape
  useEffect(() => {
    if (!abierto) return
    const handler = (e) => { if (e.key === 'Escape') onCerrar() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [abierto, onCerrar])

  // Bloquear scroll del body cuando está abierto
  useEffect(() => {
    document.body.style.overflow = abierto ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [abierto])

  return (
    <>
      {/* Overlay */}
      <div
        onClick={onCerrar}
        className={`fixed inset-0 z-30 bg-black/40 backdrop-blur-sm transition-opacity duration-300 ${
          abierto ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden="true"
      />

      {/* Panel lateral */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Panel de notificaciones"
        className={`fixed top-0 right-0 z-40 h-full w-[min(380px,100vw)] bg-white shadow-2xl flex flex-col
          transition-transform duration-300 ease-in-out
          ${abierto ? 'translate-x-0' : 'translate-x-full'}`}
      >
        {/* Cabecera */}
        <div className="flex items-center justify-between px-4 py-4 bg-blue-600 text-white shrink-0">
          <div className="flex items-center gap-2">
            <IconBell className="w-5 h-5" />
            <span className="font-semibold text-base">Notificaciones</span>
            {noLeidas > 0 && (
              <span className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full bg-red-500 text-xs font-bold">
                {noLeidas > 99 ? '99+' : noLeidas}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {noLeidas > 0 && (
              <button
                type="button"
                onClick={onMarcarTodas}
                title="Marcar todas como leídas"
                className="flex items-center gap-1 text-xs bg-blue-700 hover:bg-blue-800 px-2 py-1 rounded transition-colors"
              >
                <IconCheck className="w-3.5 h-3.5" />
                Leer todas
              </button>
            )}
            <button
              type="button"
              onClick={onCerrar}
              aria-label="Cerrar panel"
              className="p-1 rounded hover:bg-blue-700 transition-colors"
            >
              <IconX className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {notificaciones.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 text-gray-400 py-16">
              <IconBell className="w-12 h-12 opacity-30" />
              <p className="text-sm">No tienes notificaciones</p>
            </div>
          ) : notificaciones.map(n => (
            <button
              key={n.id_notif}
              type="button"
              onClick={() => onAbrir(n)}
              className={`w-full text-left flex gap-3 px-4 py-3 hover:bg-gray-50 transition-colors
                ${!n.leido ? 'bg-blue-50' : 'bg-white'}`}
            >
              <IconTipo tipo={n.tipo} />
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-snug ${!n.leido ? 'font-semibold text-gray-900' : 'font-normal text-gray-700'}`}>
                  {n.mensaje}
                </p>
                {n.titulo && (
                  <p className="text-xs text-blue-600 mt-0.5 truncate">📋 {n.titulo}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">{tiempoRelativo(n.created_at)}</p>
              </div>
              {!n.leido && (
                <span className="w-2 h-2 mt-1.5 rounded-full bg-blue-500 shrink-0" aria-label="No leída" />
              )}
            </button>
          ))}
        </div>

        {/* Pie */}
        <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 shrink-0 text-center">
          <p className="text-xs text-gray-400">
            {noLeidas === 0 ? 'Todo al día ✓' : `${noLeidas} sin leer`}
          </p>
        </div>
      </aside>
    </>
  )
}

// ─── Navbar ──────────────────────────────────────────────────────────────────
export default function Navbar({ embebido = false }) {
  const { usuario } = useAuth()
  const [notificaciones, setNotificaciones] = useState([])
  const [noLeidas, setNoLeidas]             = useState(0)
  const [drawerAbierto, setDrawerAbierto]   = useState(false)
  const [notificacionNueva, setNotificacionNueva] = useState(null)
  const [cantidadAdicional, setCantidadAdicional] = useState(0)
  const idsConocidos = useRef(null)
  const consultaEnCurso = useRef(false)
  const errorDeCargaRegistrado = useRef(false)
  const contextoAudio = useRef(null)
  const { pathname } = useLocation()

  const habilitarAudio = useCallback(() => {
    if (!window.AudioContext) return

    if (!contextoAudio.current) contextoAudio.current = new window.AudioContext()
    const contexto = contextoAudio.current
    if (contexto.state !== 'running') {
      contexto.resume().catch(err => {
        console.warn('No se pudo habilitar el sonido de notificaciones:', err.message)
      })
    }
  }, [])

  const reproducirSonidoNotificacion = useCallback(() => {
    const contexto = contextoAudio.current
    if (!contexto || contexto.state !== 'running') return

    const ahora = contexto.currentTime
    ;[880, 1174].forEach((frecuencia, indice) => {
      const inicio = ahora + indice * 0.12
      const oscilador = contexto.createOscillator()
      const volumen = contexto.createGain()
      oscilador.type = 'sine'
      oscilador.frequency.setValueAtTime(frecuencia, inicio)
      volumen.gain.setValueAtTime(0.0001, inicio)
      volumen.gain.exponentialRampToValueAtTime(0.12, inicio + 0.02)
      volumen.gain.exponentialRampToValueAtTime(0.0001, inicio + 0.2)
      oscilador.connect(volumen)
      volumen.connect(contexto.destination)
      oscilador.start(inicio)
      oscilador.stop(inicio + 0.21)
    })
  }, [])

  useEffect(() => {
    window.addEventListener('pointerdown', habilitarAudio)
    window.addEventListener('keydown', habilitarAudio)
    return () => {
      window.removeEventListener('pointerdown', habilitarAudio)
      window.removeEventListener('keydown', habilitarAudio)
      contextoAudio.current?.close()
      contextoAudio.current = null
    }
  }, [habilitarAudio])

  const cargarNotificaciones = useCallback(async () => {
    if (!usuario?.id_usuario || consultaEnCurso.current) return
    consultaEnCurso.current = true

    try {
      const { data } = await api.get('/notifications')
      const nuevasNotificaciones = data.notificaciones ?? []
      const idsActuales = new Set(nuevasNotificaciones.map(n => String(n.id_notif)))

      if (idsConocidos.current) {
        const recibidas = nuevasNotificaciones.filter(
          n => !idsConocidos.current.has(String(n.id_notif)) && !n.leido
        )
        if (recibidas.length > 0) {
          setNotificacionNueva(recibidas[0])
          setCantidadAdicional(recibidas.length - 1)
          reproducirSonidoNotificacion()
        }
      }

      idsConocidos.current = idsActuales
      setNotificaciones(nuevasNotificaciones)
      setNoLeidas(Number(data.no_leidas) || 0)
      errorDeCargaRegistrado.current = false
    } catch (err) {
      if (!errorDeCargaRegistrado.current) {
        console.error('Error al cargar notificaciones:', err.message)
        errorDeCargaRegistrado.current = true
      }
    } finally {
      consultaEnCurso.current = false
    }
  }, [reproducirSonidoNotificacion, usuario?.id_usuario])

  useEffect(() => {
    idsConocidos.current = null
    setNotificacionNueva(null)
    cargarNotificaciones()
    if (!usuario?.id_usuario) return undefined

    const socket = conectarNotificaciones()
    let temporizadorActualizacion
    let errorSocketRegistrado = false
    const actualizarPorEvento = () => {
      clearTimeout(temporizadorActualizacion)
      temporizadorActualizacion = setTimeout(cargarNotificaciones, 100)
    }
    socket.on('notifications:new', actualizarPorEvento)
    socket.on('connect', () => {
      errorSocketRegistrado = false
      cargarNotificaciones()
    })
    socket.on('connect_error', err => {
      if (!errorSocketRegistrado) {
        console.error('No se pudo conectar al canal de notificaciones:', err.message)
        errorSocketRegistrado = true
      }
    })

    const interval = setInterval(() => {
      if (!socket.connected && document.visibilityState === 'visible') cargarNotificaciones()
    }, 30000)
    const actualizarAlVolver = () => {
      if (document.visibilityState === 'visible') cargarNotificaciones()
    }
    window.addEventListener('focus', actualizarAlVolver)
    document.addEventListener('visibilitychange', actualizarAlVolver)
    return () => {
      clearInterval(interval)
      clearTimeout(temporizadorActualizacion)
      socket.disconnect()
      window.removeEventListener('focus', actualizarAlVolver)
      document.removeEventListener('visibilitychange', actualizarAlVolver)
    }
  }, [cargarNotificaciones, usuario?.id_usuario])

  const abrirNotificacion = async (n) => {
    try {
      if (!n.leido) await api.patch(`/notifications/${n.id_notif}/read`)
    } catch (err) {
      console.error('Error al marcar notificación como leída:', err.message)
    }
    setDrawerAbierto(false)
    setNotificacionNueva(null)
    window.location.assign(`/reports/${encodeURIComponent(n.id_report)}`)
  }

  const cerrarToast = useCallback(() => setNotificacionNueva(null), [])

  const marcarTodasLeidas = async () => {
    try {
      await api.patch('/notifications/read-all')
    } catch (err) {
      console.error('Error al marcar notificaciones como leídas:', err.message)
    }
    cargarNotificaciones()
  }

  const linkClass = (path) =>
    `px-3 py-2 rounded-md text-sm font-medium transition-colors ${
      pathname.startsWith(path)
        ? 'bg-blue-700 text-white'
        : 'text-blue-100 hover:bg-blue-700 hover:text-white'
    }`

  return (
    <>
      {!embebido && (
        <nav className="bg-blue-600 shadow-md relative z-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center justify-between h-16">
              <Link to="/dashboard" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center">
                  <span className="text-blue-600 font-bold text-sm">T</span>
                </div>
                <span className="text-white font-semibold text-lg">Tickets</span>
              </Link>
              <div className="hidden md:flex items-center gap-1">
                <Link to="/dashboard" className={linkClass('/dashboard')}>Dashboard</Link>
                <Link to="/reports" className={linkClass('/reports')}>Tickets</Link>
              </div>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setDrawerAbierto(true)}
                  aria-label={`Notificaciones${noLeidas ? `, ${noLeidas} sin leer` : ''}`}
                  className="relative p-2 rounded-full text-white hover:bg-blue-700 transition-colors">
                  <IconBell key={notificacionNueva?.id_notif} className={`w-6 h-6 ${notificacionNueva ? 'notification-bell-ring' : ''}`} />
                  {noLeidas > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-red-500 text-[10px] font-bold text-white">
                      {noLeidas > 99 ? '99+' : noLeidas}
                    </span>
                  )}
                </button>
                <div className="text-right hidden sm:block">
                  <p className="text-white text-sm font-medium leading-tight">{usuario?.nombre}</p>
                  <p className="text-blue-200 text-xs">{usuario?.name_role}</p>
                </div>
              </div>
            </div>
          </div>
        </nav>
      )}

      {/* Drawer lateral */}
      <NotificacionesDrawer
        abierto={drawerAbierto}
        onCerrar={() => setDrawerAbierto(false)}
        notificaciones={notificaciones}
        noLeidas={noLeidas}
        onAbrir={abrirNotificacion}
        onMarcarTodas={marcarTodasLeidas}
      />
      {notificacionNueva && (
        <NotificacionToast
          notificacion={notificacionNueva}
          cantidadAdicional={cantidadAdicional}
          onAbrir={abrirNotificacion}
          onCerrar={cerrarToast}
        />
      )}
    </>
  )
}
