const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export async function getPlaces() {
  const response = await fetch(`${API_URL}/places`);
  return response.json();
}

export async function getNearbyPlaces(lat, lng) {
  const response = await fetch(`${API_URL}/places/nearby?lat=${lat}&lng=${lng}`);
  return response.json();
}
