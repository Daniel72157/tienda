const { get } = require('../db');
const { HttpError } = require('../utils/errors');

const FREE_SHIPPING_FROM = 100;
const SHIPPING_FEE = 5.9;
const MAX_PER_LINE = 10;

const roundMoney = (value) => Math.round((value + Number.EPSILON) * 100) / 100;

function readCart(session) {
  if (!Array.isArray(session.cart)) {
    session.cart = [];
  }
  return session.cart;
}

async function findProduct(productId) {
  const product = await get('SELECT id, name, price, stock, emoji FROM products WHERE id = ?', [productId]);
  if (!product) {
    throw new HttpError(404, 'Producto no encontrado');
  }
  return product;
}

async function describeCart(session) {
  const items = [];
  for (const line of readCart(session)) {
    const product = await findProduct(line.productId).catch(() => null);
    if (product) {
      items.push({
        ...product,
        quantity: line.quantity,
        lineTotal: roundMoney(product.price * line.quantity)
      });
    }
  }

  const subtotal = roundMoney(items.reduce((sum, item) => sum + item.lineTotal, 0));
  const count = items.reduce((sum, item) => sum + item.quantity, 0);
  let shipping = SHIPPING_FEE;
  if (items.length === 0 || subtotal >= FREE_SHIPPING_FROM) {
    shipping = 0;
  }

  return {
    items,
    count,
    subtotal,
    shipping,
    total: roundMoney(subtotal + shipping),
    freeShippingFrom: FREE_SHIPPING_FROM
  };
}

async function addItem(session, productId, quantity) {
  const product = await findProduct(productId);
  const cart = readCart(session);
  const line = cart.find((entry) => entry.productId === product.id);
  const nextQuantity = Math.min((line ? line.quantity : 0) + quantity, MAX_PER_LINE);

  if (nextQuantity > product.stock) {
    throw new HttpError(409, 'No hay unidades suficientes en inventario');
  }
  if (line) {
    line.quantity = nextQuantity;
  } else {
    cart.push({ productId: product.id, quantity: nextQuantity });
  }
  return describeCart(session);
}

async function setQuantity(session, productId, quantity) {
  const cart = readCart(session);
  const line = cart.find((entry) => entry.productId === productId);
  if (!line) {
    throw new HttpError(404, 'El producto no está en el carrito');
  }
  if (quantity <= 0) {
    return removeItem(session, productId);
  }

  const product = await findProduct(productId);
  if (quantity > product.stock) {
    throw new HttpError(409, 'No hay unidades suficientes en inventario');
  }
  line.quantity = Math.min(quantity, MAX_PER_LINE);
  return describeCart(session);
}

function removeItem(session, productId) {
  session.cart = readCart(session).filter((entry) => entry.productId !== productId);
  return describeCart(session);
}

function clearCart(session) {
  session.cart = [];
}

module.exports = { describeCart, addItem, setQuantity, removeItem, clearCart };
