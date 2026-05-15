// exports.getProductsQuery = `
//   {
//     products(first: 10, sortKey: CREATED_AT, reverse: true) {
//       edges {
//         node {
//           id
//           title
//           descriptionHtml
//           createdAt
//         }
//       }
//     }
//   }
// `;
exports.getProductsQuery = `
  {
    products(first: 10, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          title
          descriptionHtml
          createdAt
          variants(first: 10) {
            edges {
              node {
                id
                title
                sku
                price
                inventoryQuantity
                inventoryItem {
                  id
                  tracked
                }
                availableForSale
              }
            }
          }
        }
      }
    }
  }
`;

exports.getProductByIdQuery = `
  query getProduct($id: ID!) {
    product(id: $id) {
      id
      title
      descriptionHtml
      vendor
      productType
      createdAt
    }
  }
`;


exports.getProductVariantByIdQuery = `
  query getProductVariants($id: ID!) {
    product(id: $id) {
      variants(first: 100) {
        edges {
          node {
            id
            sku
            inventoryItem {
              id
            }
          }
        }
      }
    }
  }
`;

exports.variantQuantityFetching = ` 
  query getVariantQuantities($variantIds: [ID!]!) { 
    nodes(ids: $variantIds) { 
      ... on ProductVariant { 
        id 
        inventoryItem { 
          id 
          inventoryLevels(first: 10) { 
            edges { 
              node { 
                location { 
                  id 
                  name 
                } 
                quantities(names: ["available"]) { 
                  name 
                  quantity 
                } 
              } 
            } 
          } 
        } 
      } 
    } 
  } 
`;


exports.getOrdersQuery = `
 {
  orders(first: 10, sortKey: CREATED_AT, reverse: true) {
    edges {
      node {
        id
        name
        createdAt
        displayFinancialStatus
        displayFulfillmentStatus
        totalPriceSet {
          shopMoney {
            amount
            currencyCode
          }
        }
        customer {
          firstName
          lastName
          email
        }
        lineItems(first: 20) {
          edges {
            node {
              id
              title
              quantity
              variantTitle
              sku
              originalUnitPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              product {
                id
                title
              }
              variant {
                id
              }
            }
          }
        }
      }
    }
  }
}
`;

exports.getDraftOrdersQuery = `
  {
    draftOrders(first: 10, sortKey: CREATED_AT, reverse: true) {
      edges {
        node {
          id
          name
          email
          createdAt
          status
          lineItems(first: 10) {
            edges {
              node {
                id
                title
                quantity
              }
            }
          }
        }
      }
    }
  }
`;

exports.getOrderLineItemsQuery = (orderId) => {
  return `
    query {
      order(id: "${orderId}") {
        id
        name
        lineItems(first: 100) {
          edges {
            node {
              id
              title
              quantity
              variantTitle
              sku
              originalUnitPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              product {
                id
                title
              }
              variant {
                id
                title
                image {
                  url
                  altText
                }
              }
            }
          }
        }
      }
    }
  `;
}



exports.getOrderDetailsForSyncQuery = `
  query getOrderDetails($id: ID!) {
    order(id: $id) {
      id
      totalPriceSet {
        shopMoney {
          amount
        }
      }
      subtotalPriceSet {
        shopMoney {
          amount
        }
      }
      currentTotalPriceSet {
        shopMoney {
          amount
        }
      }
      currentSubtotalPriceSet {
        shopMoney {
          amount
        }
      }
      totalShippingPriceSet {
        shopMoney {
          amount
        }
      }
      totalTaxSet {
        shopMoney {
          amount
        }
      }
      currentTotalTaxSet {
        shopMoney {
          amount
        }
      }
    }
  }
`;

