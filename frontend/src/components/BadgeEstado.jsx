// Badge de colores para el estado del reporte
const COLORES = {
  borrador:    'bg-gray-100 text-gray-700',
  enviado:     'bg-blue-100 text-blue-700',
  en_revision: 'bg-yellow-100 text-yellow-700',
  aprobado:    'bg-green-100 text-green-700',
  negado:      'bg-red-100 text-red-700',
  resuelto:    'bg-green-100 text-green-700',
  cerrado:     'bg-red-100 text-red-700'
}

const ETIQUETAS = {
  borrador:    'Borrador',
  enviado:     'Pendiente',
  en_revision: 'En revisión',
  aprobado:    'Aprobado',
  negado:      'Negado',
  resuelto:    'Resuelto',
  cerrado:     'Cerrado'
}

export default function BadgeEstado({ status }) {
  const color = COLORES[status] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {ETIQUETAS[status] || status}
    </span>
  )
}
