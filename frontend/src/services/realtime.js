import { io } from 'socket.io-client'

const realtimeUrl = import.meta.env.VITE_REALTIME_URL?.trim() || undefined

export const conectarNotificaciones = () => io(realtimeUrl, {
  path: '/socket.io',
  auth: callback => callback({
    token: sessionStorage.getItem('hostJwt'),
    email: localStorage.getItem('userEmail')
  })
})
