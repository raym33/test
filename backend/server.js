/**
 * MCWEB FAST - Servidor Principal
 * Sistema de gestión de hosting multi-cliente con IA
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Importar rutas
const authRoutes = require('./routes/auth');
const clientesRoutes = require('./routes/clientes');
const sitiosRoutes = require('./routes/sitios');
const contenidoRoutes = require('./routes/contenido');
const wizardRoutes = require('./routes/wizard');
const estadisticasRoutes = require('./routes/estadisticas');

// Inicializar base de datos
const { initDatabase } = require('./database/init');

const app = express();
const PORT = process.env.PORT || 3000;

// ============================================
// MIDDLEWARE DE SEGURIDAD
// ============================================

// Helmet para headers de seguridad
app.use(helmet({
  contentSecurityPolicy: false, // Desactivar para desarrollo
  crossOriginEmbedderPolicy: false
}));

// CORS configurado
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? [`https://${process.env.PANEL_DOMAIN}`, 'https://mcweb.fast']
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));

// Rate limiting global
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // máximo 100 requests por IP
  message: { error: 'Demasiadas peticiones, intenta de nuevo más tarde' }
});
app.use(limiter);

// Rate limiting más estricto para API de IA
const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hora
  max: 20, // máximo 20 llamadas a Claude por hora
  message: { error: 'Has alcanzado el límite de actualizaciones con IA. Espera 1 hora.' }
});

// Parsear JSON y form data
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Servir archivos estáticos de uploads
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Servir sitios generados (en desarrollo)
app.use('/sites', express.static(path.join(__dirname, '../sites')));

// ============================================
// RUTAS DE LA API
// ============================================

// Autenticación
app.use('/api/auth', authRoutes);

// Gestión de clientes (admin)
app.use('/api/clientes', clientesRoutes);

// Gestión de sitios
app.use('/api/sitios', sitiosRoutes);

// Actualización de contenido (cliente)
app.use('/api/contenido', aiLimiter, contenidoRoutes);

// Wizard de creación de web (público)
app.use('/api/wizard', aiLimiter, wizardRoutes);

// Estadísticas
app.use('/api/estadisticas', estadisticasRoutes);

// ============================================
// HEALTH CHECK
// ============================================

app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0'
  });
});

// ============================================
// SERVIR FRONTEND EN PRODUCCIÓN
// ============================================

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// ============================================
// MANEJO DE ERRORES
// ============================================

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// Error handler global
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // No exponer detalles del error en producción
  const message = process.env.NODE_ENV === 'production'
    ? 'Error interno del servidor'
    : err.message;

  res.status(err.status || 500).json({
    error: message,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack })
  });
});

// ============================================
// INICIAR SERVIDOR
// ============================================

async function startServer() {
  try {
    // Inicializar base de datos
    await initDatabase();
    console.log('✅ Base de datos inicializada');

    app.listen(PORT, () => {
      console.log(`
╔═══════════════════════════════════════════════════╗
║                                                   ║
║   🚀 MCWEB FAST - Servidor iniciado              ║
║                                                   ║
║   Local:    http://localhost:${PORT}               ║
║   API:      http://localhost:${PORT}/api           ║
║                                                   ║
║   Modo: ${process.env.NODE_ENV || 'development'}                          ║
║                                                   ║
╚═══════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('❌ Error al iniciar servidor:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
