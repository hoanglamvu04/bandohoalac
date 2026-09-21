const DEFAULT_MAX_ATTEMPTS = 10;

/**
 * Starts an Express app, retrying on the next port instead of crashing when
 * the requested one is already in use (e.g. a second `npm run dev`, or
 * another process already bound to it).
 */
export function listenWithFallback(app, startPort, { maxAttempts = DEFAULT_MAX_ATTEMPTS, onListening, onFallback } = {}) {
  function attempt(port, attemptNumber) {
    const server = app.listen(port);

    server.once('listening', () => {
      if (onListening) onListening(port);
    });

    server.once('error', (err) => {
      if (err.code === 'EADDRINUSE' && attemptNumber < maxAttempts) {
        const nextPort = port + 1;
        if (onFallback) onFallback(port, nextPort);
        attempt(nextPort, attemptNumber + 1);
        return;
      }

      console.error(`Could not bind to a port starting from ${startPort} after ${attemptNumber} attempt(s): ${err.message}`);
      process.exit(1);
    });
  }

  attempt(startPort, 1);
}
