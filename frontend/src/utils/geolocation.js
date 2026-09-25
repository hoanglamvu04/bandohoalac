function normalizeGeolocationError(error) {
  if (!error) return new Error('Không thể lấy vị trí hiện tại.');

  if (error.code === 1) {
    return new Error('Bạn chưa cấp quyền vị trí. Hãy bật Location cho trình duyệt rồi thử lại.');
  }
  if (error.code === 2) {
    return new Error('Thiết bị chưa xác định được vị trí. Hãy bật GPS/Wi-Fi rồi thử lại.');
  }
  if (error.code === 3) {
    return new Error('Định vị mất quá nhiều thời gian. Hãy thử lại ở nơi thoáng hơn.');
  }

  return new Error(error.message || 'Không thể lấy vị trí hiện tại.');
}

function toLocation(position) {
  return {
    lat: Number(position.coords.latitude),
    lng: Number(position.coords.longitude),
    accuracy: Math.round(Number(position.coords.accuracy) || 0),
    altitude: Number.isFinite(Number(position.coords.altitude))
      ? Number(position.coords.altitude)
      : null,
    heading: Number.isFinite(Number(position.coords.heading))
      ? Number(position.coords.heading)
      : null,
    speed: Number.isFinite(Number(position.coords.speed))
      ? Number(position.coords.speed)
      : null,
    timestamp: Number(position.timestamp) || Date.now()
  };
}

/**
 * Collect several browser geolocation samples and keep the most accurate one.
 * Desktop Chromium often returns a coarse Wi-Fi/IP sample first and a better
 * GPS / Windows Location sample a moment later, so a single
 * getCurrentPosition() call can look visibly wrong on the map.
 */
export function getBestBrowserLocation({
  timeout = 10000,
  targetAccuracy = 40
} = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Trình duyệt không hỗ trợ định vị.'));
      return;
    }

    let best = null;
    let watchId = null;
    let timer = null;
    let settled = false;

    const cleanup = () => {
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);
      if (timer) window.clearTimeout(timer);
    };

    const finish = (value, error = null) => {
      if (settled) return;
      settled = true;
      cleanup();

      if (value) resolve(value);
      else reject(normalizeGeolocationError(error));
    };

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const candidate = toLocation(position);
        if (!Number.isFinite(candidate.lat) || !Number.isFinite(candidate.lng)) return;

        if (!best || candidate.accuracy < best.accuracy) {
          best = candidate;
        }

        if (candidate.accuracy > 0 && candidate.accuracy <= targetAccuracy) {
          finish(candidate);
        }
      },
      (error) => {
        // If we already received a usable sample, keep it instead of turning
        // a late GPS timeout into a complete failure.
        if (best) {
          finish(best);
          return;
        }

        finish(null, error);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout
      }
    );

    timer = window.setTimeout(() => {
      if (best) {
        finish(best);
      } else {
        finish(null, { code: 3 });
      }
    }, timeout);
  });
}
