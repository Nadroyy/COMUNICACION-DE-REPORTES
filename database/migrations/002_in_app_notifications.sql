CREATE TABLE IF NOT EXISTS `notifications` (
  `id_notification` varchar(36) NOT NULL,
  `id_user` int unsigned NOT NULL,
  `id_report` varchar(36) NOT NULL,
  `tipo` enum('ticket_creado','asignacion','comentario') NOT NULL,
  `mensaje` varchar(500) NOT NULL,
  `leida` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id_notification`),
  KEY `idx_notifications_user_read_created` (`id_user`, `leida`, `created_at`),
  CONSTRAINT `fk_notifications_user` FOREIGN KEY (`id_user`)
    REFERENCES `users` (`id_user`) ON DELETE CASCADE,
  CONSTRAINT `fk_notifications_report` FOREIGN KEY (`id_report`)
    REFERENCES `reports` (`id_report`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;