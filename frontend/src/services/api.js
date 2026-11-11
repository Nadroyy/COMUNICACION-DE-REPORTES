import axios from 'axios'

// En desarrollo usa el proxy de Vite (/api → localhost:3001)
// En producción Docker nginx hace el proxy
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' }
})

api.interceptors.request.use(config => {
  const hostJwt = sessionStorage.getItem('hostJwt')
  const email = localStorage.getItem('userEmail')
  if (hostJwt) config.headers.Authorization = `Bearer ${hostJwt}`
  else if (email) config.headers['X-User-Email'] = email
  return config
})

api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) sessionStorage.removeItem('hostJwt')
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('usuario')
    }
    return Promise.reject(err)
  }
)

export default api
