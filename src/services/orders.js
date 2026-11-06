const { all, get, run, transaction } = require('../db');
const { describeCart, clearCart } = require('./cart');
const { HttpError } = require('../utils/errors');

async function getOrder(userId, orderId) {
  const order = await get(
    `SELECT id, full_name, address, city, subtotal, shipping, total, status, created_at
     FROM orders WHERE id = ? AND user_id = ?`,
    [orderId, userId]
  );
  if (!order) {
    throw new HttpError(404, 'Pedido no encontrado');
  }
  const items = await all(
    `SELECT oi.product_id, p.name, p.emoji, oi.quantity, oi.unit_price,
            ROUND(oi.quantity * oi.unit_price, 2) AS line_total
     FROM order_items oi
     JOIN products p ON p.id = oi.product_id
     WHERE oi.order_id = ?
     ORDER BY oi.id`,
    [orderId]
  );
  return { ...order, items };
}

function listOrders(userId) {
  return all(
    `SELECT o.id, o.total, o.status, o.created_at,
            (SELECT COALESCE(SUM(quantity), 0) FROM order_items WHERE order_id = o.id) AS item_count
     FROM orders o
     WHERE o.user_id = ?
     ORDER BY o.id DESC`,
    [userId]
  );
}

async function createOrder(userId, session, shipping) {
  const cart = await describeCart(session);
  if (cart.items.length === 0) {
    throw new HttpError(400, 'Tu carrito está vacío');
  }

  const orderId = await transaction(async () => {
    for (const item of cart.items) {
      const current = await get('SELECT stock FROM products WHERE id = ?', [item.id]);
      if (!current || current.stock < item.quantity) {
        throw new HttpError(409, `No quedan unidades suficientes de ${item.name}`);
      }
    }

    const created = await run(
      `INSERT INTO orders (user_id, full_name, address, city, subtotal, shipping, total, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, shipping.fullName, shipping.address, shipping.city, cart.subtotal, cart.shipping, cart.total, 'confirmado']
    );

    for (const item of cart.items) {
      await run(
        'INSERT INTO order_items (order_id, product_id, quantity, unit_price) VALUES (?, ?, ?, ?)',
        [created.lastID, item.id, item.quantity, item.price]
      );
      await run('UPDATE products SET stock = stock - ? WHERE id = ?', [item.quantity, item.id]);
    }
    return created.lastID;
  });

  clearCart(session);
  return getOrder(userId, orderId);
}

module.exports = { createOrder, getOrder, listOrders };
