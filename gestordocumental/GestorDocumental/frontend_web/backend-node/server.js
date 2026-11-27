const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const FRONTEND_URL = process.env.FRONTEND_URL || 'https://gestor-documental-teal.vercel.app';
const CORREO_ADMIN_DESTINO = process.env.ADMIN_EMAIL || 'ygx890@gmail.com';
const SMTP_HOST = process.env.SMTP_HOST || 'smtp.gmail.com';
const SMTP_PORT = Number(process.env.SMTP_PORT || 587);
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const MAX_ADMINISTRADORES = 3;

const SOLICITUDES_PENDIENTES = new Map();

app.use(
  cors({
    origin: [
      FRONTEND_URL,
      'https://gestor-documental-teal.vercel.app',
      'http://localhost:3000',
      'http://localhost:5500',
      'http://127.0.0.1:5500',
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Pool de conexiones a MySQL usando variables de entorno
const pool = mysql.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'db_gestor_documental',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
});

function resolverCarpetaFrontend() {
  if (process.env.FRONTEND_DIR) {
    return path.resolve(process.env.FRONTEND_DIR);
  }

  const candidatos = [
    path.join(__dirname, '../GestorDocumental frontend_web'),
    path.join(__dirname, '../../GestorDocumental frontend_web'),
    path.join(__dirname, '../frontend_web'),
    path.join(__dirname, 'public'),
  ];

  for (const dir of candidatos) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      return dir;
    }
  }
  return null;
}

const carpetaFrontend = resolverCarpetaFrontend();
if (carpetaFrontend) {
  app.use(express.static(carpetaFrontend));
}

function generarContrasenaSistema() {
  return 'Sys#' + crypto.randomBytes(4).toString('hex');
}

async function enviarCorreoAsync(para, asunto, texto) {
  if (!SMTP_USER || !SMTP_PASS) {
    console.log('=== [AVISO CORREO - SMTP NO CONFIGURADO] ===');
    console.log('Para:', para);
    console.log('Asunto:', asunto);
    console.log(texto);
    console.log('==========================================');
    return;
  }

  try {
    const transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: {
        user: SMTP_USER,
        pass: SMTP_PASS,
      },
    });

    await transporter.sendMail({
      from: SMTP_USER,
      to: para,
      subject: asunto,
      text: texto,
    });
  } catch (err) {
    console.error('Error al enviar correo:', err.message);
  }
}

function normalizarEntero(valor, porDefecto = 0) {
  const num = parseInt(valor, 10);
  return Number.isNaN(num) ? porDefecto : num;
}

// 1. Registro / Solicitud de usuario
app.post('/api/usuarios/registro', async (req, res) => {
  const correo = String(req.body?.correo || '').trim().toLowerCase();
  const rol = String(req.body?.rol || 'usuario').trim().toLowerCase();

  if (!correo || !['administrador', 'usuario', 'lector'].includes(rol)) {
    return res.status(400).json({
      status: 'error',
      mensaje: 'Datos de solicitud inválidos.',
    });
  }

  try {
    const [existeRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM usuarios WHERE LOWER(correo) = LOWER(?)',
      [correo]
    );
    if (existeRows[0].total > 0) {
      return res.status(409).json({
        status: 'error',
        mensaje: 'Ya existe un usuario registrado con ese correo electrónico.',
      });
    }

    if (rol === 'administrador') {
      const [adminRows] = await pool.query(
        "SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'administrador'"
      );
      if (adminRows[0].total >= MAX_ADMINISTRADORES) {
        return res.status(400).json({
          status: 'error',
          mensaje: 'Ya se alcanzó el límite máximo de administradores.',
        });
      }
    }

    const token = crypto.randomUUID();
    const contrasenaTemporal = generarContrasenaSistema();
    SOLICITUDES_PENDIENTES.set(token, {
      token,
      correo,
      rol,
      contrasenaTemporal,
      creadoEn: Date.now(),
    });

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const enlaceAprobacion = `${baseUrl}/login.html?aprobarToken=${encodeURIComponent(token)}`;
    const cuerpoAdmin =
      `Nueva solicitud de acceso al Centro de Gestión Documental:\n\n` +
      `Correo solicitante: ${correo}\n` +
      `Rol solicitado: ${rol}\n\n` +
      `Aprobar solicitud aquí:\n${enlaceAprobacion}\n`;

    enviarCorreoAsync(CORREO_ADMIN_DESTINO, `Nueva solicitud de acceso - ${rol}`, cuerpoAdmin);

    return res.status(200).json({
      status: 'pending',
      mensaje: 'Solicitud enviada al administrador para aprobación.',
    });
  } catch (err) {
    console.error('Error en /api/usuarios/registro:', err);
    return res.status(500).json({
      status: 'error',
      mensaje: 'Error en base de datos al procesar la solicitud.',
    });
  }
});

// 2. Consultar solicitud pendiente por token
app.get('/api/usuarios/solicitud', (req, res) => {
  const token = String(req.query?.token || '').trim();
  const solicitud = token ? SOLICITUDES_PENDIENTES.get(token) : null;

  if (!solicitud) {
    return res.status(404).json({
      status: 'error',
      mensaje: 'Solicitud no encontrada o ya aprobada.',
    });
  }

  return res.status(200).json({
    status: 'success',
    correo: solicitud.correo,
    rol: solicitud.rol,
    contrasenaTemporal: solicitud.contrasenaTemporal,
  });
});

// 3. Aprobar solicitud y crear usuario en MySQL
app.post('/api/usuarios/aprobar', async (req, res) => {
  const token = String(req.body?.token || '').trim();
  const usuarioAsignado = String(req.body?.usuario || '').trim();
  const solicitud = token ? SOLICITUDES_PENDIENTES.get(token) : null;

  if (!solicitud) {
    return res.status(404).json({
      status: 'error',
      mensaje: 'Solicitud no encontrada o ya procesada.',
    });
  }

  if (!usuarioAsignado) {
    return res.status(400).json({
      status: 'error',
      mensaje: 'Debe ingresar un nombre de usuario.',
    });
  }

  try {
    const [correoRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM usuarios WHERE LOWER(correo) = LOWER(?)',
      [solicitud.correo]
    );
    if (correoRows[0].total > 0) {
      SOLICITUDES_PENDIENTES.delete(token);
      return res.status(409).json({
        status: 'error',
        mensaje: 'Ese correo ya fue registrado en MySQL.',
      });
    }

    const [userRows] = await pool.query(
      'SELECT COUNT(*) AS total FROM usuarios WHERE LOWER(usuario_cedula) = LOWER(?)',
      [usuarioAsignado]
    );
    if (userRows[0].total > 0) {
      return res.status(409).json({
        status: 'error',
        mensaje: 'Ese nombre de usuario ya está en uso. Elige otro.',
      });
    }

    if (solicitud.rol === 'administrador') {
      const [adminRows] = await pool.query(
        "SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'administrador'"
      );
      if (adminRows[0].total >= MAX_ADMINISTRADORES) {
        return res.status(400).json({
          status: 'error',
          mensaje: 'Ya se alcanzó el límite máximo de administradores.',
        });
      }
    }

    await pool.query(
      'INSERT INTO usuarios (usuario_cedula, correo, contrasena, rol, activo, debe_cambiar_clave) VALUES (?, ?, ?, ?, 1, 1)',
      [usuarioAsignado, solicitud.correo, solicitud.contrasenaTemporal, solicitud.rol]
    );

    SOLICITUDES_PENDIENTES.delete(token);

    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const cuerpoUsuario =
      `Tu solicitud de acceso al Centro de Gestión Documental ha sido aprobada.\n\n` +
      `Usuario: ${usuarioAsignado}\n` +
      `Contraseña inicial: ${solicitud.contrasenaTemporal}\n` +
      `Rol: ${solicitud.rol}\n\n` +
      `Ingresar aquí: ${baseUrl}/login.html\n`;

    enviarCorreoAsync(
      solicitud.correo,
      'Credenciales de acceso - Centro de Gestión Documental',
      cuerpoUsuario
    );

    return res.status(200).json({
      status: 'success',
      mensaje: 'Usuario aprobado, guardado en MySQL y credenciales enviadas por correo.',
    });
  } catch (err) {
    console.error('Error en /api/usuarios/aprobar:', err);
    return res.status(500).json({
      status: 'error',
      mensaje: 'Error en base de datos al aprobar la solicitud.',
    });
  }
});

// 4. Login de usuario
async function manejarLogin(req, res) {
  const usuarioIngresado = String(req.body?.usuario || '').trim();
  const contrasenaIngresada = String(req.body?.contrasena || '').trim();

  if (!usuarioIngresado || !contrasenaIngresada) {
    return res.status(400).json({
      status: 'error',
      motivo: 'credenciales',
      mensaje: 'Credenciales incorrectas.',
    });
  }

  try {
    const [rows] = await pool.query(
      'SELECT usuario_cedula, correo, rol, activo, debe_cambiar_clave FROM usuarios WHERE (usuario_cedula = ? OR LOWER(correo) = LOWER(?)) AND contrasena = ? LIMIT 1',
      [usuarioIngresado, usuarioIngresado, contrasenaIngresada]
    );

    if (!rows.length) {
      return res.status(401).json({
        status: 'error',
        motivo: 'credenciales',
        mensaje: 'Credenciales incorrectas.',
      });
    }

    const userRow = rows[0];
    if (Number(userRow.activo) !== 1) {
      return res.status(403).json({
        status: 'error',
        motivo: 'inactivo',
        activo: Number(userRow.activo),
        mensaje: 'Usuario no activo.',
      });
    }

    return res.status(200).json({
      status: 'success',
      usuario: userRow.usuario_cedula,
      correo: userRow.correo,
      rol: userRow.rol,
      activo: Number(userRow.activo),
      debeCambiarClave: Number(userRow.debe_cambiar_clave) === 1,
    });
  } catch (err) {
    console.error('Error en login:', err);
    return res.status(500).json({
      status: 'error',
      motivo: 'servidor',
      mensaje: 'Error al validar credenciales.',
    });
  }
}

app.post('/api/usuarios/login', manejarLogin);
app.post('/api/login', manejarLogin);

// 5. Cambiar contraseña
app.post('/api/usuarios/cambiar-clave', async (req, res) => {
  const usuario = String(req.body?.usuario || '').trim();
  const claveActual = String(req.body?.claveActual || '').trim();
  const nuevaClave = String(req.body?.nuevaClave || '').trim();

  if (!usuario || !claveActual || nuevaClave.length < 4) {
    return res.status(400).json({
      status: 'error',
      mensaje: 'Complete todos los campos. La nueva contraseña debe tener al menos 4 caracteres.',
    });
  }

  try {
    const [rows] = await pool.query(
      'SELECT id FROM usuarios WHERE usuario_cedula = ? AND contrasena = ? AND activo = 1 LIMIT 1',
      [usuario, claveActual]
    );

    if (!rows.length) {
      return res.status(401).json({
        status: 'error',
        mensaje: 'La contraseña actual no es correcta.',
      });
    }

    await pool.query(
      'UPDATE usuarios SET contrasena = ?, debe_cambiar_clave = 0 WHERE id = ?',
      [nuevaClave, rows[0].id]
    );

    return res.status(200).json({
      status: 'success',
      mensaje: 'Contraseña actualizada correctamente.',
    });
  } catch (err) {
    console.error('Error en /api/usuarios/cambiar-clave:', err);
    return res.status(500).json({
      status: 'error',
      mensaje: 'Error en base de datos al actualizar contraseña.',
    });
  }
});

// 6. Documentos / Contratos indexados
app.get('/api/clientes', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT no_folio, fecha_proceso, fecha_contrato, distribuidor_id, cliente_id,
              observaciones, nombre_empresa, codigo_empresa, area_empresa, archivo, drive_url
       FROM documentos ORDER BY id DESC`
    );

    const data = rows.map((r) => ({
      nroContrato: r.no_folio || '',
      fechaProceso: r.fecha_proceso || '',
      fechaContrato: r.fecha_contrato || '',
      nroDistribuidor: r.distribuidor_id || '',
      nombreCliente: r.cliente_id || '',
      observaciones: r.observaciones || '',
      nombreEmpresa: r.nombre_empresa || '',
      codigoEmpresa: r.codigo_empresa || '',
      areaEmpresa: r.area_empresa || '',
      archivo: r.archivo || '',
      driveUrl: r.drive_url || '',
    }));

    return res.status(200).json(data);
  } catch (err) {
    console.error('Error en GET /api/clientes:', err);
    return res.status(500).json({
      status: 'error',
      mensaje: 'Error al consultar documentos en MySQL.',
    });
  }
});

app.post('/api/clientes', async (req, res) => {
  const body = req.body || {};

  try {
    await pool.query(
      `INSERT INTO documentos
        (no_folio, fecha_proceso, fecha_contrato, distribuidor_id, cliente_id, observaciones, nombre_empresa, codigo_empresa, area_empresa, archivo, drive_url)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(body.nroContrato || '').trim(),
        String(body.fechaProceso || '').trim(),
        String(body.fechaContrato || '').trim(),
        String(body.nroDistribuidor || '').trim(),
        String(body.nombreCliente || '').trim(),
        String(body.observaciones || '').trim(),
        String(body.nombreEmpresa || '').trim(),
        String(body.codigoEmpresa || '').trim(),
        String(body.areaEmpresa || '').trim(),
        String(body.archivo || '').trim(),
        String(body.driveUrl || '').trim(),
      ]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Documento indexado y guardado en MySQL con éxito',
    });
  } catch (err) {
    console.error('Error en POST /api/clientes:', err);
    return res.status(500).json({
      status: 'error',
      mensaje: 'Error al guardar documento en MySQL.',
    });
  }
});

// 7. Control de tiempos
app.get('/api/control-tiempos', async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT fecha_turno, cantidad_1, hora_inicio_1, hora_fin_1, cantidad_2,
              hora_inicio_2, hora_fin_2, horas_porcentaje, horas_por_proceso, total_horas, fecha_creacion
       FROM control_tiempos ORDER BY id DESC`
    );
    return res.status(200).json(rows);
  } catch (err) {
    console.error('Error en GET /api/control-tiempos:', err);
    return res.status(500).json({
      status: 'error',
      mensaje: 'Error al consultar control de tiempos.',
    });
  }
});

app.post('/api/control-tiempos', async (req, res) => {
  const body = req.body || {};

  try {
    await pool.query(
      `INSERT INTO control_tiempos
        (fecha_turno, cantidad_1, hora_inicio_1, hora_fin_1, cantidad_2, hora_inicio_2, hora_fin_2, horas_porcentaje, horas_por_proceso, total_horas, fecha_creacion)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(body.fechaTurno || '').trim(),
        normalizarEntero(body.cantidad1, 0),
        String(body.horaInicio1 || '').trim(),
        String(body.horaFin1 || '').trim(),
        normalizarEntero(body.cantidad2, 0),
        String(body.horaInicio2 || '').trim(),
        String(body.horaFin2 || '').trim(),
        String(body.horasPorcentaje || '').trim(),
        String(body.horasPorProceso || '').trim(),
        String(body.totalHoras || '').trim(),
        String(body.fechaCreacion || '').trim(),
      ]
    );

    return res.status(200).json({
      status: 'success',
      message: 'Control de tiempos guardado en MySQL con éxito',
    });
  } catch (err) {
    console.error('Error en POST /api/control-tiempos:', err);
    return res.status(500).json({
      status: 'error',
      mensaje: 'Error al guardar control de tiempos en MySQL.',
    });
  }
});

// Ruta raíz fallback
app.get('/', (req, res) => {
  if (carpetaFrontend && fs.existsSync(path.join(carpetaFrontend, 'login.html'))) {
    return res.sendFile(path.join(carpetaFrontend, 'login.html'));
  }
  return res.status(200).json({ status: 'ok', servicio: 'GestorDocumental API' });
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Servidor corriendo en http://localhost:${PORT}`);
  });
}

module.exports = app;