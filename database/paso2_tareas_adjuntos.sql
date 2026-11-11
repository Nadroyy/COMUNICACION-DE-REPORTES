-- ============================================================
-- PASO 2 — Tareas, adjuntos y enlace con TaskView
-- Ejecutar DESPUÉS de verificar que el Paso 1 funciona
-- ============================================================

USE al2;
SET FOREIGN_KEY_CHECKS = 0;

-- 5. Tareas derivadas de tickets
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

-- 6. Adjuntos
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

SET FOREIGN_KEY_CHECKS = 1;

-- Verificación
SELECT table_name AS tabla_creada
FROM information_schema.tables
WHERE table_schema = 'al2'
  AND table_name IN ('tasks','attachments','report_taskview_links')
ORDER BY table_name;

-- 7. Enlace con TaskView (requiere que `reports` ya exista — Paso 1)
CREATE TABLE IF NOT EXISTS `report_taskview_links` (
  `id_link`               int unsigned NOT NULL AUTO_INCREMENT,
  `id_report`             varchar(36)  NOT NULL,
  `taskview_project_id`   int          DEFAULT NULL,
  `taskview_task_id`      int          DEFAULT NULL,
  `taskview_project_name` varchar(255) DEFAULT NULL,
  `taskview_task_title`   varchar(255) DEFAULT NULL,
  `taskview_url`          varchar(255) DEFAULT NULL,
  `sync_status`           enum('pending','created','updated','failed') NOT NULL DEFAULT 'pending',
  `last_error`            text         DEFAULT NULL,
  `created_at`            timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`            timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_link`),
  UNIQUE KEY `uq_report_taskview_link` (`id_report`),
  KEY `idx_taskview_project` (`taskview_project_id`),
  KEY `idx_taskview_task`    (`taskview_task_id`),
  CONSTRAINT `fk_taskview_report` FOREIGN KEY (`id_report`) REFERENCES `reports` (`id_report`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
