const axios = require('axios');
const { productUpdateMutation, productVariantCreateMutation, productVariantStockUpdate } = require('../graphql/mutations');
const { getProductsQuery, getProductByIdQuery, getProductVariantByIdQuery, getOrdersQuery, variantQuantityFetching, getDraftOrdersQuery, getOrderLineItemsQuery, getOrderDetailsForSyncQuery } = require('../graphql/queries');

// Helper to access env at runtime
function getApiUrl() {
  return `https://${process.env.SHOPIFY_SHOP}/admin/api/2025-07/graphql.json`;
}

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Shopify-Access-Token': process.env.SHOPIFY_TOKEN,
  };
}

// Rewritten Shopify Product Creation Handler
// Supports: Product creation with or without variants
// Generate all variant combinations

function generateVariantCombinations(productOptions) {
  const [opt1, opt2] = productOptions;
  const variants = [];

  for (const val1 of opt1.values) {
    for (const val2 of opt2.values) {
      variants.push({
        title: `${val1.name} / ${val2.name}`,
        price: "9.99",
        inventoryQuantity: 10,
        inventoryManagement: "SHOPIFY",
        options: [val1.name, val2.name]
      });
    }
  }

  return variants;
}

// exports.createProduct = async (req, res) => {
//   const { title, description, vendor, productType, variants } = req.body;

//   // Step 1: Create Product
//   const productVariables = {
//     input: {
//       title: "My Patterned Product",
//       descriptionHtml: "<p>Beautiful custom product</p>",
//       vendor: "MyBrand",
//       productType: "",
//       options: ["Pattern", "Size", "Color"],
//       variants: variants.map(v => ({
//         options: [v.size, v.color],
//         price: v.price,
//         sku: v.sku
//       }))
//     }
//   };  

//   try {
//     // Create product
//     const productResponse = await axios.post(
//       getApiUrl(),
//       {
//         query:productCreateMutation,
//         variables: productVariables
//       },
//       { headers: getHeaders() }
//     );

//     console.log('Product response:', JSON.stringify(productResponse.data, null, 2));

//     // Check for top-level GraphQL errors
//     if (productResponse.data.errors) {
//       return res.status(400).json({ status:0, error: 'GraphQL error', details: productResponse.data.errors });
//     }

//     const productCreateResult = productResponse.data.data?.productCreate;

//     if (!productCreateResult) {
//       return res.status(500).json({status:0, error: 'productCreate missing in response' });
//     }

//     if (productCreateResult.userErrors.length > 0) {
//       return res.status(400).json({status:0, errors: productCreateResult.userErrors });
//     }

//     const productId = productCreateResult.product.id;
//     const createdVariants = [];

//     // Step 2: Create variants
//     for (const variant of variants || []) {
//       if (!variant.color || !variant.size ) {
//         console.warn('Skipping variant with missing color or size', variant);
//         continue;
//       }

//       const variantInput = {
//         input: {
//           productId,
//           options: [variant.size,variant.color],
//           price: variant.price,
//           sku: variant.sku,
//           barcode: variant.barcode
//         }
//       };

//       try {
//         const variantResponse = await axios.post(
//           getApiUrl(),
//           {
//             query: productVariantCreateMutation,
//             variables: variantInput
//           },
//           { headers: getHeaders() }
//         );

//         console.log('Variant response:', JSON.stringify(variantResponse.data, null, 2));

//         if (variantResponse.data.errors) {
//           console.warn('Variant GraphQL error:', variantResponse.data.errors);
//           continue;
//         }

//         const variantResult = variantResponse.data.data?.productVariantCreate;

//         if (!variantResult) {
//           console.warn('Missing productVariantCreate in variant response');
//           continue;
//         }

//         if (variantResult.userErrors.length > 0) {
//           console.warn('Variant userErrors:', variantResult.userErrors);
//           continue;
//         }

//         createdVariants.push(variantResult.productVariant);
//       } catch (variantError) {
//         console.error('Variant create error:', variantError.response?.data || variantError.message);
//         continue;
//       }
//     }

//     // Final response
//     res.json({
//       status:1,
//       product: productCreateResult.product,
//       variants: createdVariants
//     });

//   } catch (error) {
//     console.error('Create error:', error.response?.data || error.message);
//     res.status(500).json({status:0, error: 'Failed to create product and variants' });
//   }
// };

const productCreateMutation = `
  mutation productCreate($input: ProductInput!) {
    productCreate(input: $input) {
      product {
        id
        title
        options {
          id
          name
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const productVariantsBulkCreateMutation = `
  mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkCreate(productId: $productId, variants: $variants) {
      productVariants {
        id
        title
        selectedOptions {
          name
          value
        }
        sku
        inventoryItem {
          sku
        }
      }
      userErrors {
        field
        message
      }
    }
  }
`;

const getProductVariantsQuery = `
  query GetProduct($id: ID!) {
    product(id: $id) {
      variants(first: 100) {
        edges {
          node {
            id
            selectedOptions {
              name
              value
            }
          }
        }
      }
    }
  }
`;

const bulkUpdateMutation = `
    mutation productVariantsBulkUpdate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      product {
        id
      }
      productVariants {
        id
        price
        sku
        barcode
        inventoryItem {
          id
        }
      }
      userErrors {
        field
        message
      }
      }
    }
  `;

exports.createProduct = async (req, res) => {
  const { title,productType,vendor,descriptionHtml, variants=[] } = req.body;

  if (!title) {
    return res.status(400).json({ status: 0,message:"Validation failed", error:{
      "field": [
          "title"
      ],
      "message": "Title is required"
  } });
  }

  try {
    // Step 1: Create product with options
    const productOptions = [];
    if(variants?.length > 0){
      const uniqueColors = [...new Set(variants?.map(v => v.color).filter(Boolean))];
    const uniqueSizes = [...new Set(variants?.map(v => v.size).filter(Boolean))];
    const uniqueMaterial = [...new Set(variants?.map(v => v.pattern).filter(Boolean))];

    if (uniqueColors.length > 0) {
      productOptions.push({ name: "Color", values: uniqueColors.map(c => ({ name: c })) });
    }
    if (uniqueSizes.length > 0) {
      productOptions.push({ name: "Size", values: uniqueSizes.map(s => ({ name: s })) });
    }
    if (uniqueMaterial.length > 0) {
      productOptions.push({ name: "Material", values: uniqueMaterial.map(m => ({ name: m })) });
    }
    
    }
    // Validate each variant has values for all required options
for (let i = 0; i < variants?.length; i++) {
  const variant = variants[i];

  for (const option of productOptions) {
    const name = option.name;

    const missing =
      (name === "Color" && !variant.color) ||
      (name === "Size" && !variant.size) ||
      (name === "Material" && !variant.pattern);

    if (missing) {
      return res.status(400).json({
        status: 0,
        message: `Missing required option value for variant at index ${i}`,
        error: [{ field: [name=="Material" ? "Pattern":name], message: `${name=="Material" ? "Pattern":name} is required for all variants because it's defined as a product option.` }]
      });
    }
  }
}

    const productInput = {
      title,
      productType,vendor,descriptionHtml,
    };

    if( productOptions?.length >0){
      productInput. productOptions= productOptions
    }

    const productRes = await axios.post(getApiUrl(), {
      query: productCreateMutation,
      variables: { input: productInput }
    }, { headers: getHeaders() });

    const productResult = productRes.data.data?.productCreate;

    if (!productResult || productResult.userErrors.length > 0) {
      return res.status(400).json({ status: 0, error: 'Product creation failed', details: productResult?.userErrors });
    }

    const product = productResult.product;
    if(variants?.length <=0){
      return res.status(200).json({status:0,data:product})
    }
    const productId = product.id;

    // Step 2: Check for existing variants
    const existingVariantsRes = await axios.post(getApiUrl(), {
      query: getProductVariantsQuery,
      variables: { id: productId }
    }, { headers: getHeaders() });

    const existingEdges = existingVariantsRes.data.data?.product?.variants?.edges || [];
    const existingVariants = existingEdges.map(edge => {
      const node = edge.node;
      const title = node.selectedOptions.map(opt => opt.value).join(' / ');
      return {
        id: node.id,
        title,
        selectedOptions: node.selectedOptions
      };
    });
    const existingCombos = new Set(
      existingEdges.map(edge =>
        edge.node.selectedOptions.map(opt => opt.value.toLowerCase()).join('/')
      )
    );

    // Step 3: Build option ID map
    const optionMap = {};
    product.options.forEach(opt => optionMap[opt.name] = opt.id);

    const newVariants = [];
    const variantMeta = []; // to map SKU and barcode

    for (const v of variants) {
      const comboKey = `${v.color?.toLowerCase()?v.color?.toLowerCase():''}${v.size?.toLowerCase() ?`/`+v.size?.toLowerCase():''}${v.pattern?.toLowerCase()?`/`+v.pattern?.toLowerCase():''}`;
      variantMeta.push({ sku: v.sku, barcode: v.barcode, price: v.price, });
      if (existingCombos.has(comboKey)) {
        console.warn(`Skipping existing variant: ${comboKey}`);
        continue;
      }

      const optionValues = [];
      if (v?.color && optionMap["Color"]) {
        optionValues.push({ name: v.color, optionId: optionMap["Color"] });
      }
      if (v?.size && optionMap["Size"]) {
        optionValues.push({ name: v.size, optionId: optionMap["Size"] });
      }
      if (v?.pattern && optionMap["Material"]) {
        optionValues.push({ name: v?.pattern, optionId: optionMap["Material"] });
      }

      newVariants.push({
        price: v?.price,
        inventoryItem: {
          sku: v?.sku,
        },
        barcode:v?.barcode,
        optionValues
      });
    }

    // Step 4: Bulk create new variants
    const bulkRes = await axios.post(getApiUrl(), {
      query: productVariantsBulkCreateMutation,
      variables: {
        productId,
        variants: newVariants
      }
    }, { headers: getHeaders() });

    const created = bulkRes.data.data?.productVariantsBulkCreate;
    // console.log(bulkRes.data.errors);
    if (!created || created.userErrors.length > 0) {
      return res.status(400).json({
        status: 0,
        error: 'Variant bulk creation failed',
        details: created?.userErrors || []
      });
    }

    const createdVariants = [existingVariants[0]];
    // console.log(createdVariants, "createdVariants")

    const variantsToUpdate = createdVariants.map((variant, i) => {
      const meta = variantMeta[i];
      return {
        id: variant.id,
        price: meta?.price?.toString() || null,
        inventoryItem: {
          sku: meta?.sku,
          tracked: true 
        },
        barcode: meta?.barcode || null,
      };
    });

    const updateRes = await axios.post(getApiUrl(), {
      query: bulkUpdateMutation,
      variables: {
        productId,
        variants: variantsToUpdate
      }
    }, { headers: getHeaders() });

    const updateResult = updateRes.data.data?.productVariantsBulkUpdate;
    // console.log(updateRes.data.errors)

    if (!updateResult || updateResult.userErrors?.length > 0) {
      console.warn('Bulk update errors:', updateResult?.userErrors || []);
    }

    const finalVariants = updateResult?.productVariants || createdVariants;

    const fullProductRes = await axios.post(getApiUrl(), {
      query: `
       query GetFullProduct($productId: ID!) {
        product(id: $productId) {
          id
          title
          variants(first: 100) {
            edges {
              node {
                id
                barcode
                price
                sku
                inventoryItem {
                  id
                }
              }
            }
          }
      }
}
      `,
      variables: { productId }
    }, { headers: getHeaders() });

    // Step 6: Return success
    res.json({
      status: 1,
      product: fullProductRes?.data?.data?.product
    });

  } catch (err) {
    console.error('Unexpected error:', err.response?.data || err.message);
    res.status(500).json({ status: 0, error: 'Unexpected server error' });
  }
};

exports.getProducts = async (req, res) => {
  try {
    const response = await axios.post(
      getApiUrl(),
      { query: getProductsQuery },
      { headers: getHeaders() }
    );
    const products = response.data.data.products.edges.map(edge => edge.node);
    res.json({ status: 1, products });
  } catch (error) {
    console.error('Get error:', error.response?.data || error.message);
    res.status(500).json({ status: 0, error: 'Failed to get products' });
  }
};

exports.getProductById = async (req, res) => {
  //  const id = decodeURIComponent(encodedId); // ✅ decode it safely
  //  const variables = { id };
  const numericId = req.params.id;
  const gid = `gid://shopify/Product/${numericId}`;

  const variables = { id: gid };

  try {
    const response = await axios.post(
      getApiUrl(),
      { query: getProductByIdQuery, variables },
      { headers: getHeaders() }
    );

    const product = response.data.data.product;

    if (!product) {
      return res.status(404).json({ status: 0, error: 'Product not found' });
    }

    res.json({ status: 1, product });
  } catch (error) {
    console.error('Get product by ID error:', error.response?.data || error.message);
    res.status(500).json({ status: 1, error: 'Failed to fetch product' });
  }
};

exports.updateProduct = async (req, res) => {
  const { id, title, description } = req.body;
  const variables = { input: { id, title, descriptionHtml: description } };

  try {
    const response = await axios.post(
      getApiUrl(),
      { query: productUpdateMutation, variables },
      { headers: getHeaders() }
    );

    const result = response.data.data.productUpdate;

    if (result.userErrors.length) {
      return res.status(400).json({ status: 0, errors: result.userErrors });
    }

    res.json({ product: result.product });
  } catch (error) {
    console.error('Update error:', error.response?.data || error.message);
    res.status(500).json({ status: 0, error: 'Failed to update product' });
  }
};

exports.bulkUpdateStockAndPrice = async (req, res) => {
  const { updates } = req.body;

  if (!Array.isArray(updates) || updates.length === 0) {
    return res.status(400).json({ status: 0, errors: [{ message: "updates array is required." }] });
  }

  const invalidEntries = updates.map((update, index) => {
    const issues = [];

    const idCheck = (id, type) => {
      const expectedPrefix = `gid://shopify/${type}/`;
      if (
        typeof id !== "string" ||
        !id.startsWith(expectedPrefix) ||
        id.length <= expectedPrefix.length
      ) {
        issues.push({
          field: `${type.toLowerCase()}Id`,
          // value: id,
          message: `${type.toLowerCase()}Id is invalid`
        });
      }
    };

    idCheck(update.productId, "Product");
    idCheck(update.variantId, "ProductVariant");
    idCheck(update.inventoryItemId, "InventoryItem");

    const numericCheck = (value, key) => {
      if (value == null || value === "") {
        issues.push({
          field: [key],
          message: `${key} is required`
        });
      } else if (typeof value === "string") {
        issues.push({
          field: [key],
          message: `${key} must be a number, not a string`
        });
      } else if (typeof value !== "number" || isNaN(value) || value < 0) {
        issues.push({
          field: [key],
          message: `${key} must be a non-negative number`
        });
      }
    };

    numericCheck(update.price, "price");
    numericCheck(update.quantity, "quantity");

    return issues.length > 0 ? { position: index, errors: issues } : null;
  }).filter(Boolean);

  if (invalidEntries.length > 0) {
    return res.status(400).json({
      status: 0,
      message: "Validation failed",
      errors: invalidEntries
    });
  }


  try {
    // Step 1: Fetch locationId (assuming only one location is needed)
    const locationRes = await axios.post(
      getApiUrl(),
      {
        query: `
          query {
            locations(first: 1) {
              edges {
                node {
                  id
                  name
                }
              }
            }
          }
        `
      },
      { headers: getHeaders() }
    );

    const locationId = locationRes.data.data.locations.edges[0]?.node?.id;
    if (!locationId) {
      return res.status(500).json({ status: 0, errors: [{ message: "Could not retrieve locationId." }] });
    }

    // Step 2: Prepare mutations
    const bulkUpdatesMap = {}; // productId -> { variants: [] }
    const inventoryQuantities = [];

    const inventoryItemIds = updates.map(u => u.inventoryItemId);

    const inventoryQuery = `
      query getInventoryQuantities($ids: [ID!]!) {
        nodes(ids: $ids) {
          ... on InventoryItem {
            id
            inventoryLevels(first: 10) {
              edges {
                node {
                  location {
                    id
                  }
                  quantities(names: ["available", "on_hand", "committed"]) {
                    name
                    quantity
                  }
                }
              }
            }
          }
        }
      }
    `;

    const inventoryRes = await axios.post(
      getApiUrl(),
      {
        query: inventoryQuery,
        variables: { ids: inventoryItemIds }
      },
      { headers: getHeaders() }
    );

    // Map: inventoryItemId -> { available, committed, on_hand } @ location
    const currentLevelsMap = {}; // { [inventoryItemId]: number }
    // console.log(inventoryRes.data.errors)
    inventoryRes.data?.data?.nodes?.forEach(item => {
      const itemId = item?.id;
      const levels = item?.inventoryLevels?.edges || [];

      const matchingLevel = levels.find(l => l.node?.location?.id === locationId);
      if (!matchingLevel) return;

      const quantities = matchingLevel.node.quantities || [];

      const available = quantities.find(q => q.name === "available")?.quantity ?? 0;
      const committed = quantities.find(q => q.name === "committed")?.quantity ?? 0;
      const onHand = quantities.find(q => q.name === "on_hand")?.quantity ?? 0;

      currentLevelsMap[itemId] = { available, committed, onHand };
    });

    updates.forEach(({ productId, variantId, inventoryItemId, price, quantity, sku, barcode }) => {
      if (!productId || !variantId || !inventoryItemId || price == null || quantity == null) {
        throw new Error("Each update must include productId, variantId, inventoryItemId, price,, sku, barcode and quantity.");
      }

      if (!bulkUpdatesMap[productId]) {
        bulkUpdatesMap[productId] = { variants: [] };
      }

      bulkUpdatesMap[productId].variants.push({
        id: variantId,
        price: price.toString(),
        ...(barcode ? { barcode } : {}),
        inventoryItem: {
          ...(sku ? { sku } : {})
        }
      });

      const current = currentLevelsMap[inventoryItemId] ?? { available: 0, committed: 0, onHand: 0 };

      const currentAvailable = current.available;
      const currentOnHand = current.onHand;
      const committed = current.committed;

      const newAvailable = quantity;

      // To achieve newAvailable, calculate required on_hand
      const newOnHand = newAvailable + committed;

      inventoryQuantities.push({
        inventoryItemId,
        locationId,
        quantity: newOnHand
      });

      // Optional: log quantities
      // console.log(`Item: ${inventoryItemId}, Available: ${currentAvailable}, Committed: ${committed}, OnHand: ${currentOnHand}, NewOnHand: ${newOnHand}`);
    });
    // console.log(inventoryQuantities)
    const enableTrackingMutation = `
      mutation enableTracking($id: ID!, $input: InventoryItemUpdateInput!) {
        inventoryItemUpdate(id: $id, input: $input) {
          inventoryItem {
            id
            tracked
          }
          userErrors {
            field
            message
          }
        }
      }
    `;

    for (const inventoryItemId of inventoryItemIds) {
      const trackingRes = await axios.post(
        getApiUrl(),
        {
          query: enableTrackingMutation,
          variables: {
            id: inventoryItemId,
            input: {
              tracked: true
            }
          }
        },
        { headers: getHeaders() }
      );

      const result = trackingRes.data;

      if (result.errors || result.data?.inventoryItemUpdate?.userErrors?.length) {
        console.error(`Tracking failed for ${inventoryItemId}`, JSON.stringify(result, null, 2));
      } else {
        console.log(`Tracking enabled for ${inventoryItemId}`);
      }
    }

    // Step 3: Build the combined mutation
    const mutationParts = [];

    Object.entries(bulkUpdatesMap).forEach(([productId, { variants }], i) => {
      mutationParts.push(`
        updateProduct${i + 1}: productVariantsBulkUpdate(
          productId: "${productId}",
          variants: ${JSON.stringify(variants).replace(/"([^"]+)":/g, '$1:')}
        ) {
          product { id title }
          productVariants { id price }
          userErrors { field message }
        }
      `);
    });

    mutationParts.push(`
      setStock: inventorySetOnHandQuantities(
        input: {
          reason: "correction"
          setQuantities: ${JSON.stringify(inventoryQuantities).replace(/"([^"]+)":/g, '$1:')}
        }
      ) {
        userErrors { field message }
        inventoryAdjustmentGroup {
          createdAt
          reason
          referenceDocumentUri
        }
      }
    `);

    const mutation = `
      mutation {
        ${mutationParts.join('\n')}
      }
    `;

    // Step 4: Send to Shopify
    const shopifyResponse = await axios.post(
      getApiUrl(),
      { query: mutation },
      { headers: getHeaders() }
    );

    const data = shopifyResponse.data.data;
    // console.log(shopifyResponse.data.errors, "err")
    const errors = [];

    for (const key in data) {
      if (data[key]?.userErrors?.length) {
        errors.push({ position: key, errors: data[key].userErrors });
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ status: 0, message: "One or more operations failed", details: errors });
    }

    res.json({ status: 1, data: data });

  } catch (error) {
    console.error("Bulk update error:", error.response?.data || error.message);
    res.status(500).json({ status: 0, errors: [{ message: "Internal server error" }] });
  }
};

exports.getStockByVariantIds = async (req, res) => {
  const { variantIds } = req.body;

  if (!variantIds || !Array.isArray(variantIds) || variantIds.length === 0) {
    return res.status(400).json({ status: 0, errors: [{ message: "variantIds must be a non-empty array" }] });
  }

  // Pre-validate malformed variant IDs
  const malformedIds = variantIds
    .map((id, index) => {
      const prefix = "gid://shopify/ProductVariant/";
      const isMalformed =
        typeof id !== "string" ||
        !id.startsWith(prefix) ||
        id.trim().length <= prefix.length;

      return isMalformed
        ? {
          position: index,
          variantId: id,
          // message: "Malformed or missing variant ID"
        }
        : null;
    })
    .filter(Boolean);

  if (malformedIds.length > 0) {
    return res.status(400).json({
      status: 0,
      errors: [{
        message: "One or more variantIds are invalid",
        invalidVariants: malformedIds
      }]
    });
  }

  try {
    const response = await axios.post(
      getApiUrl(),
      {
        query: variantQuantityFetching,
        variables: { variantIds },
      },
      { headers: getHeaders() }
    );

    // console.log(response.data.errors)
    const nodes = response.data.data.nodes;

    // Collect all invalid variants
    const invalidVariants = nodes
      .map((variant, index) => (!variant ? {
        position: index,
        variantId: variantIds[index],
        message: "Variant not found or invalid"
      } : null))
      .filter(Boolean);

    if (invalidVariants.length > 0) {
      return res.status(400).json({
        status: 0,
        errors: [{
          message: "One or more variants not found or invalid",
          invalidVariants
        }]
      });
    }

    const result = nodes.map((variant) => {
      const levels = variant.inventoryItem?.inventoryLevels?.edges || [];
      const quantity = levels.reduce((sum, level) => {
        const q = level.node.quantities.find(q => q.name === "available");
        return sum + (q?.quantity || 0);
      }, 0);

      return {
        variantId: variant.id,
        quantity
      };
    });

    res.status(200).json({ status: 1, data:result });
  } catch (error) {
    console.error("Error fetching stock for variants:", error.response?.data || error.message);
    res.status(500).json({
      status: 0,
      message: "Failed to fetch variant stock",
      error: error.message
    });
  }
};

exports.getOrderList = async (req, res) => {
  try {
    const response = await axios.post(
      getApiUrl(),
      { query: getOrdersQuery },
      { headers: getHeaders() }
    );

    // Handle top-level GraphQL errors
    if (response.data.errors) {
      console.error("GraphQL Errors:", response.data.errors);
      return res.status(400).json({ status: 0, error: "GraphQL error", details: response.data.errors });
    }

    // Ensure data.orders exists
    const ordersData = response.data.data?.orders;
    if (!ordersData) {
      return res.status(500).json({ status: 0, error: "orders data missing in response", fullResponse: response.data });
    }

    // const orders = ordersData.edges.map(({ node }) => ({
    //   id: node.id,
    //   name: node.name,
    // }));
    // const orders = ordersData.edges.map(({ node }) => ({
    //     id: node.id,
    //     name: node.name,
    //     createdAt: node.createdAt,
    //     displayFinancialStatus: node.displayFinancialStatus,
    //     displayFulfillmentStatus: node.displayFulfillmentStatus,
    //     totalPrice: node.totalPriceSet?.shopMoney?.amount,
    //     currency: node.totalPriceSet?.shopMoney?.currencyCode,
    //     customer: {
    //       firstName: node.customer?.firstName,
    //       lastName: node.customer?.lastName,
    //       email: node.customer?.email
    //     },
    //     lineItems: node.lineItems.edges.map(({ node: item }) => ({
    //       id: item.id,
    //       title: item.title,
    //       quantity: item.quantity,
    //       variantTitle: item.variantTitle,
    //       sku: item.sku,
    //       unitPrice: item.originalUnitPriceSet?.shopMoney?.amount,
    //       currency: item.originalUnitPriceSet?.shopMoney?.currencyCode,
    //       productId: item.product?.id,
    //       productTitle: item.product?.title,
    //       variantId: item.variant?.id
    //     }))
    // }));

    res.json({ status: 1, ordersData });

  } catch (error) {
    console.error("Get orders error:", error.response?.data || error.message);
    res.status(500).json({ status: 0, errors: [{ message: "Failed to fetch orders" }] });
  }
};

exports.getLineItems = async (req, res) => {
  const { orderId, lineItemIds } = req.body;

  //  Validate orderId
  if (!orderId || !orderId.split('/').pop().trim()) {
    return res.status(400).json({
      status: 0,
      errors: [{ field: ["orderId"], message: "Valid orderId is required" }]
    });
  }

  //  Validate lineItemIds array
  if (!Array.isArray(lineItemIds) || lineItemIds.length === 0) {
    return res.status(400).json({
      status: 0,
      errors: [{ field: ["lineItemIds"], message: "At least one lineItemId is required" }]
    });
  }

  //  Validate each lineItemId format
  const invalidIds = lineItemIds.filter(id => !id || !id.split('/').pop().trim());
  if (invalidIds.length > 0) {
    return res.status(400).json({
      status: 0,
      errors: [{ field: ["lineItemIds"], message: "Some lineItemIds are invalid", invalidIds }]
    });
  }

  try {
    //  Make the GraphQL call to get order line items
    const response = await axios.post(
      getApiUrl(),
      { query: getOrderLineItemsQuery(orderId) },
      { headers: getHeaders() }
    );

    //  Check for GraphQL errors
    if (response.data.errors) {
      return res.status(400).json({
        status: 0,
        error: "GraphQL error",
        details: response.data.errors
      });
    }

    const order = response.data.data?.order;
    if (!order) {
      return res.status(404).json({ status: 0, error: "Order not found" });
    }

    const allLineItems = order.lineItems.edges.map(({ node }) => node);

    //  Filter line items that match the provided IDs
    const matchedLineItems = allLineItems.filter(item => lineItemIds.includes(item.id));

    if (matchedLineItems.length === 0) {
      return res.status(404).json({ status: 0, error: "No matching line items found in the order" });
    }

    res.json({ status: 1, lineItems: matchedLineItems });

  } catch (error) {
    console.error("Line item fetch error:", error.response?.data || error.message);
    res.status(500).json({ status: 0, error: "Failed to fetch line items" });
  }
};


exports.getDraftOrders = async (req, res) => {
  try {
    const response = await axios.post(
      getApiUrl(),
      {
        query: getDraftOrdersQuery
      },
      {
        headers: getHeaders()
      }
    );

    const draftOrders = response.data.data?.draftOrders?.edges.map(edge => edge.node) || [];

    res.json({ status: 1, draftOrders });

  } catch (error) {
    console.error("Error fetching draft orders:", error.response?.data || error.message);
    res.status(500).json({ status: 0, errors: [{ message: "Failed to fetch draft orders" }] });
  }
};

exports.cancelOrder = async (req, res) => {
  const { orderId, refund = true, restock = true, reason = "CUSTOMER" } = req.body;

  if (!orderId) {
    return res.status(400).json({ status: 0, error: [{ field: ["orderId"], message: "orderId is required" }] });
  }

  try {
    const response = await axios.post(
      getApiUrl(),
      {
        query: `
          mutation orderCancel($orderId: ID!, $refund: Boolean!, $restock: Boolean!, $reason: OrderCancelReason!) {
            orderCancel(orderId: $orderId, refund: $refund, restock: $restock, reason: $reason) {
              job {
                id
                done
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables: {
          orderId,
          refund,
          restock,
          reason
        }
      },
      { headers: getHeaders() }
    );


    const result = response.data.data?.orderCancel;
    if (!result) {
      return res.status(400).json({ status: 0, errors: [{ field: ["orderId"], message: "Invalid OrderId" }] })
    }
    if (result?.userErrors?.length) {
      return res.status(400).json({ status: 0, errors: result?.userErrors });
    }

    res.json({ status: 1, job: result?.job });

  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({ status: 0, errors: [{ message: "Failed to cancel order" }] });
  }
};

exports.removeLineItem = async (req, res) => {
  const { orderId, lineItemId, count } = req.body;

  if (!orderId) {
    return res.status(400).json({ status: 0, errors: [{ field: ["orderId"], message: "orderId is required" }] });
  }
  if (!orderId.split('/')?.[orderId.split('/')?.length - 1]?.trim()) {
    return res.status(400).json({ status: 0, errors: [{ field: ["orderId"], message: "Invalid orderId" }] });
  }
  if (!lineItemId) {
    return res.status(400).json({ status: 0, errors: [{ field: ["lineItemId"], message: "LineItemId is required" }] });
  }
  if (!lineItemId.split('/')?.[lineItemId.split('/')?.length - 1]?.trim()) {
    return res.status(400).json({ status: 0, errors: [{ field: ["lineItemId"], message: "Invalid lineItemId" }] });
  }
  if (!count) {
    return res.status(400).json({ status: 0, errors: [{ field: ["count"], message: "count is required" }] });
  }
  if (typeof count !== "number" || count <= 0) {
    return res.status(400).json({ status: 0, errors: [{ message: "count must be a positive number" }] });
  }

  try {
    // Step 1: Begin order edit 
    const beginResponse = await axios.post(
      getApiUrl(),
      {
        query: ` 
          mutation orderEditBegin($id: ID!) { 
            orderEditBegin(id: $id) { 
              calculatedOrder { 
                id 
                lineItems(first: 50) {
                  edges {
                    node {
                      id
                      title
                      quantity
                      sku
                      variant {
                        id
                        product {
                          id
                        }
                      }
                    }
                  }
                }
              }
              userErrors { 
                field 
                message 
              } 
            } 
          } 
        `,
        variables: { id: orderId },
      },
      { headers: getHeaders() }
    );

    const rawBeginData = beginResponse.data;

    if (rawBeginData.errors?.length) {
      console.error("Top-level GraphQL errors:", rawBeginData.errors);
      return res.status(400).json({ status: 0, errors: rawBeginData.errors });
    }

    const beginData = rawBeginData.data.orderEditBegin;
    if (beginData.userErrors?.length) {
      return res.status(400).json({ status: 0, errors: beginData.userErrors });
    }

    const calculatedOrder = beginData.calculatedOrder;
    const calculatedOrderId = calculatedOrder.id;

    const calculatedLineItems = calculatedOrder.lineItems.edges;

    const calculatedLineItem = calculatedLineItems.find(
      item => item.node.id.split("/").pop() === lineItemId.split("/").pop()
    );

    if (!calculatedLineItem) {
      return res.status(404).json({ status: 0, error: "Line item not found in calculated order" });
    }
    // console.log(calculatedLineItem, "calculatedLineItem")

    const calculatedLineItemId = calculatedLineItem.node.id;
    const removedQuantity = calculatedLineItem.node.quantity;
    const productId = calculatedLineItem.node.variant?.product?.id;
    const variantId = calculatedLineItem.node.variant?.id;

    const newQuantity = calculatedLineItem.node.quantity - count;

    if (newQuantity < 0) {
      return res.status(400).json({ status: 0, error: "Cannot reduce quantity below zero" });
    }

    // Step 2: Set quantity to 0 
    const setQtyResponse = await axios.post(
      getApiUrl(),
      {
        query: ` 
          mutation orderEditSetQuantity($id: ID!, $lineItemId: ID!, $quantity: Int!,$restock: Boolean) { 
            orderEditSetQuantity(id: $id, lineItemId: $lineItemId, quantity: $quantity,restock: $restock) { 
              calculatedLineItem { 
                id 
              } 
              userErrors { 
                field 
                message 
              } 
            } 
          } 
        `,
        variables: {
          id: calculatedOrderId,
          lineItemId: calculatedLineItemId,
          quantity: newQuantity,
          restock: true
        },
      },
      { headers: getHeaders() }
    );

    const rawQtyData = setQtyResponse.data;

    if (rawQtyData.errors?.length) {
      return res.status(400).json({ status: 0, errors: rawQtyData.errors });
    }

    const setQtyData = rawQtyData.data?.orderEditSetQuantity;

    if (!setQtyData) {
      return res.status(500).json({ status: 0, errors: [{ message: "Unexpected Shopify response format" }] });
    }

    if (setQtyData.userErrors?.length) {
      return res.status(400).json({ status: 0, errors: setQtyData.userErrors });
    }

    // Step 3: Commit edit 
    const commitResponse = await axios.post(
      getApiUrl(),
      {
        query: ` 
          mutation orderEditCommit($id: ID!, $notifyCustomer: Boolean!, $staffNote: String) { 
            orderEditCommit(id: $id, notifyCustomer: $notifyCustomer, staffNote: $staffNote) { 
              order { 
                id 
                name 
              } 
              userErrors { 
                field 
                message 
              } 
            } 
          } 
        `,
        variables: {
          id: calculatedOrderId,
          notifyCustomer: false,

          staffNote: "Removed line item",
        },
      },
      { headers: getHeaders() }
    );
    // console.log(commitResponse.data.errors) 
    const commitData = commitResponse.data.data.orderEditCommit;
    if (commitData.userErrors?.length) {
      return res.status(400).json({ status: 0, errors: commitData.userErrors });
    }

    res.json({
      status: 1,
      message: "Line item removed and order updated successfully.",
      order: commitData.order,
      removedLineItem: {
        id: calculatedLineItemId,
        quantityRemoved: count,
        productId: productId,
        variantId: variantId,
      }
    });
  } catch (error) {
    console.error("Remove line item error:", error.response?.data || error.message);
    res.status(500).json({ status: 0, errors: [{ message: "Failed to remove line item from order" }] });
  }
};

exports.updateOrderIdMetafield = async (req, res) => {
  const { orderGid, customOrderId } = req.body;

  const variables = {
    metafields: [
      {
        ownerId: orderGid,
        namespace: "custom",
        key: "custom_order_id",
        type: "single_line_text_field",
        value: customOrderId,
      },
    ],
  };

  try {
    const response = await axios.post(
      getApiUrl(),
      {
        query: `
          mutation metafieldsSet($metafields: [MetafieldsSetInput!]!) {
            metafieldsSet(metafields: $metafields) {
              metafields {
                id
                key
                value
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
        variables,
      },
      { headers: getHeaders() }
    );

    const result = response.data.data.metafieldsSet;

    if (result.userErrors.length) {
      return res.status(400).json({ status: 0, errors: result.userErrors });
    }

    res.json({ status: 1, metafield: result.metafields[0] });
  } catch (error) {
    console.error("Metafield update error:", error.response?.data || error.message);
    res.status(500).json({ status: 0, errors: [{ message: "Failed to update order metafield" }] });
  }
};

exports.getOrderCustomOrderId = async (req, res) => {
  const { orderGid } = req.body;

  const getOrderCustomOrderIdQuery = `
    query GetOrderCustomOrderId($id: ID!) {
      order(id: $id) {
        id
        name
        metafield(namespace: "custom", key: "custom_order_id") {
          value
        }
      }
    }
  `;

  try {
    const response = await axios.post(
      getApiUrl(),
      {
        query: getOrderCustomOrderIdQuery,
        variables: { id: orderGid },
      },
      { headers: getHeaders() }
    );

    const order = response.data.data.order;

    if (!order) {
      return res.status(404).json({ status: 0, error: "Order not found" });
    }

    res.json({
      status: 1,
      orderId: order.id,
      name: order.name,
      orderNumber: order.orderNumber,
      customOrderId: order.metafield?.value || null,
    });
  } catch (error) {
    console.error("Fetch error:", error.response?.data || error.message);
    res.status(500).json({ status: 0, errors: [{ message: "Failed to fetch order customOrderId" }] });
  }
};

exports.handleOrderEditWebhook = async (req, res) => {
  try {
    const payload = req.body;
    const orderId = payload?.order_edit?.order_id;

    if (!orderId) {
      return res.status(400).json({ status: 0, message: "order_id not found in payload" });
    }

    const gid = `gid://shopify/Order/${orderId}`;
    const variables = { id: gid };

    // Fetch order details from Shopify
    const shopifyRes = await axios.post(
      getApiUrl(),
      { query: getOrderDetailsForSyncQuery, variables },
      { headers: getHeaders() }
    );

    const orderData = shopifyRes.data.data?.order;
    if (!orderData) {
      console.error("Order not found in Shopify:", gid);
      return res.status(404).json({ status: 0, message: "Order not found in Shopify" });
    }

    // Enrich payload
    // The user wants to include order info: total amount, total product amount (subtotal), shipping amount
    const enrichedPayload = {
      ...payload,
      total_amount: orderData.totalPriceSet?.shopMoney?.amount,
      subtotal_amount: orderData.subtotalPriceSet?.shopMoney?.amount,
      shipping_amount: orderData.totalShippingPriceSet?.shopMoney?.amount
    };

    // Send to ERP API
    const erpApiUrl = "https://fynbooks.com:8090/ERP_V_0.1/BillPrintFormat/PrintFormat/swapna_online_order.php?mode=3";
    
    // Using axios to POST the enriched payload
    const erpRes = await axios.post(erpApiUrl, enrichedPayload);

    console.log("ERP API Response:", erpRes.status, erpRes.data);

    res.json({
      status: 1,
      message: "Webhook processed and sent to ERP",
      erp_response: erpRes.data
    });

  } catch (error) {
    console.error("Error handling order edit webhook:", error.response?.data || error.message);
    res.status(500).json({ status: 0, error: "Failed to process order edit webhook", details: error.message });
  }
};