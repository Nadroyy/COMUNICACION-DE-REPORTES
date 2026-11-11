const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');

const dbPath = require.resolve('../config/db');
const dbStub = new Module(dbPath);
dbStub.filename = dbPath;
dbStub.loaded = true;
dbStub.exports = {};
require.cache[dbPath] = dbStub;

const { puedeVerReporte } = require('./reportAccess');

const reporteBase = {
  id_report: 'reporte-1',
  id_autor: '10',
  id_responsable: '20',
  id_warehouse: 'sede-1',
  status: 'enviado',
  es_publico: 1,
  visibilidad_usuarios: '[30]'
};

test('author and administrator can access drafts', () => {
  const borrador = { ...reporteBase, status: 'borrador' };
  assert.equal(puedeVerReporte(borrador, { id_usuario: 10, id_role: 2 }), true);
  assert.equal(puedeVerReporte(borrador, { id_usuario: 99, id_role: '1' }), true);
});

test('published reports are limited to author, responsible, and explicitly shared users', () => {
  assert.equal(puedeVerReporte(reporteBase, { id_usuario: 10, id_role: 2 }), true);
  assert.equal(puedeVerReporte(reporteBase, { id_usuario: 20, id_role: 2 }), true);
  assert.equal(puedeVerReporte(reporteBase, { id_usuario: 30, id_role: 2 }), true);
  assert.equal(puedeVerReporte(reporteBase, { id_usuario: 40, id_role: 2 }), false);
});

test('public and same-warehouse flags do not grant report access', () => {
  assert.equal(
    puedeVerReporte(reporteBase, { id_usuario: 40, id_role: 2, id_warehouse: 'sede-1' }),
    false
  );
  assert.equal(
    puedeVerReporte({ ...reporteBase, es_publico: 0 }, { id_usuario: 40, id_role: 2 }),
    false
  );
});

test('selected users cannot access drafts before publication', () => {
  assert.equal(
    puedeVerReporte(
      { ...reporteBase, status: 'borrador' },
      { id_usuario: 30, id_role: 2 }
    ),
    false
  );
});

test('selected users keep access after a report is closed', () => {
  assert.equal(
    puedeVerReporte(
      { ...reporteBase, status: 'cerrado' },
      { id_usuario: 30, id_role: 2 }
    ),
    true
  );
});
