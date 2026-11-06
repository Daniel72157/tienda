const sqlite3 = require('sqlite3').verbose();

const db = new sqlite3.Database(':memory:');

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function onRun(err) {
      if (err) {
        reject(err);
        return;
      }
      resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });
}

let queue = Promise.resolve();

function transaction(work) {
  const next = queue.then(async () => {
    await run('BEGIN');
    try {
      const result = await work();
      await run('COMMIT');
      return result;
    } catch (error) {
      await run('ROLLBACK');
      throw error;
    }
  });
  queue = next.catch(() => undefined);
  return next;
}

const CATEGORIES = [
  [1, 'Periféricos', 'perifericos'],
  [2, 'Pantallas', 'pantallas'],
  [3, 'Audio', 'audio'],
  [4, 'Accesorios', 'accesorios']
];

const PRODUCTS = [
  [1, 1, 'Teclado mecánico TKL', 'Switches lineales, layout compacto sin teclado numérico y retroiluminación blanca. Cable USB-C desmontable.', 49.9, 25, 4.6, '⌨️'],
  [2, 1, 'Mouse inalámbrico Pro', 'Sensor de 4000 DPI, receptor USB y Bluetooth. Hasta 12 meses de autonomía con una sola pila.', 24.5, 40, 4.4, '🖱️'],
  [3, 1, 'Mouse gamer RGB', 'Seis botones programables, 7200 DPI y cable trenzado. Iluminación personalizable por zonas.', 32.0, 18, 4.2, '🖲️'],
  [4, 2, 'Monitor 24" Full HD', 'Panel IPS de 75 Hz con bordes delgados, entradas HDMI y DisplayPort, soporte inclinable.', 149.0, 12, 4.5, '🖥️'],
  [5, 2, 'Monitor curvo 27"', 'Curvatura 1500R, resolución QHD, 144 Hz y tiempo de respuesta de 1 ms. Ideal para trabajo y juegos.', 229.0, 7, 4.7, '📺'],
  [6, 2, 'Monitor portátil 15.6"', 'Delgado y ligero, se conecta por un solo cable USB-C. Incluye funda protectora magnética.', 119.9, 3, 4.1, '💻'],
  [7, 3, 'Audífonos Bluetooth ANC', 'Cancelación activa de ruido, 35 horas de batería y carga rápida. Micrófono con reducción de eco.', 89.0, 22, 4.8, '🎧'],
  [8, 3, 'Parlante portátil', 'Sonido 360°, resistente al agua IPX6 y 14 horas de reproducción continua.', 39.9, 30, 4.3, '🔊'],
  [9, 3, 'Micrófono USB', 'Condensador cardioide con trípode, perilla de ganancia y salida de monitoreo sin latencia.', 54.0, 9, 4.5, '🎙️'],
  [10, 4, 'Hub USB-C 7 en 1', 'HDMI 4K, lector SD y microSD, dos puertos USB 3.0 y carga pasante de 100 W.', 29.9, 50, 4.4, '🔌'],
  [11, 4, 'Soporte para laptop', 'Aluminio plegable con seis niveles de altura y almohadillas antideslizantes.', 21.5, 0, 4.2, '📐'],
  [12, 4, 'Webcam 1080p', 'Enfoque automático, micrófono doble y tapa de privacidad integrada.', 34.9, 16, 4.0, '📷']
];

const REVIEWS = [
  [1, 'carolina', 5, 'Muy buen teclado, el sonido de los switches es suave y se siente sólido.'],
  [1, 'andres_m', 4, 'Cumple de sobra por el precio. Le faltaría un poco más de peso.'],
  [4, 'laura', 5, 'Colores muy buenos para el precio, lo uso todo el día para trabajar.'],
  [5, 'diego', 5, 'La curvatura se nota y los 144 Hz hacen una diferencia enorme.'],
  [7, 'sofia', 5, 'La cancelación de ruido funciona muy bien en el transporte público.'],
  [7, 'mateo', 4, 'Cómodos y con muy buena batería. La app podría ser mejor.'],
  [9, 'valentina', 4, 'Excelente calidad de voz para reuniones y grabaciones.'],
  [12, 'julian', 3, 'Buena imagen con luz natural, con poca luz pierde detalle.']
];

db.serialize(() => {
  db.run('PRAGMA foreign_keys = ON');
  db.run(`CREATE TABLE categories (
    id INTEGER PRIMARY KEY,
    name TEXT NOT NULL,
    slug TEXT NOT NULL UNIQUE
  )`);
  db.run(`CREATE TABLE products (
    id INTEGER PRIMARY KEY,
    category_id INTEGER NOT NULL REFERENCES categories(id),
    name TEXT NOT NULL,
    description TEXT,
    price REAL NOT NULL,
    stock INTEGER NOT NULL DEFAULT 0,
    rating REAL NOT NULL DEFAULT 0,
    emoji TEXT
  )`);
  db.run(`CREATE TABLE reviews (
    id INTEGER PRIMARY KEY,
    product_id INTEGER NOT NULL REFERENCES products(id),
    author TEXT NOT NULL,
    rating INTEGER NOT NULL,
    comment TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE orders (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL,
    full_name TEXT NOT NULL,
    address TEXT NOT NULL,
    city TEXT NOT NULL,
    subtotal REAL NOT NULL,
    shipping REAL NOT NULL,
    total REAL NOT NULL,
    status TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.run(`CREATE TABLE order_items (
    id INTEGER PRIMARY KEY,
    order_id INTEGER NOT NULL REFERENCES orders(id),
    product_id INTEGER NOT NULL REFERENCES products(id),
    quantity INTEGER NOT NULL,
    unit_price REAL NOT NULL
  )`);

  const insertCategory = db.prepare('INSERT INTO categories (id, name, slug) VALUES (?, ?, ?)');
  CATEGORIES.forEach((row) => insertCategory.run(row));
  insertCategory.finalize();

  const insertProduct = db.prepare(
    'INSERT INTO products (id, category_id, name, description, price, stock, rating, emoji) VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
  );
  PRODUCTS.forEach((row) => insertProduct.run(row));
  insertProduct.finalize();

  const insertReview = db.prepare('INSERT INTO reviews (product_id, author, rating, comment) VALUES (?, ?, ?, ?)');
  REVIEWS.forEach((row) => insertReview.run(row));
  insertReview.finalize();
});

module.exports = { db, run, get, all, transaction };
