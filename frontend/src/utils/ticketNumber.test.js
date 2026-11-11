import test from 'node:test'
import assert from 'node:assert/strict'
import { formatTicketNumber } from './ticketNumber.js'

test('formats ticket numbers with at least three digits', () => {
  assert.equal(formatTicketNumber(1), '#001')
  assert.equal(formatTicketNumber('42'), '#042')
  assert.equal(formatTicketNumber(1000), '#1000')
})

test('returns a visible placeholder when no ticket number is available', () => {
  assert.equal(formatTicketNumber(null), '#---')
})
