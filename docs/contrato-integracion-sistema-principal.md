# Contrato de integracion con el sistema principal

Documento para acordar con el responsable del sistema principal los endpoints y flujos necesarios para integrar el modulo de reportes. Las rutas de ejemplo son propuestas; deben adaptarse al prefijo y convenciones existentes en la API principal.

## 1. Responsabilidades

- **Sistema principal:** autentica al usuario y es la fuente de verdad para identidad, usuarios activos, sedes y permisos.
- **Modulo de reportes:** administra tipos de reporte, tickets, comentarios, tareas, notificaciones e historial.
- El modulo no debe confiar en un correo o identificador enviado libremente por el navegador para identificar al usuario.

## 2. Endpoints requeridos del sistema principal

Todos los endpoints protegidos deben aceptar `Authorization: Bearer <token>` y responder `401` si la sesion no es valida. El backend del modulo debe poder validar el token de forma segura, mediante firma compartida/JWKS o consultando el endpoint de sesion del sistema principal. No usar `X-User-Email` como mecanismo de autenticacion en produccion.

### JWT para el modulo

El modulo acepta un JWT firmado con HS256. El token debe incluir `id` (igual a `users.id_user`), `email` y `exp`. El backend verifica la firma usando `HOST_JWT_SECRET`, exige que el usuario exista y este activo, y carga roles y sede desde la base de datos.

El sistema principal debe abrir el modulo con el token en el fragmento, por ejemplo `https://reportes.example.com/dashboard#token=<JWT>`. El frontend elimina el fragmento enseguida y envia el token en `Authorization: Bearer`. No incluir el token en query strings en produccion, porque pueden quedar registrados en logs e historial. Configurar el secreto directamente en el entorno del backend; nunca en el frontend, repositorio o imagen Docker.

### 2.1 Consultar la sesion

`GET /api/auth/me`

Respuesta minima requerida:

```json
{
  "usuario": {
    "id_usuario": 42,
    "nombre": "Nombre Apellido",
    "email": "usuario@empresa.com",
    "activo": true,
    "id_role": 3,
    "id_warehouse": "sede-01",
    "permisos": ["reportes.ver", "reportes.crear"]
  }
}
```

Los identificadores deben ser estables y corresponder a los usados por el sistema principal. El modulo necesita, como minimo, `id_usuario`, `nombre`, `email`, `id_role`, `id_warehouse` y permisos efectivos.

### 2.2 Listar usuarios asignables

`GET /api/users?activo=true&buscar={texto}`

Respuesta minima:

```json
{
  "usuarios": [
    {
      "id_usuario": 42,
      "nombre": "Nombre Apellido",
      "email": "usuario@empresa.com",
      "id_role": 3,
      "id_warehouse": "sede-01"
    }
  ]
}
```

Solo devolver usuarios activos que el usuario autenticado tenga permiso de consultar. Se utiliza para asignar responsables, tareas y destinatarios de notificaciones.

### 2.3 Listar sedes

`GET /api/warehouses?activo=true`

Respuesta minima:

```json
{
  "sedes": [
    { "id_warehouse": "sede-01", "nombre": "Sede principal" }
  ]
}
```

### 2.4 Permisos del modulo

Los permisos se pueden incluir en `GET /api/auth/me` o exponerse por separado, por ejemplo `GET /api/auth/me/permissions?module=reportes`.

Permisos minimos a acordar:

| Permiso | Capacidad |
|---|---|
| `reportes.ver` | Consultar reportes permitidos |
| `reportes.crear` | Crear y enviar reportes |
| `reportes.gestionar` | Asignar, revisar, transferir, resolver y cerrar |

El backend del modulo debe aplicar estos permisos; ocultar botones en el frontend no es suficiente.

## 3. Endpoints actuales del modulo

Base propuesta: `/api`. Todos requieren la sesion validada del sistema principal.

| Metodo y ruta | Uso |
|---|---|
| `GET /api/report-types` | Listar tipos y plantillas |
| `GET /api/report-types/:slug` | Consultar plantilla por tipo |
| `GET /api/reports` | Listar con filtros y paginacion |
| `POST /api/reports` | Crear reporte |
| `GET /api/reports/:id` | Consultar detalle |
| `PATCH /api/reports/:id` | Editar campos permitidos |
| `DELETE /api/reports/:id` | Cerrar reporte (borrado logico) |
| `GET /api/reports/:id/history` | Consultar auditoria |
| `GET/POST /api/reports/:id/comments` | Consultar/agregar comentarios |
| `GET/POST /api/reports/:id/tasks` | Consultar/crear tareas |
| `PATCH /api/tasks/:id` | Actualizar tarea |
| `GET /api/notifications` | Consultar notificaciones |

### Avisos en la pestaña del sistema principal

El sistema principal puede consultar `GET /api/integration/user-pending?userId={id_usuario}` usando `Authorization: Bearer <INTEGRATION_SECRET>`. La respuesta mantiene `pendientes` para el badge y agrega hasta 10 avisos no leídos con el mensaje, tipo de interacción, fecha, estado, ruta del ticket y `siguiente_paso` sugerido.

```json
{
  "userId": 42,
  "pendientes": 1,
  "notificaciones": [{
    "id_notif": "uuid",
    "id_report": "uuid",
    "titulo": "Solicitud de compra",
    "tipo": "comentario",
    "mensaje": "Nuevo comentario en el ticket",
    "status": "en_revision",
    "created_at": "2026-10-16T14:30:00.000Z",
    "siguiente_paso": "Revisar el ticket y registrar una decisión",
    "ruta": "/reports/uuid"
  }]
}
```

Al abrir un aviso, el sistema principal puede marcarlo como leído con `PATCH /api/integration/user-pending/read` y body `{ "userId": 42, "notificationId": "uuid" }`. La ruta devuelta apunta al módulo de reportes; el sistema principal debe convertirla en un enlace a la URL base de ese módulo.

`POST /api/reports` recibe `id_type`, `titulo` y los campos opcionales de la plantilla; el servidor establece el autor desde la sesion validada. Devuelve `201` y `id_report`.

## 4. Flujo de estados vigente

El esquema y controlador actuales usan estos estados y transiciones:

| Estado actual | Accion | Estado siguiente |
|---|---|---|
| `borrador` | Enviar | `enviado` |
| `enviado` | Tomar para revision | `en_revision` |
| `enviado` | Cerrar | `cerrado` |
| `en_revision` | Registrar resolucion | `resuelto` |
| `en_revision` | Cerrar | `cerrado` |
| `resuelto` | Cerrar | `cerrado` |

Flujo esperado: crear borrador -> enviar -> responsable revisa -> responsable registra resolucion -> reporte queda resuelto -> autor o administrador cierra. La transferencia debe guardar el motivo, registrar auditoria, cambiar responsable y notificar al nuevo responsable.

## 5. Acciones que faltan por formalizar/implementar

Las rutas siguientes son una propuesta de API de acciones para evitar que el frontend cambie estados arbitrariamente mediante un `PATCH` generico. Actualmente no aparecen registradas como rutas dedicadas. Acordar quien las implementa y en que servicio antes de conectar el frontend.

### Enviar reporte

`POST /api/reports/:id/submit`

- Actor: autor; administrador, si la politica del sistema lo permite.
- Precondicion: estado `borrador`.
- Efectos: cambiar a `enviado`, registrar auditoria y notificar al responsable.
- Respuesta: `200` con el reporte actualizado.

### Iniciar revision

`POST /api/reports/:id/review`

- Actor: responsable asignado o usuario con `reportes.gestionar`.
- Precondicion: estado `enviado`.
- Efectos: cambiar a `en_revision` y registrar auditoria.

### Transferir responsable

`POST /api/reports/:id/transfer`

```json
{
  "id_responsable": 57,
  "motivo": "Requiere atencion del area correspondiente"
}
```

- Actor: responsable actual o usuario con `reportes.gestionar`.
- Validar que el nuevo responsable exista y este activo; `motivo` es obligatorio.
- Efectos: cambiar responsable, guardar motivo en historial y notificar al nuevo responsable.
- El estado no cambia. Definir si se permite transferir tanto en `enviado` como en `en_revision`.

### Registrar resolucion

`POST /api/reports/:id/resolve`

```json
{ "contenido": "Accion realizada y resultado obtenido" }
```

- Actor: responsable asignado o usuario con `reportes.gestionar`.
- Precondicion: estado `en_revision`.
- Efectos: guardar comentario marcado como resolucion, cambiar a `resuelto`, registrar auditoria y notificar a los participantes.
- Estas operaciones deben ser atomicas: si falla el comentario, no cambiar el estado, y viceversa.

### Cerrar reporte

`POST /api/reports/:id/close`

- Actor: autor o usuario con `reportes.gestionar`.
- Precondicion: `enviado`, `en_revision` o `resuelto`, segun la politica acordada.
- Efectos: cambiar a `cerrado` y registrar auditoria.

## 6. Contrato comun de respuestas

- `200` para consultas y acciones completadas; `201` para creacion.
- `400` para datos invalidos o transicion no permitida; incluir codigo/mensaje y estado esperado.
- `401` para sesion ausente o vencida.
- `403` para usuario autenticado sin permiso.
- `404` cuando el reporte o usuario no existe o no es visible para ese actor.
- `409` cuando el estado cambio desde que el cliente lo consulto.
- `500` con mensaje generico; no devolver SQL, tokens ni trazas al cliente.

Las acciones de cambio de estado, asignacion y transferencia deben generar auditoria con actor, fecha, accion y valores anterior/nuevo. La autorizacion debe verificarse en el servidor en cada solicitud.

## 7. Decisiones pendientes antes de implementar

1. Confirmar si la API principal ofrece JWT verificable, JWKS o endpoint de introspeccion de sesion.
2. Confirmar nombres reales de rutas de usuarios, sedes y permisos para reutilizar los existentes.
3. Confirmar roles/permisos autorizados para enviar, revisar, transferir, resolver y cerrar.
4. Confirmar si se necesita un flujo de aprobacion/rechazo. No forma parte del esquema vigente: no existen estados `aprobado`/`negado` en el codigo actual.
5. Acordar si el sistema principal solo aporta identidad/directorios/permisos o si tambien alojara las rutas de reportes.