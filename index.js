// const express = require('express');
// const dotenv = require('dotenv');
// const productRoutes = require('./routes/productRoutes');
// // const orderRoutes = require('./routes/orderRoutes');

// dotenv.config();
// // console.log('Loaded SHOPIFY_SHOP:', process.env.SHOPIFY_SHOP);

// const app = express();
// app.use(express.json());

// app.use('/api/products', productRoutes);
// // app.use('/api/orders', orderRoutes);

// const PORT = process.env.PORT || 3001;
// app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors'); 
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');

dotenv.config();

const app = express();
app.use(express.json());

// Enable CORS for frontend
app.use(
  cors({
    origin: 'http://localhost:5173', // allow this origin
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    credentials: true,
  })
);

app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

