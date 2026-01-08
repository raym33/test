/**
 * Inicialización de la Base de Datos SQLite (usando sql.js)
 */

const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DATABASE_PATH || './data/database.sqlite';

let db = null;

async function getDatabase() {
  if (!db) {
    // Asegurar que el directorio existe
    const dir = path.dirname(DB_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const SQL = await initSqlJs();

    // Cargar base de datos existente o crear nueva
    if (fs.existsSync(DB_PATH)) {
      const buffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(buffer);
    } else {
      db = new SQL.Database();
    }
  }
  return db;
}

function saveDatabase() {
  if (db) {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  }
}

async function initDatabase() {
  const db = await getDatabase();

  // ============================================
  // CREAR TABLAS
  // ============================================

  db.run(`
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      nombre TEXT NOT NULL,
      rol TEXT NOT NULL CHECK (rol IN ('admin', 'cliente')),
      activo INTEGER DEFAULT 1,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      ultimo_acceso DATETIME,
      debe_cambiar_password INTEGER DEFAULT 1
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS clientes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario_id INTEGER UNIQUE NOT NULL,
      telefono TEXT,
      empresa TEXT,
      notas TEXT,
      plan TEXT DEFAULT 'basic',
      fecha_expiracion DATE,
      llamadas_claude_hoy INTEGER DEFAULT 0,
      ultima_llamada_claude DATE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS plantillas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nombre TEXT NOT NULL,
      descripcion TEXT,
      categoria TEXT,
      html_base TEXT NOT NULL,
      css_base TEXT,
      preview_imagen TEXT,
      activa INTEGER DEFAULT 1,
      orden INTEGER DEFAULT 0
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS sitios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      cliente_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      dominio TEXT UNIQUE,
      subdominio TEXT UNIQUE,
      ruta_archivos TEXT NOT NULL,
      plantilla_id INTEGER,
      cloudflare_zone_id TEXT,
      activo INTEGER DEFAULT 1,
      fecha_creacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_modificacion DATETIME DEFAULT CURRENT_TIMESTAMP,
      configuracion TEXT,
      FOREIGN KEY (cliente_id) REFERENCES clientes(id) ON DELETE CASCADE,
      FOREIGN KEY (plantilla_id) REFERENCES plantillas(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS secciones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sitio_id INTEGER NOT NULL,
      nombre TEXT NOT NULL,
      tipo TEXT NOT NULL,
      contenido TEXT,
      orden INTEGER DEFAULT 0,
      visible INTEGER DEFAULT 1,
      FOREIGN KEY (sitio_id) REFERENCES sitios(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS cambios_historial (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sitio_id INTEGER NOT NULL,
      usuario_id INTEGER NOT NULL,
      tipo TEXT NOT NULL,
      seccion TEXT,
      contenido_anterior TEXT,
      contenido_nuevo TEXT,
      prompt_usado TEXT,
      fecha DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sitio_id) REFERENCES sitios(id) ON DELETE CASCADE,
      FOREIGN KEY (usuario_id) REFERENCES usuarios(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS estadisticas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sitio_id INTEGER NOT NULL,
      fecha DATE NOT NULL,
      visitas INTEGER DEFAULT 0,
      bandwidth_mb REAL DEFAULT 0,
      UNIQUE(sitio_id, fecha),
      FOREIGN KEY (sitio_id) REFERENCES sitios(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS dominios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sitio_id INTEGER,
      dominio TEXT UNIQUE NOT NULL,
      tipo TEXT DEFAULT 'principal',
      cloudflare_zone_id TEXT,
      ssl_activo INTEGER DEFAULT 0,
      fecha_registro DATE,
      fecha_expiracion DATE,
      FOREIGN KEY (sitio_id) REFERENCES sitios(id) ON DELETE SET NULL
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS archivos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sitio_id INTEGER NOT NULL,
      nombre_original TEXT NOT NULL,
      nombre_guardado TEXT NOT NULL,
      ruta TEXT NOT NULL,
      tipo TEXT,
      tamaño INTEGER,
      fecha_subida DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (sitio_id) REFERENCES sitios(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS wizard_sesiones (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT UNIQUE NOT NULL,
      paso_actual INTEGER DEFAULT 1,
      datos TEXT,
      sitio_temporal_id INTEGER,
      email_contacto TEXT,
      fecha_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
      fecha_ultimo_paso DATETIME DEFAULT CURRENT_TIMESTAMP,
      completado INTEGER DEFAULT 0,
      pagado INTEGER DEFAULT 0
    )
  `);

  // ============================================
  // CREAR ÍNDICES
  // ============================================

  db.run(`CREATE INDEX IF NOT EXISTS idx_usuarios_email ON usuarios(email)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sitios_dominio ON sitios(dominio)`);
  db.run(`CREATE INDEX IF NOT EXISTS idx_sitios_cliente ON sitios(cliente_id)`);

  // ============================================
  // INSERTAR DATOS INICIALES
  // ============================================

  // Crear admin por defecto si no existe
  const adminCheck = db.exec("SELECT id FROM usuarios WHERE email = 'admin@mcweb.fast'");

  if (adminCheck.length === 0 || adminCheck[0].values.length === 0) {
    const passwordHash = bcrypt.hashSync('Admin123!', 10);

    db.run(`
      INSERT INTO usuarios (email, password_hash, nombre, rol, debe_cambiar_password)
      VALUES (?, ?, ?, ?, ?)
    `, ['admin@mcweb.fast', passwordHash, 'Administrador', 'admin', 0]);

    console.log('✅ Usuario admin creado: admin@mcweb.fast / Admin123!');
  }

  // Insertar plantillas base si no existen
  const plantillasCheck = db.exec("SELECT COUNT(*) as count FROM plantillas");
  const count = plantillasCheck[0]?.values[0]?.[0] || 0;

  if (count === 0) {
    insertarPlantillasBase(db);
    console.log('✅ Plantillas base insertadas');
  }

  // Guardar cambios
  saveDatabase();

  return db;
}

function insertarPlantillasBase(db) {
  const plantillas = [
    {
      nombre: 'Negocio Local',
      descripcion: 'Perfecta para restaurantes, tiendas, talleres y negocios locales',
      categoria: 'negocio',
      html_base: getPlantillaNegocio(),
      preview_imagen: '/templates/negocio-preview.jpg',
      orden: 1
    },
    {
      nombre: 'Profesional',
      descripcion: 'Ideal para freelancers, consultores y profesionales independientes',
      categoria: 'profesional',
      html_base: getPlantillaProfesional(),
      preview_imagen: '/templates/profesional-preview.jpg',
      orden: 2
    },
    {
      nombre: 'Portfolio',
      descripcion: 'Muestra tu trabajo creativo con estilo',
      categoria: 'portfolio',
      html_base: getPlantillaPortfolio(),
      preview_imagen: '/templates/portfolio-preview.jpg',
      orden: 3
    }
  ];

  for (const p of plantillas) {
    db.run(`
      INSERT INTO plantillas (nombre, descripcion, categoria, html_base, css_base, preview_imagen, orden)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [p.nombre, p.descripcion, p.categoria, p.html_base, '', p.preview_imagen, p.orden]);
  }
}

// Plantillas HTML (simplificadas para brevedad)
function getPlantillaNegocio() {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{NOMBRE_NEGOCIO}}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-50">
  <section id="hero" class="bg-blue-600 text-white py-20 px-4">
    <div class="max-w-4xl mx-auto text-center">
      <h1 class="text-4xl md:text-5xl font-bold mb-4">{{TITULO_HERO}}</h1>
      <p class="text-xl mb-8">{{SUBTITULO_HERO}}</p>
      <a href="#contacto" class="bg-white text-blue-600 px-8 py-3 rounded-full font-semibold">Contactar</a>
    </div>
  </section>
  <section id="servicios" class="py-16 px-4">
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold text-center mb-12">Nuestros Servicios</h2>
      <div class="grid md:grid-cols-3 gap-8">{{SERVICIOS_CARDS}}</div>
    </div>
  </section>
  <section id="contacto" class="bg-gray-100 py-16 px-4">
    <div class="max-w-4xl mx-auto text-center">
      <h2 class="text-3xl font-bold mb-8">Contacto</h2>
      <p>{{TELEFONO}} | {{EMAIL}} | {{DIRECCION}}</p>
    </div>
  </section>
  <footer class="bg-gray-800 text-white py-8 px-4 text-center">
    <p>&copy; 2024 {{NOMBRE_NEGOCIO}}</p>
  </footer>
</body>
</html>`;
}

function getPlantillaProfesional() {
  return getPlantillaNegocio(); // Simplificado
}

function getPlantillaPortfolio() {
  return getPlantillaNegocio(); // Simplificado
}

module.exports = { initDatabase, getDatabase, saveDatabase };
