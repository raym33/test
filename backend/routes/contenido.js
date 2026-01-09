/**
 * Rutas de Actualización de Contenido (Cliente)
 * Permite a los clientes editar su sitio usando IA
 */

const express = require('express');
const multer = require('multer');
const router = express.Router();

const { requireAuth, requireSiteAccess } = require('../middleware/auth');
const {
  getSitioById,
  getSeccionesBySitioId,
  updateSeccion,
  createCambioHistorial,
  createArchivo,
  getHistorialBySitioId,
  updateClienteClaudeCalls,
  getClienteClaudeCalls
} = require('../database/db');
const { actualizarSeccion, validarHTML, mejorarTexto } = require('../services/claudeService');
const { purgarCache } = require('../services/cloudflareService');
const { guardarHTML, leerHTML, guardarImagen, listarBackups, restaurarBackup } = require('../services/fileService');

// Configurar multer para subida de imágenes
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: parseInt(process.env.MAX_IMAGE_SIZE) || 5 * 1024 * 1024 // 5MB por defecto
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de archivo no permitido. Solo imágenes JPG, PNG, GIF y WebP.'));
    }
  }
});

/**
 * GET /api/contenido/:sitioId
 * Obtiene el contenido actual del sitio
 */
router.get('/:sitioId', requireAuth, requireSiteAccess, async (req, res) => {
  try {
    const sitio = await getSitioById(req.params.sitioId);

    if (!sitio) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    // Leer HTML actual
    const html = await leerHTML(sitio.ruta_archivos);

    // Obtener secciones
    const secciones = await getSeccionesBySitioId(sitio.id);

    res.json({
      success: true,
      sitio: {
        id: sitio.id,
        nombre: sitio.nombre,
        dominio: sitio.dominio
      },
      html,
      secciones: secciones.map(s => ({
        id: s.id,
        nombre: s.nombre,
        tipo: s.tipo,
        contenido: JSON.parse(s.contenido || '{}'),
        visible: s.visible === 1
      }))
    });

  } catch (error) {
    console.error('Error obteniendo contenido:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/contenido/:sitioId/actualizar
 * Actualiza una sección del sitio usando IA
 */
router.post('/:sitioId/actualizar', requireAuth, requireSiteAccess, upload.single('imagen'), async (req, res) => {
  try {
    const sitio = await getSitioById(req.params.sitioId);

    if (!sitio) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    // Verificar límite de llamadas a Claude
    if (req.cliente) {
      const llamadasHoy = await getClienteClaudeCalls(req.cliente.id);
      const limite = parseInt(process.env.MAX_CLAUDE_CALLS_PER_DAY) || 20;

      if (llamadasHoy >= limite) {
        return res.status(429).json({
          error: `Has alcanzado el límite de ${limite} actualizaciones con IA por día. Inténtalo mañana.`
        });
      }
    }

    const { seccion, texto, instruccion } = req.body;

    if (!seccion) {
      return res.status(400).json({ error: 'La sección es requerida' });
    }

    // Leer HTML actual
    const htmlActual = await leerHTML(sitio.ruta_archivos);

    if (!htmlActual) {
      return res.status(404).json({ error: 'No se encontró el HTML del sitio' });
    }

    // Procesar imagen si se subió
    let imagenUrl = null;
    if (req.file) {
      const resultado = await guardarImagen(sitio.ruta_archivos, req.file.buffer, req.file.originalname);
      imagenUrl = resultado.ruta;

      // Guardar referencia en DB
      await createArchivo({
        sitioId: sitio.id,
        nombreOriginal: resultado.nombreOriginal,
        nombreGuardado: resultado.nombreGuardado,
        ruta: resultado.ruta,
        tipo: resultado.tipo,
        tamaño: resultado.tamaño
      });
    }

    // Generar HTML actualizado con Claude
    let htmlNuevo;
    try {
      htmlNuevo = await actualizarSeccion({
        htmlActual,
        seccion,
        nuevoTexto: texto,
        nuevaImagen: imagenUrl,
        instruccionExtra: instruccion
      });

      // Validar HTML
      htmlNuevo = validarHTML(htmlNuevo);

    } catch (error) {
      console.error('Error con Claude API:', error);
      return res.status(500).json({
        error: 'Error al generar el contenido. Por favor, inténtalo de nuevo.'
      });
    }

    // Guardar nuevo HTML (crea backup automáticamente)
    await guardarHTML(sitio.ruta_archivos, htmlNuevo);

    // Registrar el cambio
    await createCambioHistorial({
      sitioId: sitio.id,
      usuarioId: req.user.id,
      tipo: 'actualizacion_seccion',
      seccion,
      contenidoAnterior: htmlActual.substring(0, 1000), // Guardar preview
      contenidoNuevo: htmlNuevo.substring(0, 1000),
      promptUsado: `Sección: ${seccion}, Texto: ${texto?.substring(0, 200)}, Imagen: ${imagenUrl || 'N/A'}`
    });

    // Incrementar contador de llamadas Claude
    if (req.cliente) {
      await updateClienteClaudeCalls(req.cliente.id);
    }

    // Purgar caché si hay dominio
    if (sitio.dominio && process.env.CLOUDFLARE_TOKEN) {
      try {
        await purgarCache(sitio.dominio);
      } catch (error) {
        console.error('Error purgando caché:', error);
        // No fallar por esto
      }
    }

    res.json({
      success: true,
      message: 'Contenido actualizado correctamente',
      previewUrl: `/sites/${sitio.subdominio}/public/index.html`
    });

  } catch (error) {
    console.error('Error actualizando contenido:', error);

    if (error.message?.includes('Tipo de archivo')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/contenido/:sitioId/mejorar-texto
 * Mejora un texto usando IA (sin actualizar el sitio)
 */
router.post('/:sitioId/mejorar-texto', requireAuth, requireSiteAccess, async (req, res) => {
  try {
    const { texto, contexto } = req.body;

    if (!texto) {
      return res.status(400).json({ error: 'El texto es requerido' });
    }

    const sitio = await getSitioById(req.params.sitioId);
    const textoMejorado = await mejorarTexto(texto, contexto || sitio?.nombre || 'web profesional');

    res.json({
      success: true,
      textoOriginal: texto,
      textoMejorado
    });

  } catch (error) {
    console.error('Error mejorando texto:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/contenido/:sitioId/historial
 * Obtiene el historial de cambios del sitio
 */
router.get('/:sitioId/historial', requireAuth, requireSiteAccess, async (req, res) => {
  try {
    const historial = await getHistorialBySitioId(req.params.sitioId, 50);

    res.json({
      success: true,
      historial: historial.map(h => ({
        id: h.id,
        tipo: h.tipo,
        seccion: h.seccion,
        fecha: h.fecha,
        usuario: h.usuario_nombre
      }))
    });

  } catch (error) {
    console.error('Error obteniendo historial:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/contenido/:sitioId/backups
 * Lista los backups disponibles del sitio
 */
router.get('/:sitioId/backups', requireAuth, requireSiteAccess, async (req, res) => {
  try {
    const sitio = await getSitioById(req.params.sitioId);

    if (!sitio) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    const backups = await listarBackups(sitio.ruta_archivos);

    res.json({
      success: true,
      backups
    });

  } catch (error) {
    console.error('Error listando backups:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/contenido/:sitioId/restaurar
 * Restaura un backup del sitio
 */
router.post('/:sitioId/restaurar', requireAuth, requireSiteAccess, async (req, res) => {
  try {
    const { nombreBackup } = req.body;

    if (!nombreBackup) {
      return res.status(400).json({ error: 'Nombre del backup es requerido' });
    }

    const sitio = await getSitioById(req.params.sitioId);

    if (!sitio) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    const resultado = await restaurarBackup(sitio.ruta_archivos, nombreBackup);

    // Registrar la restauración
    await createCambioHistorial({
      sitioId: sitio.id,
      usuarioId: req.user.id,
      tipo: 'restauracion_backup',
      seccion: null,
      contenidoAnterior: null,
      contenidoNuevo: null,
      promptUsado: `Backup restaurado: ${nombreBackup}`
    });

    // Purgar caché si hay dominio
    if (sitio.dominio && process.env.CLOUDFLARE_TOKEN) {
      try {
        await purgarCache(sitio.dominio);
      } catch (error) {
        console.error('Error purgando caché:', error);
      }
    }

    res.json(resultado);

  } catch (error) {
    console.error('Error restaurando backup:', error);
    res.status(500).json({ error: error.message || 'Error interno del servidor' });
  }
});

/**
 * POST /api/contenido/:sitioId/subir-imagen
 * Sube una imagen sin actualizar el HTML
 */
router.post('/:sitioId/subir-imagen', requireAuth, requireSiteAccess, upload.single('imagen'), async (req, res) => {
  try {
    const sitio = await getSitioById(req.params.sitioId);

    if (!sitio) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No se proporcionó ninguna imagen' });
    }

    const resultado = await guardarImagen(sitio.ruta_archivos, req.file.buffer, req.file.originalname);

    // Guardar referencia en DB
    await createArchivo({
      sitioId: sitio.id,
      nombreOriginal: resultado.nombreOriginal,
      nombreGuardado: resultado.nombreGuardado,
      ruta: resultado.ruta,
      tipo: resultado.tipo,
      tamaño: resultado.tamaño
    });

    res.json({
      success: true,
      imagen: resultado
    });

  } catch (error) {
    console.error('Error subiendo imagen:', error);

    if (error.message?.includes('Tipo de archivo')) {
      return res.status(400).json({ error: error.message });
    }

    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
