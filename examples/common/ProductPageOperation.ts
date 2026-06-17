export interface GraphQLOperationRequest<
  TVariables extends Record<string, unknown> = Record<string, unknown>,
> {
  operationName?: string;
  query: string;
  variables?: TVariables;
}

export interface ProductPageData {
  moreStuff: Array<MoreStuff>;
  stuff: { name: string };
}

export interface MoreStuff {
  id: string;
  name: string;
}

export interface ProductDetailsData {
  description: string;
}

export const ProductPageOperation = {
  operationName: "ProductPage",
  query: /* GraphQL */ `
    query ProductPage {
      stuff {
        name
        ...ProductDetails @defer(label: "productDetails")
      }
      moreStuff @stream(initialCount: 0, label: "moreStuff") {
        id
        name
      }
    }

    fragment ProductDetails on Stuff {
      description
    }
  `,
} satisfies GraphQLOperationRequest;
