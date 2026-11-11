-- ============================================================
-- MIGRACIÓN: Módulo de Tickets y Comunicaciones
-- Base destino : al2  (host: 50.28.103.119 / 192.168.40.62)
-- Ejecutar     : una sola vez, desde Workbench o CLI
-- Seguro       : usa CREATE TABLE IF NOT EXISTS e INSERT IGNORE
--                — no toca ninguna tabla existente
-- ============================================================

USE al2;

-- Desactiva FK temporalmente para que el orden no importe
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. TIPOS DE REPORTE
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `report_types` (
  `id_type`          varchar(36)  NOT NULL DEFAULT (UUID()),
  `nombre`           varchar(100) NOT NULL,
  `slug`             varchar(50)  NOT NULL,
  `descripcion`      varchar(300) DEFAULT NULL,
  `template_fields`  json         DEFAULT NULL,
  `required_fields`  json         DEFAULT NULL,
  `roles_permitidos` json         DEFAULT NULL,
  `activo`           tinyint(1)   NOT NULL DEFAULT 1,
  `created_at`       timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_type`),
  UNIQUE KEY `slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- 2. REPORTES / TICKETS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reports` (
  `id_report`            varchar(36)  NOT NULL DEFAULT (UUID()),
  `numero_ticket`        bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_type`              varchar(36)  NOT NULL,
  `titulo`               varchar(200) NOT NULL,
  `descripcion`          text,
  `status`               enum('borrador','enviado','en_revision','aprobado','negado','resuelto','cerrado')
                                       NOT NULL DEFAULT 'borrador',
  `prioridad`            enum('baja','media','alta','critica')
                                       NOT NULL DEFAULT 'media',
  `id_autor`             int unsigned NOT NULL,
  `id_responsable`       int unsigned DEFAULT NULL,
  `id_warehouse`         varchar(36)  DEFAULT NULL,
  `visibilidad_usuarios` json         DEFAULT NULL,
  `es_publico`           tinyint(1)   NOT NULL DEFAULT 0,
  `fecha_hecho`          date         DEFAULT NULL,
  `fecha_limite`         date         DEFAULT NULL,
  `ubicacion`            varchar(200) DEFAULT NULL,
  `extra_data`           json         DEFAULT NULL,
  `created_at`           timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`           timestamp    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_report`),
  UNIQUE KEY `uq_reports_numero_ticket` (`numero_ticket`),
  KEY `idx_reports_status`    (`status`),
  KEY `idx_reports_autor`     (`id_autor`),
  KEY `idx_reports_responsable` (`id_responsable`),
  CONSTRAINT `fk_report_type`        FOREIGN KEY (`id_type`)        REFERENCES `report_types` (`id_type`),
  CONSTRAINT `fk_report_autor`       FOREIGN KEY (`id_autor`)       REFERENCES `users`        (`id_user`),
  CONSTRAINT `fk_report_responsable` FOREIGN KEY (`id_responsable`) REFERENCES `users`        (`id_user`)       ON DELETE SET NULL,
  CONSTRAINT `fk_report_warehouse`   FOREIGN KEY (`id_warehouse`)   REFERENCES `warehouses`   (`id_warehouse`)  ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- 3. NOTIFICACIONES INTERNAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id_notif`   varchar(36)  NOT NULL DEFAULT (UUID()),
  `id_usuario` int unsigned NOT NULL,
  `id_report`  varchar(36)  NOT NULL,
  `tipo`       varchar(50)  NOT NULL
                 COMMENT 'ticket_creado | asignacion | comentario_nuevo | cambio_estado | sistema',
  `mensaje`    varchar(500) NOT NULL,
  `leido`      tinyint(1)   NOT NULL DEFAULT 0,
  `created_at` timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_notif`),
  KEY `idx_notif_usuario_leido` (`id_usuario`, `leido`, `created_at`),
  KEY `idx_notif_report`        (`id_report`),
  CONSTRAINT `fk_notif_usuario` FOREIGN KEY (`id_usuario`) REFERENCES `users`   (`id_user`)   ON DELETE CASCADE,
  CONSTRAINT `fk_notif_report`  FOREIGN KEY (`id_report`)  REFERENCES `reports` (`id_report`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- 4. COMENTARIOS Y RESOLUCIONES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `report_comments` (
  `id_comment`    varchar(36)  NOT NULL DEFAULT (UUID()),
  `id_report`     varchar(36)  NOT NULL,
  `id_autor`      int unsigned NOT NULL,
  `contenido`     text         NOT NULL,
  `es_resolucion` tinyint(1)   NOT NULL DEFAULT 0,
  `created_at`    timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_comment`),
  KEY `idx_comments_report` (`id_report`),
  CONSTRAINT `fk_comment_report` FOREIGN KEY (`id_report`) REFERENCES `reports` (`id_report`) ON DELETE CASCADE,
  CONSTRAINT `fk_comment_autor`  FOREIGN KEY (`id_autor`)  REFERENCES `users`   (`id_user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- 5. ADJUNTOS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `attachments` (
  `id_attachment`  varchar(36)  NOT NULL DEFAULT (UUID()),
  `id_report`      varchar(36)  NOT NULL,
  `nombre_archivo` varchar(255) NOT NULL,
  `url_archivo`    varchar(500) NOT NULL,
  `tipo_mime`      varchar(100) DEFAULT NULL,
  `id_subido_por`  int unsigned NOT NULL,
  `created_at`     timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_attachment`),
  CONSTRAINT `fk_attach_report` FOREIGN KEY (`id_report`)     REFERENCES `reports` (`id_report`) ON DELETE CASCADE,
  CONSTRAINT `fk_attach_user`   FOREIGN KEY (`id_subido_por`) REFERENCES `users`   (`id_user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- 6. TAREAS DERIVADAS DE TICKETS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `tasks` (
  `id_task`      varchar(36)  NOT NULL DEFAULT (UUID()),
  `id_report`    varchar(36)  NOT NULL,
  `titulo`       varchar(200) NOT NULL,
  `descripcion`  text,
  `id_asignado`  int unsigned DEFAULT NULL,
  `status`       enum('pendiente','en_progreso','hecha') NOT NULL DEFAULT 'pendiente',
  `fecha_limite` date         DEFAULT NULL,
  `created_at`   timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   timestamp    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_task`),
  CONSTRAINT `fk_task_report`   FOREIGN KEY (`id_report`)   REFERENCES `reports` (`id_report`) ON DELETE CASCADE,
  CONSTRAINT `fk_task_asignado` FOREIGN KEY (`id_asignado`) REFERENCES `users`   (`id_user`)   ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- 7. AUDITORÍA
-- ------------------------------------------------------------
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

-- ------------------------------------------------------------
-- 8. REGISTRAR EL MÓDULO EN EL SISTEMA DE PERMISOS
--    INSERT IGNORE: si ya existe no falla
-- ------------------------------------------------------------
INSERT IGNORE INTO `modules` (`module_key`, `module_name`, `parent_key`, `sort_order`, `status`)
VALUES
  ('tickets',           'Tickets y Comunicaciones', NULL,       20, 1),
  ('tickets.ver',       'Ver tickets',              'tickets',  1,  1),
  ('tickets.crear',     'Crear tickets',            'tickets',  2,  1),
  ('tickets.gestionar', 'Gestionar tickets',        'tickets',  3,  1);

-- ------------------------------------------------------------
-- 9. TIPOS DE TICKET BASE (3 plantillas)
-- ------------------------------------------------------------
INSERT IGNORE INTO `report_types`
  (`id_type`, `nombre`, `slug`, `descripcion`, `template_fields`, `required_fields`, `roles_permitidos`)
VALUES
(
  'type-001', 'Aviso de Evento', 'aviso_evento',
  'Comunicar eventos, reuniones o anuncios',
  '[{"name":"fecha_evento","label":"Fecha del evento","type":"date","required":true},{"name":"lugar","label":"Lugar","type":"text","required":true}]',
  '["titulo","descripcion","fecha_hecho"]',
  NULL
),
(
  'type-002', 'Solicitud / Decisión', 'solicitud_decision',
  'Solicitudes que requieren aprobación o decisión',
  '[{"name":"tipo_solicitud","label":"Tipo de solicitud","type":"select","options":["Aprobación","Consulta","Autorización","Otro"],"required":true}]',
  '["titulo","descripcion","prioridad"]',
  NULL
),
(
  'type-003', 'Reporte Operativo', 'reporte_operativo',
  'Incidentes, novedades o situaciones del día a día',
  '[{"name":"categoria","label":"Categoría","type":"select","options":["Incidente","Novedad","Mantenimiento","Otro"],"required":true},{"name":"area_afectada","label":"Área afectada","type":"text","required":true}]',
  '["titulo","descripcion","fecha_hecho","prioridad"]',
  NULL
);

-- Reactiva FK
SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- VERIFICACIÓN FINAL
-- Debe mostrar las 7 tablas nuevas
-- ------------------------------------------------------------
SELECT table_name, table_rows
FROM information_schema.tables
WHERE table_schema = 'al2'
  AND table_name IN (
    'report_types','reports','notifications',
    'report_comments','attachments','tasks','audit_events'
  )
ORDER BY table_name;
