const express = require('express');
const router = express.Router();

const places = [
  { id: '1', name: 'The Lake Coffee', category: 'Cafe', rating: 4.8, lat: 21.008, lng: 105.53 },
  { id: '2', name: 'Green Villa Hoa Lac', category: 'Villa', rating: 4.9, lat: 21.02, lng: 105.51 }
];

router.get('/', (req, res) => res.json(places));

router.get('/nearby', (req, res) => {
  const { lat, lng } = req.query;
  res.json({ center: { lat, lng }, items: places });
});

module.exports = router;
