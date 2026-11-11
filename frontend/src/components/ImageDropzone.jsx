import { useRef, useState } from 'react'

const MAX_IMAGES = 5
const MAX_IMAGE_SIZE = 5 * 1024 * 1024
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export default function ImageDropzone({
  files,
  onFilesChange,
  existingCount = 0,
  disabled = false
}) {
  const [arrastrando, setArrastrando] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef(null)

  const agregarArchivos = archivos => {
    const seleccionados = Array.from(archivos)
    if (!seleccionados.length) return

    if (existingCount + files.length + seleccionados.length > MAX_IMAGES) {
      setError(`Cada reporte admite hasta ${MAX_IMAGES} imágenes`)
      return
    }

    const invalido = seleccionados.find(archivo =>
      !ALLOWED_TYPES.includes(archivo.type) || archivo.size > MAX_IMAGE_SIZE
    )
    if (invalido) {
      setError('Solo se permiten imágenes PNG, JPEG o WebP de máximo 5 MB cada una')
      return
    }

    setError('')
    onFilesChange(actuales => [...actuales, ...seleccionados])
  }

  const manejarSeleccion = event => {
    agregarArchivos(event.target.files || [])
    event.target.value = ''
  }

  const manejarSoltado = event => {
    event.preventDefault()
    setArrastrando(false)
    agregarArchivos(event.dataTransfer.files || [])
  }

  const manejarArrastre = event => {
    if (Array.from(event.dataTransfer.types || []).includes('Files')) {
      event.preventDefault()
      setArrastrando(true)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragEnter={manejarArrastre}
        onDragOver={manejarArrastre}
        onDragLeave={event => {
          if (!(event.relatedTarget instanceof Node) || !event.currentTarget.contains(event.relatedTarget)) {
            setArrastrando(false)
          }
        }}
        onDrop={manejarSoltado}
        disabled={disabled || existingCount + files.length >= MAX_IMAGES}
        className={`w-full rounded-lg border-2 border-dashed px-4 py-5 text-center transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
          arrastrando
            ? 'border-blue-500 bg-blue-50 text-blue-800'
            : 'border-gray-300 bg-gray-50 text-gray-600 hover:border-blue-400 hover:bg-blue-50'
        }`}
      >
        <span className="block text-sm font-medium">
          {arrastrando ? 'Suelta las imágenes aquí' : 'Arrastra imágenes aquí o haz clic para seleccionarlas'}
        </span>
        <span className="mt-1 block text-xs text-gray-500">
          PNG, JPEG o WebP · hasta 5 MB cada una · {existingCount + files.length}/{MAX_IMAGES}
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        onChange={manejarSeleccion}
        disabled={disabled || existingCount + files.length >= MAX_IMAGES}
        className="sr-only"
        tabIndex={-1}
      />
      {error && <p role="alert" className="mt-2 text-xs text-red-600">{error}</p>}
      {files.length > 0 && (
        <ul className="mt-2 space-y-1">
          {files.map((archivo, index) => (
            <li key={`${archivo.name}-${archivo.size}-${index}`} className="flex items-center justify-between gap-2 text-sm text-gray-700">
              <span className="truncate">
                {archivo.name}
                <span className="text-xs text-gray-400"> ({(archivo.size / 1024 / 1024).toFixed(1)} MB)</span>
              </span>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onFilesChange(actuales => actuales.filter((_, i) => i !== index))}
                className="shrink-0 text-xs text-red-600 hover:text-red-800"
              >
                Quitar
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
