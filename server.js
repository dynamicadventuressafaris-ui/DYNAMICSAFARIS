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

// B. ADMIN API: Create Trip (Multiple Images & Pickups)
app.post('/api/admin/add-trip', upload.array('images', 5), async (req, res) => {
  try {
    const { title, description, price, requirements, pickups, deadline, event_date } = req.body;
    
    // Map Cloudinary URLs into a JSON array
    const imageUrls = req.files ? JSON.stringify(req.files.map(file => file.path)) : '[]';

    const newTrip = await pool.query(
      `INSERT INTO adventures (title, description, price, image_url, requirements, pickups, booking_deadline, event_date) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [title, description, price, imageUrls, requirements, pickups, deadline, event_date]
    );

    res.json(newTrip.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// C. ADMIN API: Delete a Trip
app.delete('/api/admin/trips/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.query('DELETE FROM adventures WHERE id = $1', [id]);
    res.json({ message: "Trip deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// D. ADMIN API: Update an Existing Trip
app.put('/api/admin/trips/:id', upload.array('images', 5), async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, price, requirements, pickups, deadline, event_date } = req.body;
    
    let query = `UPDATE adventures SET title=$1, description=$2, price=$3, requirements=$4, pickups=$5, booking_deadline=$6, event_date=$7`;
    let params = [title, description, price, requirements, pickups, deadline, event_date];

    // If new images were uploaded, update the image_url too
    if (req.files && req.files.length > 0) {
      const imageUrls = JSON.stringify(req.files.map(file => file.path));
      query += `, image_url=$8 WHERE id=$9`;
      params.push(imageUrls, id);
    } else {
      query += ` WHERE id=$8`;
      params.push(id);
    }

    await pool.query(query, params);
    res.json({ message: "Trip updated successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// E. ADMIN LOGIN ROUTE
app.post('/api/admin/login', async (req, res) => {
    const { email, password } = req.body;
    try {
        // Query your Neon database for the admin
        const result = await pool.query(
            'SELECT * FROM admins WHERE email = $1 AND password = $2', 
            [email, password]
        );

        if (result.rows.length > 0) {
            // Success: User found in the database
            res.json({ success: true, message: "Login successful" });
        } else {
            // Failure: No match found
            res.status(401).json({ success: false, message: "Invalid email or password" });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Server database error" });
    }
});

// --- 4. START SERVER ---
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Dynamic Adventures live on port ${PORT}`));
