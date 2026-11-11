-- ============================================================
-- Sistema de Comunicaciones y Reportes
-- Se integra a la BD al2 (producción)
-- IMPORTANTE: Las tablas users, roles y warehouses ya existen.
--             Este script SOLO agrega las tablas del módulo de reportes.
-- ============================================================

-- Estructura de tablas existentes que se referencian:
--
-- users:      id_user (int unsigned PK), name_user, email, password,
--             role (FK → roles.id_role), sede_user (FK → warehouses.id_warehouse),
--             status (tinyint)
--
-- roles:      id_role (int unsigned PK), name_role, desc_role
--
-- warehouses: id_warehouse (varchar 36 PK), name, address
--
-- modules:    id_module (int PK), module_key, module_name
-- user_module_permissions: user_id, module_id, can_access

-- ============================================================

-- ------------------------------------------------------------
-- TIPOS DE REPORTE (plantillas configurables por tipo)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `report_types` (
  `id_type`         varchar(36)  NOT NULL DEFAULT (UUID()),
  `nombre`          varchar(100) NOT NULL,
  `slug`            varchar(50)  NOT NULL,
  `descripcion`     varchar(300) DEFAULT NULL,
  -- Campos extra específicos del tipo: JSON array de {name, label, type, required, options?}
  `template_fields` json         DEFAULT NULL,
  -- Campos base obligatorios para este tipo: JSON array de strings
  `required_fields` json         DEFAULT NULL,
  -- Roles que pueden crear este tipo: JSON array de id_role (int)
  `roles_permitidos` json        DEFAULT NULL,
  `activo`          tinyint(1)   NOT NULL DEFAULT 1,
  `created_at`      timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_type`),
  UNIQUE KEY `slug_unique` (`slug`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- REPORTES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `reports` (
  `id_report`     varchar(36)  NOT NULL DEFAULT (UUID()),
  `numero_ticket` bigint unsigned NOT NULL AUTO_INCREMENT,
  `id_type`       varchar(36)  NOT NULL,
  `titulo`        varchar(200) NOT NULL,
  `descripcion`   text,
  `status`        enum('borrador','enviado','en_revision','aprobado','negado','resuelto','cerrado')
                                NOT NULL DEFAULT 'borrador',
  `prioridad`     enum('baja','media','alta','critica')
                                NOT NULL DEFAULT 'media',
  -- FK → users.id_user (autor que registra el reporte)
  `id_autor`      int unsigned  NOT NULL,
  -- FK → users.id_user (responsable de resolver)
  `id_responsable` int unsigned DEFAULT NULL,
  -- Visibilidad por sede (warehouse)
  `id_warehouse`  varchar(36)  DEFAULT NULL,
  -- Visibilidad por usuarios individuales: JSON array de id_user (int)
  `visibilidad_usuarios` json  DEFAULT NULL,
  -- Visible para todos los usuarios
  `es_publico`    tinyint(1)   NOT NULL DEFAULT 0,
  -- Fecha del hecho reportado
  `fecha_hecho`   date         DEFAULT NULL,
  -- Fecha límite para resolución
  `fecha_limite`  date         DEFAULT NULL,
  -- Ubicación específica
  `ubicacion`     varchar(200) DEFAULT NULL,
  -- Datos extra según plantilla del tipo (JSON libre)
  `extra_data`    json         DEFAULT NULL,
  `created_at`    timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    timestamp    NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_report`),
  UNIQUE KEY `uq_reports_numero_ticket` (`numero_ticket`),
  KEY `idx_reports_status` (`status`),
  KEY `idx_reports_autor`  (`id_autor`),
  FOREIGN KEY (`id_type`)        REFERENCES `report_types`(`id_type`),
  FOREIGN KEY (`id_autor`)       REFERENCES `users`(`id_user`),
  FOREIGN KEY (`id_responsable`) REFERENCES `users`(`id_user`)       ON DELETE SET NULL,
  FOREIGN KEY (`id_warehouse`)   REFERENCES `warehouses`(`id_warehouse`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- NOTIFICACIONES INTERNAS
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `notifications` (
  `id_notif`    varchar(36)  NOT NULL DEFAULT (UUID()),
  `id_usuario`  int unsigned NOT NULL,
  `id_report`   varchar(36)  NOT NULL,
  `tipo`        varchar(50)  NOT NULL
                  COMMENT 'ticket_creado | asignacion | comentario_nuevo | cambio_estado | sistema',
  `mensaje`     varchar(500) NOT NULL,
  `leido`       tinyint(1)   NOT NULL DEFAULT 0,
  `created_at`  timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_notif`),
  KEY `idx_notif_usuario_leido` (`id_usuario`, `leido`, `created_at`),
  KEY `idx_notif_report`        (`id_report`),
  FOREIGN KEY (`id_usuario`) REFERENCES `users`   (`id_user`)    ON DELETE CASCADE,
  FOREIGN KEY (`id_report`)  REFERENCES `reports` (`id_report`)  ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- COMENTARIOS Y RESOLUCIONES
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `report_comments` (
  `id_comment`    varchar(36) NOT NULL DEFAULT (UUID()),
  `id_report`     varchar(36) NOT NULL,
  `id_autor`      int unsigned NOT NULL,
  `contenido`     text        NOT NULL,
  -- true = este comentario es la resolución oficial del reporte
  `es_resolucion` tinyint(1)  NOT NULL DEFAULT 0,
  `created_at`    timestamp   NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_comment`),
  FOREIGN KEY (`id_report`) REFERENCES `reports`(`id_report`) ON DELETE CASCADE,
  FOREIGN KEY (`id_autor`)  REFERENCES `users`(`id_user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- ADJUNTOS
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
  FOREIGN KEY (`id_report`)     REFERENCES `reports`(`id_report`) ON DELETE CASCADE,
  FOREIGN KEY (`id_subido_por`) REFERENCES `users`(`id_user`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- TAREAS DERIVADAS DE REPORTES
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
  FOREIGN KEY (`id_report`)   REFERENCES `reports`(`id_report`) ON DELETE CASCADE,
  FOREIGN KEY (`id_asignado`) REFERENCES `users`(`id_user`)     ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- AUDITORÍA — historial de cambios
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `audit_events` (
  `id_audit`     varchar(36)  NOT NULL DEFAULT (UUID()),
  `entidad_tipo` enum('report','task','comment') NOT NULL,
  `entidad_id`   varchar(36)  NOT NULL,
  `accion`       varchar(50)  NOT NULL,
  -- FK → users.id_user (quién hizo el cambio)
  `id_usuario`   int unsigned DEFAULT NULL,
  -- Detalle del cambio: { campo: { antes, despues } }
  `cambios`      json         DEFAULT NULL,
  `created_at`   timestamp    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_audit`),
  FOREIGN KEY (`id_usuario`) REFERENCES `users`(`id_user`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- ------------------------------------------------------------
-- REGISTRO DEL MÓDULO EN EL SISTEMA DE PERMISOS EXISTENTE
-- Agrega el módulo de reportes a la tabla modules ya existente
-- ------------------------------------------------------------
INSERT IGNORE INTO `modules` (`module_key`, `module_name`, `parent_key`, `sort_order`, `status`)
VALUES
  ('reportes',           'Reportes y Comunicaciones', NULL,        20, 1),
  ('reportes.ver',       'Ver reportes',              'reportes',  1,  1),
  ('reportes.crear',     'Crear reportes',            'reportes',  2,  1),
  ('reportes.gestionar', 'Gestionar reportes',        'reportes',  3,  1);

-- ============================================================
-- SEEDS — tipos de reporte base
-- ============================================================
INSERT IGNORE INTO `report_types`
  (`id_type`, `nombre`, `slug`, `descripcion`, `template_fields`, `required_fields`, `roles_permitidos`)
VALUES
(
  'type-001',
  'Aviso de Evento',
  'aviso_evento',
  'Para comunicar eventos, reuniones, actividades o anuncios importantes',
  '[{"name":"fecha_evento","label":"Fecha del evento","type":"date","required":true},{"name":"lugar","label":"Lugar","type":"text","required":true},{"name":"publico_objetivo","label":"Público objetivo","type":"text","required":false},{"name":"requiere_confirmacion","label":"Requiere confirmación de asistencia","type":"boolean","required":false}]',
  '["titulo","descripcion","fecha_hecho"]',
  '[1,2,3,4,5,6,7,8]'
),
(
  'type-002',
  'Solicitud / Decisión',
  'solicitud_decision',
  'Para registrar solicitudes que requieren aprobación o decisiones importantes',
  '[{"name":"tipo_solicitud","label":"Tipo de solicitud","type":"select","options":["Aprobación","Consulta","Autorización","Otro"],"required":true},{"name":"impacto","label":"Impacto esperado","type":"textarea","required":false},{"name":"alternativas","label":"Alternativas consideradas","type":"textarea","required":false}]',
  '["titulo","descripcion","prioridad"]',
  '[1,2,3,4,5,6,7,8]'
),
(
  'type-003',
  'Reporte Operativo',
  'reporte_operativo',
  'Para reportar incidentes, novedades o situaciones operativas del día a día',
  '[{"name":"categoria","label":"Categoría","type":"select","options":["Incidente","Novedad","Mantenimiento","Otro"],"required":true},{"name":"area_afectada","label":"Área afectada","type":"text","required":true},{"name":"nivel_impacto","label":"Nivel de impacto","type":"select","options":["Sin impacto","Bajo","Medio","Alto","Crítico"],"required":true},{"name":"acciones_tomadas","label":"Acciones tomadas","type":"textarea","required":false}]',
  '["titulo","descripcion","fecha_hecho","prioridad"]',
  '[1,2,3,4,5,6,7,8]'
);
