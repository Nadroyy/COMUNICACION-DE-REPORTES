export function parseFechaServidor(value) {
  if (!value && value !== 0) return null

  const raw = String(value).trim()
  if (!raw) return null

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T')
  const parsed = new Date(normalized)

  if (Number.isNaN(parsed.getTime())) {
    return null
  }

  return parsed
}

export function tiempoRelativo(value, now = Date.now()) {
  const fecha = parseFechaServidor(value)
  if (!fecha) return 'Fecha no disponible'

  const diff = now - fecha.getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'Ahora'
  if (min < 60) return `Hace ${min} min`
  const hrs = Math.floor(min / 60)
  if (hrs < 24) return `Hace ${hrs} h`
  const dias = Math.floor(hrs / 24)
  return `Hace ${dias} d`
}
