/**
 * Servicio de Integración con Cloudflare API
 * Gestiona DNS, SSL y cache
 */

const CLOUDFLARE_TOKEN = process.env.CLOUDFLARE_TOKEN;
const CLOUDFLARE_ACCOUNT_ID = process.env.CLOUDFLARE_ACCOUNT_ID;
const SERVER_IP = process.env.SERVER_IP;

const CF_API_BASE = 'https://api.cloudflare.com/client/v4';

/**
 * Realiza una petición a la API de Cloudflare
 */
async function cloudflareRequest(endpoint, method = 'GET', body = null) {
  if (!CLOUDFLARE_TOKEN) {
    throw new Error('CLOUDFLARE_TOKEN no configurado. Añádelo al archivo .env');
  }

  const options = {
    method,
    headers: {
      'Authorization': `Bearer ${CLOUDFLARE_TOKEN}`,
      'Content-Type': 'application/json'
    }
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(`${CF_API_BASE}${endpoint}`, options);
  const data = await response.json();

  if (!data.success) {
    const errorMsg = data.errors?.map(e => e.message).join(', ') || 'Error desconocido';
    throw new Error(`Error de Cloudflare: ${errorMsg}`);
  }

  return data.result;
}

/**
 * Lista todas las zonas (dominios) en la cuenta
 */
async function listarZonas() {
  return await cloudflareRequest('/zones');
}

/**
 * Obtiene el ID de zona para un dominio
 */
async function obtenerZoneId(dominio) {
  // Extraer el dominio raíz (sin subdominios)
  const partes = dominio.replace(/^www\./, '').split('.');
  const dominioRaiz = partes.slice(-2).join('.');

  const zonas = await cloudflareRequest(`/zones?name=${dominioRaiz}`);

  if (!zonas || zonas.length === 0) {
    throw new Error(`Zona no encontrada para dominio: ${dominioRaiz}. Asegúrate de que el dominio esté añadido a Cloudflare.`);
  }

  return zonas[0].id;
}

/**
 * Crea un registro DNS para un dominio
 */
async function crearRegistroDNS(dominio, tipo = 'A', contenido = null, proxied = true) {
  const zoneId = await obtenerZoneId(dominio);
  const ip = contenido || SERVER_IP;

  if (!ip && tipo === 'A') {
    throw new Error('SERVER_IP no configurado. Añádelo al archivo .env');
  }

  // Determinar el nombre del registro
  let nombre = '@';
  if (dominio.startsWith('www.')) {
    nombre = 'www';
  } else if (dominio.includes('.') && dominio.split('.').length > 2) {
    // Es un subdominio
    nombre = dominio.split('.')[0];
  }

  return await cloudflareRequest(`/zones/${zoneId}/dns_records`, 'POST', {
    type: tipo,
    name: nombre,
    content: tipo === 'CNAME' ? contenido : ip,
    ttl: 1, // Auto
    proxied: proxied
  });
}

/**
 * Configura DNS completo para un nuevo sitio
 * Crea registro A y CNAME para www
 */
async function configurarDNSSitio(dominio) {
  const resultados = [];

  try {
    // Crear registro A para el dominio raíz
    const registroA = await crearRegistroDNS(dominio, 'A', SERVER_IP, true);
    resultados.push({ tipo: 'A', success: true, id: registroA.id });

    // Crear CNAME para www si no es ya www
    if (!dominio.startsWith('www.')) {
      const dominioSinWww = dominio.replace(/^www\./, '');
      const registroCNAME = await crearRegistroDNS(`www.${dominioSinWww}`, 'CNAME', dominioSinWww, true);
      resultados.push({ tipo: 'CNAME', success: true, id: registroCNAME.id });
    }

    return { success: true, registros: resultados };

  } catch (error) {
    console.error('Error configurando DNS:', error);
    return { success: false, error: error.message, registros: resultados };
  }
}

/**
 * Lista los registros DNS de un dominio
 */
async function listarRegistrosDNS(dominio) {
  const zoneId = await obtenerZoneId(dominio);
  return await cloudflareRequest(`/zones/${zoneId}/dns_records`);
}

/**
 * Elimina un registro DNS
 */
async function eliminarRegistroDNS(dominio, recordId) {
  const zoneId = await obtenerZoneId(dominio);
  return await cloudflareRequest(`/zones/${zoneId}/dns_records/${recordId}`, 'DELETE');
}

/**
 * Purga la caché de un dominio completo
 */
async function purgarCache(dominio) {
  try {
    const zoneId = await obtenerZoneId(dominio);

    await cloudflareRequest(`/zones/${zoneId}/purge_cache`, 'POST', {
      purge_everything: true
    });

    return { success: true, message: 'Caché purgada correctamente' };

  } catch (error) {
    console.error('Error purgando caché:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Purga URLs específicas de la caché
 */
async function purgarURLs(dominio, urls) {
  try {
    const zoneId = await obtenerZoneId(dominio);

    await cloudflareRequest(`/zones/${zoneId}/purge_cache`, 'POST', {
      files: urls
    });

    return { success: true, message: `${urls.length} URLs purgadas` };

  } catch (error) {
    console.error('Error purgando URLs:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Obtiene estadísticas de analytics para un dominio
 */
async function obtenerAnalytics(dominio, dias = 7) {
  try {
    const zoneId = await obtenerZoneId(dominio);

    const fechaFin = new Date();
    const fechaInicio = new Date();
    fechaInicio.setDate(fechaInicio.getDate() - dias);

    const analytics = await cloudflareRequest(
      `/zones/${zoneId}/analytics/dashboard?since=${fechaInicio.toISOString()}&until=${fechaFin.toISOString()}`
    );

    return {
      success: true,
      data: {
        requests: analytics.totals?.requests?.all || 0,
        bandwidth: analytics.totals?.bandwidth?.all || 0,
        threats: analytics.totals?.threats?.all || 0,
        pageviews: analytics.totals?.pageviews?.all || 0
      }
    };

  } catch (error) {
    console.error('Error obteniendo analytics:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Activa el modo "Under Attack" para un dominio (protección DDoS)
 */
async function activarModoAtaque(dominio, activar = true) {
  try {
    const zoneId = await obtenerZoneId(dominio);

    await cloudflareRequest(`/zones/${zoneId}/settings/security_level`, 'PATCH', {
      value: activar ? 'under_attack' : 'medium'
    });

    return {
      success: true,
      message: activar ? 'Modo Under Attack activado' : 'Modo Under Attack desactivado'
    };

  } catch (error) {
    console.error('Error cambiando modo de seguridad:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Configura reglas de caché para archivos estáticos
 */
async function configurarReglasCache(dominio) {
  try {
    const zoneId = await obtenerZoneId(dominio);

    // Configurar Browser Cache TTL
    await cloudflareRequest(`/zones/${zoneId}/settings/browser_cache_ttl`, 'PATCH', {
      value: 2592000 // 30 días
    });

    return { success: true, message: 'Reglas de caché configuradas' };

  } catch (error) {
    console.error('Error configurando caché:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Verifica el estado SSL de un dominio
 */
async function verificarSSL(dominio) {
  try {
    const zoneId = await obtenerZoneId(dominio);
    const settings = await cloudflareRequest(`/zones/${zoneId}/settings/ssl`);

    return {
      success: true,
      ssl: {
        status: settings.value,
        enabled: settings.value !== 'off'
      }
    };

  } catch (error) {
    console.error('Error verificando SSL:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Configura SSL en modo "Full (strict)"
 */
async function configurarSSL(dominio, modo = 'full') {
  try {
    const zoneId = await obtenerZoneId(dominio);

    await cloudflareRequest(`/zones/${zoneId}/settings/ssl`, 'PATCH', {
      value: modo // 'off', 'flexible', 'full', 'strict'
    });

    return { success: true, message: `SSL configurado en modo ${modo}` };

  } catch (error) {
    console.error('Error configurando SSL:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  listarZonas,
  obtenerZoneId,
  crearRegistroDNS,
  configurarDNSSitio,
  listarRegistrosDNS,
  eliminarRegistroDNS,
  purgarCache,
  purgarURLs,
  obtenerAnalytics,
  activarModoAtaque,
  configurarReglasCache,
  verificarSSL,
  configurarSSL
};
