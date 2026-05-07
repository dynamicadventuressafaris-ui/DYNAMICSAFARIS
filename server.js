const express = require('express');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
const pool = require('./db');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Media Upload Engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: { folder: 'voyagevibe_trips' }
});
const upload = multer({ storage: storage });

// --- ROUTES ---

// A. PUBLIC API: Fetch All with Filter Logic
app.get('/api/trips', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM adventures ORDER BY event_date ASC');
    const now = new Date();

    const processedTrips = result.rows.map(trip => {
      const deadline = new Date(trip.booking_deadline);
      const eventDate = new Date(trip.event_date);
      
      let status = 'Open';
      if (now > eventDate) status = 'Archive';
      else if (now > deadline) status = 'Closed';

      return { ...trip, status };
    });

    res.json(processedTrips);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// B. ADMIN API: Create Trip (Handles Media + DB)
app.post('/api/admin/add-trip', upload.single('image'), async (req, res) => {
  try {
    const { title, description, price, requirements, deadline, event_date } = req.body;
    const imageUrl = req.file ? req.file.path : null;

    const newTrip = await pool.query(
      `INSERT INTO adventures (title, description, price, image_url, requirements, booking_deadline, event_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [title, description, price, imageUrl, requirements, deadline, event_date]
    );

    res.json(newTrip.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`VoyageVibe active on port ${PORT}`));
