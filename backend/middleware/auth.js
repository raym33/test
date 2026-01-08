/**
 * Middleware de Autenticación JWT
 */

const jwt = require('jsonwebtoken');
const { getUserById, getClienteByUsuarioId } = require('../database/db');

const JWT_SECRET = process.env.JWT_SECRET || 'desarrollo_secreto_cambiar_en_produccion';

/**
 * Genera un token JWT
 */
function generateToken(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      rol: user.rol
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

/**
 * Verifica un token JWT
 */
function verifyToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

/**
 * Middleware: Requiere autenticación
 */
function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token de autenticación requerido' });
  }

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);

  if (!decoded) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }

  // Obtener usuario actualizado de la base de datos
  const user = getUserById(decoded.id);

  if (!user || !user.activo) {
    return res.status(401).json({ error: 'Usuario no encontrado o inactivo' });
  }

  // Añadir usuario al request
  req.user = {
    id: user.id,
    email: user.email,
    nombre: user.nombre,
    rol: user.rol,
    debeCambiarPassword: user.debe_cambiar_password === 1
  };

  // Si es cliente, añadir datos del cliente
  if (user.rol === 'cliente') {
    const cliente = getClienteByUsuarioId(user.id);
    if (cliente) {
      req.cliente = cliente;
    }
  }

  next();
}

/**
 * Middleware: Requiere rol de admin
 */
function requireAdmin(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'No autenticado' });
  }

  if (req.user.rol !== 'admin') {
    return res.status(403).json({ error: 'Acceso denegado. Se requiere rol de administrador.' });
  }

  next();
}

/**
 * Middleware: Requiere que el usuario tenga acceso al sitio
 */
function requireSiteAccess(req, res, next) {
  const sitioId = parseInt(req.params.sitioId || req.params.id);

  if (!sitioId) {
    return res.status(400).json({ error: 'ID de sitio requerido' });
  }

  // Admin tiene acceso a todo
  if (req.user.rol === 'admin') {
    return next();
  }

  // Cliente solo tiene acceso a sus propios sitios
  if (req.cliente) {
    const { getSitioById } = require('../database/db');
    const sitio = getSitioById(sitioId);

    if (!sitio || sitio.cliente_id !== req.cliente.id) {
      return res.status(403).json({ error: 'No tienes acceso a este sitio' });
    }
  }

  next();
}

/**
 * Middleware: Autenticación opcional (para rutas públicas con funcionalidad extra para usuarios autenticados)
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);

    if (decoded) {
      const user = getUserById(decoded.id);
      if (user && user.activo) {
        req.user = {
          id: user.id,
          email: user.email,
          nombre: user.nombre,
          rol: user.rol
        };

        if (user.rol === 'cliente') {
          const cliente = getClienteByUsuarioId(user.id);
          if (cliente) {
            req.cliente = cliente;
          }
        }
      }
    }
  }

  next();
}

module.exports = {
  generateToken,
  verifyToken,
  requireAuth,
  requireAdmin,
  requireSiteAccess,
  optionalAuth,
  JWT_SECRET
};
