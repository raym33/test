/**
 * Funciones de acceso a la base de datos (sql.js)
 */

const { getDatabase, saveDatabase } = require('./init');

// Helper para ejecutar queries
async function runQuery(sql, params = []) {
  const db = await getDatabase();
  db.run(sql, params);
  saveDatabase();
}

async function getOne(sql, params = []) {
  const db = await getDatabase();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const row = stmt.getAsObject();
    stmt.free();
    return row;
  }
  stmt.free();
  return null;
}

async function getAll(sql, params = []) {
  const db = await getDatabase();
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

async function insertAndGetId(sql, params = []) {
  const db = await getDatabase();
  db.run(sql, params);
  const result = db.exec("SELECT last_insert_rowid() as id");
  saveDatabase();
  return result[0]?.values[0]?.[0];
}

// ============================================
// USUARIOS
// ============================================

async function getUserByEmail(email) {
  return await getOne('SELECT * FROM usuarios WHERE email = ?', [email]);
}

async function getUserById(id) {
  return await getOne('SELECT * FROM usuarios WHERE id = ?', [id]);
}

async function createUser({ email, passwordHash, nombre, rol }) {
  return await insertAndGetId(`
    INSERT INTO usuarios (email, password_hash, nombre, rol)
    VALUES (?, ?, ?, ?)
  `, [email, passwordHash, nombre, rol]);
}

async function updateUserPassword(userId, passwordHash) {
  await runQuery(`
    UPDATE usuarios SET password_hash = ?, debe_cambiar_password = 0 WHERE id = ?
  `, [passwordHash, userId]);
}

async function updateUserLastAccess(userId) {
  await runQuery(`
    UPDATE usuarios SET ultimo_acceso = datetime('now') WHERE id = ?
  `, [userId]);
}

// ============================================
// CLIENTES
// ============================================

async function createCliente({ usuarioId, telefono, empresa, plan }) {
  return await insertAndGetId(`
    INSERT INTO clientes (usuario_id, telefono, empresa, plan)
    VALUES (?, ?, ?, ?)
  `, [usuarioId, telefono, empresa, plan || 'basic']);
}

async function getClienteByUsuarioId(usuarioId) {
  return await getOne(`
    SELECT c.*, u.email, u.nombre, u.activo
    FROM clientes c
    JOIN usuarios u ON c.usuario_id = u.id
    WHERE c.usuario_id = ?
  `, [usuarioId]);
}

async function getAllClientes() {
  return await getAll(`
    SELECT c.*, u.email, u.nombre, u.activo, u.fecha_creacion,
           (SELECT COUNT(*) FROM sitios WHERE cliente_id = c.id) as num_sitios
    FROM clientes c
    JOIN usuarios u ON c.usuario_id = u.id
    ORDER BY u.fecha_creacion DESC
  `);
}

async function updateClienteClaudeCalls(clienteId) {
  const today = new Date().toISOString().split('T')[0];

  const cliente = await getOne('SELECT ultima_llamada_claude FROM clientes WHERE id = ?', [clienteId]);

  if (cliente?.ultima_llamada_claude !== today) {
    await runQuery(`
      UPDATE clientes SET llamadas_claude_hoy = 1, ultima_llamada_claude = ? WHERE id = ?
    `, [today, clienteId]);
  } else {
    await runQuery(`
      UPDATE clientes SET llamadas_claude_hoy = llamadas_claude_hoy + 1 WHERE id = ?
    `, [clienteId]);
  }
}

async function getClienteClaudeCalls(clienteId) {
  const today = new Date().toISOString().split('T')[0];
  const cliente = await getOne('SELECT llamadas_claude_hoy, ultima_llamada_claude FROM clientes WHERE id = ?', [clienteId]);

  if (!cliente || cliente.ultima_llamada_claude !== today) {
    return 0;
  }
  return cliente.llamadas_claude_hoy;
}

// ============================================
// SITIOS
// ============================================

async function createSitio({ clienteId, nombre, dominio, subdominio, rutaArchivos, plantillaId, configuracion }) {
  return await insertAndGetId(`
    INSERT INTO sitios (cliente_id, nombre, dominio, subdominio, ruta_archivos, plantilla_id, configuracion)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [clienteId, nombre, dominio, subdominio, rutaArchivos, plantillaId, JSON.stringify(configuracion || {})]);
}

async function getSitioById(id) {
  return await getOne(`
    SELECT s.*, p.nombre as plantilla_nombre
    FROM sitios s
    LEFT JOIN plantillas p ON s.plantilla_id = p.id
    WHERE s.id = ?
  `, [id]);
}

async function getSitiosByClienteId(clienteId) {
  return await getAll(`
    SELECT s.*, p.nombre as plantilla_nombre
    FROM sitios s
    LEFT JOIN plantillas p ON s.plantilla_id = p.id
    WHERE s.cliente_id = ?
    ORDER BY s.fecha_creacion DESC
  `, [clienteId]);
}

async function getAllSitios() {
  return await getAll(`
    SELECT s.*, p.nombre as plantilla_nombre, u.nombre as cliente_nombre, u.email as cliente_email
    FROM sitios s
    LEFT JOIN plantillas p ON s.plantilla_id = p.id
    LEFT JOIN clientes c ON s.cliente_id = c.id
    LEFT JOIN usuarios u ON c.usuario_id = u.id
    ORDER BY s.fecha_creacion DESC
  `);
}

async function updateSitio(id, updates) {
  const fields = [];
  const values = [];

  for (const [key, value] of Object.entries(updates)) {
    fields.push(`${key} = ?`);
    values.push(value);
  }

  fields.push("fecha_modificacion = datetime('now')");
  values.push(id);

  await runQuery(`UPDATE sitios SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function deleteSitio(id) {
  await runQuery('DELETE FROM sitios WHERE id = ?', [id]);
}

// ============================================
// PLANTILLAS
// ============================================

async function getAllPlantillas() {
  return await getAll('SELECT * FROM plantillas WHERE activa = 1 ORDER BY orden');
}

async function getPlantillaById(id) {
  return await getOne('SELECT * FROM plantillas WHERE id = ?', [id]);
}

// ============================================
// SECCIONES
// ============================================

async function createSeccion({ sitioId, nombre, tipo, contenido, orden }) {
  return await insertAndGetId(`
    INSERT INTO secciones (sitio_id, nombre, tipo, contenido, orden)
    VALUES (?, ?, ?, ?, ?)
  `, [sitioId, nombre, tipo, JSON.stringify(contenido), orden]);
}

async function getSeccionesBySitioId(sitioId) {
  return await getAll('SELECT * FROM secciones WHERE sitio_id = ? ORDER BY orden', [sitioId]);
}

async function updateSeccion(id, contenido) {
  await runQuery('UPDATE secciones SET contenido = ? WHERE id = ?', [JSON.stringify(contenido), id]);
}

// ============================================
// HISTORIAL DE CAMBIOS
// ============================================

async function createCambioHistorial({ sitioId, usuarioId, tipo, seccion, contenidoAnterior, contenidoNuevo, promptUsado }) {
  return await insertAndGetId(`
    INSERT INTO cambios_historial (sitio_id, usuario_id, tipo, seccion, contenido_anterior, contenido_nuevo, prompt_usado)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [sitioId, usuarioId, tipo, seccion, contenidoAnterior, contenidoNuevo, promptUsado]);
}

async function getHistorialBySitioId(sitioId, limit = 50) {
  return await getAll(`
    SELECT h.*, u.nombre as usuario_nombre
    FROM cambios_historial h
    JOIN usuarios u ON h.usuario_id = u.id
    WHERE h.sitio_id = ?
    ORDER BY h.fecha DESC
    LIMIT ?
  `, [sitioId, limit]);
}

// ============================================
// ARCHIVOS
// ============================================

async function createArchivo({ sitioId, nombreOriginal, nombreGuardado, ruta, tipo, tamaño }) {
  return await insertAndGetId(`
    INSERT INTO archivos (sitio_id, nombre_original, nombre_guardado, ruta, tipo, tamaño)
    VALUES (?, ?, ?, ?, ?, ?)
  `, [sitioId, nombreOriginal, nombreGuardado, ruta, tipo, tamaño]);
}

async function getArchivosBySitioId(sitioId) {
  return await getAll('SELECT * FROM archivos WHERE sitio_id = ? ORDER BY fecha_subida DESC', [sitioId]);
}

// ============================================
// WIZARD SESIONES
// ============================================

async function createWizardSession(sessionId) {
  await runQuery(`
    INSERT INTO wizard_sesiones (session_id, datos)
    VALUES (?, ?)
  `, [sessionId, JSON.stringify({})]);
  return sessionId;
}

async function getWizardSession(sessionId) {
  return await getOne('SELECT * FROM wizard_sesiones WHERE session_id = ?', [sessionId]);
}

async function updateWizardSession(sessionId, updates) {
  const current = await getWizardSession(sessionId);
  if (!current) return null;

  const newData = { ...JSON.parse(current.datos || '{}'), ...updates.datos };

  await runQuery(`
    UPDATE wizard_sesiones
    SET paso_actual = ?, datos = ?, fecha_ultimo_paso = datetime('now')
    WHERE session_id = ?
  `, [updates.paso || current.paso_actual, JSON.stringify(newData), sessionId]);

  return await getWizardSession(sessionId);
}

async function completeWizardSession(sessionId, { sitioId, email }) {
  await runQuery(`
    UPDATE wizard_sesiones
    SET completado = 1, sitio_temporal_id = ?, email_contacto = ?
    WHERE session_id = ?
  `, [sitioId, email, sessionId]);
}

// ============================================
// ESTADÍSTICAS
// ============================================

async function getEstadisticasGenerales() {
  const db = await getDatabase();

  const totalSitios = db.exec('SELECT COUNT(*) as count FROM sitios WHERE activo = 1')[0]?.values[0]?.[0] || 0;
  const totalClientes = db.exec('SELECT COUNT(*) as count FROM clientes')[0]?.values[0]?.[0] || 0;

  const hoy = new Date().toISOString().split('T')[0];
  const visitasHoy = db.exec(`SELECT COALESCE(SUM(visitas), 0) as total FROM estadisticas WHERE fecha = '${hoy}'`)[0]?.values[0]?.[0] || 0;

  return {
    totalSitios,
    totalClientes,
    visitasHoy
  };
}

async function getEstadisticasSitio(sitioId, dias = 30) {
  return await getAll(`
    SELECT * FROM estadisticas
    WHERE sitio_id = ?
    AND fecha >= date('now', '-' || ? || ' days')
    ORDER BY fecha DESC
  `, [sitioId, dias]);
}

module.exports = {
  // Helpers exportados para uso directo
  runQuery,
  getOne,
  getAll,
  // Usuarios
  getUserByEmail,
  getUserById,
  createUser,
  updateUserPassword,
  updateUserLastAccess,
  // Clientes
  createCliente,
  getClienteByUsuarioId,
  getAllClientes,
  updateClienteClaudeCalls,
  getClienteClaudeCalls,
  // Sitios
  createSitio,
  getSitioById,
  getSitiosByClienteId,
  getAllSitios,
  updateSitio,
  deleteSitio,
  // Plantillas
  getAllPlantillas,
  getPlantillaById,
  // Secciones
  createSeccion,
  getSeccionesBySitioId,
  updateSeccion,
  // Historial
  createCambioHistorial,
  getHistorialBySitioId,
  // Archivos
  createArchivo,
  getArchivosBySitioId,
  // Wizard
  createWizardSession,
  getWizardSession,
  updateWizardSession,
  completeWizardSession,
  // Estadísticas
  getEstadisticasGenerales,
  getEstadisticasSitio
};
