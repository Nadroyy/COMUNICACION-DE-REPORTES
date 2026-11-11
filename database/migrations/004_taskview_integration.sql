CREATE TABLE IF NOT EXISTS report_taskview_links (
  id_link INT UNSIGNED NOT NULL AUTO_INCREMENT,
  id_report CHAR(36) NOT NULL,
  taskview_project_id INT NULL,
  taskview_task_id INT NULL,
  taskview_project_name VARCHAR(255) NULL,
  taskview_task_title VARCHAR(255) NULL,
  taskview_url VARCHAR(255) NULL,
  sync_status ENUM('pending', 'created', 'updated', 'failed') NOT NULL DEFAULT 'pending',
  last_error TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id_link),
  UNIQUE KEY uq_report_taskview_link (id_report),
  KEY idx_taskview_project (taskview_project_id),
  KEY idx_taskview_task (taskview_task_id),
  CONSTRAINT fk_report_taskview_link_report
    FOREIGN KEY (id_report) REFERENCES reports(id_report)
    ON DELETE CASCADE
    ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
