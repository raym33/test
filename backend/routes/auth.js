/**
 * Rutas de Autenticación
 */

const express = require('express');
const bcrypt = require('bcryptjs');
const router = express.Router();

const { generateToken, requireAuth } = require('../middleware/auth');
const {
  getUserByEmail,
  updateUserPassword,
  updateUserLastAccess,
  getClienteByUsuarioId
} = require('../database/db');

/**
 * POST /api/auth/login
 * Iniciar sesión
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validar campos
    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña son requeridos' });
    }

    // Buscar usuario
    const user = await getUserByEmail(email.toLowerCase().trim());

    if (!user) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Verificar si está activo
    if (!user.activo) {
      return res.status(401).json({ error: 'Cuenta desactivada. Contacta al administrador.' });
    }

    // Verificar contraseña
    const validPassword = await bcrypt.compare(password, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales incorrectas' });
    }

    // Actualizar último acceso
    await updateUserLastAccess(user.id);

    // Generar token
    const token = generateToken(user);

    // Obtener datos adicionales si es cliente
    let clienteData = null;
    if (user.rol === 'cliente') {
      clienteData = await getClienteByUsuarioId(user.id);
    }

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        nombre: user.nombre,
        rol: user.rol,
        debeCambiarPassword: user.debe_cambiar_password === 1
      },
      cliente: clienteData
    });

  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/auth/cambiar-password
 * Cambiar contraseña (requiere autenticación)
 */
router.post('/cambiar-password', requireAuth, async (req, res) => {
  try {
    const { passwordActual, passwordNueva } = req.body;

    // Validar campos
    if (!passwordActual || !passwordNueva) {
      return res.status(400).json({ error: 'Contraseña actual y nueva son requeridas' });
    }

    // Validar longitud mínima
    if (passwordNueva.length < 8) {
      return res.status(400).json({ error: 'La nueva contraseña debe tener al menos 8 caracteres' });
    }

    // Obtener usuario actual
    const user = await getUserByEmail(req.user.email);

    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Verificar contraseña actual
    const validPassword = await bcrypt.compare(passwordActual, user.password_hash);

    if (!validPassword) {
      return res.status(401).json({ error: 'Contraseña actual incorrecta' });
    }

    // Hash de la nueva contraseña
    const newPasswordHash = await bcrypt.hash(passwordNueva, 10);

    // Actualizar contraseña
    await updateUserPassword(user.id, newPasswordHash);

    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente'
    });

  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * GET /api/auth/me
 * Obtener datos del usuario actual
 */
router.get('/me', requireAuth, async (req, res) => {
  try {
    let clienteData = null;

    if (req.user.rol === 'cliente') {
      clienteData = await getClienteByUsuarioId(req.user.id);
    }

    res.json({
      user: req.user,
      cliente: clienteData
    });

  } catch (error) {
    console.error('Error al obtener usuario:', error);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

/**
 * POST /api/auth/logout
 * Cerrar sesión (el token se invalida del lado del cliente)
 */
router.post('/logout', requireAuth, (req, res) => {
  // En una implementación más avanzada, se podría añadir el token a una blacklist
  res.json({
    success: true,
    message: 'Sesión cerrada correctamente'
  });
});

module.exports = router;
