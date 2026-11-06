const { HttpError } = require('./errors');

const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

function requireAuth(req, res, next) {
  if (!req.session || !req.session.userId) {
    return next(new HttpError(401, 'Debes iniciar sesión para continuar'));
  }
  return next();
}

function parseId(value) {
  const id = Number.parseInt(value, 10);
  if (!Number.isInteger(id) || id < 1) {
    throw new HttpError(400, 'Identificador inválido');
  }
  return id;
}

module.exports = { asyncHandler, requireAuth, parseId };
