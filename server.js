const express = require('express');
const path = require('path');
const cors = require('cors');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');
require('dotenv').config();

const app = express();

// --- 1. CONFIGURATION ---
app.use(cors());
app.use(express.json());

// Database Connection (Neon)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || "postgresql://neondb_owner:npg_yrDfL8MR0xeF@ep-lucky-pond-a1bmf9zd-pooler.c-3.eu-central-1.aws.neon.tech/neondb?sslmode=require",
});

// Cloudinary Config
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Media Upload Engine
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: { folder: 'dynamic_adventures_safaris' }
});
const upload = multer({ storage: storage });

// --- 2. SERVE FRONTEND (Fixes "Cannot GET /") ---
// This tells Express to serve your HTML, CSS, and JS files from the root directory
app.use(express.static(path.join(__dirname, '/')));

// Root Route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// --- 3. BACKEND API ROUTES ---

// A. PUBLIC API: Fetch All with Status Logic
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

// B. ADMIN API: Create Trip
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

// --- 4. START SERVER ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Dynamic Adventures live on port ${PORT}`));
