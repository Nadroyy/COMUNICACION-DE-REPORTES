import { useState } from 'react'
import api from '../services/api'

export default function ModalTarea({ idReport, onClose, onCreada }) {
  const [form, setForm] = useState({
    titulo: '', descripcion: '', id_asignado: '', fecha_limite: ''
  })
  const [error, setError] = useState('')
  const [guardando, setGuardando] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.titulo.trim()) {
      setError('El título es requerido')
      return
    }
    setGuardando(true)
    setError('')
    try {
      await api.post(`/reports/${idReport}/tasks`, {
        titulo:      form.titulo,
        descripcion: form.descripcion || undefined,
        id_asignado: form.id_asignado || undefined,
        fecha_limite:form.fecha_limite || undefined
      })
      onCreada()
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la tarea')
      setGuardando(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Nueva tarea</h3>
        </div>
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {error}
            </div>
          )}
          <div>
            <label className="label">Título *</label>
            <input
              className="input-field"
              value={form.titulo}
              onChange={e => setForm(f => ({ ...f, titulo: e.target.value }))}
              placeholder="¿Qué hay que hacer?"
            />
          </div>
          <div>
            <label className="label">Descripción</label>
            <textarea
              className="input-field"
              rows={3}
              value={form.descripcion}
              onChange={e => setForm(f => ({ ...f, descripcion: e.target.value }))}
              placeholder="Detalles adicionales..."
            />
          </div>
          <div>
            <label className="label">Fecha límite</label>
            <input
              type="date"
              className="input-field"
              value={form.fecha_limite}
              onChange={e => setForm(f => ({ ...f, fecha_limite: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">
              Cancelar
            </button>
            <button type="submit" disabled={guardando} className="btn-primary">
              {guardando ? 'Guardando...' : 'Crear tarea'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
