import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api from '../utils/api'
import {
  Users,
  Globe,
  BarChart3,
  Plus,
  Search,
  LogOut,
  Edit,
  Trash2,
  Key,
  ExternalLink,
  X,
  Check,
  Loader2,
  AlertTriangle
} from 'lucide-react'

export default function AdminDashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const [tab, setTab] = useState('clientes')
  const [clientes, setClientes] = useState([])
  const [sitios, setSitios] = useState([])
  const [stats, setStats] = useState(null)
  const [loading, setLoading] = useState(true)
  const [busqueda, setBusqueda] = useState('')

  // Modal state
  const [modal, setModal] = useState(null)
  const [modalLoading, setModalLoading] = useState(false)

  // Formulario nuevo cliente
  const [nuevoCliente, setNuevoCliente] = useState({
    nombre: '',
    email: '',
    empresa: '',
    telefono: ''
  })

  useEffect(() => {
    cargarDatos()
  }, [])

  const cargarDatos = async () => {
    try {
      const [clientesRes, sitiosRes, statsRes] = await Promise.all([
        api.get('/clientes'),
        api.get('/sitios'),
        api.get('/estadisticas/general')
      ])
      setClientes(clientesRes.data.clientes)
      setSitios(sitiosRes.data.sitios)
      setStats(statsRes.data.estadisticas)
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

  const crearCliente = async (e) => {
    e.preventDefault()
    setModalLoading(true)

    try {
      const response = await api.post('/clientes', nuevoCliente)
      setModal({
        tipo: 'credenciales',
        data: response.data.credenciales
      })
      setNuevoCliente({ nombre: '', email: '', empresa: '', telefono: '' })
      cargarDatos()
    } catch (error) {
      alert(error.response?.data?.error || 'Error al crear cliente')
    } finally {
      setModalLoading(false)
    }
  }

  const resetearPassword = async (clienteId) => {
    if (!confirm('¿Resetear la contraseña de este cliente?')) return

    try {
      const response = await api.post(`/clientes/${clienteId}/reset-password`)
      setModal({
        tipo: 'credenciales',
        data: response.data.credenciales
      })
    } catch (error) {
      alert('Error al resetear contraseña')
    }
  }

  const eliminarCliente = async (clienteId) => {
    if (!confirm('¿Eliminar este cliente? Se eliminarán todos sus sitios.')) return

    try {
      await api.delete(`/clientes/${clienteId}`)
      cargarDatos()
    } catch (error) {
      alert('Error al eliminar cliente')
    }
  }

  const clientesFiltrados = clientes.filter(c =>
    c.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    c.email.toLowerCase().includes(busqueda.toLowerCase())
  )

  const sitiosFiltrados = sitios.filter(s =>
    s.nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
    s.dominio?.toLowerCase().includes(busqueda.toLowerCase())
  )

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
            <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
              Admin
            </span>
          </div>

          <div className="flex items-center gap-4">
            <span className="text-gray-600">{user?.email}</span>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <Users className="text-blue-600" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats?.totalClientes || 0}</div>
                <div className="text-sm text-gray-500">Clientes</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center">
                <Globe className="text-green-600" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats?.totalSitios || 0}</div>
                <div className="text-sm text-gray-500">Sitios</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <BarChart3 className="text-purple-600" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{stats?.visitasHoy || 0}</div>
                <div className="text-sm text-gray-500">Visitas hoy</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="text-orange-600" size={24} />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {stats?.servidor?.bandwidth_usado_gb?.toFixed(1) || '0'} GB
                </div>
                <div className="text-sm text-gray-500">Bandwidth usado</div>
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-xl shadow-sm">
          <div className="border-b px-6">
            <div className="flex gap-6">
              <button
                onClick={() => setTab('clientes')}
                className={`py-4 border-b-2 font-medium ${
                  tab === 'clientes'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Users size={18} className="inline mr-2" />
                Clientes
              </button>
              <button
                onClick={() => setTab('sitios')}
                className={`py-4 border-b-2 font-medium ${
                  tab === 'sitios'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                <Globe size={18} className="inline mr-2" />
                Sitios
              </button>
            </div>
          </div>

          {/* Toolbar */}
          <div className="p-4 border-b flex items-center justify-between">
            <div className="relative">
              <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar..."
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {tab === 'clientes' && (
              <button
                onClick={() => setModal({ tipo: 'nuevo-cliente' })}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-4 py-2 rounded-lg"
              >
                <Plus size={18} />
                Nuevo cliente
              </button>
            )}
          </div>

          {/* Content */}
          {tab === 'clientes' ? (
            <div className="divide-y">
              {clientesFiltrados.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No hay clientes
                </div>
              ) : (
                clientesFiltrados.map(cliente => (
                  <div
                    key={cliente.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold">
                        {cliente.nombre.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{cliente.nombre}</h3>
                        <p className="text-sm text-gray-500">{cliente.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className="text-sm text-gray-500">
                        {cliente.numSitios} sitios
                      </span>
                      {cliente.activo ? (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                          Activo
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                          Inactivo
                        </span>
                      )}
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => resetearPassword(cliente.id)}
                          className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                          title="Resetear contraseña"
                        >
                          <Key size={18} />
                        </button>
                        <button
                          onClick={() => eliminarCliente(cliente.id)}
                          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                          title="Eliminar"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="divide-y">
              {sitiosFiltrados.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  No hay sitios
                </div>
              ) : (
                sitiosFiltrados.map(sitio => (
                  <div
                    key={sitio.id}
                    className="px-6 py-4 flex items-center justify-between hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-teal-500 rounded-lg flex items-center justify-center text-white font-bold">
                        {sitio.nombre.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{sitio.nombre}</h3>
                        <p className="text-sm text-gray-500">
                          {sitio.dominio || sitio.subdominio}
                          {sitio.clienteNombre && ` • ${sitio.clienteNombre}`}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {sitio.activo ? (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-700 rounded-full">
                          Activo
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-gray-100 text-gray-600 rounded-full">
                          Inactivo
                        </span>
                      )}
                      <a
                        href={sitio.dominio ? `https://${sitio.dominio}` : `/sites/${sitio.subdominio}/public/index.html`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"
                      >
                        <ExternalLink size={18} />
                      </a>
                      <Link
                        to={`/sitio/${sitio.id}`}
                        className="p-2 text-gray-400 hover:text-primary-600 hover:bg-primary-50 rounded-lg"
                      >
                        <Edit size={18} />
                      </Link>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </main>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4">
            {modal.tipo === 'nuevo-cliente' && (
              <>
                <div className="p-6 border-b flex items-center justify-between">
                  <h2 className="text-lg font-semibold">Nuevo cliente</h2>
                  <button
                    onClick={() => setModal(null)}
                    className="p-1 text-gray-400 hover:text-gray-600"
                  >
                    <X size={20} />
                  </button>
                </div>
                <form onSubmit={crearCliente} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Nombre *
                    </label>
                    <input
                      type="text"
                      value={nuevoCliente.nombre}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, nombre: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={nuevoCliente.email}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, email: e.target.value })}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Empresa
                    </label>
                    <input
                      type="text"
                      value={nuevoCliente.empresa}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, empresa: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Teléfono
                    </label>
                    <input
                      type="tel"
                      value={nuevoCliente.telefono}
                      onChange={(e) => setNuevoCliente({ ...nuevoCliente, telefono: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                  <div className="pt-4">
                    <button
                      type="submit"
                      disabled={modalLoading}
                      className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 text-white py-3 rounded-lg font-medium"
                    >
                      {modalLoading ? (
                        <Loader2 className="animate-spin" size={20} />
                      ) : (
                        <>
                          <Check size={20} />
                          Crear cliente
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </>
            )}

            {modal.tipo === 'credenciales' && (
              <>
                <div className="p-6 border-b">
                  <h2 className="text-lg font-semibold">Credenciales generadas</h2>
                </div>
                <div className="p-6">
                  <div className="bg-gray-900 text-white rounded-lg p-4 font-mono text-sm mb-4">
                    <p className="mb-2">
                      <span className="text-gray-400">Email:</span> {modal.data.email}
                    </p>
                    <p>
                      <span className="text-gray-400">Contraseña:</span> {modal.data.passwordTemporal}
                    </p>
                  </div>
                  <p className="text-sm text-gray-500 mb-4">
                    El cliente deberá cambiar la contraseña en su primer acceso.
                  </p>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(`Email: ${modal.data.email}\nContraseña: ${modal.data.passwordTemporal}`)
                      alert('Copiado al portapapeles')
                    }}
                    className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 py-2 rounded-lg font-medium mb-2"
                  >
                    Copiar credenciales
                  </button>
                  <button
                    onClick={() => setModal(null)}
                    className="w-full bg-primary-600 hover:bg-primary-700 text-white py-2 rounded-lg font-medium"
                  >
                    Cerrar
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
