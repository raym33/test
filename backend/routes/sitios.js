/**
 * Rutas de Gestión de Sitios Web
 */

const express = require('express');
const router = express.Router();

const { requireAuth, requireAdmin, requireSiteAccess } = require('../middleware/auth');
const {
  createSitio,
  getSitioById,
  getSitiosByClienteId,
  getAllSitios,
  updateSitio,
  deleteSitio,
  getPlantillaById,
  getAllPlantillas,
  createSeccion
} = require('../database/db');
const { generarSitioCompleto, validarHTML } = require('../services/claudeService');
const { configurarDNSSitio, purgarCache } = require('../services/cloudflareService');
const { crearEstructuraSitio, guardarHTML, SITES_ROOT } = require('../services/fileService');

/**
 * GET /api/sitios
 * Lista todos los sitios (admin ve todos, cliente solo los suyos)
 */
router.get('/', requireAuth, async (req, res) => {
  try {
    let sitios;

    if (req.user.rol === 'admin') {
      sitios = await getAllSitios();
    } else {
      sitios = await getSitiosByClienteId(req.cliente.id);
    }

    res.json({
      success: true,
      sitios: sitios.map(s => ({
        id: s.id,
        nombre: s.nombre,
        dominio: s.dominio,
        subdominio: s.subdominio,
        plantilla: s.plantilla_nombre,
        activo: s.activo === 1,
        fechaCreacion: s.fecha_creacion,
        fechaModificacion: s.fecha_modificacion,
        clienteNombre: s.cliente_nombre,
        clienteEmail: s.cliente_email
      }))
    });

  } catch (error) {
    console.error('Error listando sitios:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/sitios/plantillas
 * Lista las plantillas disponibles
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
    console.error('Error listando plantillas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/sitios/:id
 * Obtiene un sitio específico
 */
router.get('/:id', requireAuth, requireSiteAccess, async (req, res) => {
  try {
    const sitio = await getSitioById(req.params.id);

    if (!sitio) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    // Parsear configuración JSON
    let configuracion = {};
    try {
      configuracion = JSON.parse(sitio.configuracion || '{}');
    } catch (e) {}

    res.json({
      success: true,
      sitio: {
        id: sitio.id,
        nombre: sitio.nombre,
        dominio: sitio.dominio,
        subdominio: sitio.subdominio,
        rutaArchivos: sitio.ruta_archivos,
        plantilla: sitio.plantilla_nombre,
        activo: sitio.activo === 1,
        fechaCreacion: sitio.fecha_creacion,
        fechaModificacion: sitio.fecha_modificacion,
        configuracion
      }
    });

  } catch (error) {
    console.error('Error obteniendo sitio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/sitios
 * Crea un nuevo sitio (solo admin)
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const {
      clienteId,
      nombre,
      dominio,
      plantillaId,
      configuracion
    } = req.body;

    // Validaciones
    if (!clienteId || !nombre) {
      return res.status(400).json({ error: 'Cliente y nombre son requeridos' });
    }

    // Generar identificador único para el sitio
    const identificador = generarIdentificador(nombre);

    // Crear estructura de archivos
    const rutaArchivos = await crearEstructuraSitio(identificador);

    // Obtener plantilla si se especificó
    let plantilla = null;
    if (plantillaId) {
      plantilla = await getPlantillaById(plantillaId);
    }

    // Generar HTML inicial con Claude si hay configuración
    let htmlInicial = plantilla?.html_base || getHTMLPlaceholder(nombre);

    if (configuracion?.generarConIA) {
      try {
        htmlInicial = await generarSitioCompleto({
          tipoNegocio: configuracion.tipoNegocio || 'negocio local',
          nombreNegocio: nombre,
          descripcion: configuracion.descripcion || '',
          servicios: configuracion.servicios || [],
          colorPrimario: configuracion.colorPrimario || '#3B82F6',
          colorSecundario: configuracion.colorSecundario || '#1E40AF',
          contacto: configuracion.contacto || {}
        });

        // Validar y limpiar HTML
        htmlInicial = validarHTML(htmlInicial);
      } catch (error) {
        console.error('Error generando sitio con Claude:', error);
        // Continuar con HTML por defecto
      }
    }

    // Guardar HTML
    await guardarHTML(rutaArchivos, htmlInicial);

    // Crear registro en base de datos
    const sitioId = await createSitio({
      clienteId,
      nombre: nombre.trim(),
      dominio: dominio?.toLowerCase().trim() || null,
      subdominio: identificador,
      rutaArchivos,
      plantillaId: plantillaId || null,
      configuracion
    });

    // Crear secciones por defecto
    const seccionesPorDefecto = ['hero', 'servicios', 'nosotros', 'contacto'];
    for (let i = 0; i < seccionesPorDefecto.length; i++) {
      await createSeccion({
        sitioId,
        nombre: seccionesPorDefecto[i],
        tipo: seccionesPorDefecto[i],
        contenido: {},
        orden: i
      });
    }

    // Configurar DNS si hay dominio
    let dnsResult = null;
    if (dominio && process.env.CLOUDFLARE_TOKEN) {
      try {
        dnsResult = await configurarDNSSitio(dominio);
      } catch (error) {
        console.error('Error configurando DNS:', error);
        // No fallar la creación por esto
      }
    }

    res.status(201).json({
      success: true,
      sitio: {
        id: sitioId,
        nombre,
        dominio,
        subdominio: identificador,
        rutaArchivos,
        previewUrl: `/sites/${identificador}/public/index.html`
      },
      dns: dnsResult
    });

  } catch (error) {
    console.error('Error creando sitio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * PUT /api/sitios/:id
 * Actualiza un sitio
 */
router.put('/:id', requireAuth, requireSiteAccess, async (req, res) => {
  try {
    const { nombre, dominio, activo, configuracion } = req.body;
    const sitioId = req.params.id;

    const sitio = await getSitioById(sitioId);
    if (!sitio) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    const updates = {};

    if (nombre !== undefined) updates.nombre = nombre.trim();
    if (dominio !== undefined) updates.dominio = dominio?.toLowerCase().trim() || null;
    if (activo !== undefined) updates.activo = activo ? 1 : 0;
    if (configuracion !== undefined) updates.configuracion = JSON.stringify(configuracion);

    if (Object.keys(updates).length > 0) {
      await updateSitio(sitioId, updates);
    }

    res.json({
      success: true,
      message: 'Sitio actualizado correctamente'
    });

  } catch (error) {
    console.error('Error actualizando sitio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * DELETE /api/sitios/:id
 * Elimina un sitio (solo admin)
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const sitioId = req.params.id;

    const sitio = await getSitioById(sitioId);
    if (!sitio) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    // Eliminar archivos
    const { eliminarSitio: eliminarArchivosSitio } = require('../services/fileService');
    await eliminarArchivosSitio(sitio.ruta_archivos);

    // Eliminar de base de datos
    await deleteSitio(sitioId);

    res.json({
      success: true,
      message: 'Sitio eliminado correctamente'
    });

  } catch (error) {
    console.error('Error eliminando sitio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/sitios/:id/purgar-cache
 * Purga la caché de Cloudflare para un sitio
 */
router.post('/:id/purgar-cache', requireAuth, requireSiteAccess, async (req, res) => {
  try {
    const sitio = await getSitioById(req.params.id);

    if (!sitio || !sitio.dominio) {
      return res.status(404).json({ error: 'Sitio no encontrado o sin dominio configurado' });
    }

    const result = await purgarCache(sitio.dominio);

    res.json(result);

  } catch (error) {
    console.error('Error purgando caché:', error);
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
    .replace(/[\u0300-\u036f]/g, '') // Quitar acentos
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .substring(0, 30);

  const random = Math.random().toString(36).substring(2, 8);

  return `${base}-${random}`;
}

/**
 * HTML placeholder cuando no hay plantilla
 */
function getHTMLPlaceholder(nombre) {
  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${nombre}</title>
  <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen flex items-center justify-center">
  <div class="text-center p-8">
    <h1 class="text-4xl font-bold text-gray-800 mb-4">${nombre}</h1>
    <p class="text-gray-600">Sitio en construcción</p>
    <p class="text-gray-400 mt-4 text-sm">Usa el panel de administración para personalizar este sitio</p>
  </div>
</body>
</html>`;
}

module.exports = router;
