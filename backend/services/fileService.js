/**
 * Servicio de Gestión de Archivos
 * Maneja la creación de sitios, guardado de HTML e imágenes
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const sharp = require('sharp');

const SITES_ROOT = process.env.SITES_ROOT || './sites';
const UPLOADS_ROOT = './uploads';

/**
 * Asegura que un directorio existe
 */
async function ensureDir(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') throw error;
  }
}

/**
 * Genera un nombre único para archivos
 */
function generarNombreUnico(nombreOriginal) {
  const ext = path.extname(nombreOriginal);
  const base = path.basename(nombreOriginal, ext)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .substring(0, 30);
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 8);
  return `${base}-${timestamp}-${random}${ext}`;
}

/**
 * Crea la estructura de directorios para un nuevo sitio
 */
async function crearEstructuraSitio(identificador) {
  const sitePath = path.join(SITES_ROOT, identificador);

  await ensureDir(path.join(sitePath, 'public'));
  await ensureDir(path.join(sitePath, 'uploads'));
  await ensureDir(path.join(sitePath, 'backups'));

  return sitePath;
}

/**
 * Guarda el HTML de un sitio
 */
async function guardarHTML(sitePath, html, archivo = 'index.html') {
  const publicPath = path.join(sitePath, 'public');
  await ensureDir(publicPath);

  const filePath = path.join(publicPath, archivo);

  // Crear backup si existe
  if (fsSync.existsSync(filePath)) {
    const backupDir = path.join(sitePath, 'backups');
    await ensureDir(backupDir);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(backupDir, `${archivo}.${timestamp}.bak`);
    await fs.copyFile(filePath, backupPath);
  }

  await fs.writeFile(filePath, html, 'utf-8');

  return filePath;
}

/**
 * Lee el HTML de un sitio
 */
async function leerHTML(sitePath, archivo = 'index.html') {
  const filePath = path.join(sitePath, 'public', archivo);

  try {
    return await fs.readFile(filePath, 'utf-8');
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

/**
 * Procesa y guarda una imagen
 * Optimiza el tamaño y formato
 */
async function guardarImagen(sitePath, buffer, nombreOriginal) {
  const uploadsPath = path.join(sitePath, 'uploads');
  await ensureDir(uploadsPath);

  const nombreGuardado = generarNombreUnico(nombreOriginal);
  const filePath = path.join(uploadsPath, nombreGuardado);

  try {
    // Procesar imagen con Sharp
    const imagen = sharp(buffer);
    const metadata = await imagen.metadata();

    // Redimensionar si es muy grande (max 1920px de ancho)
    if (metadata.width > 1920) {
      await imagen
        .resize(1920, null, { withoutEnlargement: true })
        .jpeg({ quality: 85 })
        .toFile(filePath);
    } else {
      // Solo optimizar
      await imagen
        .jpeg({ quality: 85 })
        .toFile(filePath);
    }

    // Obtener tamaño final
    const stats = await fs.stat(filePath);

    return {
      nombreOriginal,
      nombreGuardado,
      ruta: `/uploads/${nombreGuardado}`,
      rutaRelativa: `uploads/${nombreGuardado}`,
      tamaño: stats.size,
      tipo: 'image/jpeg'
    };

  } catch (error) {
    console.error('Error procesando imagen:', error);

    // Si falla el procesamiento, guardar original
    await fs.writeFile(filePath, buffer);

    return {
      nombreOriginal,
      nombreGuardado,
      ruta: `/uploads/${nombreGuardado}`,
      rutaRelativa: `uploads/${nombreGuardado}`,
      tamaño: buffer.length,
      tipo: 'image/unknown'
    };
  }
}

/**
 * Lista los backups de un sitio
 */
async function listarBackups(sitePath) {
  const backupDir = path.join(sitePath, 'backups');

  try {
    const archivos = await fs.readdir(backupDir);
    const backups = [];

    for (const archivo of archivos) {
      const stats = await fs.stat(path.join(backupDir, archivo));
      backups.push({
        nombre: archivo,
        fecha: stats.mtime,
        tamaño: stats.size
      });
    }

    return backups.sort((a, b) => b.fecha - a.fecha);

  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * Restaura un backup
 */
async function restaurarBackup(sitePath, nombreBackup) {
  const backupPath = path.join(sitePath, 'backups', nombreBackup);
  const targetPath = path.join(sitePath, 'public', 'index.html');

  // Verificar que el backup existe
  if (!fsSync.existsSync(backupPath)) {
    throw new Error('Backup no encontrado');
  }

  // Crear backup del actual antes de restaurar
  if (fsSync.existsSync(targetPath)) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const preRestoreBackup = path.join(sitePath, 'backups', `index.html.pre-restore-${timestamp}.bak`);
    await fs.copyFile(targetPath, preRestoreBackup);
  }

  // Restaurar
  await fs.copyFile(backupPath, targetPath);

  return { success: true, message: 'Backup restaurado correctamente' };
}

/**
 * Elimina un sitio completo
 */
async function eliminarSitio(sitePath) {
  try {
    await fs.rm(sitePath, { recursive: true, force: true });
    return { success: true };
  } catch (error) {
    console.error('Error eliminando sitio:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Lista las imágenes de un sitio
 */
async function listarImagenes(sitePath) {
  const uploadsPath = path.join(sitePath, 'uploads');

  try {
    const archivos = await fs.readdir(uploadsPath);
    const imagenes = [];

    for (const archivo of archivos) {
      if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(archivo)) {
        const stats = await fs.stat(path.join(uploadsPath, archivo));
        imagenes.push({
          nombre: archivo,
          ruta: `/uploads/${archivo}`,
          fecha: stats.mtime,
          tamaño: stats.size
        });
      }
    }

    return imagenes.sort((a, b) => b.fecha - a.fecha);

  } catch (error) {
    if (error.code === 'ENOENT') return [];
    throw error;
  }
}

/**
 * Obtiene el tamaño total de un sitio
 */
async function obtenerTamañoSitio(sitePath) {
  let totalSize = 0;

  async function calcularTamaño(dirPath) {
    try {
      const items = await fs.readdir(dirPath, { withFileTypes: true });

      for (const item of items) {
        const itemPath = path.join(dirPath, item.name);

        if (item.isDirectory()) {
          await calcularTamaño(itemPath);
        } else {
          const stats = await fs.stat(itemPath);
          totalSize += stats.size;
        }
      }
    } catch (error) {
      // Ignorar errores de acceso
    }
  }

  await calcularTamaño(sitePath);

  return {
    bytes: totalSize,
    kb: Math.round(totalSize / 1024),
    mb: Math.round(totalSize / 1024 / 1024 * 100) / 100
  };
}

module.exports = {
  ensureDir,
  generarNombreUnico,
  crearEstructuraSitio,
  guardarHTML,
  leerHTML,
  guardarImagen,
  listarBackups,
  restaurarBackup,
  eliminarSitio,
  listarImagenes,
  obtenerTamañoSitio,
  SITES_ROOT
};
