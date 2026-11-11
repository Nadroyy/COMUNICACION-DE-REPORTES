const DEFAULT_SISTEMA_PRINCIPAL_URL = 'http://50.28.103.119:3055';

const getSistemaPrincipalBaseUrl = () => {
  const raw = process.env.SISTEMA_PRINCIPAL_URL || process.env.MAIN_SYSTEM_URL || process.env.HOST_API_URL || '';
  const baseUrl = raw || (process.env.AUTH_MODE === 'host-jwt' ? DEFAULT_SISTEMA_PRINCIPAL_URL : '');
  return baseUrl.replace(/\/+$/, '');
};

const normalizarUsuarios = (payload) => {
  if (!payload) return null;

  const usuarios = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.usuarios)
      ? payload.usuarios
      : Array.isArray(payload.data)
        ? payload.data
        : Array.isArray(payload.data?.usuarios)
          ? payload.data.usuarios
          : null;

  if (!usuarios) return null;

  return usuarios.flatMap(usuario => {
    const idUsuario = Number(usuario.id_usuario ?? usuario.id_user);
    const nombre = usuario.nombre ?? usuario.name_user;
    if (!Number.isSafeInteger(idUsuario) || idUsuario <= 0 || typeof nombre !== 'string') return [];

    const status = usuario.status == null ? null : Number(usuario.status);
    if (status !== null && status !== 1) return [];

    const idRole = usuario.id_role ?? usuario.role ?? null;
    const numericRole = idRole == null ? null : Number(idRole);
    return [{
      id_usuario: idUsuario,
      nombre,
      email: typeof usuario.email === 'string' ? usuario.email : null,
      id_role: Number.isInteger(numericRole) ? numericRole : null,
      name_role: usuario.name_role ?? (numericRole == null ? '' : `Rol ${numericRole}`),
      id_warehouse: usuario.id_warehouse ?? usuario.sede_user ?? null,
      nombre_warehouse: usuario.nombre_warehouse ?? usuario.warehouse_name ?? '',
      status
    }];
  });
};

const fetchUsuariosSistemaPrincipal = async (authHeader) => {
  const baseUrl = getSistemaPrincipalBaseUrl();
  if (!baseUrl) {
    const error = new Error('URL del sistema principal no configurada');
    error.status = 503;
    throw error;
  }

  const response = await fetch(`${baseUrl}/getUsersReportes`, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      ...(authHeader ? { Authorization: authHeader } : {})
    }
  });

  if (!response.ok) {
    const error = new Error(`Endpoint /getUsersReportes respondió ${response.status}`);
    error.status = response.status === 401 || response.status === 403 ? 401 : 502;
    throw error;
  }

  if (!response.headers.get('content-type')?.includes('application/json')) {
    const error = new Error('Endpoint /getUsersReportes no devolvió JSON');
    error.status = 502;
    throw error;
  }

  const usuarios = normalizarUsuarios(await response.json());
  if (!usuarios) {
    const error = new Error('Endpoint /getUsersReportes devolvió un formato inválido');
    error.status = 502;
    throw error;
  }

  return usuarios;
};

const buscarUsuarioActivo = (usuarios, idUsuario, email) => {
  const emailNormalizado = typeof email === 'string' ? email.trim().toLowerCase() : '';
  const idNormalizado = Number(idUsuario);

  return usuarios.find(usuario =>
    usuario.status === 1
    && usuario.id_usuario === idNormalizado
    && typeof usuario.email === 'string'
    && usuario.email.trim().toLowerCase() === emailNormalizado
  ) || null;
};

module.exports = {
  buscarUsuarioActivo,
  fetchUsuariosSistemaPrincipal,
  getSistemaPrincipalBaseUrl,
  normalizarUsuarios
};
