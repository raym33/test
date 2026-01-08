import { useState, useEffect } from 'react'
import { useParams, Link } from 'react-router-dom'
import api from '../utils/api'
import {
  ArrowLeft,
  Save,
  Upload,
  Sparkles,
  Eye,
  History,
  RotateCcw,
  Loader2,
  Check,
  X,
  Image,
  Type,
  RefreshCw
} from 'lucide-react'

const SECCIONES = [
  { id: 'hero', nombre: 'Hero / Cabecera', icon: '🎯' },
  { id: 'servicios', nombre: 'Servicios', icon: '⚙️' },
  { id: 'nosotros', nombre: 'Sobre nosotros', icon: '👥' },
  { id: 'contacto', nombre: 'Contacto', icon: '📞' }
]

export default function SiteEditor() {
  const { sitioId } = useParams()
  const [sitio, setSitio] = useState(null)
  const [html, setHtml] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [seccionActiva, setSeccionActiva] = useState('hero')
  const [mensaje, setMensaje] = useState(null)

  // Form state
  const [texto, setTexto] = useState('')
  const [imagen, setImagen] = useState(null)
  const [imagenPreview, setImagenPreview] = useState(null)
  const [instruccion, setInstruccion] = useState('')

  // Historial
  const [historial, setHistorial] = useState([])
  const [mostrarHistorial, setMostrarHistorial] = useState(false)

  useEffect(() => {
    cargarSitio()
  }, [sitioId])

  const cargarSitio = async () => {
    try {
      const [contenidoRes, historialRes] = await Promise.all([
        api.get(`/contenido/${sitioId}`),
        api.get(`/contenido/${sitioId}/historial`)
      ])
      setSitio(contenidoRes.data.sitio)
      setHtml(contenidoRes.data.html)
      setHistorial(historialRes.data.historial)
    } catch (error) {
      console.error('Error cargando sitio:', error)
      setMensaje({ tipo: 'error', texto: 'Error al cargar el sitio' })
    } finally {
      setLoading(false)
    }
  }

  const handleImagenChange = (e) => {
    const file = e.target.files[0]
    if (file) {
      setImagen(file)
      setImagenPreview(URL.createObjectURL(file))
    }
  }

  const limpiarFormulario = () => {
    setTexto('')
    setImagen(null)
    setImagenPreview(null)
    setInstruccion('')
  }

  const actualizarConIA = async () => {
    if (!texto && !imagen) {
      setMensaje({ tipo: 'error', texto: 'Añade texto o una imagen para actualizar' })
      return
    }

    setSaving(true)
    setMensaje(null)

    try {
      const formData = new FormData()
      formData.append('seccion', seccionActiva)
      if (texto) formData.append('texto', texto)
      if (imagen) formData.append('imagen', imagen)
      if (instruccion) formData.append('instruccion', instruccion)

      const response = await api.post(`/contenido/${sitioId}/actualizar`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })

      setMensaje({ tipo: 'success', texto: '¡Contenido actualizado!' })
      limpiarFormulario()

      // Recargar contenido
      await cargarSitio()

    } catch (error) {
      const errorMsg = error.response?.data?.error || 'Error al actualizar'
      setMensaje({ tipo: 'error', texto: errorMsg })
    } finally {
      setSaving(false)
    }
  }

  const mejorarTexto = async () => {
    if (!texto) return

    setSaving(true)
    try {
      const response = await api.post(`/contenido/${sitioId}/mejorar-texto`, {
        texto,
        contexto: sitio?.nombre
      })
      setTexto(response.data.textoMejorado)
      setMensaje({ tipo: 'success', texto: 'Texto mejorado con IA' })
    } catch (error) {
      setMensaje({ tipo: 'error', texto: 'Error al mejorar el texto' })
    } finally {
      setSaving(false)
    }
  }

  const refrescarPreview = () => {
    const iframe = document.getElementById('preview-iframe')
    if (iframe) {
      iframe.src = iframe.src
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* Header */}
      <header className="bg-white shadow-sm z-10">
        <div className="px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              to="/dashboard"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
            >
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="font-semibold text-gray-900">{sitio?.nombre}</h1>
              <p className="text-sm text-gray-500">{sitio?.dominio || 'Sin dominio'}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setMostrarHistorial(!mostrarHistorial)}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <History size={18} />
              Historial
            </button>
            <button
              onClick={refrescarPreview}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
            >
              <RefreshCw size={18} />
              Refrescar
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex">
        {/* Editor Panel */}
        <div className="w-96 bg-white border-r flex flex-col">
          {/* Section Tabs */}
          <div className="border-b">
            <div className="flex overflow-x-auto">
              {SECCIONES.map(seccion => (
                <button
                  key={seccion.id}
                  onClick={() => setSeccionActiva(seccion.id)}
                  className={`flex-shrink-0 px-4 py-3 text-sm font-medium border-b-2 ${
                    seccionActiva === seccion.id
                      ? 'border-primary-500 text-primary-600'
                      : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  <span className="mr-1">{seccion.icon}</span>
                  {seccion.nombre}
                </button>
              ))}
            </div>
          </div>

          {/* Editor Form */}
          <div className="flex-1 overflow-y-auto p-4 space-y-6">
            {mensaje && (
              <div className={`flex items-center gap-2 p-3 rounded-lg ${
                mensaje.tipo === 'success'
                  ? 'bg-green-50 text-green-700'
                  : 'bg-red-50 text-red-700'
              }`}>
                {mensaje.tipo === 'success' ? <Check size={18} /> : <X size={18} />}
                {mensaje.texto}
              </div>
            )}

            {/* Texto */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Type size={16} />
                Nuevo texto
              </label>
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder={`Escribe el nuevo texto para la sección ${seccionActiva}...`}
              />
              {texto && (
                <button
                  onClick={mejorarTexto}
                  disabled={saving}
                  className="mt-2 text-sm text-primary-600 hover:text-primary-700 flex items-center gap-1"
                >
                  <Sparkles size={14} />
                  Mejorar texto con IA
                </button>
              )}
            </div>

            {/* Imagen */}
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                <Image size={16} />
                Nueva imagen
              </label>

              {imagenPreview ? (
                <div className="relative">
                  <img
                    src={imagenPreview}
                    alt="Preview"
                    className="w-full h-32 object-cover rounded-lg"
                  />
                  <button
                    onClick={() => { setImagen(null); setImagenPreview(null) }}
                    className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary-400 hover:bg-primary-50/50">
                  <Upload size={24} className="text-gray-400 mb-2" />
                  <span className="text-sm text-gray-500">Subir imagen</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImagenChange}
                    className="hidden"
                  />
                </label>
              )}
            </div>

            {/* Instrucción adicional */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Instrucciones adicionales (opcional)
              </label>
              <input
                type="text"
                value={instruccion}
                onChange={(e) => setInstruccion(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="Ej: Centra el texto, hazlo más grande..."
              />
            </div>
          </div>

          {/* Action Button */}
          <div className="border-t p-4">
            <button
              onClick={actualizarConIA}
              disabled={saving || (!texto && !imagen)}
              className="w-full flex items-center justify-center gap-2 bg-primary-600 hover:bg-primary-700 disabled:bg-gray-300 text-white py-3 rounded-lg font-medium"
            >
              {saving ? (
                <>
                  <Loader2 className="animate-spin" size={20} />
                  Actualizando...
                </>
              ) : (
                <>
                  <Sparkles size={20} />
                  Actualizar con IA
                </>
              )}
            </button>
            <p className="text-xs text-gray-500 text-center mt-2">
              La IA regenerará la sección manteniendo el diseño
            </p>
          </div>
        </div>

        {/* Preview Panel */}
        <div className="flex-1 bg-gray-200 p-4">
          <div className="bg-white rounded-xl shadow-lg h-full overflow-hidden">
            <div className="bg-gray-100 px-4 py-2 flex items-center gap-2 border-b">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400"></div>
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <div className="w-3 h-3 rounded-full bg-green-400"></div>
              </div>
              <div className="flex-1 flex items-center gap-2">
                <div className="flex-1 bg-white rounded px-3 py-1 text-sm text-gray-600">
                  {sitio?.dominio || `mcweb.fast/sites/${sitio?.subdominio}`}
                </div>
                <a
                  href={sitio?.dominio ? `https://${sitio.dominio}` : `/sites/${sitio?.subdominio}/public/index.html`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1 text-gray-400 hover:text-gray-600"
                >
                  <Eye size={18} />
                </a>
              </div>
            </div>
            <iframe
              id="preview-iframe"
              src={`/sites/${sitio?.subdominio}/public/index.html`}
              className="w-full h-[calc(100%-40px)]"
              title="Preview"
            />
          </div>
        </div>

        {/* Historial Panel */}
        {mostrarHistorial && (
          <div className="w-80 bg-white border-l overflow-y-auto">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Historial de cambios</h3>
            </div>
            <div className="divide-y">
              {historial.length === 0 ? (
                <div className="p-4 text-center text-gray-500">
                  No hay cambios registrados
                </div>
              ) : (
                historial.map(cambio => (
                  <div key={cambio.id} className="p-4">
                    <div className="flex items-center gap-2 text-sm">
                      <RotateCcw size={14} className="text-gray-400" />
                      <span className="font-medium text-gray-900">
                        {cambio.tipo === 'actualizacion_seccion' ? 'Actualización' : cambio.tipo}
                      </span>
                    </div>
                    {cambio.seccion && (
                      <p className="text-sm text-gray-600 mt-1">
                        Sección: {cambio.seccion}
                      </p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">
                      {new Date(cambio.fecha).toLocaleString()}
                    </p>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
