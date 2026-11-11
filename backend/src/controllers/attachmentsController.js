const fs = require('node:fs/promises');
const path = require('node:path');
const { v4: uuidv4 } = require('uuid');
const pool = require('../config/db');
const { detectarTipoImagen } = require('../services/imageTypes');
const { uploadsDirectory, getStoredFilePath } = require('../services/attachmentStorage');

const MAX_IMAGES_PER_REPORT = 5;

const subir = async (req, res) => {
  const archivos = req.files || [];
  if (archivos.length === 0) {
    return res.status(400).json({ error: 'Selecciona al menos una imagen' });
  }

  const archivosValidados = archivos.map(archivo => ({
    archivo,
    tipo: detectarTipoImagen(archivo.buffer)
  }));
  if (archivosValidados.some(item => !item.tipo)) {
    return res.status(400).json({ error: 'Solo se permiten imágenes PNG, JPEG o WebP válidas' });
  }

  const conn = await pool.getConnection();
  const archivosGuardados = [];
  try {
    await conn.beginTransaction();
    await conn.execute(
      'SELECT id_report FROM reports WHERE id_report = ? FOR UPDATE',
      [req.params.id]
    );
    const [countRows] = await conn.execute(
      'SELECT COUNT(*) AS total FROM attachments WHERE id_report = ?',
      [req.params.id]
    );
    if (Number(countRows[0].total) + archivos.length > MAX_IMAGES_PER_REPORT) {
      await conn.rollback();
      return res.status(400).json({ error: 'Cada reporte admite hasta 5 imágenes' });
    }

    await fs.mkdir(uploadsDirectory, { recursive: true });
    const adjuntos = [];
    for (const { archivo, tipo } of archivosValidados) {
      const id_attachment = uuidv4();
      const nombreGuardado = `${id_attachment}.${tipo.extension}`;
      const rutaGuardado = path.join(uploadsDirectory, nombreGuardado);
      const nombreOriginal = path.basename(archivo.originalname)
        .replace(/[\\/\u0000-\u001f]/g, '_')
        .slice(0, 255) || `imagen.${tipo.extension}`;

      await fs.writeFile(rutaGuardado, archivo.buffer, { flag: 'wx' });
      archivosGuardados.push(rutaGuardado);
      await conn.execute(
        `INSERT INTO attachments
           (id_attachment, id_report, nombre_archivo, url_archivo, tipo_mime, id_subido_por)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id_attachment, req.params.id, nombreOriginal, nombreGuardado, tipo.mime, req.usuario.id_usuario]
      );
      adjuntos.push({
        id_attachment,
        nombre_archivo: nombreOriginal,
        tipo_mime: tipo.mime
      });
    }

    await conn.commit();
    return res.status(201).json({ adjuntos });
  } catch (err) {
    await conn.rollback();
    await Promise.all(archivosGuardados.map(ruta => fs.unlink(ruta).catch(unlinkError => {
      if (unlinkError.code !== 'ENOENT') {
        console.error('Error al limpiar imagen no guardada:', unlinkError.message);
      }
    })));
    console.error('Error al guardar imágenes del reporte:', err);
    return res.status(500).json({ error: 'No se pudieron guardar las imágenes' });
  } finally {
    conn.release();
  }
};

const descargar = async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `SELECT nombre_archivo, url_archivo, tipo_mime
       FROM attachments
       WHERE id_attachment = ? AND id_report = ?`,
      [req.params.attachmentId, req.params.id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    const ruta = getStoredFilePath(rows[0].url_archivo);
    if (!ruta) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(rows[0].tipo_mime)) {
      return res.status(404).json({ error: 'Imagen no encontrada' });
    }

    res.setHeader('Content-Type', rows[0].tipo_mime);
    res.setHeader('Content-Disposition', 'inline');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    return res.sendFile(ruta, err => {
      if (err) {
        if (err.code === 'ENOENT' && !res.headersSent) {
          res.status(404).json({ error: 'El archivo de imagen no está disponible' });
        } else if (res.headersSent) {
          console.error('Error al enviar imagen del reporte:', err.message);
        } else {
          console.error('Error al enviar imagen del reporte:', err);
          res.status(500).json({ error: 'No se pudo obtener la imagen' });
        }
      }
    });
  } catch (err) {
    console.error('Error al consultar imagen del reporte:', err);
    return res.status(500).json({ error: 'No se pudo obtener la imagen' });
  }
};

module.exports = { subir, descargar };
