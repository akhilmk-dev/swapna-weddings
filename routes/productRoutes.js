const express = require('express');
const router = express.Router();
const { createProduct, getProducts, updateProduct, getProductById, bulkUpdateStockAndPrice, getStockByVariantIds, cancelOrder, getOrderList, removeLineItem, getDraftOrders, updateOrderIdMetafield, getOrderCustomOrderId,  getLineItems } = require('../services/shopifyService');
const { default: axios } = require('axios');

// POST /api/products/create
router.post('/create', createProduct);

// GET /api/products
router.get('/all', getProducts);

router.get('/:id', getProductById);

// POST /api/products/update
router.post('/update', updateProduct);
router.post('/update-stock', bulkUpdateStockAndPrice);
router.post('/stocks',getStockByVariantIds)
router.post('/cancel-order', cancelOrder);
router.post('/orders-list', getOrderList);
router.post('/remove-line-item', removeLineItem);
router.post('/line-item',getLineItems);
// router.post('/draft-orders', getDraftOrders);
router.post('/update-custom-id', updateOrderIdMetafield);
router.post('/custom-id', getOrderCustomOrderId);

module.exports = router;