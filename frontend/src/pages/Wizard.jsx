import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../utils/api'
import {
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Store,
  Briefcase,
  Palette,
  Upload,
  Check,
  Loader2,
  Phone,
  Mail,
  MapPin,
  Clock
} from 'lucide-react'

const TIPOS_NEGOCIO = [
  { id: 'restaurante', nombre: 'Restaurante / Bar', icon: '🍽️' },
  { id: 'tienda', nombre: 'Tienda / Comercio', icon: '🛍️' },
  { id: 'taller', nombre: 'Taller / Reparaciones', icon: '🔧' },
  { id: 'salon', nombre: 'Peluquería / Estética', icon: '💇' },
  { id: 'clinica', nombre: 'Clínica / Salud', icon: '🏥' },
  { id: 'abogado', nombre: 'Abogado / Consultor', icon: '⚖️' },
  { id: 'inmobiliaria', nombre: 'Inmobiliaria', icon: '🏠' },
  { id: 'fotografo', nombre: 'Fotógrafo / Creativo', icon: '📸' },
  { id: 'otro', nombre: 'Otro negocio', icon: '💼' }
]

const COLORES_PREDEFINIDOS = [
  { primario: '#3B82F6', secundario: '#1E40AF', nombre: 'Azul Profesional' },
  { primario: '#10B981', secundario: '#047857', nombre: 'Verde Natural' },
  { primario: '#8B5CF6', secundario: '#6D28D9', nombre: 'Morado Creativo' },
  { primario: '#F59E0B', secundario: '#D97706', nombre: 'Naranja Energético' },
  { primario: '#EF4444', secundario: '#B91C1C', nombre: 'Rojo Pasión' },
  { primario: '#EC4899', secundario: '#BE185D', nombre: 'Rosa Moderno' },
  { primario: '#14B8A6', secundario: '#0D9488', nombre: 'Turquesa Fresco' },
  { primario: '#1F2937', secundario: '#111827', nombre: 'Gris Elegante' }
]

export default function Wizard() {
  const navigate = useNavigate()
  const [paso, setPaso] = useState(1)
  const [sessionId, setSessionId] = useState(null)
  const [loading, setLoading] = useState(false)
  const [generando, setGenerando] = useState(false)
  const [error, setError] = useState('')

  // Datos del formulario
  const [datos, setDatos] = useState({
    tipoNegocio: '',
    nombreNegocio: '',
    descripcion: '',
    plantillaId: 1,
    colorPrimario: '#3B82F6',
    colorSecundario: '#1E40AF',
    servicios: ['', '', ''],
    telefono: '',
    email: '',
    direccion: '',
    horario: '',
    logo: null,
    logoPreview: null
  })

  // Preview generado
  const [preview, setPreview] = useState(null)

  // Iniciar sesión del wizard
  useEffect(() => {
    iniciarSesion()
  }, [])

  const iniciarSesion = async () => {
    try {
      const response = await api.post('/wizard/iniciar')
      setSessionId(response.data.sessionId)
    } catch (err) {
      setError('Error al iniciar. Por favor, recarga la página.')
    }
  }

  const handleInputChange = (field, value) => {
    setDatos(prev => ({ ...prev, [field]: value }))
  }

  const handleServicioChange = (index, value) => {
    const nuevosServicios = [...datos.servicios]
    nuevosServicios[index] = value
    setDatos(prev => ({ ...prev, servicios: nuevosServicios }))
  }

  const handleLogoChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setDatos(prev => ({
        ...prev,
        logo: file,
        logoPreview: URL.createObjectURL(file)
      }))
    }
  }

  const handleColorSelect = (color) => {
    setDatos(prev => ({
      ...prev,
      colorPrimario: color.primario,
      colorSecundario: color.secundario
    }))
  }

  const guardarPaso = async () => {
    if (!sessionId) return

    setLoading(true)
    setError('')

    try {
      const formData = new FormData()
      formData.append('sessionId', sessionId)

      switch (paso) {
        case 1:
          formData.append('tipoNegocio', datos.tipoNegocio)
          formData.append('nombreNegocio', datos.nombreNegocio)
          formData.append('descripcion', datos.descripcion)
          break
        case 2:
          formData.append('plantillaId', datos.plantillaId)
          formData.append('colorPrimario', datos.colorPrimario)
          formData.append('colorSecundario', datos.colorSecundario)
          break
        case 3:
          formData.append('servicios', JSON.stringify(datos.servicios.filter(s => s.trim())))
          break
        case 4:
          formData.append('telefono', datos.telefono)
          formData.append('email', datos.email)
          formData.append('direccion', datos.direccion)
          formData.append('horario', datos.horario)
          break
        case 5:
          if (datos.logo) {
            formData.append('logo', datos.logo)
          }
          break
      }

      await api.post(`/wizard/paso/${paso}`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      return true
    } catch (err) {
      setError(err.response?.data?.error || 'Error al guardar')
      return false
    } finally {
      setLoading(false)
    }
  }

  const siguientePaso = async () => {
    // Validaciones
    if (paso === 1 && (!datos.tipoNegocio || !datos.nombreNegocio)) {
      setError('Por favor, completa el tipo y nombre de tu negocio')
      return
    }

    const guardado = await guardarPaso()
    if (guardado) {
      setPaso(prev => prev + 1)
    }
  }

  const pasoAnterior = () => {
    setPaso(prev => prev - 1)
    setError('')
  }

  const generarWeb = async () => {
    await guardarPaso() // Guardar último paso

    setGenerando(true)
    setError('')

    try {
      const response = await api.post('/wizard/generar', { sessionId })
      setPreview(response.data.preview)
      setPaso(6) // Paso de preview
    } catch (err) {
      setError(err.response?.data?.error || 'Error al generar la web. Inténtalo de nuevo.')
    } finally {
      setGenerando(false)
    }
  }

  const finalizarYCrearCuenta = async () => {
    if (!datos.email) {
      setError('Necesitas un email para crear tu cuenta')
      return
    }

    setLoading(true)
    setError('')

    try {
      const response = await api.post('/wizard/finalizar', {
        sessionId,
        email: datos.email,
        nombre: datos.nombreNegocio,
        telefono: datos.telefono
      })

      // Guardar credenciales para mostrar
      setPaso(7) // Paso final
      setPreview(prev => ({
        ...prev,
        credenciales: response.data.credenciales
      }))
    } catch (err) {
      setError(err.response?.data?.error || 'Error al crear la cuenta')
    } finally {
      setLoading(false)
    }
  }

  // Renderizar paso actual
  const renderPaso = () => {
    switch (paso) {
      case 1:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                ¿Qué tipo de negocio tienes?
              </h2>
              <p className="text-gray-600">Esto nos ayuda a personalizar tu web</p>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {TIPOS_NEGOCIO.map(tipo => (
                <button
                  key={tipo.id}
                  onClick={() => handleInputChange('tipoNegocio', tipo.id)}
                  className={`p-4 rounded-xl border-2 text-center transition ${
                    datos.tipoNegocio === tipo.id
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-3xl mb-2">{tipo.icon}</div>
                  <div className="text-sm font-medium text-gray-900">{tipo.nombre}</div>
                </button>
              ))}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Nombre de tu negocio *
              </label>
              <input
                type="text"
                value={datos.nombreNegocio}
                onChange={(e) => handleInputChange('nombreNegocio', e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Ej: Restaurante La Paella"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Describe brevemente tu negocio
              </label>
              <textarea
                value={datos.descripcion}
                onChange={(e) => handleInputChange('descripcion', e.target.value)}
                rows={3}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Ej: Restaurante familiar especializado en paellas y arroces mediterráneos"
              />
            </div>
          </div>
        )

      case 2:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Elige los colores de tu marca
              </h2>
              <p className="text-gray-600">Selecciona una combinación que te represente</p>
            </div>

            <div className="grid grid-cols-4 gap-4">
              {COLORES_PREDEFINIDOS.map((color, index) => (
                <button
                  key={index}
                  onClick={() => handleColorSelect(color)}
                  className={`p-4 rounded-xl border-2 transition ${
                    datos.colorPrimario === color.primario
                      ? 'border-gray-900 shadow-lg'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex gap-1 mb-2">
                    <div
                      className="w-8 h-8 rounded-lg"
                      style={{ backgroundColor: color.primario }}
                    />
                    <div
                      className="w-8 h-8 rounded-lg"
                      style={{ backgroundColor: color.secundario }}
                    />
                  </div>
                  <div className="text-xs font-medium text-gray-700">{color.nombre}</div>
                </button>
              ))}
            </div>

            <div className="flex gap-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color primario
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={datos.colorPrimario}
                    onChange={(e) => handleInputChange('colorPrimario', e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={datos.colorPrimario}
                    onChange={(e) => handleInputChange('colorPrimario', e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Color secundario
                </label>
                <div className="flex gap-2">
                  <input
                    type="color"
                    value={datos.colorSecundario}
                    onChange={(e) => handleInputChange('colorSecundario', e.target.value)}
                    className="w-12 h-12 rounded-lg cursor-pointer"
                  />
                  <input
                    type="text"
                    value={datos.colorSecundario}
                    onChange={(e) => handleInputChange('colorSecundario', e.target.value)}
                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg"
                  />
                </div>
              </div>
            </div>

            {/* Preview de colores */}
            <div
              className="p-6 rounded-xl text-white"
              style={{ background: `linear-gradient(135deg, ${datos.colorPrimario} 0%, ${datos.colorSecundario} 100%)` }}
            >
              <h3 className="text-xl font-bold mb-2">{datos.nombreNegocio || 'Tu Negocio'}</h3>
              <p className="opacity-90">Así se verán los colores en tu web</p>
            </div>
          </div>
        )

      case 3:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                ¿Qué servicios o productos ofreces?
              </h2>
              <p className="text-gray-600">Añade hasta 3 servicios principales</p>
            </div>

            <div className="space-y-4">
              {datos.servicios.map((servicio, index) => (
                <div key={index}>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Servicio {index + 1}
                  </label>
                  <input
                    type="text"
                    value={servicio}
                    onChange={(e) => handleServicioChange(index, e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder={`Ej: ${
                      index === 0 ? 'Paellas para llevar' :
                      index === 1 ? 'Menú del día' :
                      'Eventos y celebraciones'
                    }`}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => setDatos(prev => ({ ...prev, servicios: [...prev.servicios, ''] }))}
              className="text-primary-600 hover:text-primary-700 font-medium"
            >
              + Añadir otro servicio
            </button>
          </div>
        )

      case 4:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Información de contacto
              </h2>
              <p className="text-gray-600">Para que tus clientes puedan encontrarte</p>
            </div>

            <div className="grid grid-cols-2 gap-6">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Phone size={16} />
                  Teléfono
                </label>
                <input
                  type="tel"
                  value={datos.telefono}
                  onChange={(e) => handleInputChange('telefono', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="612 345 678"
                />
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Mail size={16} />
                  Email *
                </label>
                <input
                  type="email"
                  value={datos.email}
                  onChange={(e) => handleInputChange('email', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="tu@email.com"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <MapPin size={16} />
                  Dirección
                </label>
                <input
                  type="text"
                  value={datos.direccion}
                  onChange={(e) => handleInputChange('direccion', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Calle Principal 123, Ciudad"
                />
              </div>

              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                  <Clock size={16} />
                  Horario
                </label>
                <input
                  type="text"
                  value={datos.horario}
                  onChange={(e) => handleInputChange('horario', e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                  placeholder="Lunes a Viernes: 9:00 - 20:00"
                />
              </div>
            </div>
          </div>
        )

      case 5:
        return (
          <div className="space-y-8">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                Añade tu logo (opcional)
              </h2>
              <p className="text-gray-600">Si no tienes, usaremos tu nombre con estilo</p>
            </div>

            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8">
              {datos.logoPreview ? (
                <div className="text-center">
                  <img
                    src={datos.logoPreview}
                    alt="Logo preview"
                    className="max-h-32 mx-auto mb-4"
                  />
                  <button
                    onClick={() => setDatos(prev => ({ ...prev, logo: null, logoPreview: null }))}
                    className="text-red-600 hover:text-red-700 text-sm"
                  >
                    Eliminar logo
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center cursor-pointer">
                  <Upload size={48} className="text-gray-400 mb-4" />
                  <span className="text-gray-600 mb-2">Haz clic para subir tu logo</span>
                  <span className="text-sm text-gray-400">PNG, JPG hasta 5MB</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleLogoChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            <div className="bg-primary-50 rounded-xl p-6">
              <h3 className="font-semibold text-primary-900 mb-2">
                ¡Casi listo!
              </h3>
              <p className="text-primary-700">
                En el siguiente paso, nuestra IA generará tu web profesional en segundos.
              </p>
            </div>
          </div>
        )

      case 6:
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Check size={32} className="text-green-600" />
              </div>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">
                ¡Tu web está lista!
              </h2>
              <p className="text-gray-600">
                Mira cómo ha quedado y crea tu cuenta para gestionarla
              </p>
            </div>

            {preview && (
              <div className="border rounded-xl overflow-hidden shadow-lg">
                <div className="bg-gray-100 px-4 py-2 flex items-center gap-2">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-red-400"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                    <div className="w-3 h-3 rounded-full bg-green-400"></div>
                  </div>
                  <div className="flex-1 bg-white rounded px-3 py-1 text-sm text-gray-600">
                    {preview.url}
                  </div>
                </div>
                <iframe
                  src={preview.url}
                  className="w-full h-96"
                  title="Preview de tu web"
                />
              </div>
            )}

            <div className="bg-gray-50 rounded-xl p-6">
              <h3 className="font-semibold text-gray-900 mb-4">
                Crea tu cuenta para acceder al panel de edición
              </h3>
              <p className="text-sm text-gray-600 mb-4">
                Tu email será: <strong>{datos.email}</strong>
              </p>
              <button
                onClick={finalizarYCrearCuenta}
                disabled={loading}
                className="w-full bg-primary-600 hover:bg-primary-700 text-white py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Sparkles size={20} />
                    Crear mi cuenta y activar la web
                  </>
                )}
              </button>
            </div>
          </div>
        )

      case 7:
        return (
          <div className="space-y-8 text-center">
            <div>
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check size={40} className="text-green-600" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">
                ¡Felicidades! 🎉
              </h2>
              <p className="text-xl text-gray-600">
                Tu web está activa y tu cuenta ha sido creada
              </p>
            </div>

            {preview?.credenciales && (
              <div className="bg-gray-900 text-white rounded-xl p-6 text-left">
                <h3 className="font-semibold mb-4">Tus credenciales de acceso:</h3>
                <div className="space-y-2 font-mono text-sm">
                  <p><span className="text-gray-400">Email:</span> {preview.credenciales.email}</p>
                  <p><span className="text-gray-400">Contraseña:</span> {preview.credenciales.passwordTemporal}</p>
                </div>
                <p className="text-yellow-400 text-sm mt-4">
                  ⚠️ Guarda estos datos. Deberás cambiar la contraseña en el primer acceso.
                </p>
              </div>
            )}

            <div className="flex flex-col gap-4">
              <Link
                to="/login"
                className="bg-primary-600 hover:bg-primary-700 text-white py-3 px-6 rounded-lg font-medium inline-flex items-center justify-center gap-2"
              >
                Acceder a mi panel
              </Link>
              <a
                href={preview?.url}
                target="_blank"
                rel="noopener noreferrer"
                className="border border-gray-300 hover:border-gray-400 text-gray-700 py-3 px-6 rounded-lg font-medium"
              >
                Ver mi web
              </a>
            </div>
          </div>
        )

      default:
        return null
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold text-gray-900">
            MCWEB<span className="text-primary-600">.fast</span>
          </Link>

          {paso < 6 && (
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4, 5].map(num => (
                <div
                  key={num}
                  className={`w-8 h-1 rounded-full ${
                    num <= paso ? 'bg-primary-600' : 'bg-gray-200'
                  }`}
                />
              ))}
            </div>
          )}
        </div>
      </header>

      {/* Content */}
      <main className="max-w-2xl mx-auto px-4 py-12">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-lg mb-6">
            {error}
          </div>
        )}

        {generando ? (
          <div className="text-center py-20">
            <Loader2 className="w-16 h-16 animate-spin text-primary-600 mx-auto mb-6" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">
              Generando tu web...
            </h2>
            <p className="text-gray-600">
              Nuestra IA está creando tu sitio web profesional
            </p>
          </div>
        ) : (
          renderPaso()
        )}

        {/* Navigation */}
        {paso < 6 && !generando && (
          <div className="flex justify-between mt-12">
            {paso > 1 ? (
              <button
                onClick={pasoAnterior}
                className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft size={20} />
                Anterior
              </button>
            ) : (
              <div />
            )}

            {paso < 5 ? (
              <button
                onClick={siguientePaso}
                disabled={loading}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    Siguiente
                    <ArrowRight size={20} />
                  </>
                )}
              </button>
            ) : (
              <button
                onClick={generarWeb}
                disabled={loading}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-700 text-white px-6 py-3 rounded-lg font-medium"
              >
                {loading ? (
                  <Loader2 className="animate-spin" size={20} />
                ) : (
                  <>
                    <Sparkles size={20} />
                    Generar mi web
                  </>
                )}
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  )
}
