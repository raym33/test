import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import {
  Globe,
  Edit,
  ExternalLink,
  LogOut,
  BarChart3,
  Clock,
  User
} from 'lucide-react'

export default function Dashboard() {
  const { user, cliente, logout } = useAuth()
  const navigate = useNavigate()
  const [sitios, setSitios] = useState([])
  const [loading, setLoading] = useState(true)
  const [resumen, setResumen] = useState(null)

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      const [sitiosRes, resumenRes] = await Promise.all([
        api.get('/sitios'),
        api.get('/estadisticas/resumen')
      ])
      setSitios(sitiosRes.data.sitios)
      setResumen(resumenRes.data.resumen)
    } catch (error) {
      console.error('Error cargando datos:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = () => {
    logout()
    navigate('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold text-gray-900">
              MCWEB<span className="text-primary-600">.fast</span>
            </span>
            <span className="text-gray-400">|</span>
            <span className="text-gray-600">Mi Panel</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-gray-600">
              <User size={18} />
              <span>{user?.nombre}</span>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
            >
              <LogOut size={18} />
              Salir
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            ¡Hola, {user?.nombre}! 👋
          </h1>
          <p className="text-gray-600">
            Gestiona tu web desde aquí
          </p>
        </div>

        {/* Stats */}
        {resumen && (
          <div className="grid grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-primary-100 rounded-xl flex items-center justify-center">
                  <Globe className="text-primary-600" size={24} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{resumen.totalSitios}</div>
                  <div className="text-sm text-gray-500">Sitios web</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                  <BarChart3 className="text-green-600" size={24} />
                </div>
                <div>
                  <div className="text-2xl font-bold text-gray-900">{resumen.sitiosActivos}</div>
                  <div className="text-sm text-gray-500">Activos</div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                  <Clock className="text-purple-600" size={24} />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-900">
                    {resumen.ultimaModificacion
                      ? new Date(resumen.ultimaModificacion).toLocaleDateString()
                      : 'Nunca'}
                  </div>
                  <div className="text-sm text-gray-500">Última edición</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Sites List */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold text-gray-900">Mis sitios web</h2>
          </div>

          {sitios.length === 0 ? (
            <div className="p-12 text-center">
              <Globe size={48} className="text-gray-300 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                No tienes ningún sitio todavía
              </h3>
              <p className="text-gray-500 mb-4">
                Crea tu primera web en minutos
              </p>
              <Link
                to="/crear"
                className="inline-flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
              >
                Crear mi web
              </Link>
            </div>
          ) : (
            <div className="divide-y">
              {sitios.map(sitio => (
                <div
                  key={sitio.id}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-gradient-to-br from-primary-500 to-purple-500 rounded-xl flex items-center justify-center text-white font-bold">
                      {sitio.nombre.charAt(0)}
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{sitio.nombre}</h3>
                      <p className="text-sm text-gray-500">
                        {sitio.dominio || sitio.subdominio}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {sitio.activo ? (
                      <span className="px-2 py-1 text-xs font-medium bg-green-100 text-green-700 rounded-full">
                        Activo
                      </span>
                    ) : (
                      <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-600 rounded-full">
                        Inactivo
                      </span>
                    )}

                    <a
                      href={sitio.dominio ? `https://${sitio.dominio}` : `/sites/${sitio.subdominio}/public/index.html`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      title="Ver sitio"
                    >
                      <ExternalLink size={18} />
                    </a>

                    <Link
                      to={`/sitio/${sitio.id}`}
                      className="flex items-center gap-2 px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
                    >
                      <Edit size={16} />
                      Editar
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-8 bg-gradient-to-r from-primary-600 to-purple-600 rounded-xl p-6 text-white">
          <h3 className="text-lg font-semibold mb-2">¿Necesitas ayuda?</h3>
          <p className="opacity-90 mb-4">
            Nuestro equipo está aquí para ayudarte a sacar el máximo partido a tu web
          </p>
          <button className="bg-white text-primary-600 px-4 py-2 rounded-lg font-medium hover:bg-gray-100">
            Contactar soporte
          </button>
        </div>
      </main>
    </div>
  )
}
