const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({
  origin: [
    'https://gestor-documental-teal.vercel.app',
    'http://localhost:3000',
    'http://localhost:5500',
    'http://127.0.0.1:5500'
  ],
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type']
}));

app.use(express.json());

const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '12345678',
  database: process.env.DB_NAME || 'db_gestor_documental',
  waitForConnections: true,
  connectionLimit: 10
});

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, mensaje: 'Servidor Node y MySQL conectados' });
  } catch (err) {
    res.status(500).json({ ok: false, error: err.message });
  }
});

async function manejarLogin(req, res) {
  const usuarioIngresado = String(req.body?.usuario || '').trim();
  const contrasenaIngresada = String(req.body?.contrasena ?? req.body?.password ?? '').trim();

  if (!usuarioIngresado || !contrasenaIngresada) {
    return res.status(400).json({
      ok: false,
      status: 'error',
      motivo: 'credenciales',
      mensaje: 'Credenciales incorrectas.'
    });
  }

  try {
    const [rows] = await pool.query(
      `SELECT usuario_cedula, correo, contrasena, rol, activo, debe_cambiar_clave
       FROM usuarios
       WHERE usuario_cedula = ? OR LOWER(correo) = LOWER(?)
       LIMIT 1`,
      [usuarioIngresado, usuarioIngresado]
    );

    if (rows.length === 0 || rows[0].contrasena !== contrasenaIngresada) {
      return res.status(401).json({
        ok: false,
        status: 'error',
        motivo: 'credenciales',
        mensaje: 'Credenciales incorrectas.'
      });
    }

    const userRow = rows[0];
    if (Number(userRow.activo) !== 1) {
      return res.status(403).json({
        ok: false,
        status: 'error',
        motivo: 'inactivo',
        activo: 0,
        mensaje: 'Usuario no activo.'
      });
    }

    return res.status(200).json({
      ok: true,
      status: 'success',
      usuario: userRow.usuario_cedula,
      correo: userRow.correo,
      rol: userRow.rol,
      activo: 1,
      debeCambiarClave: Number(userRow.debe_cambiar_clave) === 1
    });
  } catch (err) {
    console.error('Error SQL en login:', err.message);
    return res.status(500).json({
      ok: false,
      status: 'error',
      motivo: 'credenciales',
      error: err.message
    });
  }
}

app.post('/api/login', manejarLogin);
app.post('/api/usuarios/login', manejarLogin);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor corriendo en http://0.0.0.0:${PORT}`);
});