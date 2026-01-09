/**
 * Rutas del Wizard de Creación de Web
 * El "McDonald's de webs" - El cliente elige ingredientes y sale con su web
 */

const express = require('express');
const multer = require('multer');
const crypto = require('crypto');
const router = express.Router();

const {
  createWizardSession,
  getWizardSession,
  updateWizardSession,
  completeWizardSession,
  createSitio,
  createCliente,
  createUser,
  createSeccion,
  getAllPlantillas
} = require('../database/db');
const { generarSitioCompleto, validarHTML, generarContenidoSeccion } = require('../services/claudeService');
const { crearEstructuraSitio, guardarHTML, guardarImagen } = require('../services/fileService');
const bcrypt = require('bcryptjs');

// Configurar multer
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

/**
 * POST /api/wizard/iniciar
 * Inicia una nueva sesión del wizard
 */
router.post('/iniciar', async (req, res) => {
  try {
    const sessionId = crypto.randomUUID();
    await createWizardSession(sessionId);

    res.json({
      success: true,
      sessionId,
      pasoActual: 1,
      totalPasos: 5,
      mensaje: 'Sesión iniciada. ¡Vamos a crear tu web!'
    });

  } catch (error) {
    console.error('Error iniciando wizard:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/wizard/plantillas
 * Obtiene las plantillas disponibles para el wizard
 */
router.get('/plantillas', async (req, res) => {
  try {
    const plantillas = await getAllPlantillas();

    res.json({
      success: true,
      plantillas: plantillas.map(p => ({
        id: p.id,
        nombre: p.nombre,
        descripcion: p.descripcion,
        categoria: p.categoria,
        previewImagen: p.preview_imagen
      }))
    });

  } catch (error) {
    console.error('Error obteniendo plantillas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/wizard/paso/:paso
 * Guarda los datos de un paso del wizard
 */
router.post('/paso/:paso', upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'imagenes', maxCount: 5 }
]), async (req, res) => {
  try {
    const { sessionId } = req.body;
    const paso = parseInt(req.params.paso);

    if (!sessionId) {
      return res.status(400).json({ error: 'SessionId es requerido' });
    }

    const session = await getWizardSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada. Inicia una nueva.' });
    }

    // Parsear datos existentes
    const datosActuales = JSON.parse(session.datos || '{}');

    // Procesar según el paso
    let nuevosDatos = {};

    switch (paso) {
      case 1: // Tipo de negocio y nombre
        nuevosDatos = {
          tipoNegocio: req.body.tipoNegocio,
          nombreNegocio: req.body.nombreNegocio,
          descripcion: req.body.descripcion
        };
        break;

      case 2: // Plantilla y colores
        nuevosDatos = {
          plantillaId: req.body.plantillaId,
          colorPrimario: req.body.colorPrimario || '#3B82F6',
          colorSecundario: req.body.colorSecundario || '#1E40AF'
        };
        break;

      case 3: // Servicios
        nuevosDatos = {
          servicios: JSON.parse(req.body.servicios || '[]')
        };
        break;

      case 4: // Contacto
        nuevosDatos = {
          contacto: {
            telefono: req.body.telefono,
            email: req.body.email,
            direccion: req.body.direccion,
            horario: req.body.horario,
            whatsapp: req.body.whatsapp
          }
        };
        break;

      case 5: // Imágenes y logo
        // Procesar logo si se subió
        if (req.files?.logo?.[0]) {
          nuevosDatos.logoTemporal = {
            buffer: req.files.logo[0].buffer.toString('base64'),
            nombre: req.files.logo[0].originalname
          };
        }

        // Procesar imágenes adicionales
        if (req.files?.imagenes) {
          nuevosDatos.imagenesTemporal = req.files.imagenes.map(f => ({
            buffer: f.buffer.toString('base64'),
            nombre: f.originalname
          }));
        }
        break;

      default:
        return res.status(400).json({ error: 'Paso no válido' });
    }

    // Actualizar sesión
    const sessionActualizada = await updateWizardSession(sessionId, {
      paso: paso + 1,
      datos: { ...datosActuales, ...nuevosDatos }
    });

    res.json({
      success: true,
      pasoActual: paso + 1,
      mensaje: paso === 5 ? '¡Datos completos! Listo para generar tu web.' : `Paso ${paso} guardado`
    });

  } catch (error) {
    console.error('Error en paso del wizard:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/wizard/generar
 * Genera el sitio web completo usando IA
 */
router.post('/generar', async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'SessionId es requerido' });
    }

    const session = await getWizardSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    const datos = JSON.parse(session.datos || '{}');

    // Validar datos mínimos
    if (!datos.nombreNegocio || !datos.tipoNegocio) {
      return res.status(400).json({
        error: 'Faltan datos requeridos. Completa al menos el nombre y tipo de negocio.'
      });
    }

    // Generar identificador único
    const identificador = generarIdentificador(datos.nombreNegocio);

    // Crear estructura de archivos
    const rutaArchivos = await crearEstructuraSitio(identificador);

    // Procesar logo si existe
    let logoUrl = null;
    if (datos.logoTemporal) {
      const logoBuffer = Buffer.from(datos.logoTemporal.buffer, 'base64');
      const resultado = await guardarImagen(rutaArchivos, logoBuffer, datos.logoTemporal.nombre);
      logoUrl = resultado.ruta;
    }

    // Procesar imágenes adicionales
    const imagenesUrls = [];
    if (datos.imagenesTemporal) {
      for (const img of datos.imagenesTemporal) {
        const imgBuffer = Buffer.from(img.buffer, 'base64');
        const resultado = await guardarImagen(rutaArchivos, imgBuffer, img.nombre);
        imagenesUrls.push(resultado.ruta);
      }
    }

    // Generar HTML con Claude
    let htmlGenerado;
    try {
      htmlGenerado = await generarSitioCompleto({
        tipoNegocio: datos.tipoNegocio,
        nombreNegocio: datos.nombreNegocio,
        descripcion: datos.descripcion || '',
        servicios: datos.servicios || [],
        colorPrimario: datos.colorPrimario || '#3B82F6',
        colorSecundario: datos.colorSecundario || '#1E40AF',
        contacto: datos.contacto || {},
        logoUrl,
        imagenesUrls
      });

      // Validar y limpiar HTML
      htmlGenerado = validarHTML(htmlGenerado);

    } catch (error) {
      console.error('Error generando con Claude:', error);
      return res.status(500).json({
        error: 'Error al generar tu web. Por favor, inténtalo de nuevo.'
      });
    }

    // Guardar HTML
    await guardarHTML(rutaArchivos, htmlGenerado);

    // Actualizar sesión con el sitio temporal
    await updateWizardSession(sessionId, {
      datos: {
        ...datos,
        sitioGenerado: {
          identificador,
          rutaArchivos,
          previewUrl: `/sites/${identificador}/public/index.html`
        }
      }
    });

    res.json({
      success: true,
      mensaje: '¡Tu web ha sido generada!',
      preview: {
        identificador,
        url: `/sites/${identificador}/public/index.html`
      }
    });

  } catch (error) {
    console.error('Error generando sitio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/wizard/regenerar-seccion
 * Regenera una sección específica con nuevos parámetros
 */
router.post('/regenerar-seccion', async (req, res) => {
  try {
    const { sessionId, seccion, instrucciones } = req.body;

    if (!sessionId || !seccion) {
      return res.status(400).json({ error: 'SessionId y sección son requeridos' });
    }

    const session = await getWizardSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    const datos = JSON.parse(session.datos || '{}');

    if (!datos.sitioGenerado) {
      return res.status(400).json({ error: 'Primero debes generar el sitio' });
    }

    // Generar contenido para la sección
    const nuevoContenido = await generarContenidoSeccion({
      tipoSeccion: seccion,
      contextoNegocio: `${datos.tipoNegocio} llamado ${datos.nombreNegocio}`,
      instrucciones
    });

    res.json({
      success: true,
      seccion,
      contenido: nuevoContenido
    });

  } catch (error) {
    console.error('Error regenerando sección:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/wizard/finalizar
 * Finaliza el wizard y crea la cuenta del cliente
 */
router.post('/finalizar', async (req, res) => {
  try {
    const { sessionId, email, nombre, telefono, dominio } = req.body;

    if (!sessionId || !email) {
      return res.status(400).json({ error: 'SessionId y email son requeridos' });
    }

    // Validar email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Email no válido' });
    }

    const session = await getWizardSession(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    const datos = JSON.parse(session.datos || '{}');

    if (!datos.sitioGenerado) {
      return res.status(400).json({ error: 'Primero debes generar el sitio' });
    }

    // Generar contraseña temporal
    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(passwordTemporal, 10);

    // Crear usuario
    const usuarioId = await createUser({
      email: email.toLowerCase().trim(),
      passwordHash,
      nombre: nombre?.trim() || datos.nombreNegocio,
      rol: 'cliente'
    });

    // Crear cliente
    const clienteId = await createCliente({
      usuarioId,
      telefono: telefono?.trim() || datos.contacto?.telefono || null,
      empresa: datos.nombreNegocio,
      plan: 'basic'
    });

    // Crear sitio
    const sitioId = await createSitio({
      clienteId,
      nombre: datos.nombreNegocio,
      dominio: dominio?.toLowerCase().trim() || null,
      subdominio: datos.sitioGenerado.identificador,
      rutaArchivos: datos.sitioGenerado.rutaArchivos,
      plantillaId: datos.plantillaId || null,
      configuracion: {
        tipoNegocio: datos.tipoNegocio,
        colorPrimario: datos.colorPrimario,
        colorSecundario: datos.colorSecundario,
        servicios: datos.servicios,
        contacto: datos.contacto
      }
    });

    // Crear secciones
    const secciones = ['hero', 'servicios', 'nosotros', 'contacto'];
    for (let i = 0; i < secciones.length; i++) {
      await createSeccion({
        sitioId,
        nombre: secciones[i],
        tipo: secciones[i],
        contenido: {},
        orden: i
      });
    }

    // Marcar sesión como completada
    await completeWizardSession(sessionId, { sitioId, email });

    res.json({
      success: true,
      mensaje: '¡Tu web está lista!',
      cliente: {
        id: clienteId,
        email: email.toLowerCase().trim()
      },
      credenciales: {
        email: email.toLowerCase().trim(),
        passwordTemporal,
        panelUrl: process.env.PANEL_DOMAIN || 'mcweb.fast',
        mensaje: 'Usa estas credenciales para acceder a tu panel de control'
      },
      sitio: {
        id: sitioId,
        nombre: datos.nombreNegocio,
        url: datos.sitioGenerado.previewUrl,
        dominio: dominio || null
      }
    });

  } catch (error) {
    console.error('Error finalizando wizard:', error);

    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(400).json({
        error: 'Ya existe una cuenta con ese email. Inicia sesión o usa otro email.'
      });
    }

    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/wizard/session/:sessionId
 * Obtiene el estado actual de una sesión del wizard
 */
router.get('/session/:sessionId', async (req, res) => {
  try {
    const session = await getWizardSession(req.params.sessionId);

    if (!session) {
      return res.status(404).json({ error: 'Sesión no encontrada' });
    }

    const datos = JSON.parse(session.datos || '{}');

    res.json({
      success: true,
      session: {
        pasoActual: session.paso_actual,
        completado: session.completado === 1,
        datos: {
          tipoNegocio: datos.tipoNegocio,
          nombreNegocio: datos.nombreNegocio,
          descripcion: datos.descripcion,
          plantillaId: datos.plantillaId,
          colorPrimario: datos.colorPrimario,
          colorSecundario: datos.colorSecundario,
          servicios: datos.servicios,
          contacto: datos.contacto,
          sitioGenerado: datos.sitioGenerado ? {
            identificador: datos.sitioGenerado.identificador,
            previewUrl: datos.sitioGenerado.previewUrl
          } : null
        }
      }
    });

  } catch (error) {
    console.error('Error obteniendo sesión:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Genera un identificador único para el sitio
 */
function generarIdentificador(nombre) {
  const base = nombre
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 30);

  const random = Math.random().toString(36).substring(2, 8);
  return `${base}-${random}`;
}

/**
 * Genera una contraseña temporal
 */
function generarPasswordTemporal() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password + '!';
}

module.exports = router;
