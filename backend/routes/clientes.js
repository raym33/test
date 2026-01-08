/**
 * Rutas de Gestión de Clientes (Admin)
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const { requireAuth, requireAdmin } = require('../middleware/auth');
const {
  createUser,
  createCliente,
  getAllClientes,
  getClienteByUsuarioId,
  getUserById
} = require('../database/db');
const { getDatabase } = require('../database/init');

/**
 * GET /api/clientes
 * Lista todos los clientes (solo admin)
 */
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const clientes = getAllClientes();

    res.json({
      success: true,
      clientes: clientes.map(c => ({
        id: c.id,
        usuarioId: c.usuario_id,
        nombre: c.nombre,
        email: c.email,
        empresa: c.empresa,
        telefono: c.telefono,
        plan: c.plan,
        activo: c.activo === 1,
        numSitios: c.num_sitios,
        fechaCreacion: c.fecha_creacion
      }))
    });

  } catch (error) {
    console.error('Error listando clientes:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/clientes/:id
 * Obtiene un cliente específico (solo admin)
 */
router.get('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = getDatabase();
    const cliente = db.prepare(`
      SELECT c.*, u.email, u.nombre, u.activo, u.fecha_creacion, u.ultimo_acceso
      FROM clientes c
      JOIN usuarios u ON c.usuario_id = u.id
      WHERE c.id = ?
    `).get(req.params.id);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    res.json({
      success: true,
      cliente: {
        id: cliente.id,
        usuarioId: cliente.usuario_id,
        nombre: cliente.nombre,
        email: cliente.email,
        empresa: cliente.empresa,
        telefono: cliente.telefono,
        plan: cliente.plan,
        activo: cliente.activo === 1,
        fechaCreacion: cliente.fecha_creacion,
        ultimoAcceso: cliente.ultimo_acceso,
        llamadasClaudeHoy: cliente.llamadas_claude_hoy
      }
    });

  } catch (error) {
    console.error('Error obteniendo cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/clientes
 * Crea un nuevo cliente (solo admin)
 */
router.post('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { nombre, email, empresa, telefono, plan } = req.body;

    // Validaciones
    if (!nombre || !email) {
      return res.status(400).json({ error: 'Nombre y email son requeridos' });
    }

    // Validar formato de email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: 'Formato de email inválido' });
    }

    // Generar contraseña temporal
    const passwordTemporal = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(passwordTemporal, 10);

    // Crear usuario
    const usuarioId = createUser({
      email: email.toLowerCase().trim(),
      passwordHash,
      nombre: nombre.trim(),
      rol: 'cliente'
    });

    // Crear cliente
    const clienteId = createCliente({
      usuarioId,
      telefono: telefono?.trim() || null,
      empresa: empresa?.trim() || null,
      plan: plan || 'basic'
    });

    res.status(201).json({
      success: true,
      cliente: {
        id: clienteId,
        usuarioId,
        nombre,
        email: email.toLowerCase().trim()
      },
      credenciales: {
        email: email.toLowerCase().trim(),
        passwordTemporal,
        mensaje: 'El cliente debe cambiar su contraseña en el primer acceso'
      }
    });

  } catch (error) {
    console.error('Error creando cliente:', error);

    if (error.message?.includes('UNIQUE constraint')) {
      return res.status(400).json({ error: 'Ya existe un usuario con ese email' });
    }

    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * PUT /api/clientes/:id
 * Actualiza un cliente (solo admin)
 */
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { nombre, empresa, telefono, plan, activo } = req.body;
    const clienteId = req.params.id;

    const db = getDatabase();

    // Obtener cliente actual
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(clienteId);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Actualizar cliente
    db.prepare(`
      UPDATE clientes SET empresa = ?, telefono = ?, plan = ? WHERE id = ?
    `).run(
      empresa?.trim() || cliente.empresa,
      telefono?.trim() || cliente.telefono,
      plan || cliente.plan,
      clienteId
    );

    // Actualizar usuario si hay cambios
    if (nombre !== undefined || activo !== undefined) {
      const updates = [];
      const values = [];

      if (nombre) {
        updates.push('nombre = ?');
        values.push(nombre.trim());
      }

      if (activo !== undefined) {
        updates.push('activo = ?');
        values.push(activo ? 1 : 0);
      }

      if (updates.length > 0) {
        values.push(cliente.usuario_id);
        db.prepare(`UPDATE usuarios SET ${updates.join(', ')} WHERE id = ?`).run(...values);
      }
    }

    res.json({
      success: true,
      message: 'Cliente actualizado correctamente'
    });

  } catch (error) {
    console.error('Error actualizando cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * DELETE /api/clientes/:id
 * Elimina un cliente (solo admin)
 */
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const clienteId = req.params.id;
    const db = getDatabase();

    // Obtener cliente
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(clienteId);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Eliminar usuario (cascade eliminará cliente y sitios por FK)
    db.prepare('DELETE FROM usuarios WHERE id = ?').run(cliente.usuario_id);

    res.json({
      success: true,
      message: 'Cliente eliminado correctamente'
    });

  } catch (error) {
    console.error('Error eliminando cliente:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/clientes/:id/reset-password
 * Resetea la contraseña de un cliente (solo admin)
 */
router.post('/:id/reset-password', requireAuth, requireAdmin, async (req, res) => {
  try {
    const clienteId = req.params.id;
    const db = getDatabase();

    // Obtener cliente
    const cliente = db.prepare('SELECT * FROM clientes WHERE id = ?').get(clienteId);

    if (!cliente) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }

    // Generar nueva contraseña
    const nuevaPassword = generarPasswordTemporal();
    const passwordHash = await bcrypt.hash(nuevaPassword, 10);

    // Actualizar contraseña
    db.prepare(`
      UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 1 WHERE id = ?
    `).run(passwordHash, cliente.usuario_id);

    res.json({
      success: true,
      credenciales: {
        passwordTemporal: nuevaPassword,
        mensaje: 'El cliente debe cambiar su contraseña en el próximo acceso'
      }
    });

  } catch (error) {
    console.error('Error reseteando contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * Genera una contraseña temporal segura
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
