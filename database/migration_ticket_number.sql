-- Asigna un consecutivo permanente a los tickets existentes y nuevos.
-- Ejecutar una sola vez sobre la base de datos de reportes antes de desplegar
-- una versión del backend que use numero_ticket.
ALTER TABLE reports
  ADD COLUMN numero_ticket BIGINT UNSIGNED NULL AFTER id_report;

SET @numero_ticket := 0;

UPDATE reports
SET numero_ticket = (@numero_ticket := @numero_ticket + 1)
ORDER BY created_at ASC, id_report ASC;

ALTER TABLE reports
  MODIFY COLUMN numero_ticket BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  ADD UNIQUE KEY uq_reports_numero_ticket (numero_ticket);
