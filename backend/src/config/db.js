// Configuración del pool de conexiones a MySQL
// El módulo usa DOS bases en el mismo servidor:
//   DB_NAME      → tickets_db   (tablas propias: reports, notifications, etc.)
//   DB_MAIN_NAME → al2 / inventario_catalogo (users, roles, warehouses)
//
// En las queries se usa el prefijo de base cuando hace falta cruzar:
//   tickets_db.reports  vs  al2.users
// Si ambas bases están en el mismo servidor, MySQL lo resuelve solo.

const mysql = require('mysql2/promise');
require('dotenv').config();

const pool = mysql.createPool({
  host:     process.env.DB_HOST      || 'localhost',
  port:     parseInt(process.env.DB_PORT) || 3306,
  user:     process.env.DB_USER      || 'root',
  password: process.env.DB_PASS      || '',
  database: process.env.DB_NAME      || 'tickets_db',
  waitForConnections: true,
  connectionLimit:    10,
  queueLimit:         0,
  timezone: process.env.DB_TIMEZONE || '-05:00',
  charset: 'utf8mb4'
});

// Nombre de la base principal del sistema (users, roles, warehouses)
// Se usa en queries cross-database: `${mainDb}.users`
const mainDb = process.env.DB_MAIN_NAME || process.env.DB_NAME;
pool.mainDb = mainDb;

// Verificar conexión al iniciar
pool.getConnection()
  .then(conn => {
    console.log(`✅ Conectado a MySQL — tickets: ${process.env.DB_NAME} | sistema: ${mainDb}`);
    conn.release();
  })
  .catch(err => {
    console.error('❌ Error al conectar a MySQL:', err.message);
  });

module.exports = pool;
