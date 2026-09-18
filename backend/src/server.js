import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const places = [
  {
    id: '1',
    name: 'The Lake Coffee',
    category: 'Cafe',
    lat: 21.008,
    lng: 105.53,
    rating: 4.8
  }
];

app.get('/api/health', (_, res) => {
  res.json({ ok: true, service: 'hola-maps-api' });
});

app.get('/api/places', (_, res) => {
  res.json(places);
});

app.listen(5000, () => {
  console.log('Hola Maps API running on port 5000');
});
