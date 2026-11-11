export function formatTicketNumber(value) {
  if (value === null || value === undefined || !/^\d+$/.test(String(value))) return '#---'
  return `#${String(value).padStart(3, '0')}`
}
