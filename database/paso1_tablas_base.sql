-- ============================================================
-- PASO 1 — Crear base de datos y tablas base del módulo
-- Servidor: 192.168.40.62
-- ============================================================
-- Crea una base nueva llamada reportes completamente separada
-- de inventario_catalogo. No toca nada existente.
-- Las FK a users/warehouses van sin referencia cruzada porque
-- están en otra base — la integridad la maneja el backend.
-- ============================================================

-- Crear la base nueva
CREATE DATABASE IF NOT EXISTS reportes
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_0900_ai_ci;

USE reportes;
SET FOREIGN_KEY_CHECKS = 0;

-- ------------------------------------------------------------
-- 1. Tipos de ticket
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
-- 2. Tickets
-- Nota: id_autor, id_responsable, id_warehouse referencian
--       users/warehouses de inventario_catalogo — la validación
--       la hace el backend, no FK cruzada entre bases.
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
  KEY `idx_reports_status`      (`status`),
  KEY `idx_reports_autor`       (`id_autor`),
  KEY `idx_reports_responsable` (`id_responsable`),
  CONSTRAINT `fk_report_type` FOREIGN KEY (`id_type`) REFERENCES `report_types` (`id_type`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- 3. Comentarios
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
  CONSTRAINT `fk_comment_report` FOREIGN KEY (`id_report`)
    REFERENCES `reports` (`id_report`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- 4. Notificaciones internas
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id_notif`   varchar(36)  NOT NULL DEFAULT (UUID()),
  `id_usuario` int unsigned NOT NULL,
  `id_report`  varchar(36)  NOT NULL,
  `tipo`       varchar(50)  NOT NULL,
  `mensaje`    varchar(500) NOT NULL,
  `leido`      tinyint(1)   NOT NULL DEFAULT 0,
  `created_at` timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_notif`),
  KEY `idx_notif_usuario_leido` (`id_usuario`, `leido`, `created_at`),
  KEY `idx_notif_report`        (`id_report`),
  CONSTRAINT `fk_notif_report` FOREIGN KEY (`id_report`)
    REFERENCES `reports` (`id_report`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- Tipos de ticket base (3 plantillas)
-- ------------------------------------------------------------
INSERT IGNORE INTO `report_types`
  (`id_type`, `nombre`, `slug`, `descripcion`, `template_fields`, `required_fields`)
VALUES
(
  'type-001', 'Aviso de Evento', 'aviso_evento',
  'Comunicar eventos, reuniones o anuncios',
  '[{"name":"fecha_evento","label":"Fecha del evento","type":"date","required":true},{"name":"lugar","label":"Lugar","type":"text","required":true}]',
  '["titulo","descripcion","fecha_hecho"]'
),
(
  'type-002', 'Solicitud / Decisión', 'solicitud_decision',
  'Solicitudes que requieren aprobación o decisión',
  '[{"name":"tipo_solicitud","label":"Tipo de solicitud","type":"select","options":["Aprobación","Consulta","Autorización","Otro"],"required":true}]',
  '["titulo","descripcion","prioridad"]'
),
(
  'type-003', 'Reporte Operativo', 'reporte_operativo',
  'Incidentes, novedades o situaciones del día a día',
  '[{"name":"categoria","label":"Categoría","type":"select","options":["Incidente","Novedad","Mantenimiento","Otro"],"required":true},{"name":"area_afectada","label":"Área afectada","type":"text","required":true}]',
  '["titulo","descripcion","fecha_hecho","prioridad"]'
);

SET FOREIGN_KEY_CHECKS = 1;

-- ------------------------------------------------------------
-- Verificación: debe mostrar 4 filas
-- ------------------------------------------------------------
SELECT table_name AS tabla_creada
FROM information_schema.tables
WHERE table_schema = 'reportes'
  AND table_name IN ('report_types','reports','report_comments','notifications')
ORDER BY table_name;
