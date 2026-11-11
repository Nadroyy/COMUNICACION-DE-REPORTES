// Badge de colores para la prioridad
const COLORES = {
  baja:    'bg-green-100 text-green-700',
  media:   'bg-yellow-100 text-yellow-700',
  alta:    'bg-orange-100 text-orange-700',
  critica: 'bg-red-100 text-red-700'
}

const ETIQUETAS = {
  baja:    'Baja',
  media:   'Media',
  alta:    'Alta',
  critica: '⚠ Crítica'
}

export default function BadgePrioridad({ prioridad }) {
  const color = COLORES[prioridad] || 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {ETIQUETAS[prioridad] || prioridad}
    </span>
  )
}
