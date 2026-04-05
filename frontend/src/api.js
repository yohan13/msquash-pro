const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000'

function authHeader() {
  const t = localStorage.getItem('token')
  return t ? { Authorization: `Bearer ${t}` } : {}
}

async function request(url, options = {}) {
  let res
  try {
    res = await fetch(url, options)
  } catch {
    throw new Error('NETWORK_ERROR')
  }
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error || `HTTP_${res.status}`)
  return json
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

export function register(payload) {
  return request(`${API_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function login(payload) {
  return request(`${API_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
}

export function me() {
  return request(`${API_URL}/api/auth/me`, { headers: authHeader() })
}

export function updateProfile(payload) {
  return request(`${API_URL}/api/auth/me`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
}

// ─── Config & Slots ───────────────────────────────────────────────────────────

export function getConfig() {
  return request(`${API_URL}/api/config`)
}

export function getDay(date) {
  return request(`${API_URL}/api/slots?date=${encodeURIComponent(date)}`)
}

// ─── Bookings ─────────────────────────────────────────────────────────────────

export function createBooking(payload) {
  return request(`${API_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
}

export function deleteBooking(id) {
  return request(`${API_URL}/api/bookings/${id}`, {
    method: 'DELETE',
    headers: authHeader(),
  })
}

export function myBookings() {
  return request(`${API_URL}/api/my/bookings`, { headers: authHeader() })
}

export function bookingICSUrl(id) {
  return `${API_URL}/api/bookings/${id}/ics?token=${localStorage.getItem('token') || ''}`
}

// ─── Admin — Blocks ───────────────────────────────────────────────────────────

export function createBlock(payload) {
  return request(`${API_URL}/api/blocks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
}

export function deleteBlock(id) {
  return request(`${API_URL}/api/blocks/${id}`, {
    method: 'DELETE',
    headers: authHeader(),
  })
}

// ─── Admin — CSV Export ───────────────────────────────────────────────────────

export async function exportCSV(from, to) {
  const u = new URL(`${API_URL}/api/admin/export/csv`)
  if (from) u.searchParams.set('from', from)
  if (to)   u.searchParams.set('to', to)
  let res
  try { res = await fetch(u, { headers: authHeader() }) }
  catch { throw new Error('NETWORK_ERROR') }
  if (!res.ok) throw new Error('EXPORT_FAILED')
  return res.blob()
}

// ─── Admin — Users ────────────────────────────────────────────────────────────

export function adminGetUsers() {
  return request(`${API_URL}/api/admin/users`, { headers: authHeader() })
}

export function adminUpdateRole(userId, role) {
  return request(`${API_URL}/api/admin/users/${userId}/role`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ role }),
  })
}

export function adminResetPassword(userId, newPassword) {
  return request(`${API_URL}/api/admin/users/${userId}/password`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ newPassword }),
  })
}

export function adminDeleteUser(userId) {
  return request(`${API_URL}/api/admin/users/${userId}`, {
    method: 'DELETE',
    headers: authHeader(),
  })
}

// ─── Admin — Stats ────────────────────────────────────────────────────────────

export function adminGetStats() {
  return request(`${API_URL}/api/admin/stats`, { headers: authHeader() })
}

// ─── Members (pour picker adversaire) ────────────────────────────────────────

export function getMembers() {
  return request(`${API_URL}/api/members`, { headers: authHeader() })
}

// ─── Subscriptions ────────────────────────────────────────────────────────────

export function mySubscriptions() {
  return request(`${API_URL}/api/my/subscriptions`, { headers: authHeader() })
}

export function buySubscription(cardType) {
  return request(`${API_URL}/api/my/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify({ cardType }),
  })
}

export function adminGetSubscriptions() {
  return request(`${API_URL}/api/admin/subscriptions`, { headers: authHeader() })
}

export function adminCreateSubscription(payload) {
  return request(`${API_URL}/api/admin/subscriptions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeader() },
    body: JSON.stringify(payload),
  })
}

export function adminDeleteSubscription(id) {
  return request(`${API_URL}/api/admin/subscriptions/${id}`, {
    method: 'DELETE',
    headers: authHeader(),
  })
}
