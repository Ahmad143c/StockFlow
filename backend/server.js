const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
require('dotenv').config();


const path = require('path');
const app = express();
app.use(express.json());

// CORS configuration – allow all origins and handle preflight explicitly
const corsOptions = {
  origin: (origin, callback) => {
    // Allow all origins including GitHub Codespaces
    if (!origin) return callback(null, true);
    return callback(null, true);
  },
  methods: ['GET','POST','PUT','PATCH','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization'],
  credentials: true,        // allow cookies/auth headers if needed
};
app.use(cors(corsOptions));
// express-cors middleware already handles preflight; explicit app.options('*')
// registration triggers a path-to-regexp error with '*' so we omit it.

app.use(helmet());
// Serve uploads folder for file viewing
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB connected'))
  .catch(err => console.error(err));


// basic root endpoint for health-checks / info
app.get('/', (req, res) => {
  res.send('StockFlow API is running');
});

app.use('/api/auth', require('./routes/auth'));
app.use('/api/products', require('./routes/products'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/users', require('./routes/users'));
app.use('/api/purchase-orders', require('./routes/purchaseOrders'));
app.use('/api/vendors', require('./routes/vendors'));
app.use('/api/sales', require('./routes/sales'));

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || '0.0.0.0';

app.listen(PORT, HOST, () => console.log(`Server running on ${HOST}:${PORT}`));
