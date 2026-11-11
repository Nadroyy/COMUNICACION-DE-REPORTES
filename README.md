# Sistema de Tickets y Solicitudes

Módulo para registrar solicitudes mediante formularios y gestionarlas como tickets asignados, con decisiones y transferencias auditadas.

---

## Estructura del proyecto

```
comunicacion de reportes/
├── backend/          Node.js + Express + MySQL
├── frontend/         React + Vite + TailwindCSS
├── database/
│   └── schema.sql    Tablas + seeds de ejemplo
└── docker-compose.yml
```

---

## Opción A — Levantar con Docker (recomendado)

### Requisitos
- Docker Desktop instalado y corriendo

### Pasos

```bash
# PowerShell: desde la raíz del proyecto
Copy-Item .env.example .env
# Edita .env: HOST_JWT_SECRET debe coincidir con el secreto HS256 del sistema principal
docker compose up --build -d
docker compose ps
```

Esto levanta la interfaz y el backend; la base de datos de Reportes y la del sistema principal son externas:

| Servicio | Puerto local | URL |
|----------|--------------|-----|
| Frontend | 3156 | http://localhost:3156 |
| Backend | 3155 | http://localhost:3155/api |

Abre Reportes por el frontend en `:3156`. El Nginx del frontend reenvía las peticiones `/api` al backend dentro de Docker, de modo que el navegador usa el mismo origen para la interfaz y la API y no depende de CORS. El puerto `3155` del backend se conserva para integraciones que todavía lo consumen directamente. Comprueba la API a través del mismo origen con `http://localhost:3156/api/health`.

Antes de levantarlo, configura `HOST_JWT_SECRET` en `.env` con el mismo secreto HS256 del sistema principal. No publiques ese secreto ni lo compartas en el repositorio. Si mantienes el acceso desde la aplicación principal en `:3000`, conserva ese origen en `CORS_ORIGINS`; los cambios de variables requieren recrear el contenedor del backend.

Este Compose no levanta MySQL ni aplica migraciones: el backend se conecta a las bases configuradas para el sistema. Confirma que las migraciones requeridas estén aplicadas en el esquema correcto antes de desplegar; no ejecutes seeds locales en producción.

> **Seguridad:** `.env.example` solo contiene valores de muestra. Reemplázalos en `.env`; no uses las credenciales de ejemplo fuera del entorno local. El archivo `.env` está excluido de Git.

> **Integración:** este MVP expone su propia API REST. No está conectado a la base ni a los endpoints de la plataforma principal. Para integrarlo se necesitan las URLs, el método de autenticación y los contratos de esos endpoints.

La propuesta de endpoints y flujos para acordar con el equipo del sistema principal está en [docs/contrato-integracion-sistema-principal.md](docs/contrato-integracion-sistema-principal.md).

---

## Opción B — Desarrollo local (sin Docker)

### Requisitos
- Node.js 18+
- MySQL 8.0 corriendo en localhost:3306

### 1. Base de datos

Importar primero `estructuraDbSistema.sql` a una base local llamada `al2_pruebas`. Luego ejecutar `database/setup_al2_pruebas.sql` en esa base desde MySQL Workbench. El script crea las tablas del módulo, vistas de compatibilidad y usuarios locales de prueba; no modifica `inventario_local` ni contiene datos de producción.

El dump recibido contiene solo estructura. El seed local genera identificadores de prueba para los 45 correos: 28 activos con el rol indicado y 17 inactivos. Las cuentas activas usan una contraseña temporal de pruebas y su valor se guarda únicamente como hash bcrypt en esta copia local.

### 2. Backend

```bash
cd backend
npm install
# Copiar y configurar variables de entorno
copy .env.example .env
npm run dev
# Corre en http://localhost:3001
```

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
# Corre en http://localhost:5173
```

---

## Variables de entorno

### backend/.env

| Variable       | Descripción                          | Ejemplo                    |
|----------------|--------------------------------------|----------------------------|
| DB_HOST        | Host de MySQL                        | localhost                  |
| DB_PORT        | Puerto de MySQL                      | 3306                       |
| DB_TIMEZONE    | Zona horaria de MySQL                | `-05:00` (Colombia)         |
| DB_USER        | Usuario de MySQL                     | reportes_app               |
| DB_PASS        | Contraseña de MySQL                  | Definida en `.env`         |
| DB_NAME        | Nombre de la base de datos           | al2_pruebas                 |
| AUTH_MODE      | Método de identidad                  | `jwt` o `host-email`       |
| JWT_SECRET     | Clave secreta para firmar tokens     | (cambiar en producción)    |
| JWT_EXPIRES_IN | Duración del token                   | 8h                         |
| PORT           | Puerto del servidor                  | 3001                       |

---

## Acceso local de prueba

Contraseña temporal para las cuentas activas: **password**. No reutilizarla en producción.

Ejemplo: `yelitza@gmail.com` (rol 1, Administrador). Los roles 1–4 corresponden a Administrador, Financiero, Ventas y Bodegas; las cuentas sin número quedan inactivas y sin permisos.

## Notificaciones internas

La creación de tickets permite notificar al responsable, a todas las personas activas o a personas seleccionadas. La opción inicial es **Solo responsable**; para avisar a otra persona, asígnala como responsable, selecciónala en **Personas específicas** o elige **Todas las personas activas**. Los borradores no generan avisos hasta que se envía el ticket. Los destinatarios pueden abrirlo desde la bandeja de notificaciones; los comentarios notifican a quienes participan en el ticket.

Con la aplicación abierta, los avisos llegan por Socket.IO al momento de guardarse; aparece una alerta temporal visible que permite abrir el ticket. En el módulo embebido, la campana permite consultar los avisos pendientes aunque la alerta temporal ya haya desaparecido. Al volver a una pestaña activa se consultan de nuevo las notificaciones, y el sondeo cada 30 segundos se usa únicamente como respaldo si el canal está desconectado.

La aplicación también mantiene un canal Socket.IO autenticado para avisos inmediatos. El backend emite cada evento únicamente a la sala privada del usuario destinatario y solo después de confirmar la transacción que guarda la notificación. Nginx reenvía `/socket.io/` al backend; el sondeo periódico queda como respaldo si el canal se desconecta.

En una base existente, ejecutar `database/migrations/002_in_app_notifications.sql` después de tener creadas las tablas `users` y `reports`. En una instalación nueva, `database/schema.sql` ya incluye la tabla de notificaciones.

### Número consecutivo de ticket

Cada reporte tiene un número único global y continuo, mostrado con mínimo tres dígitos (`#001`, `#002`, …, `#1000`). En una base existente, hacer primero una copia de seguridad y ejecutar una sola vez `database/migration_ticket_number.sql` sobre la base de reportes. La migración asigna números a los tickets existentes en orden de creación; después, MySQL genera automáticamente el consecutivo para los tickets nuevos, incluidos los creados por la integración. Aplicar esta migración antes de desplegar una versión del backend que consulte `numero_ticket`.

Para integrar la sesión del sistema anfitrión, configurar `AUTH_MODE=host-jwt` y definir `HOST_JWT_SECRET` en el entorno del servidor con la misma clave HS256 usada por el sistema principal. No guardar esta clave en el repositorio ni incluirla en la imagen Docker.

El sistema principal debe firmar un JWT HS256 con `id`, `email` y `exp`, y abrir el módulo con el token en el fragmento, por ejemplo `http://servidor:3156/dashboard#token=<JWT>`. El fragmento evita que el token viaje en la petición inicial; el frontend lo elimina enseguida, lo conserva solo en `sessionStorage` y lo envía como `Authorization: Bearer`. En modo `host-jwt`, el backend valida firma y vencimiento y contrasta ID, correo y estado activo contra `/getUsersReportes` del sistema principal; de ahí también obtiene rol y sede. `SISTEMA_PRINCIPAL_URL` debe apuntar al servidor de esa API y el endpoint debe devolver el estado de cada usuario. Se admite `?token=` por compatibilidad, pero no se recomienda porque puede quedar en logs e historial.

Al desplegar cambios de tiempo real, reconstruir y publicar las imágenes de backend y frontend, y recrear ambos contenedores: el backend incluye Socket.IO y el proxy de Nginx con soporte de upgrade WebSocket está en la imagen del frontend. Si el proxy TLS/firewall está delante de Nginx, debe permitir conexiones HTTP Upgrade/WebSocket.

Por defecto, el frontend conecta Socket.IO en su propio origen y Nginx reenvía `/socket.io/` al backend. Si el bundle se sirve desde otro host/puerto (por ejemplo, embebido directamente en el sistema principal en `:3000`), define `VITE_REALTIME_URL` al construir la imagen frontend, por ejemplo `http://50.28.103.119:3155`, y permite ese origen en `CORS_ORIGINS` del backend. Esta variable es de compilación del frontend, no una variable de entorno que pueda agregarse al contenedor Nginx después de construir la imagen.

El modo anterior `AUTH_MODE=host-email` solo es compatible con instalaciones de prueba protegidas: un correo enviado como `X-User-Email` no demuestra una sesión autenticada.

---

## Endpoints principales

```
POST   /api/auth/login              Iniciar sesión
GET    /api/auth/me                 Usuario autenticado
GET    /api/users/assignable        Destinatarios activos para asignar/transferir

GET    /api/report-types            Listar tipos de reporte
GET    /api/report-types/:slug      Detalle por slug

GET    /api/reports                 Listar (filtros: status, type, sede, search, page)
POST   /api/reports                 Crear ticket (requiere id_responsable)
GET    /api/reports/stats           Contadores por estado (dashboard)
GET    /api/reports/:id             Detalle completo
POST   /api/reports/:id/review      El responsable toma el ticket
POST   /api/reports/:id/transfer    Transferir con destinatario y motivo
POST   /api/reports/:id/decision    Aprobar o negar (requiere motivo al negar)
PATCH  /api/reports/:id             Actualizar campos no relacionados con decisiones
DELETE /api/reports/:id             Cerrar ticket (soft delete)
GET    /api/reports/:id/history     Historial de cambios

GET    /api/reports/:id/comments    Ver comentarios
POST   /api/reports/:id/comments    Agregar comentario de seguimiento

GET    /api/reports/:id/tasks       Ver tareas
POST   /api/reports/:id/tasks       Crear tarea

PATCH  /api/tasks/:id               Actualizar tarea
```

---

## Tipos de reporte incluidos

| Tipo              | Slug                | Descripción                              |
|-------------------|---------------------|------------------------------------------|
| Aviso de Evento   | aviso_evento        | Eventos, reuniones, anuncios             |
| Solicitud/Decisión| solicitud_decision  | Aprobaciones, consultas, autorizaciones  |
| Reporte Operativo | reporte_operativo   | Incidentes, novedades, mantenimiento     |

---

## Permisos y flujo

```
Pendiente → En revisión → Aprobado
                       └→ Negado (solo administrador)
```

El administrador puede tomar, aprobar, negar y transferir tickets. La persona asignada puede tomarlo, aprobarlo y transferirlo a otra persona. Toda transferencia exige un motivo y queda en el historial. Los comentarios sirven para seguimiento; no cambian el estado ni sustituyen una decisión.
