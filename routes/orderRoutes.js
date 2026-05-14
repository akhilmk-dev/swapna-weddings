const express = require('express');
const router = express.Router();
const { handleOrderEditWebhook } = require('../services/shopifyService');


router.post('/webhook/order-edit', handleOrderEditWebhook);

module.exports = router;