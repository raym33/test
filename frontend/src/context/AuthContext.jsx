import { createContext, useContext, useState, useEffect } from 'react'
import api from '../utils/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [cliente, setCliente] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Verificar si hay token guardado
    const token = localStorage.getItem('token')
    if (token) {
      verificarToken()
    } else {
      setLoading(false)
    }
  }, [])

  const verificarToken = async () => {
    try {
      const response = await api.get('/auth/me')
      setUser(response.data.user)
      setCliente(response.data.cliente)
    } catch (error) {
      // Token inválido
      localStorage.removeItem('token')
    } finally {
      setLoading(false)
    }
  }

  const login = async (email, password) => {
    const response = await api.post('/auth/login', { email, password })
    const { token, user, cliente } = response.data

    localStorage.setItem('token', token)
    setUser(user)
    setCliente(cliente)

    return response.data
  }

  const logout = () => {
    localStorage.removeItem('token')
    setUser(null)
    setCliente(null)
  }

  const cambiarPassword = async (passwordActual, passwordNueva) => {
    await api.post('/auth/cambiar-password', { passwordActual, passwordNueva })
    // Actualizar el estado del usuario
    if (user) {
      setUser({ ...user, debeCambiarPassword: false })
    }
  }

  const value = {
    user,
    cliente,
    loading,
    isAuthenticated: !!user,
    isAdmin: user?.rol === 'admin',
    login,
    logout,
    cambiarPassword
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
