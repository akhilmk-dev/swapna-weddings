exports.productCreateMutation = `
  mutation productCreate($input: ProductInput!) {
  productCreate(input: $input) {
    product {
      id
      title
      variants(first: 10) {
        edges {
          node {
            id
            title
            price
            sku
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
`;
exports.productVariantCreateMutation = `
  mutation productVariantCreate($input: ProductVariantInput!) {
    productVariantCreate(input: $input) {
      productVariant {
        id
        title
        price
        sku
      }
      userErrors {
        field
        message
      }
    }
  }
`;

exports.productVariantStockUpdate = `
  mutation inventoryAdjustQuantities($input: InventoryAdjustQuantitiesInput!) {
  inventoryAdjustQuantities(input: $input) {
    userErrors {
      field
      message
    }
    inventoryAdjustmentGroup {
      createdAt
      reason
      referenceDocumentUri
      changes {
        name
        delta
      }
    }
  }
}
`;

// exports.productVariantsBulkCreateMutation = `
//   mutation productVariantsBulkCreate($variants: [ProductVariantInput!]!) {
//     productVariantsBulkCreate(variants: $variants) {
//       productVariants {
//         id
//         title
//         price
//         sku
//       }
//       userErrors {
//         field
//         message
//       }
//     }
//   }
// `;

exports.productUpdateMutation = `
  mutation productUpdate($input: ProductInput!) {
    productUpdate(input: $input) {
      product {
        id
        title
        descriptionHtml
      }
      userErrors {
        field
        message
      }
    }
  }
`;


