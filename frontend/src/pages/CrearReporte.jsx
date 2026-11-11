import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import api from '../services/api'
import ImageDropzone from '../components/ImageDropzone'

// Fecha de hoy en formato YYYY-MM-DD (sin desfase UTC)
const hoy = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

// Campo dinámico según template_fields
function CampoDinamico({ campo, value, onChange }) {
  const base = "input-field"
  if (campo.type === 'textarea') {
    return (
      <textarea className={base} rows={3} value={value || ''}
        onChange={e => onChange(campo.name, e.target.value)}
        placeholder={campo.label} required={campo.required} />
    )
  }
  if (campo.type === 'select' && campo.options) {
    return (
      <select className={base} value={value || ''}
        onChange={e => onChange(campo.name, e.target.value)} required={campo.required}>
        <option value="">— Selecciona —</option>
        {campo.options.map(op => <option key={op} value={op}>{op}</option>)}
      </select>
    )
  }
  if (campo.type === 'boolean') {
    return (
      <div className="flex items-center gap-2">
        <input type="checkbox" id={campo.name} checked={!!value}
          onChange={e => onChange(campo.name, e.target.checked)}
          className="w-4 h-4 rounded border-gray-300 text-blue-600" />
        <label htmlFor={campo.name} className="text-sm text-gray-700">{campo.label}</label>
      </div>
    )
  }
  return (
    <input type={campo.type === 'date' ? 'date' : 'text'} className={base}
      value={value || ''} onChange={e => onChange(campo.name, e.target.value)}
      placeholder={campo.label} required={campo.required} />
  )
}

// Selector de persona con búsqueda
function SelectorPersona({ usuarios, value, onChange, id, required }) {
  const [busqueda, setBusqueda] = useState('')
  const [abierto, setAbierto] = useState(false)
  const ref = useRef(null)

  const seleccionado = usuarios.find(u => String(u.id_usuario) === String(value))
  const filtrados = usuarios.filter(u => {
    const texto = `${u.nombre} ${u.nombre_warehouse || ''}`.toLowerCase()
    return texto.includes(busqueda.toLowerCase())
  })

  useEffect(() => {
    const cerrar = (e) => { if (ref.current && !ref.current.contains(e.target)) setAbierto(false) }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [])

  return (
    <div ref={ref} className="relative">
      <button type="button"
        onClick={() => setAbierto(a => !a)}
        className={`input-field text-left flex items-center justify-between ${!value ? 'text-gray-400' : 'text-gray-900'}`}>
        {seleccionado
          ? <span>{seleccionado.nombre}{seleccionado.nombre_warehouse ? ` · ${seleccionado.nombre_warehouse}` : ''}</span>
          : <span>Busca por nombre o sede...</span>}
        <span className="text-gray-400 ml-2">▾</span>
      </button>
      {abierto && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="p-2 border-b border-gray-100">
            <input autoFocus className="input-field py-1.5 text-sm" placeholder="Buscar..."
              value={busqueda} onChange={e => setBusqueda(e.target.value)} />
          </div>
          <div className="max-h-52 overflow-y-auto">
            {filtrados.length === 0
              ? <p className="text-sm text-gray-400 px-3 py-4 text-center">Sin resultados</p>
              : filtrados.map(u => (
                <button key={u.id_usuario} type="button"
                  onClick={() => { onChange(String(u.id_usuario)); setAbierto(false); setBusqueda('') }}
                  className={`w-full text-left px-3 py-2.5 text-sm hover:bg-blue-50 flex items-center justify-between ${
                    String(u.id_usuario) === String(value) ? 'bg-blue-50 text-blue-800' : 'text-gray-800'
                  }`}>
                  <span className="font-medium">{u.nombre}</span>
                  {u.nombre_warehouse && <span className="text-xs text-gray-400">{u.nombre_warehouse}</span>}
                </button>
              ))}
          </div>
        </div>
      )}
      {/* Campo oculto para validación HTML */}
      <input type="text" className="sr-only" value={value} onChange={() => {}} required={required} tabIndex={-1} />
    </div>
  )
}

export default function CrearReporte() {
  const navigate = useNavigate()
  const [tipos, setTipos]     = useState([])
  const [usuarios, setUsuarios] = useState([])
  const [tipoSeleccionado, setTipoSeleccionado] = useState(null)
  const [form, setForm] = useState({
    id_type: '', titulo: '', descripcion: '',
    id_responsable: '',
    modo_notificacion: 'responsable', usuarios_notificados: [],
    prioridad: 'media', fecha_hecho: hoy(), fecha_limite: '',
    ubicacion: ''
  })
  const [extraData, setExtraData] = useState({})
  const [imagenes, setImagenes] = useState([])
  const [error, setError]     = useState('')
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    api.get('/report-types').then(r => setTipos(r.data.tipos)).catch(() => {})
    api.get('/users/assignable').then(r => setUsuarios(r.data.usuarios)).catch(() => {})
  }, [])

  const handleTipoChange = (idType) => {
    const tipo = tipos.find(t => t.id_type === idType)
    setTipoSeleccionado(tipo || null)
    setExtraData({})
    setForm(f => ({ ...f, id_type: idType }))
  }

  const handleExtraChange = (nombre, valor) => {
    setExtraData(ed => ({ ...ed, [nombre]: valor }))
  }

  const enviar = async (enviarAhora) => {
    setError('')
    if (!form.id_type)          { setError('Selecciona un tipo de reporte'); return }
    if (!form.titulo.trim())    { setError('El título es requerido'); return }
    if (form.fecha_limite && form.fecha_limite < hoy()) {
      setError('La fecha límite no puede ser anterior a hoy')
      return
    }
    if (enviarAhora && !form.id_responsable) {
      setError('Selecciona un responsable antes de enviar el ticket')
      return
    }

    setGuardando(true)
    try {
      const body = {
        id_type:      form.id_type,
        titulo:       form.titulo,
        descripcion:  form.descripcion || undefined,
        id_responsable: form.id_responsable,
        prioridad:    form.prioridad,
        fecha_hecho:  form.fecha_hecho  || undefined,
        fecha_limite: form.fecha_limite || undefined,
        ubicacion:    form.ubicacion    || undefined,
        notificar_a_todos: form.modo_notificacion === 'todos',
        usuarios_notificados: form.modo_notificacion === 'personas' ? form.usuarios_notificados : [],
        extra_data:   Object.keys(extraData).length > 0 ? extraData : undefined,
        status:       enviarAhora ? 'enviado' : 'borrador'
      }
      const { data } = await api.post('/reports', body)
      if (imagenes.length > 0) {
        const formData = new FormData()
        imagenes.forEach(imagen => formData.append('images', imagen))
        try {
          await api.post(`/reports/${data.id_report}/attachments`, formData, {
            headers: { 'Content-Type': 'multipart/form-data' }
          })
        } catch (uploadError) {
          navigate(`/reports/${data.id_report}`, {
            state: {
              attachmentUploadError: uploadError.response?.data?.error
                || 'El reporte se creó, pero no se pudieron subir las imágenes. Inténtalo nuevamente desde el detalle.'
            }
          })
          return
        }
      }
      navigate(`/reports/${data.id_report}`)
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear el reporte')
      setGuardando(false)
    }
  }

  const requiredFields = tipoSeleccionado?.required_fields || []

  return (
    <div className="max-w-6xl mx-auto space-y-3 lg:h-[calc(100dvh-6rem)] lg:flex lg:flex-col">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-700 text-sm">← Volver</button>
        <h1 className="text-xl font-bold text-gray-900">Nueva solicitud</h1>
      </div>

      <form onSubmit={e => e.preventDefault()} className="grid grid-cols-1 gap-3 lg:min-h-0 lg:flex-1 lg:grid-cols-[minmax(15rem,0.8fr)_minmax(0,1.6fr)]">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm lg:col-span-2">{error}</div>
        )}

        {/* Tipo */}
        <div className="card p-3 lg:min-h-0 lg:overflow-y-auto">
          <h2 className="font-semibold text-gray-900 mb-3">Tipo de reporte</h2>
          <div className="grid grid-cols-1 gap-2">
            {tipos.map(tipo => (
              <label key={tipo.id_type}
                className={`flex items-start gap-2 p-3 rounded-lg border-2 cursor-pointer transition-colors ${
                  form.id_type === tipo.id_type ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'
                }`}>
                <input type="radio" name="tipo" value={tipo.id_type}
                  checked={form.id_type === tipo.id_type}
                  onChange={() => handleTipoChange(tipo.id_type)} className="mt-0.5" />
                <div>
                  <p className="font-medium text-gray-900">{tipo.nombre}</p>
                  <p className="text-xs text-gray-500">{tipo.descripcion}</p>
                  {tipo.id_type === form.id_type && requiredFields.length > 0 && (
                    <p className="text-xs text-blue-600 mt-1">
                      Obligatorios: {requiredFields.join(', ')}
                    </p>
                  )}
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* Información general */}
        <div className="flex flex-col gap-3 lg:min-h-0 lg:overflow-y-auto">
        <div className="card p-4 space-y-3">
          <h2 className="font-semibold text-gray-900">Información general</h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Título *</label>
            <input className="input-field" value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="Describe la solicitud en pocas palabras" required />
          </div>

          <div>
            <label className="label" htmlFor="id_responsable">
              Responsable <span className="font-normal text-gray-500">(requerido para enviar)</span>
            </label>
            <SelectorPersona usuarios={usuarios} value={form.id_responsable}
              onChange={val => setForm(f => ({ ...f, id_responsable: val }))}
              id="id_responsable" />
          </div>
              </div>

          {/* Notificaciones */}
          <fieldset className="space-y-3">
            <legend className="label">Compartir y notificar también a</legend>
            <div className="flex flex-wrap gap-1.5">
              {[['responsable','Solo responsable'],['personas','Personas específicas'],['todos','Todas las personas activas']].map(([value, label]) => (
                <label key={value}
                  className={`flex items-center gap-1.5 rounded border px-2.5 py-1.5 text-xs cursor-pointer ${
                    form.modo_notificacion === value ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-gray-300 text-gray-700'
                  }`}>
                  <input type="radio" name="modo_notificacion" value={value}
                    checked={form.modo_notificacion === value}
                    onChange={() => setForm(f => ({ ...f, modo_notificacion: value }))} />
                  {label}
                </label>
              ))}
            </div>
            {form.modo_notificacion === 'todos' && (
              <p className="text-xs text-amber-700">
                Todos los usuarios activos recibirán una notificación y podrán ver este reporte.
              </p>
            )}
            {form.modo_notificacion === 'personas' && (
              <div className="max-h-48 overflow-y-auto rounded border border-gray-200 p-3 space-y-2">
                {usuarios.map(persona => (
                  <label key={persona.id_usuario} className="flex items-center gap-2 text-sm text-gray-700">
                    <input type="checkbox"
                      checked={form.usuarios_notificados.includes(String(persona.id_usuario))}
                      onChange={e => setForm(f => ({
                        ...f,
                        usuarios_notificados: e.target.checked
                          ? [...f.usuarios_notificados, String(persona.id_usuario)]
                          : f.usuarios_notificados.filter(id => id !== String(persona.id_usuario))
                      }))} />
                    {persona.nombre}
                  </label>
                ))}
              </div>
            )}
            <p className="text-xs text-gray-500">
              {form.modo_notificacion === 'todos'
                ? 'Todos los usuarios activos recibirán el aviso y podrán ver el reporte.'
                : form.modo_notificacion === 'personas'
                  ? 'Solo el responsable y las personas seleccionadas recibirán el aviso y podrán ver el reporte.'
                  : 'Solo el responsable recibirá el aviso y podrá ver el reporte.'}
              {' '}El autor y los administradores también pueden verlo.
            </p>
          </fieldset>

          <div>
            <label className="label">Descripción</label>
            <textarea className="input-field" rows={2} value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Detalla lo ocurrido, la solicitud o el aviso..." />
          </div>

          <div>
            <label className="label">Imágenes (opcional)</label>
            <ImageDropzone files={imagenes} onFilesChange={setImagenes} disabled={guardando} />
          </div>

          <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
            <div>
              <label className="label">Prioridad</label>
              <select className="input-field" value={form.prioridad}
                onChange={e => setForm(f => ({ ...f, prioridad: e.target.value }))}>
                <option value="baja">Baja</option>
                <option value="media">Media</option>
                <option value="alta">Alta</option>
                <option value="critica">Crítica</option>
              </select>
            </div>
            <div>
              <label className="label">Fecha del hecho</label>
              <input type="date" className="input-field" value={form.fecha_hecho}
                onChange={e => setForm(f => ({ ...f, fecha_hecho: e.target.value }))} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label">Fecha límite</label>
              <input type="date" className="input-field" value={form.fecha_limite}
                min={hoy()}
                onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))} />
            </div>
            <div>
              <label className="label">Ubicación</label>
              <input className="input-field" value={form.ubicacion}
                onChange={e => setForm(f => ({ ...f, ubicacion: e.target.value }))}
                placeholder="Sede, área, piso..." />
            </div>
          </div>

        {/* Campos específicos del tipo */}
        {tipoSeleccionado && tipoSeleccionado.template_fields.length > 0 && (
          <div className="border-t border-gray-200 pt-3 space-y-3">
            <h2 className="font-semibold text-gray-900">Campos de {tipoSeleccionado.nombre}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {tipoSeleccionado.template_fields.map(campo => (
              <div key={campo.name}>
                {campo.type !== 'boolean' && (
                  <label className="label">{campo.label}{campo.required && ' *'}</label>
                )}
                <CampoDinamico campo={campo} value={extraData[campo.name]} onChange={handleExtraChange} />
              </div>
            ))}
            </div>
          </div>
        )}

        {/* Acciones — Borrador vs Enviar */}
        <div className="border-t border-gray-200 pt-3 space-y-2">
          <div className="flex gap-3">
            <button type="button" disabled={guardando} onClick={() => enviar(false)}
              className="flex-1 btn-secondary py-3 text-sm">
              <span className="block font-medium">💾 Guardar borrador</span>
              <span className="block text-xs text-gray-500 mt-0.5">Privado para ti y administradores; no se envían avisos</span>
            </button>
            <button type="button" disabled={guardando} onClick={() => enviar(true)}
              className="flex-1 btn-primary py-3 text-sm">
              <span className="block font-medium">📤 Enviar a {usuarios.find(u => String(u.id_usuario) === form.id_responsable)?.nombre || 'responsable'}</span>
              <span className="block text-xs text-blue-100 mt-0.5">El responsable recibe un aviso ahora</span>
            </button>
          </div>
          <button type="button" onClick={() => navigate(-1)}
            className="w-full text-sm text-gray-500 hover:text-gray-700 py-1">
            Cancelar
          </button>
        </div>
        </div>
        </div>
      </form>
    </div>
  )
}
