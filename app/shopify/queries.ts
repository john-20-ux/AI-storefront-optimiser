// GraphQL Admin API documents for the catalog scan.
// Fields follow brief §11. We read only product/catalog metadata — no orders/customers.

export const PRODUCTS_QUERY = `#graphql
  query ScanProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: UPDATED_AT) {
      pageInfo {
        hasNextPage
        endCursor
      }
      nodes {
        id
        title
        handle
        status
        vendor
        productType
        tags
        descriptionHtml
        onlineStoreUrl
        totalInventory
        category {
          id
          name
        }
        seo {
          title
          description
        }
        featuredMedia {
          preview {
            image {
              url
            }
          }
        }
        options(first: 10) {
          id
          name
          optionValues {
            name
          }
        }
        media(first: 20) {
          nodes {
            id
            alt
            mediaContentType
            preview {
              image {
                url
              }
            }
          }
        }
        variants(first: 50) {
          nodes {
            id
            title
            sku
            barcode
            price
            compareAtPrice
            selectedOptions {
              name
              value
            }
          }
        }
        metafields(first: 25) {
          nodes {
            namespace
            key
            value
          }
        }
      }
    }
  }
`;

// Single product — used by the product detail / fix drawer (Sprint 4).
export const PRODUCT_BY_ID_QUERY = `#graphql
  query ScanProduct($id: ID!) {
    product(id: $id) {
      id
      title
      handle
      status
      vendor
      productType
      tags
      descriptionHtml
      onlineStoreUrl
      totalInventory
      category {
        id
        name
      }
      seo {
        title
        description
      }
      featuredMedia {
        preview {
          image {
            url
          }
        }
      }
      options(first: 10) {
        id
        name
        optionValues {
          name
        }
      }
      media(first: 20) {
        nodes {
          id
          alt
          mediaContentType
          preview {
            image {
              url
            }
          }
        }
      }
      variants(first: 50) {
        nodes {
          id
          title
          sku
          barcode
          price
          compareAtPrice
          selectedOptions {
            name
            value
          }
        }
      }
      metafields(first: 25) {
        nodes {
          namespace
          key
          value
        }
      }
    }
  }
`;
