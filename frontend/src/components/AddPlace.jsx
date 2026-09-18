import { useState } from 'react';

export default function AddPlace() {
  const [location, setLocation] = useState(null);

  function getLocation() {
    navigator.geolocation.getCurrentPosition((position) => {
      setLocation({
        lat: position.coords.latitude,
        lng: position.coords.longitude,
        accuracy: position.coords.accuracy
      });
    });
  }

  return (
    <section className="add-place">
      <h2>Đóng góp địa điểm</h2>
      <button onClick={getLocation}>📍 Lấy vị trí hiện tại</button>
      {location && (
        <p>
          GPS: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}<br />
          Độ chính xác: {Math.round(location.accuracy)}m
        </p>
      )}
      <input placeholder="Tên địa điểm" />
      <textarea placeholder="Mô tả trải nghiệm thực tế" />
      <button>Gửi đóng góp +20 điểm</button>
    </section>
  );
}
