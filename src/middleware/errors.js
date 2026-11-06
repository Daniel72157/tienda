const { HttpError } = require('../utils/errors');

function notFound(req, res) {
  res.status(404).json({ error: 'Recurso no encontrado' });
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message });
  }
  if (err.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'El cuerpo de la solicitud no es un JSON válido' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'La solicitud es demasiado grande' });
  }
  console.error('Error no controlado:', err.message);
  return res.status(500).json({ error: 'Error interno del servidor' });
}

module.exports = { notFound, errorHandler };
