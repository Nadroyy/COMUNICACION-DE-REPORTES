USE inventario_local;

ALTER TABLE reports
  MODIFY status enum('borrador','enviado','en_revision','aprobado','negado','resuelto','cerrado')
  NOT NULL DEFAULT 'enviado';