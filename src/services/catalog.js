const { all, get, run } = require('../db');
const { HttpError } = require('../utils/errors');

const LIST_SQL = `
  SELECT p.id, p.name, p.description, p.price, p.stock, p.rating, p.emoji,
         c.name AS category, c.slug AS category_slug
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE ($category IS NULL OR c.slug = $category)
    AND ($search IS NULL OR p.name LIKE $pattern)
    AND p.price >= $minPrice
    AND p.price <= $maxPrice
  ORDER BY
    CASE WHEN $sort = 'price_asc' THEN p.price END ASC,
    CASE WHEN $sort = 'price_desc' THEN p.price END DESC,
    CASE WHEN $sort = 'rating' THEN p.rating END DESC,
    CASE WHEN $sort = 'name' THEN p.name END COLLATE NOCASE ASC,
    p.id ASC
  LIMIT $limit OFFSET $offset`;

const COUNT_SQL = `
  SELECT COUNT(*) AS total
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE ($category IS NULL OR c.slug = $category)
    AND ($search IS NULL OR p.name LIKE $pattern)
    AND p.price >= $minPrice
    AND p.price <= $maxPrice`;

const PRODUCT_SQL = `
  SELECT p.id, p.name, p.description, p.price, p.stock, p.rating, p.emoji,
         c.name AS category, c.slug AS category_slug
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE p.id = ?`;

const FEATURED_SQL = `
  SELECT p.id, p.name, p.description, p.price, p.stock, p.rating, p.emoji,
         c.name AS category, c.slug AS category_slug
  FROM products p
  JOIN categories c ON c.id = p.category_id
  WHERE p.stock > 0
  ORDER BY p.rating DESC, p.id ASC
  LIMIT 4`;

async function listProducts(options = {}) {
  const {
    category = null,
    search = null,
    sort = 'relevance',
    minPrice = 0,
    maxPrice = 100000,
    page = 1,
    pageSize = 8
  } = options;

  const filters = {
    $category: category,
    $search: search,
    $pattern: search ? `%${search}%` : null,
    $minPrice: minPrice,
    $maxPrice: maxPrice
  };

  const { total } = await get(COUNT_SQL, filters);
  const items = await all(LIST_SQL, {
    ...filters,
    $sort: sort,
    $limit: pageSize,
    $offset: (page - 1) * pageSize
  });

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

function listFeatured() {
  return all(FEATURED_SQL);
}

function listCategories() {
  return all(`
    SELECT c.id, c.name, c.slug, COUNT(p.id) AS total
    FROM categories c
    LEFT JOIN products p ON p.category_id = c.id
    GROUP BY c.id
    ORDER BY c.id`);
}

async function getProduct(id) {
  const product = await get(PRODUCT_SQL, [id]);
  if (!product) {
    throw new HttpError(404, 'Producto no encontrado');
  }
  const reviews = await all(
    'SELECT id, author, rating, comment, created_at FROM reviews WHERE product_id = ? ORDER BY id DESC LIMIT 20',
    [id]
  );
  return { ...product, reviews };
}

async function addReview(productId, author, rating, comment) {
  const product = await get('SELECT id FROM products WHERE id = ?', [productId]);
  if (!product) {
    throw new HttpError(404, 'Producto no encontrado');
  }
  await run('INSERT INTO reviews (product_id, author, rating, comment) VALUES (?, ?, ?, ?)', [
    productId,
    author,
    rating,
    comment
  ]);
  await run(
    'UPDATE products SET rating = (SELECT ROUND(AVG(rating), 1) FROM reviews WHERE product_id = ?) WHERE id = ?',
    [productId, productId]
  );
  return getProduct(productId);
}

module.exports = { listProducts, listFeatured, listCategories, getProduct, addReview };
