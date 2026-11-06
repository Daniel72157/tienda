const express = require('express');
const { get } = require('../db');
const catalog = require('../services/catalog');
const cart = require('../services/cart');
const orders = require('../services/orders');
const { HttpError } = require('../utils/errors');
const { asyncHandler, requireAuth, parseId } = require('../utils/http');
const { toInt, toPrice, toSort, toSlug, cleanText } = require('../utils/validators');

const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'ok', uptime: Math.round(process.uptime()) });
});

router.get('/me', asyncHandler(async (req, res) => {
  if (!req.session.userId) {
    return res.json({ authenticated: false });
  }
  const user = await get('SELECT id, username, role FROM users WHERE id = ?', [req.session.userId]);
  return res.json(user ? { authenticated: true, user } : { authenticated: false });
}));

router.post('/logout', (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      return next(err);
    }
    res.clearCookie('connect.sid');
    return res.json({ ok: true });
  });
});

router.get('/categories', asyncHandler(async (req, res) => {
  res.json(await catalog.listCategories());
}));

router.get('/products', asyncHandler(async (req, res) => {
  const search = cleanText(req.query.q, 60);
  const result = await catalog.listProducts({
    category: toSlug(req.query.category),
    search: search || null,
    sort: toSort(req.query.sort),
    minPrice: toPrice(req.query.min, 0),
    maxPrice: toPrice(req.query.max, 100000),
    page: toInt(req.query.page, 1, 1, 1000),
    pageSize: toInt(req.query.pageSize, 8, 1, 24)
  });
  res.json(result);
}));

router.get('/products/featured', asyncHandler(async (req, res) => {
  res.json(await catalog.listFeatured());
}));

router.get('/products/:id', asyncHandler(async (req, res) => {
  res.json(await catalog.getProduct(parseId(req.params.id)));
}));

router.post('/products/:id/reviews', requireAuth, asyncHandler(async (req, res) => {
  const productId = parseId(req.params.id);
  const rating = toInt(req.body.rating, 0, 0, 5);
  const comment = cleanText(req.body.comment, 400);
  if (rating < 1 || comment.length < 3) {
    throw new HttpError(400, 'Elige una calificación y escribe un comentario');
  }
  const user = await get('SELECT username FROM users WHERE id = ?', [req.session.userId]);
  if (!user) {
    throw new HttpError(401, 'Tu sesión ya no es válida');
  }
  res.status(201).json(await catalog.addReview(productId, user.username, rating, comment));
}));

router.get('/cart', asyncHandler(async (req, res) => {
  res.json(await cart.describeCart(req.session));
}));

router.post('/cart/items', asyncHandler(async (req, res) => {
  const productId = parseId(req.body.productId);
  const quantity = toInt(req.body.quantity, 1, 1, 10);
  res.status(201).json(await cart.addItem(req.session, productId, quantity));
}));

router.patch('/cart/items/:productId', asyncHandler(async (req, res) => {
  const productId = parseId(req.params.productId);
  const quantity = toInt(req.body.quantity, 0, 0, 10);
  res.json(await cart.setQuantity(req.session, productId, quantity));
}));

router.delete('/cart/items/:productId', asyncHandler(async (req, res) => {
  res.json(await cart.removeItem(req.session, parseId(req.params.productId)));
}));

router.delete('/cart', asyncHandler(async (req, res) => {
  cart.clearCart(req.session);
  res.json(await cart.describeCart(req.session));
}));

router.get('/orders', requireAuth, asyncHandler(async (req, res) => {
  res.json(await orders.listOrders(req.session.userId));
}));

router.get('/orders/:id', requireAuth, asyncHandler(async (req, res) => {
  res.json(await orders.getOrder(req.session.userId, parseId(req.params.id)));
}));

router.post('/orders', requireAuth, asyncHandler(async (req, res) => {
  const fullName = cleanText(req.body.fullName, 80);
  const address = cleanText(req.body.address, 120);
  const city = cleanText(req.body.city, 60);
  if (!fullName || !address || !city) {
    throw new HttpError(400, 'Completa todos los datos de envío');
  }
  const order = await orders.createOrder(req.session.userId, req.session, { fullName, address, city });
  res.status(201).json(order);
}));

module.exports = router;
