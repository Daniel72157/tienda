function requestLogger(req, res, next) {
  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    const route = req.route ? req.baseUrl + req.route.path : 'static';
    console.log(`${new Date().toISOString()} ${req.method} ${route} ${res.statusCode} ${elapsedMs.toFixed(1)}ms`);
  });

  next();
}

module.exports = requestLogger;
