USE al2_pruebas;

INSERT IGNORE INTO roles (id_role, name_role, desc_role) VALUES
(1, 'Administrador', 'Administracion completa de tickets'),
(2, 'Financiero', 'Gestion financiera de solicitudes'),
(3, 'Ventas', 'Gestion de solicitudes de ventas'),
(4, 'Bodegas', 'Gestion de solicitudes de bodegas'),
(5, 'Sin rol asignado', 'Cuenta local inactiva sin permisos de la aplicacion');

INSERT IGNORE INTO users
  (id_user, name_user, identification_user, status, email, password, role, cajera)
VALUES
(910001, 'estefany', 'LOCAL-910001', 0, 'estefany@gmail.com', NULL, 5, 0),
(910002, 'karolayn', 'LOCAL-910002', 0, 'karolayn@gmail.com', NULL, 5, 0),
(910003, 'yelitza', 'LOCAL-910003', 1, 'yelitza@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1, 0),
(910004, 'maryuri', 'LOCAL-910004', 1, 'maryuri@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1, 0),
(910005, 'yarime', 'LOCAL-910005', 1, 'yarime@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3, 0),
(910006, 'elisa', 'LOCAL-910006', 1, 'elisa@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1, 0),
(910007, 'cristina', 'LOCAL-910007', 0, 'cristina@gmail.com', NULL, 5, 0),
(910008, 'maite', 'LOCAL-910008', 1, 'maite@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3, 0),
(910009, 'neila', 'LOCAL-910009', 0, 'neila@gmail.com', NULL, 5, 0),
(910010, 'kimberly', 'LOCAL-910010', 1, 'kimberly@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3, 0),
(910011, 'salma', 'LOCAL-910011', 0, 'salma@gmail.com', NULL, 5, 0),
(910012, 'krlscrisfer72', 'LOCAL-910012', 1, 'krlscrisfer72@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1, 0),
(910013, 'jeny', 'LOCAL-910013', 0, 'jeny@gmail.com', NULL, 5, 0),
(910014, 'diegoprincipal', 'LOCAL-910014', 1, 'diegoprincipal@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 4, 0),
(910015, 'heider', 'LOCAL-910015', 1, 'heider@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 4, 0),
(910016, 'luis', 'LOCAL-910016', 1, 'luis@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 4, 0),
(910017, 'anderson', 'LOCAL-910017', 1, 'anderson@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 4, 0),
(910018, 'ingdiego', 'LOCAL-910018', 1, 'ingdiego@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1, 0),
(910019, 'wendy', 'LOCAL-910019', 0, 'wendy@gmail.com', NULL, 5, 0),
(910020, 'anabel', 'LOCAL-910020', 1, 'anabel@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3, 0),
(910021, 'yanny', 'LOCAL-910021', 1, 'yanny@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3, 0),
(910022, 'gabriela', 'LOCAL-910022', 0, 'gabriela@gmail.com', NULL, 5, 0),
(910023, 'maria', 'LOCAL-910023', 1, 'maria@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3, 0),
(910024, 'fanny', 'LOCAL-910024', 1, 'fanny@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 2, 0),
(910025, 'ale', 'LOCAL-910025', 0, 'ale@gmail.com', NULL, 5, 0),
(910026, 'auxtemporal', 'LOCAL-910026', 0, 'auxtemporal@gmail.com', NULL, 5, 0),
(910027, 'diegobulevar', 'LOCAL-910027', 1, 'diegobulevar@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 4, 0),
(910028, 'kimberlyanulaciones', 'LOCAL-910028', 1, 'kimberlyanulaciones@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3, 0),
(910029, 'diegocaobos', 'LOCAL-910029', 1, 'diegocaobos@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 4, 0),
(910030, 'userCaobos', 'LOCAL-910030', 0, 'userCaobos@gmail.com', NULL, 5, 0),
(910031, 'yarimeanulaciones', 'LOCAL-910031', 1, 'yarimeanulaciones@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3, 0),
(910032, 'yanny2', 'LOCAL-910032', 1, 'yanny2@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3, 0),
(910033, 'david', 'LOCAL-910033', 1, 'david@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 1, 0),
(910034, 'maitebodega', 'LOCAL-910034', 1, 'maitebodega@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 4, 0),
(910035, 'marcela', 'LOCAL-910035', 1, 'marcela@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3, 0),
(910036, 'entregaportatil', 'LOCAL-910036', 0, 'entregaportatil@gmail.com', NULL, 5, 0),
(910037, 'mariaanulaciones', 'LOCAL-910037', 0, 'mariaanulaciones@gmail.com', NULL, 5, 0),
(910038, 'leydi', 'LOCAL-910038', 1, 'leydi@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3, 0),
(910039, 'ventasprueba2', 'LOCAL-910039', 1, 'ventasprueba2@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3, 0),
(910040, 'ventasprueba1', 'LOCAL-910040', 1, 'ventasprueba1@gmail.com', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3, 0),
(910041, 'prueba', 'LOCAL-910041', 0, 'prueba@example.com', NULL, 5, 0),
(910042, 'ventas', 'LOCAL-910042', 1, 'ventas@gmail.com.co', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 3, 0),
(910043, '123', 'LOCAL-910043', 0, '123@gmail.com', NULL, 5, 0),
(910044, '456', 'LOCAL-910044', 0, '456@gmail.com', NULL, 5, 0),
(910045, 'hleider4', 'LOCAL-910045', 0, 'hleider4@gmail.com', NULL, 5, 0);

CREATE OR REPLACE VIEW sedes AS
SELECT id_warehouse AS id_sede, name AS nombre, address AS direccion,
       CAST(NULL AS CHAR(100)) AS ciudad, 1 AS activa
FROM warehouses;

CREATE TABLE IF NOT EXISTS equipos (
  id_equipo varchar(36) NOT NULL DEFAULT (UUID()),
  nombre varchar(100) NOT NULL,
  id_sede varchar(36) DEFAULT NULL,
  descripcion varchar(200) DEFAULT NULL,
  activo tinyint(1) NOT NULL DEFAULT 1,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_equipo)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE OR REPLACE VIEW usuarios AS
SELECT CAST(u.id_user AS CHAR(36)) AS id_usuario,
       u.name_user AS nombre,
       u.email,
       u.password AS password_hash,
       u.role AS id_role,
       r.name_role,
       u.sede_user AS id_sede,
       w.name AS nombre_sede,
       CAST(NULL AS CHAR(36)) AS id_equipo,
       CAST(NULL AS CHAR(100)) AS nombre_equipo,
       u.status AS activo
FROM users u
LEFT JOIN roles r ON r.id_role = u.role
LEFT JOIN warehouses w ON w.id_warehouse = u.sede_user;

CREATE TABLE IF NOT EXISTS report_types (
  id_type varchar(36) NOT NULL DEFAULT (UUID()),
  nombre varchar(100) NOT NULL,
  slug varchar(50) NOT NULL,
  descripcion varchar(300) DEFAULT NULL,
  template_fields json DEFAULT NULL,
  required_fields json DEFAULT NULL,
  roles_permitidos json DEFAULT NULL,
  activo tinyint(1) NOT NULL DEFAULT 1,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_type),
  UNIQUE KEY slug_unique (slug)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS reports (
  id_report varchar(36) NOT NULL DEFAULT (UUID()),
  numero_ticket bigint unsigned NOT NULL AUTO_INCREMENT,
  id_type varchar(36) NOT NULL,
  titulo varchar(200) NOT NULL,
  descripcion text,
  status enum('borrador','enviado','en_revision','aprobado','negado','resuelto','cerrado') NOT NULL DEFAULT 'enviado',
  prioridad enum('baja','media','alta','critica') NOT NULL DEFAULT 'media',
  id_autor varchar(36) NOT NULL,
  id_responsable varchar(36) DEFAULT NULL,
  id_equipo varchar(36) DEFAULT NULL,
  id_sede varchar(36) DEFAULT NULL,
  visibilidad_usuarios json DEFAULT NULL,
  es_publico tinyint(1) NOT NULL DEFAULT 0,
  fecha_hecho date DEFAULT NULL,
  fecha_limite date DEFAULT NULL,
  ubicacion varchar(200) DEFAULT NULL,
  extra_data json DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_report),
  UNIQUE KEY uq_reports_numero_ticket (numero_ticket),
  KEY idx_reports_type (id_type),
  KEY idx_reports_status_created (status, created_at),
  KEY idx_reports_author (id_autor),
  KEY idx_reports_assignee (id_responsable),
  KEY idx_reports_sede (id_sede),
  CONSTRAINT fk_reports_type FOREIGN KEY (id_type) REFERENCES report_types (id_type),
  CONSTRAINT fk_reports_equipo FOREIGN KEY (id_equipo) REFERENCES equipos (id_equipo) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS report_comments (
  id_comment varchar(36) NOT NULL DEFAULT (UUID()),
  id_report varchar(36) NOT NULL,
  id_autor varchar(36) NOT NULL,
  contenido text NOT NULL,
  es_resolucion tinyint(1) NOT NULL DEFAULT 0,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_comment),
  KEY idx_comments_report (id_report, created_at),
  CONSTRAINT fk_comments_report FOREIGN KEY (id_report) REFERENCES reports (id_report) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS attachments (
  id_attachment varchar(36) NOT NULL DEFAULT (UUID()),
  id_report varchar(36) NOT NULL,
  nombre_archivo varchar(255) NOT NULL,
  url_archivo varchar(500) NOT NULL,
  tipo_mime varchar(100) DEFAULT NULL,
  id_subido_por varchar(36) NOT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_attachment),
  CONSTRAINT fk_attachments_report FOREIGN KEY (id_report) REFERENCES reports (id_report) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS tasks (
  id_task varchar(36) NOT NULL DEFAULT (UUID()),
  id_report varchar(36) NOT NULL,
  titulo varchar(200) NOT NULL,
  descripcion text,
  id_asignado varchar(36) DEFAULT NULL,
  status enum('pendiente','en_progreso','hecha') NOT NULL DEFAULT 'pendiente',
  fecha_limite date DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_task),
  CONSTRAINT fk_tasks_report FOREIGN KEY (id_report) REFERENCES reports (id_report) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

CREATE TABLE IF NOT EXISTS audit_events (
  id_audit varchar(36) NOT NULL DEFAULT (UUID()),
  entidad_tipo enum('report','task','comment') NOT NULL,
  entidad_id varchar(36) NOT NULL,
  accion varchar(50) NOT NULL,
  id_usuario varchar(36) DEFAULT NULL,
  cambios json DEFAULT NULL,
  created_at timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id_audit),
  KEY idx_audit_entity (entidad_tipo, entidad_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

INSERT IGNORE INTO report_types
  (id_type, nombre, slug, descripcion, template_fields, required_fields, roles_permitidos)
VALUES
('type-001', 'Aviso de Evento', 'aviso_evento', 'Eventos, reuniones, actividades o anuncios',
 '[{"name":"fecha_evento","label":"Fecha del evento","type":"date","required":true},{"name":"lugar","label":"Lugar","type":"text","required":true}]',
 '["titulo"]', '[1,2,3,4]'),
('type-002', 'Solicitud / Decision', 'solicitud_decision', 'Solicitudes que requieren una decision',
 '[{"name":"tipo_solicitud","label":"Tipo de solicitud","type":"select","options":["Aprobacion","Consulta","Autorizacion","Otro"],"required":true}]',
 '["titulo","id_responsable"]', '[1,2,3,4]'),
('type-003', 'Solicitud Operativa', 'reporte_operativo', 'Novedades operativas, incidentes o mantenimiento',
 '[{"name":"categoria","label":"Categoria","type":"select","options":["Incidente","Novedad","Mantenimiento","Otro"],"required":true}]',
 '["titulo","fecha_hecho"]', '[1,4]');