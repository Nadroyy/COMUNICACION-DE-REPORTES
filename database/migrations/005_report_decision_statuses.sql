-- Ejecutar sobre la base configurada como DB_NAME en el backend.
-- Las instalaciones nuevas ya incluyen estos estados en schema.sql.

ALTER TABLE `reports`
  MODIFY COLUMN `status`
    ENUM('borrador','enviado','en_revision','aprobado','negado','resuelto','cerrado')
    NOT NULL DEFAULT 'borrador';