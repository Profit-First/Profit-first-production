/**
 * Shopify GraphQL Service
 * 
 * Uses Shopify's GraphQL Admin API for efficient data fetching
 * Reference: https://shopify.dev/docs/api/admin-graphql
 */

const axios = require('axios');
const { PutCommand, BatchWriteCommand } = require('@aws-sdk/lib-dynamodb');
const { dynamoDB } = require('../config/aws.config');

// Table names
const PRODUCTS_TABLE = process.env.SHOPIFY_PRODUCTS_TABLE || 'shopify_products';
const ORDERS_TABLE = process.env.SHOPIFY_ORDERS_TABLE || 'shopify_orders';
const CUSTOMERS_TABLE = process.env.SHOPIFY_CUSTOMERS_TABLE || 'shopify_customers';

class ShopifyGraphQLService {
  constructor() {
    this.apiVersion = '2024-01';
  }

  /**
   * Execute GraphQL query
   */
  async executeGraphQL(shopUrl, accessToken, query, variables = {}) {
    try {
      const response = await axios.post(
        `https://${shopUrl}/admin/api/${this.apiVersion}/graphql.json`,
        {
          query,
          variables
        },
        {
          headers: {
            'X-Shopify-Access-Token': accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.errors) {
        console.error('GraphQL Errors:', response.data.errors);
        throw new Error(response.data.errors[0].message);
      }

      return response.data.data;
    } catch (error) {
      console.error('GraphQL execution error:', error.message);
      throw error;
    }
  }

  /**
   * Fetch Products using GraphQL
   * More efficient than REST API - fetches only needed fields
   */
  async fetchProducts(userId, shopUrl, accessToken, cursor = null, limit = 50) {
    console.log(`📦 Fetching products via GraphQL (limit: ${limit})...`);

    const query = `
      query GetProducts($first: Int!, $after: String) {
        products(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              title
              description
              handle
              status
              vendor
              productType
              tags
              createdAt
              updatedAt
              publishedAt
              totalInventory
              variants(first: 100) {
                edges {
                  node {
                    id
                    title
                    price
                    compareAtPrice
                    sku
                    barcode
                    inventoryQuantity
                    weight
                    weightUnit
                    requiresShipping
                    taxable
                    image {
                      url
                      altText
                    }
                  }
                }
              }
              images(first: 10) {
                edges {
                  node {
                    url
                    altText
                    width
                    height
                  }
                }
              }
              featuredImage {
                url
                altText
              }
              options {
                id
                name
                values
              }
              priceRangeV2 {
                minVariantPrice {
                  amount
                  currencyCode
                }
                maxVariantPrice {
                  amount
                  currencyCode
                }
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    try {
      const data = await this.executeGraphQL(shopUrl, accessToken, query, {
        first: limit,
        after: cursor
      });

      const products = data.products.edges.map(edge => ({
        cursor: edge.cursor,
        ...this.transformProduct(edge.node)
      }));

      // Store in DynamoDB
      await this.storeProducts(userId, shopUrl, products);

      console.log(`   ✅ Fetched ${products.length} products`);

      return {
        success: true,
        products,
        pageInfo: data.products.pageInfo,
        count: products.length
      };
    } catch (error) {
      console.error(`   ❌ Product fetch failed:`, error.message);
      return { success: false, error: error.message, count: 0 };
    }
  }

  /**
   * Fetch Orders using GraphQL
   * Includes line items, customer info, and financial details
   */
  async fetchOrders(userId, shopUrl, accessToken, cursor = null, limit = 50, createdAfter = null) {
    console.log(`📋 Fetching orders via GraphQL (limit: ${limit})...`);

    const query = `
      query GetOrders($first: Int!, $after: String, $query: String) {
        orders(first: $first, after: $after, query: $query) {
          edges {
            cursor
            node {
              id
              name
              email
              phone
              createdAt
              updatedAt
              processedAt
              cancelledAt
              closedAt
              test
              confirmed
              displayFinancialStatus
              displayFulfillmentStatus
              subtotalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              totalPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              totalShippingPriceSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              totalTaxSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              totalDiscountsSet {
                shopMoney {
                  amount
                  currencyCode
                }
              }
              customer {
                id
                firstName
                lastName
                email
                phone
                ordersCount
                totalSpentV2 {
                  amount
                  currencyCode
                }
              }
              lineItems(first: 100) {
                edges {
                  node {
                    id
                    title
                    quantity
                    variant {
                      id
                      title
                      sku
                      price
                      product {
                        id
                        title
                      }
                    }
                    originalUnitPriceSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                    discountedUnitPriceSet {
                      shopMoney {
                        amount
                        currencyCode
                      }
                    }
                  }
                }
              }
              shippingAddress {
                firstName
                lastName
                address1
                address2
                city
                province
                country
                zip
                phone
              }
              billingAddress {
                firstName
                lastName
                address1
                address2
                city
                province
                country
                zip
                phone
              }
              tags
              note
              customerLocale
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    try {
      // Build query string for filtering
      let queryString = '';
      if (createdAfter) {
        queryString = `created_at:>='${createdAfter}'`;
      }

      const data = await this.executeGraphQL(shopUrl, accessToken, query, {
        first: limit,
        after: cursor,
        query: queryString || undefined
      });

      const orders = data.orders.edges.map(edge => ({
        cursor: edge.cursor,
        ...this.transformOrder(edge.node)
      }));

      // Store in DynamoDB
      await this.storeOrders(userId, shopUrl, orders);

      console.log(`   ✅ Fetched ${orders.length} orders`);

      return {
        success: true,
        orders,
        pageInfo: data.orders.pageInfo,
        count: orders.length
      };
    } catch (error) {
      console.error(`   ❌ Order fetch failed:`, error.message);
      return { success: false, error: error.message, count: 0 };
    }
  }

  /**
   * Fetch Customers using GraphQL
   * Includes order history and spending data
   */
  async fetchCustomers(userId, shopUrl, accessToken, cursor = null, limit = 50, createdAfter = null) {
    console.log(`👥 Fetching customers via GraphQL (limit: ${limit})...`);

    const query = `
      query GetCustomers($first: Int!, $after: String, $query: String) {
        customers(first: $first, after: $after, query: $query) {
          edges {
            cursor
            node {
              id
              firstName
              lastName
              email
              phone
              createdAt
              updatedAt
              state
              note
              verifiedEmail
              taxExempt
              tags
              ordersCount
              totalSpentV2 {
                amount
                currencyCode
              }
              addresses {
                id
                firstName
                lastName
                address1
                address2
                city
                province
                country
                zip
                phone
              }
              defaultAddress {
                id
                firstName
                lastName
                address1
                address2
                city
                province
                country
                zip
                phone
              }
              lastOrder {
                id
                name
                createdAt
                totalPriceSet {
                  shopMoney {
                    amount
                    currencyCode
                  }
                }
              }
              numberOfOrders
              amountSpent {
                amount
                currencyCode
              }
            }
          }
          pageInfo {
            hasNextPage
            endCursor
          }
        }
      }
    `;

    try {
      // Build query string for filtering
      let queryString = '';
      if (createdAfter) {
        queryString = `created_at:>='${createdAfter}'`;
      }

      const data = await this.executeGraphQL(shopUrl, accessToken, query, {
        first: limit,
        after: cursor,
        query: queryString || undefined
      });

      const customers = data.customers.edges.map(edge => ({
        cursor: edge.cursor,
        ...this.transformCustomer(edge.node)
      }));

      // Store in DynamoDB
      await this.storeCustomers(userId, shopUrl, customers);

      console.log(`   ✅ Fetched ${customers.length} customers`);

      return {
        success: true,
        customers,
        pageInfo: data.customers.pageInfo,
        count: customers.length
      };
    } catch (error) {
      console.error(`   ❌ Customer fetch failed:`, error.message);
      return { success: false, error: error.message, count: 0 };
    }
  }

  /**
   * Fetch all products with pagination
   */
  async fetchAllProducts(userId, shopUrl, accessToken) {
    console.log(`\n📦 Fetching ALL products...`);
    
    let allProducts = [];
    let hasNextPage = true;
    let cursor = null;
    let pageCount = 0;

    while (hasNextPage) {
      pageCount++;
      console.log(`   Page ${pageCount}...`);
      
      const result = await this.fetchProducts(userId, shopUrl, accessToken, cursor, 50);
      
      if (!result.success) {
        break;
      }

      allProducts = allProducts.concat(result.products);
      hasNextPage = result.pageInfo.hasNextPage;
      cursor = result.pageInfo.endCursor;

      // Add delay to avoid rate limiting
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`\n✅ Total products fetched: ${allProducts.length}\n`);
    
    return {
      success: true,
      products: allProducts,
      count: allProducts.length
    };
  }

  /**
   * Fetch all orders with pagination
   */
  async fetchAllOrders(userId, shopUrl, accessToken, createdAfter = null) {
    console.log(`\n📋 Fetching ALL orders...`);
    
    let allOrders = [];
    let hasNextPage = true;
    let cursor = null;
    let pageCount = 0;

    while (hasNextPage) {
      pageCount++;
      console.log(`   Page ${pageCount}...`);
      
      const result = await this.fetchOrders(userId, shopUrl, accessToken, cursor, 50, createdAfter);
      
      if (!result.success) {
        break;
      }

      allOrders = allOrders.concat(result.orders);
      hasNextPage = result.pageInfo.hasNextPage;
      cursor = result.pageInfo.endCursor;

      // Add delay to avoid rate limiting
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`\n✅ Total orders fetched: ${allOrders.length}\n`);
    
    return {
      success: true,
      orders: allOrders,
      count: allOrders.length
    };
  }

  /**
   * Fetch all customers with pagination
   */
  async fetchAllCustomers(userId, shopUrl, accessToken, createdAfter = null) {
    console.log(`\n👥 Fetching ALL customers...`);
    
    let allCustomers = [];
    let hasNextPage = true;
    let cursor = null;
    let pageCount = 0;

    while (hasNextPage) {
      pageCount++;
      console.log(`   Page ${pageCount}...`);
      
      const result = await this.fetchCustomers(userId, shopUrl, accessToken, cursor, 50, createdAfter);
      
      if (!result.success) {
        break;
      }

      allCustomers = allCustomers.concat(result.customers);
      hasNextPage = result.pageInfo.hasNextPage;
      cursor = result.pageInfo.endCursor;

      // Add delay to avoid rate limiting
      if (hasNextPage) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    console.log(`\n✅ Total customers fetched: ${allCustomers.length}\n`);
    
    return {
      success: true,
      customers: allCustomers,
      count: allCustomers.length
    };
  }

  /**
   * Transform GraphQL product to storage format
   */
  transformProduct(node) {
    // Extract numeric ID from GraphQL global ID
    const productId = node.id.split('/').pop();
    
    return {
      id: productId,
      title: node.title,
      description: node.description,
      handle: node.handle,
      status: node.status,
      vendor: node.vendor,
      productType: node.productType,
      tags: node.tags,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      publishedAt: node.publishedAt,
      totalInventory: node.totalInventory,
      variants: node.variants.edges.map(v => ({
        id: v.node.id.split('/').pop(),
        title: v.node.title,
        price: v.node.price,
        compareAtPrice: v.node.compareAtPrice,
        sku: v.node.sku,
        barcode: v.node.barcode,
        inventoryQuantity: v.node.inventoryQuantity,
        weight: v.node.weight,
        weightUnit: v.node.weightUnit,
        requiresShipping: v.node.requiresShipping,
        taxable: v.node.taxable,
        image: v.node.image
      })),
      images: node.images.edges.map(i => i.node),
      featuredImage: node.featuredImage,
      options: node.options,
      priceRange: {
        min: node.priceRangeV2.minVariantPrice.amount,
        max: node.priceRangeV2.maxVariantPrice.amount,
        currency: node.priceRangeV2.minVariantPrice.currencyCode
      }
    };
  }

  /**
   * Transform GraphQL order to storage format
   */
  transformOrder(node) {
    const orderId = node.id.split('/').pop();
    
    return {
      id: orderId,
      name: node.name,
      email: node.email,
      phone: node.phone,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      processedAt: node.processedAt,
      cancelledAt: node.cancelledAt,
      closedAt: node.closedAt,
      test: node.test,
      confirmed: node.confirmed,
      financialStatus: node.displayFinancialStatus,
      fulfillmentStatus: node.displayFulfillmentStatus,
      subtotalPrice: parseFloat(node.subtotalPriceSet.shopMoney.amount),
      totalPrice: parseFloat(node.totalPriceSet.shopMoney.amount),
      totalShipping: parseFloat(node.totalShippingPriceSet.shopMoney.amount),
      totalTax: parseFloat(node.totalTaxSet.shopMoney.amount),
      totalDiscounts: parseFloat(node.totalDiscountsSet.shopMoney.amount),
      currency: node.totalPriceSet.shopMoney.currencyCode,
      customer: node.customer ? {
        id: node.customer.id.split('/').pop(),
        firstName: node.customer.firstName,
        lastName: node.customer.lastName,
        email: node.customer.email,
        phone: node.customer.phone,
        ordersCount: node.customer.ordersCount,
        totalSpent: parseFloat(node.customer.totalSpentV2.amount)
      } : null,
      lineItems: node.lineItems.edges.map(li => ({
        id: li.node.id.split('/').pop(),
        title: li.node.title,
        quantity: li.node.quantity,
        variant: li.node.variant ? {
          id: li.node.variant.id.split('/').pop(),
          title: li.node.variant.title,
          sku: li.node.variant.sku,
          price: li.node.variant.price,
          productId: li.node.variant.product.id.split('/').pop(),
          productTitle: li.node.variant.product.title
        } : null,
        originalPrice: parseFloat(li.node.originalUnitPriceSet.shopMoney.amount),
        discountedPrice: parseFloat(li.node.discountedUnitPriceSet.shopMoney.amount)
      })),
      shippingAddress: node.shippingAddress,
      billingAddress: node.billingAddress,
      tags: node.tags,
      note: node.note,
      locale: node.customerLocale
    };
  }

  /**
   * Transform GraphQL customer to storage format
   */
  transformCustomer(node) {
    const customerId = node.id.split('/').pop();
    
    return {
      id: customerId,
      firstName: node.firstName,
      lastName: node.lastName,
      email: node.email,
      phone: node.phone,
      createdAt: node.createdAt,
      updatedAt: node.updatedAt,
      state: node.state,
      note: node.note,
      verifiedEmail: node.verifiedEmail,
      taxExempt: node.taxExempt,
      tags: node.tags,
      ordersCount: node.ordersCount,
      totalSpent: parseFloat(node.totalSpentV2.amount),
      currency: node.totalSpentV2.currencyCode,
      addresses: node.addresses,
      defaultAddress: node.defaultAddress,
      lastOrder: node.lastOrder ? {
        id: node.lastOrder.id.split('/').pop(),
        name: node.lastOrder.name,
        createdAt: node.lastOrder.createdAt,
        totalPrice: parseFloat(node.lastOrder.totalPriceSet.shopMoney.amount)
      } : null,
      numberOfOrders: node.numberOfOrders,
      amountSpent: node.amountSpent ? parseFloat(node.amountSpent.amount) : 0
    };
  }

  /**
   * Store products in DynamoDB
   */
  async storeProducts(userId, shopUrl, products) {
    for (const product of products) {
      try {
        await dynamoDB.send(new PutCommand({
          TableName: PRODUCTS_TABLE,
          Item: {
            userId,
            productId: product.id,
            shopUrl,
            productData: product,
            syncedAt: new Date().toISOString(),
            updatedAt: product.updatedAt
          }
        }));
      } catch (error) {
        console.error(`Error storing product ${product.id}:`, error.message);
      }
    }
  }

  /**
   * Store orders in DynamoDB
   */
  async storeOrders(userId, shopUrl, orders) {
    for (const order of orders) {
      try {
        await dynamoDB.send(new PutCommand({
          TableName: ORDERS_TABLE,
          Item: {
            userId,
            orderId: order.id,
            shopUrl,
            orderData: order,
            syncedAt: new Date().toISOString(),
            createdAt: order.createdAt,
            updatedAt: order.updatedAt,
            totalPrice: order.totalPrice,
            orderName: order.name
          }
        }));
      } catch (error) {
        console.error(`Error storing order ${order.id}:`, error.message);
      }
    }
  }

  /**
   * Store customers in DynamoDB
   */
  async storeCustomers(userId, shopUrl, customers) {
    for (const customer of customers) {
      try {
        await dynamoDB.send(new PutCommand({
          TableName: CUSTOMERS_TABLE,
          Item: {
            userId,
            customerId: customer.id,
            shopUrl,
            customerData: customer,
            syncedAt: new Date().toISOString(),
            createdAt: customer.createdAt,
            updatedAt: customer.updatedAt,
            email: customer.email,
            totalSpent: customer.totalSpent
          }
        }));
      } catch (error) {
        console.error(`Error storing customer ${customer.id}:`, error.message);
      }
    }
  }
}

module.exports = new ShopifyGraphQLService();
