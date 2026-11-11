-- ============================================================
-- PASO 3 — Auditoría y registro de permisos
-- Ejecutar DESPUÉS de verificar que los Pasos 1 y 2 funcionan
-- ============================================================

USE al2;
SET FOREIGN_KEY_CHECKS = 0;

-- 7. Auditoría (historial de cambios)
CREATE TABLE IF NOT EXISTS `audit_events` (
  `id_audit`     varchar(36)  NOT NULL DEFAULT (UUID()),
  `entidad_tipo` enum('report','task','comment') NOT NULL,
  `entidad_id`   varchar(36)  NOT NULL,
  `accion`       varchar(50)  NOT NULL,
  `id_usuario`   int unsigned DEFAULT NULL,
  `cambios`      json         DEFAULT NULL,
  `created_at`   timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_audit`),
  KEY `idx_audit_entidad` (`entidad_tipo`, `entidad_id`),
  CONSTRAINT `fk_audit_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `users` (`id_user`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Registrar el módulo en el sistema de permisos existente
-- INSERT IGNORE: no falla si ya existe
INSERT IGNORE INTO `modules` (`module_key`, `module_name`, `parent_key`, `sort_order`, `status`)
VALUES
  ('tickets',           'Tickets y Comunicaciones', NULL,      20, 1),
  ('tickets.ver',       'Ver tickets',          'tickets',     1,  1),
  ('tickets.crear',     'Crear tickets',        'tickets',     2,  1),
  ('tickets.gestionar', 'Gestionar tickets',    'tickets',     3,  1);

SET FOREIGN_KEY_CHECKS = 1;

-- Verificación final: las 7 tablas del módulo
SELECT table_name AS tabla, table_rows AS filas_aprox
FROM information_schema.tables
WHERE table_schema = 'al2'
  AND table_name IN (
    'report_types','reports','report_comments',
    'notifications','tasks','attachments','audit_events'
  )
ORDER BY table_name;
