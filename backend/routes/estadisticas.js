/**
 * Rutas de Estadísticas
 */

const express = require('express');
const router = express.Router();

const { requireAuth, requireAdmin, requireSiteAccess } = require('../middleware/auth');
const {
  getEstadisticasGenerales,
  getEstadisticasSitio,
  getSitioById,
  getSitiosByClienteId
} = require('../database/db');
const { obtenerAnalytics } = require('../services/cloudflareService');

/**
 * GET /api/estadisticas/general
 * Estadísticas generales del sistema (solo admin)
 */
router.get('/general', requireAuth, requireAdmin, async (req, res) => {
  try {
    const stats = getEstadisticasGenerales();

    // Intentar obtener stats de Hetzner
    let serverStats = null;
    if (process.env.HETZNER_TOKEN) {
      try {
        const { obtenerEstadisticas } = require('../services/hetznerService');
        serverStats = await obtenerEstadisticas();
      } catch (e) {
        console.error('Error obteniendo stats de Hetzner:', e);
      }
    }

    res.json({
      success: true,
      estadisticas: {
        totalSitios: stats.totalSitios,
        totalClientes: stats.totalClientes,
        visitasHoy: stats.visitasHoy,
        servidor: serverStats
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/estadisticas/sitio/:sitioId
 * Estadísticas de un sitio específico
 */
router.get('/sitio/:sitioId', requireAuth, requireSiteAccess, async (req, res) => {
  try {
    const sitio = getSitioById(req.params.sitioId);

    if (!sitio) {
      return res.status(404).json({ error: 'Sitio no encontrado' });
    }

    // Stats de la base de datos
    const statsDB = getEstadisticasSitio(sitio.id, 30);

    // Stats de Cloudflare si hay dominio
    let statsCloudflare = null;
    if (sitio.dominio && process.env.CLOUDFLARE_TOKEN) {
      try {
        const resultado = await obtenerAnalytics(sitio.dominio, 7);
        if (resultado.success) {
          statsCloudflare = resultado.data;
        }
      } catch (e) {
        console.error('Error obteniendo stats de Cloudflare:', e);
      }
    }

    res.json({
      success: true,
      sitio: {
        id: sitio.id,
        nombre: sitio.nombre,
        dominio: sitio.dominio
      },
      estadisticas: {
        ultimos30Dias: statsDB,
        cloudflare: statsCloudflare
      }
    });

  } catch (error) {
    console.error('Error obteniendo estadísticas del sitio:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/estadisticas/resumen
 * Resumen rápido para el dashboard del cliente
 */
router.get('/resumen', requireAuth, async (req, res) => {
  try {
    let sitios;

    if (req.user.rol === 'admin') {
      const { getAllSitios } = require('../database/db');
      sitios = getAllSitios();
    } else {
      sitios = getSitiosByClienteId(req.cliente.id);
    }

    const resumen = {
      totalSitios: sitios.length,
      sitiosActivos: sitios.filter(s => s.activo === 1).length,
      ultimaModificacion: sitios.length > 0
        ? sitios.sort((a, b) => new Date(b.fecha_modificacion) - new Date(a.fecha_modificacion))[0].fecha_modificacion
        : null
    };

    res.json({
      success: true,
      resumen
    });

  } catch (error) {
    console.error('Error obteniendo resumen:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

module.exports = router;
