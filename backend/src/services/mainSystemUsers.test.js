const test = require('node:test');
const assert = require('node:assert/strict');
const { buscarUsuarioActivo, getSistemaPrincipalBaseUrl, normalizarUsuarios } = require('./mainSystemUsers');

test('uses the production system API as a fallback in host-jwt mode', () => {
  const originalAuthMode = process.env.AUTH_MODE;
  const originalUrl = process.env.SISTEMA_PRINCIPAL_URL;
  const originalMainUrl = process.env.MAIN_SYSTEM_URL;
  const originalHostUrl = process.env.HOST_API_URL;

  process.env.AUTH_MODE = 'host-jwt';
  delete process.env.SISTEMA_PRINCIPAL_URL;
  delete process.env.MAIN_SYSTEM_URL;
  delete process.env.HOST_API_URL;
  assert.equal(getSistemaPrincipalBaseUrl(), 'http://50.28.103.119:3055');

  if (originalAuthMode === undefined) delete process.env.AUTH_MODE;
  else process.env.AUTH_MODE = originalAuthMode;
  if (originalUrl === undefined) delete process.env.SISTEMA_PRINCIPAL_URL;
  else process.env.SISTEMA_PRINCIPAL_URL = originalUrl;
  if (originalMainUrl === undefined) delete process.env.MAIN_SYSTEM_URL;
  else process.env.MAIN_SYSTEM_URL = originalMainUrl;
  if (originalHostUrl === undefined) delete process.env.HOST_API_URL;
  else process.env.HOST_API_URL = originalHostUrl;
});

test('normalizes users from the getUsersReportes response', () => {
  const usuarios = normalizarUsuarios({
    data: {
      usuarios: [{
        id_user: '999',
        name_user: 'Usuario Prueba',
        email: 'prueba@example.com',
        role: '3',
        status: '1',
        sede_user: '2'
      }]
    }
  });

  assert.deepEqual(usuarios[0], {
    id_usuario: 999,
    nombre: 'Usuario Prueba',
    email: 'prueba@example.com',
    id_role: 3,
    name_role: 'Rol 3',
    id_warehouse: '2',
    nombre_warehouse: '',
    status: 1
  });
});

test('matches an active user by both ID and case-insensitive email', () => {
  const usuarios = normalizarUsuarios([{
    id_user: 999,
    name_user: 'Usuario Prueba',
    email: 'Prueba@Example.com',
    role: 3,
    status: 1
  }]);

  assert.equal(buscarUsuarioActivo(usuarios, 999, ' prueba@example.com ')?.id_role, 3);
  assert.equal(buscarUsuarioActivo(usuarios, 1000, 'prueba@example.com'), null);
  assert.equal(buscarUsuarioActivo(usuarios, 999, 'otra@example.com'), null);
});

test('does not authenticate a user without an explicitly active status', () => {
  const usuarios = normalizarUsuarios([{
    id_user: 999,
    name_user: 'Usuario Prueba',
    email: 'prueba@example.com'
  }]);

  assert.equal(buscarUsuarioActivo(usuarios, 999, 'prueba@example.com'), null);
});

test('does not authenticate an inactive user', () => {
  const usuarios = normalizarUsuarios([{
    id_user: 999,
    name_user: 'Usuario Prueba',
    email: 'prueba@example.com',
    status: 0
  }]);

  assert.equal(buscarUsuarioActivo(usuarios, 999, 'prueba@example.com'), null);
});
