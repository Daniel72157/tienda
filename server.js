const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const https = require('https');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');

const { db, run, get, all } = require('./src/db');
const apiRouter = require('./src/routes/api');
const requestLogger = require('./src/middleware/requestLogger');
const { notFound, errorHandler } = require('./src/middleware/errors');
const { asyncHandler } = require('./src/utils/http');
const { cleanText } = require('./src/utils/validators');

const app = express();

const SESSION_SECRET = process.env.SESSION_SECRET;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;
if (!SESSION_SECRET || !ADMIN_PASSWORD) {
  throw new Error('Faltan SESSION_SECRET o ADMIN_PASSWORD en el entorno');
}

const FILES_DIR = path.resolve(__dirname, 'files');

app.disable('x-powered-by');
app.use(helmet());

app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000' }));

app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

app.use(session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 1000 * 60 * 30
  }
}));

app.use(requestLogger);
app.use(express.static(path.join(__dirname, 'public')));
app.use('/api', apiRouter);

// Limite de intentos para frenar fuerza bruta
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 10 });

db.serialize(() => {
  db.run('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT UNIQUE, password TEXT, role TEXT)');
  const adminHash = bcrypt.hashSync(ADMIN_PASSWORD, 12);
  db.run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', adminHash, 'admin']);
});

function isValidEmail(email) {
  if (email.length === 0 || email.length > 254) {
    return false;
  }
  const parts = email.split('@');
  if (parts.length !== 2 || !/^[\w.+-]+$/.test(parts[0])) {
    return false;
  }
  const labels = parts[1].split('.');
  return labels.length >= 2 && labels.every((label) => /^[a-zA-Z0-9-]+$/.test(label));
}

function resolveDownload(name) {
  switch (name) {
    case 'terminos.txt':
      return 'terminos.txt';
    case 'privacidad.txt':
      return 'privacidad.txt';
    case 'envios.txt':
      return 'envios.txt';
    default:
      return null;
  }
}

function resolveRedirect(target) {
  switch (target) {
    case 'catalogo':
      return '/#catalogo';
    case 'destacados':
      return '/#destacados';
    case 'novedades':
      return '/#boletin';
    default:
      return '/';
  }
}

function resolveUpstream(resource) {
  return resource === 'estado' ? 'https://api.example.com/status' : null;
}

// Registro
app.post('/register', authLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).send('Datos invalidos');
  }
  const name = username.trim();
  if (name.length < 3 || name.length > 30 || password.length < 8 || password.length > 72) {
    return res.status(400).send('Datos invalidos');
  }
  const existing = await get('SELECT id FROM users WHERE username = ?', [name]);
  if (existing) {
    return res.status(409).send('No se pudo registrar');
  }
  const hash = await bcrypt.hash(password, 12);
  await run('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', [name, hash, 'user']);
  return res.send('Usuario registrado');
}));

// Login
app.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  if (typeof username !== 'string' || typeof password !== 'string') {
    return res.status(400).send('Datos invalidos');
  }
  const user = await get('SELECT id, username, password FROM users WHERE username = ?', [username]);
  const valid = user ? await bcrypt.compare(password, user.password) : false;
  if (!valid) {
    return res.status(401).send('Credenciales invalidas');
  }
  const previousCart = req.session.cart;
  return req.session.regenerate((err) => {
    if (err) {
      return res.status(500).send('No se pudo iniciar sesion');
    }
    req.session.userId = user.id;
    req.session.cart = previousCart || [];
    return res.type('text/plain').send(`Bienvenido ${user.username}`);
  });
}));

// Busqueda de productos
app.get('/search', asyncHandler(async (req, res) => {
  const q = cleanText(req.query.q, 50);
  const results = await all(
    'SELECT id, name, price, emoji FROM products WHERE name LIKE ? ORDER BY id',
    [`%${q}%`]
  );
  res.json({ query: q, results });
}));

app.get('/download', (req, res) => {
  const fileName = resolveDownload(req.query.name);
  if (!fileName) {
    return res.status(404).send('No existe');
  }
  return fs.readFile(path.join(FILES_DIR, fileName), 'utf8', (err, data) => {
    if (err) {
      return res.status(404).send('No existe');
    }
    return res.type('text/plain').send(data);
  });
});

app.get('/calc', (req, res) => {
  const a = Number(req.query.a);
  const b = Number(req.query.b);
  const operations = {
    sum: (x, y) => x + y,
    sub: (x, y) => x - y,
    mul: (x, y) => x * y,
    div: (x, y) => x / y
  };
  const operation = operations[req.query.op];
  if (!operation || Number.isNaN(a) || Number.isNaN(b)) {
    return res.status(400).send('Parametros invalidos');
  }
  return res.send(String(operation(a, b)));
});

app.get('/reset-token', (req, res) => {
  res.send(crypto.randomBytes(32).toString('hex'));
});

app.get('/proxy', (req, res) => {
  const upstream = resolveUpstream(req.query.resource);
  if (!upstream) {
    return res.status(403).send('Destino no permitido');
  }
  return https.get(upstream, (response) => {
    let body = '';
    response.on('data', (chunk) => {
      body += chunk;
    });
    response.on('end', () => res.type('text/plain').send(body));
  }).on('error', () => res.status(502).send('Error al consultar el destino'));
});

app.get('/go', (req, res) => {
  res.redirect(resolveRedirect(req.query.to));
});

app.post('/validate-email', (req, res) => {
  const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
  res.send(isValidEmail(email) ? 'valido' : 'invalido');
});

app.use(notFound);
app.use(errorHandler);

app.listen(3000, '127.0.0.1', () => {
  console.log('Servidor escuchando en http://localhost:3000');
});
