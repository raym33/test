import { Link } from 'react-router-dom'
import { Zap, Globe, Palette, Clock, Shield, Sparkles } from 'lucide-react'

export default function Landing() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="container mx-auto px-4 py-6">
        <nav className="flex justify-between items-center">
          <div className="text-2xl font-bold text-white">
            MCWEB<span className="text-primary-400">.fast</span>
          </div>
          <div className="flex gap-4">
            <Link
              to="/login"
              className="text-gray-300 hover:text-white transition px-4 py-2"
            >
              Iniciar sesión
            </Link>
            <Link
              to="/crear"
              className="bg-primary-600 hover:bg-primary-700 text-white px-6 py-2 rounded-full font-medium transition"
            >
              Crear mi web
            </Link>
          </div>
        </nav>
      </header>

      {/* Hero */}
      <section className="container mx-auto px-4 py-20 text-center">
        <div className="inline-flex items-center gap-2 bg-primary-500/20 text-primary-300 px-4 py-2 rounded-full text-sm mb-8">
          <Sparkles size={16} />
          Potenciado por Inteligencia Artificial
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          Tu web profesional
          <br />
          <span className="gradient-text">en minutos</span>
        </h1>

        <p className="text-xl text-gray-400 mb-12 max-w-2xl mx-auto">
          Elige el estilo, añade tu contenido y nuestra IA crea una web
          profesional al instante. Sin código, sin complicaciones.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            to="/crear"
            className="bg-primary-600 hover:bg-primary-700 text-white px-8 py-4 rounded-full font-semibold text-lg transition inline-flex items-center justify-center gap-2"
          >
            <Zap size={20} />
            Crear mi web gratis
          </Link>
          <a
            href="#como-funciona"
            className="border border-gray-600 hover:border-gray-500 text-gray-300 px-8 py-4 rounded-full font-semibold text-lg transition"
          >
            Cómo funciona
          </a>
        </div>

        {/* Stats */}
        <div className="flex justify-center gap-12 mt-16 text-center">
          <div>
            <div className="text-4xl font-bold text-white">3 min</div>
            <div className="text-gray-500">Tiempo promedio</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white">100%</div>
            <div className="text-gray-500">Personalizable</div>
          </div>
          <div>
            <div className="text-4xl font-bold text-white">0€</div>
            <div className="text-gray-500">Para empezar</div>
          </div>
        </div>
      </section>

      {/* Como funciona */}
      <section id="como-funciona" className="container mx-auto px-4 py-20">
        <h2 className="text-3xl font-bold text-white text-center mb-16">
          Tan fácil como pedir comida
        </h2>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          <div className="bg-gray-800/50 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Palette className="text-primary-400" size={32} />
            </div>
            <div className="text-sm text-primary-400 font-medium mb-2">Paso 1</div>
            <h3 className="text-xl font-semibold text-white mb-4">Elige el estilo</h3>
            <p className="text-gray-400">
              Selecciona una plantilla y los colores que representen tu marca.
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Globe className="text-primary-400" size={32} />
            </div>
            <div className="text-sm text-primary-400 font-medium mb-2">Paso 2</div>
            <h3 className="text-xl font-semibold text-white mb-4">Añade tu contenido</h3>
            <p className="text-gray-400">
              Sube tu logo, fotos y escribe sobre tu negocio. La IA hace el resto.
            </p>
          </div>

          <div className="bg-gray-800/50 rounded-2xl p-8 text-center">
            <div className="w-16 h-16 bg-primary-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Zap className="text-primary-400" size={32} />
            </div>
            <div className="text-sm text-primary-400 font-medium mb-2">Paso 3</div>
            <h3 className="text-xl font-semibold text-white mb-4">¡Listo!</h3>
            <p className="text-gray-400">
              Tu web está online. Edítala cuando quieras desde tu panel.
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-20">
        <div className="grid md:grid-cols-2 gap-12 items-center max-w-5xl mx-auto">
          <div>
            <h2 className="text-3xl font-bold text-white mb-6">
              Todo lo que necesitas para tu presencia online
            </h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Clock className="text-green-400" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Edita cuando quieras</h3>
                  <p className="text-gray-400">Cambia textos e imágenes desde tu móvil o PC</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield className="text-blue-400" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">Seguro y rápido</h3>
                  <p className="text-gray-400">Hosting profesional con SSL incluido</p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="w-12 h-12 bg-purple-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Sparkles className="text-purple-400" size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">IA que trabaja para ti</h3>
                  <p className="text-gray-400">Genera contenido profesional automáticamente</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-800/50 rounded-2xl p-8">
            <div className="aspect-video bg-gray-900 rounded-lg flex items-center justify-center">
              <span className="text-gray-600">Preview de una web generada</span>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="container mx-auto px-4 py-20">
        <div className="bg-gradient-to-r from-primary-600 to-purple-600 rounded-3xl p-12 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            ¿Listo para tener tu web?
          </h2>
          <p className="text-xl text-white/80 mb-8">
            Empieza gratis. Solo toma 3 minutos.
          </p>
          <Link
            to="/crear"
            className="bg-white text-primary-600 px-8 py-4 rounded-full font-semibold text-lg hover:bg-gray-100 transition inline-flex items-center gap-2"
          >
            <Zap size={20} />
            Crear mi web ahora
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="container mx-auto px-4 py-12 border-t border-gray-800">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-gray-500">
            © 2024 MCWEB.fast - Tu web en minutos
          </div>
          <div className="flex gap-6 text-gray-500">
            <a href="#" className="hover:text-gray-300 transition">Términos</a>
            <a href="#" className="hover:text-gray-300 transition">Privacidad</a>
            <a href="#" className="hover:text-gray-300 transition">Contacto</a>
          </div>
        </div>
      </footer>
    </div>
  )
}
