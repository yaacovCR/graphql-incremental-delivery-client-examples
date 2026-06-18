export interface GraphQLOperationRequest<
  TVariables extends Record<string, unknown> = Record<string, unknown>,
> {
  operationName?: string;
  query: string;
  variables?: TVariables;
}

export interface ProductPageData {
  product: Product;
  recommendations: Array<Recommendation>;
}

export interface Product {
  id: string;
  name: string;
  summary: ProductSummary;
}

export interface ProductSummary {
  inventoryStatus: string;
  rating: number;
  reviewCount: number;
}

export interface Recommendation {
  id: string;
  name: string;
  reason: string;
}

export interface ProductDetailsData {
  description: string;
  specifications: Array<ProductSpecification>;
}

export interface ProductSpecification {
  label: string;
  value: string;
}

export const ProductPageOperation = {
  operationName: "ProductPage",
  query: /* GraphQL */ `
    query ProductPage {
      product {
        id
        name
        summary {
          inventoryStatus
          rating
          reviewCount
        }
        ...ProductDetails @defer(label: "productDetails")
      }
      recommendations @stream(initialCount: 0, label: "recommendations") {
        id
        name
        reason
      }
    }

    fragment ProductDetails on Product {
      description
      specifications {
        label
        value
      }
    }
  `,
} satisfies GraphQLOperationRequest;
