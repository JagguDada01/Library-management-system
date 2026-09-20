function notFoundHandler(req, res, next) {
  res.status(404);
  if (req.accepts('html')) {
    return res.render('errors/404', {
      title: '404 - Page Not Found',
      message: 'The page or resource you requested does not exist or has been moved.'
    });
  }
  if (req.accepts('json')) {
    return res.json({ error: 'Resource not found' });
  }
  res.type('txt').send('404 Not Found');
}

function errorHandler(err, req, res, next) {
  if (res.headersSent) {
    return next(err);
  }

  // Determine status code
  const statusCode = err.statusCode || err.status || 500;

  console.error(`[Error] ${req.method} ${req.originalUrl} - Status ${statusCode}:`, err.message);
  if (process.env.NODE_ENV !== 'production') {
    console.error(err.stack);
  }

  res.status(statusCode);

  const errorTitle = {
    400: '400 - Bad Request',
    401: '401 - Unauthorized',
    403: '403 - Forbidden',
    404: '404 - Page Not Found',
    409: '409 - Conflict',
    500: '500 - Internal Server Error'
  }[statusCode] || 'Error';

  const userMessage =
    statusCode === 500 && process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred on our server. Please try again later.'
      : err.message || 'Something went wrong.';

  if (req.accepts('html')) {
    const templateName = [400, 403, 404].includes(statusCode) ? `errors/${statusCode}` : 'errors/500';
    return res.render(templateName, {
      title: errorTitle,
      message: userMessage,
      statusCode
    });
  }

  if (req.accepts('json')) {
    return res.json({
      error: userMessage,
      statusCode
    });
  }

  res.type('txt').send(`${statusCode}: ${userMessage}`);
}

module.exports = {
  notFoundHandler,
  errorHandler
};
