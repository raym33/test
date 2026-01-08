/**
 * Servicio de Integración con Hetzner Cloud API
 * Para monitoreo del servidor
 */

const HETZNER_TOKEN = process.env.HETZNER_TOKEN;

async function obtenerEstadisticas() {
  if (!HETZNER_TOKEN) {
    return {
      bandwidth_usado_gb: 0,
      cpu_uso: 0,
      ram_uso_gb: 0,
      mensaje: 'HETZNER_TOKEN no configurado'
    };
  }

  try {
    const response = await fetch('https://api.hetzner.cloud/v1/servers', {
      headers: {
        'Authorization': `Bearer ${HETZNER_TOKEN}`
      }
    });

    if (!response.ok) {
      throw new Error('Error conectando con Hetzner API');
    }

    const data = await response.json();

    if (!data.servers || data.servers.length === 0) {
      return {
        bandwidth_usado_gb: 0,
        cpu_uso: 0,
        ram_uso_gb: 0,
        mensaje: 'No hay servidores'
      };
    }

    const server = data.servers[0];

    return {
      bandwidth_usado_gb: (server.outgoing_traffic || 0) / 1024 / 1024 / 1024,
      nombre: server.name,
      status: server.status,
      ip: server.public_net?.ipv4?.ip || 'N/A',
      tipo: server.server_type?.name || 'N/A'
    };

  } catch (error) {
    console.error('Error obteniendo stats de Hetzner:', error);
    return {
      bandwidth_usado_gb: 0,
      error: error.message
    };
  }
}

module.exports = { obtenerEstadisticas };
