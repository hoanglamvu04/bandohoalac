/**
 * Bounded read-through cache with concurrent-request singleflight.
 * Intended exclusively for non-identifying public aggregate data.
 * Never use it to cache access-controlled or mutable user records.
 */
export function createReadThroughCache({
  ttlMs = 60000, maxEntries = 128, now = () => Date.now()
} = {}) {
  if (!Number.isInteger(ttlMs) || ttlMs < 0 ||
      !Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 1000) {
    throw new TypeError('Invalid read-through cache limits');
  }
  const values = new Map();
  const running = new Map();
  async function read(key, load) {
    if (typeof key !== 'string' || !key.length || key.length > 512 ||
        typeof load !== 'function') {
      throw new TypeError('Invalid public aggregate cache key or loader');
    }
    const cached = values.get(key);
    if (cached && cached.expiresAt > now()) return cached.value;
    if (running.has(key)) return running.get(key);

    const task = Promise.resolve().then(load)
      .then((result) => {
        values.delete(key);
        values.set(key, { value: result, expiresAt: now() + ttlMs });
        while (values.size > maxEntries) {
          values.delete(values.keys().next().value);
        }
        return result;
      })
      .finally(() => {
        if (running.get(key) === task) running.delete(key);
      });
    running.set(key, task);
    return task;
  }
  read.clear = () => { values.clear(); };
  read.stats = () => ({ cached: values.size, inFlight: running.size });
  return read;
}
