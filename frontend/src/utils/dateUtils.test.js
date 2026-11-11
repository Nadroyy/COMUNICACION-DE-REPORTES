import test from 'node:test'
import assert from 'node:assert/strict'

import { parseFechaServidor, tiempoRelativo } from './dateUtils.js'

test('parseFechaServidor treats MySQL timestamps without timezone as local time', () => {
  const fecha = parseFechaServidor('2026-10-17 12:00:00')
  assert.ok(fecha)
  assert.equal(fecha.getTime(), new Date(2026, 9, 17, 12, 0, 0).getTime())
})

test('tiempoRelativo uses local MySQL timestamps without adding a timezone offset', () => {
  const actual = new Date(2026, 9, 17, 12, 2, 0).getTime()
  assert.equal(tiempoRelativo('2026-10-17 12:00:00', actual), 'Hace 2 min')
})

test('parseFechaServidor preserves timestamps that include a timezone', () => {
  const fecha = parseFechaServidor('2026-10-17T12:00:00Z')
  assert.ok(fecha)
  assert.equal(fecha.toISOString(), '2026-10-17T12:00:00.000Z')
})

test('tiempoRelativo handles timezone-aware timestamps returned by the API', () => {
  const actual = new Date('2026-10-17T17:02:00.000Z').getTime()
  assert.equal(tiempoRelativo('2026-10-17T17:00:00.000Z', actual), 'Hace 2 min')
})
