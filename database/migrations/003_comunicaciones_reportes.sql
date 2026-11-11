-- Tablas exclusivas del modulo de Comunicaciones y Reportes.
-- Comparado con estructuraDbSistema.sql: reutiliza users, warehouses,
-- roles y permisos existentes; no crea ni modifica esas tablas.
-- Seleccionar la base de datos destino antes de ejecutar esta migracion.

CREATE TABLE IF NOT EXISTS `report_types` (
  `id_type` varchar(36) NOT NULL DEFAULT (UUID()),
  `nombre` varchar(100) NOT NULL,
  `slug` varchar(50) NOT NULL,
  `descripcion` varchar(300) DEFAULT NULL,
  `template_fields` json DEFAULT NULL,
  `required_fields` json DEFAULT NULL,
  `roles_permitidos` json DEFAULT NULL,
  `activo` tinyint(1) NOT NULL DEFAULT 1,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_type`),
  UNIQUE KEY `uq_cr_report_types_slug` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `reports` (
  `id_report` varchar(36) NOT NULL DEFAULT (UUID()),
  `numero_ticket` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_type` varchar(36) NOT NULL,
  `titulo` varchar(200) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `status` enum('borrador','enviado','en_revision','resuelto','cerrado') NOT NULL DEFAULT 'borrador',
  `prioridad` enum('baja','media','alta','critica') NOT NULL DEFAULT 'media',
  `id_autor` int unsigned NOT NULL,
  `id_responsable` int unsigned DEFAULT NULL,
  `id_warehouse` varchar(36) DEFAULT NULL,
  `visibilidad_usuarios` json DEFAULT NULL,
  `es_publico` tinyint(1) NOT NULL DEFAULT 0,
  `fecha_hecho` date DEFAULT NULL,
  `fecha_limite` date DEFAULT NULL,
  `ubicacion` varchar(200) DEFAULT NULL,
  `extra_data` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_report`),
  UNIQUE KEY `uq_cr_reports_numero_ticket` (`numero_ticket`),
  KEY `idx_cr_reports_status_created` (`status`, `created_at`),
  KEY `idx_cr_reports_autor` (`id_autor`),
  KEY `idx_cr_reports_responsable` (`id_responsable`),
  KEY `idx_cr_reports_warehouse` (`id_warehouse`),
  CONSTRAINT `fk_cr_reports_type`
    FOREIGN KEY (`id_type`) REFERENCES `report_types` (`id_type`),
  CONSTRAINT `fk_cr_reports_autor`
    FOREIGN KEY (`id_autor`) REFERENCES `users` (`id_user`),
  CONSTRAINT `fk_cr_reports_responsable`
    FOREIGN KEY (`id_responsable`) REFERENCES `users` (`id_user`) ON DELETE SET NULL,
  CONSTRAINT `fk_cr_reports_warehouse`
    FOREIGN KEY (`id_warehouse`) REFERENCES `warehouses` (`id_warehouse`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id_notif` varchar(36) NOT NULL DEFAULT (UUID()),
  `id_usuario` int unsigned NOT NULL,
  `id_report` varchar(36) NOT NULL,
  `tipo` varchar(50) NOT NULL,
  `mensaje` varchar(500) NOT NULL,
  `leido` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_notif`),
  KEY `idx_cr_notifications_user_read_created` (`id_usuario`, `leido`, `created_at`),
  KEY `idx_cr_notifications_report` (`id_report`),
  CONSTRAINT `fk_cr_notifications_user`
    FOREIGN KEY (`id_usuario`) REFERENCES `users` (`id_user`) ON DELETE CASCADE,
  CONSTRAINT `fk_cr_notifications_report`
    FOREIGN KEY (`id_report`) REFERENCES `reports` (`id_report`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `report_comments` (
  `id_comment` varchar(36) NOT NULL DEFAULT (UUID()),
  `id_report` varchar(36) NOT NULL,
  `id_autor` int unsigned NOT NULL,
  `contenido` text NOT NULL,
  `es_resolucion` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_comment`),
  KEY `idx_cr_comments_report_created` (`id_report`, `created_at`),
  CONSTRAINT `fk_cr_comments_report`
    FOREIGN KEY (`id_report`) REFERENCES `reports` (`id_report`) ON DELETE CASCADE,
  CONSTRAINT `fk_cr_comments_autor`
    FOREIGN KEY (`id_autor`) REFERENCES `users` (`id_user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `attachments` (
  `id_attachment` varchar(36) NOT NULL DEFAULT (UUID()),
  `id_report` varchar(36) NOT NULL,
  `nombre_archivo` varchar(255) NOT NULL,
  `url_archivo` varchar(500) NOT NULL,
  `tipo_mime` varchar(100) DEFAULT NULL,
  `id_subido_por` int unsigned NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_attachment`),
  KEY `idx_cr_attachments_report` (`id_report`),
  CONSTRAINT `fk_cr_attachments_report`
    FOREIGN KEY (`id_report`) REFERENCES `reports` (`id_report`) ON DELETE CASCADE,
  CONSTRAINT `fk_cr_attachments_user`
    FOREIGN KEY (`id_subido_por`) REFERENCES `users` (`id_user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `tasks` (
  `id_task` varchar(36) NOT NULL DEFAULT (UUID()),
  `id_report` varchar(36) NOT NULL,
  `titulo` varchar(200) NOT NULL,
  `descripcion` text DEFAULT NULL,
  `id_asignado` int unsigned DEFAULT NULL,
  `status` enum('pendiente','en_progreso','hecha') NOT NULL DEFAULT 'pendiente',
  `fecha_limite` date DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_task`),
  KEY `idx_cr_tasks_report` (`id_report`),
  KEY `idx_cr_tasks_asignado` (`id_asignado`),
  CONSTRAINT `fk_cr_tasks_report`
    FOREIGN KEY (`id_report`) REFERENCES `reports` (`id_report`) ON DELETE CASCADE,
  CONSTRAINT `fk_cr_tasks_user`
    FOREIGN KEY (`id_asignado`) REFERENCES `users` (`id_user`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS `audit_events` (
  `id_audit` varchar(36) NOT NULL DEFAULT (UUID()),
  `entidad_tipo` enum('report','task','comment') NOT NULL,
  `entidad_id` varchar(36) NOT NULL,
  `accion` varchar(50) NOT NULL,
  `id_usuario` int unsigned DEFAULT NULL,
  `cambios` json DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_audit`),
  KEY `idx_cr_audit_entity_created` (`entidad_tipo`, `entidad_id`, `created_at`),
  CONSTRAINT `fk_cr_audit_user`
    FOREIGN KEY (`id_usuario`) REFERENCES `users` (`id_user`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;