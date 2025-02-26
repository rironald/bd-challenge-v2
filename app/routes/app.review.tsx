import { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { useActionData, useLoaderData } from "@remix-run/react";
import { BlockStack, Card, Layout, Page } from "@shopify/polaris";
import { apiVersion, authenticate } from "app/shopify.server";

export const query = `
  query product($id: ID!) {
    product(id: $id) {
      id
      title
      handle
    }
  }
`;

export const loader = async ({ request, params }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  console.log("Session:", session);

  if (!session) {
    throw new Response("Unauthorized", { status: 401 });
  }

  const { shop, accessToken } = session;
  console.log("Shop:", shop);
  console.log("Access Token:", accessToken);

  if (!shop || !accessToken) {
    throw new Response("Invalid session", { status: 401 });
  }

  const productId = params.productId;
  if (!productId) {
    throw new Response("Product ID is required", { status: 400 });
  }

  try {
    const response = await fetch(
      `https://${shop}/admin/api/${apiVersion}/graphql.json`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Shopify-Access-Token": accessToken,
        },
        body: JSON.stringify({
          query,
          variables: { id: `gid://shopify/Product/${productId}` },
        }),
      },
    );

    console.log("API Response Status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Error Response:", errorText);
      throw new Response("Failed to fetch product details", {
        status: response.status,
      });
    }

    const data = await response.json();
    console.log("API Data:", data);

    if (!data?.data?.product) {
      throw new Response("Product not found", { status: 404 });
    }

    return Response.json({ product: data.data.product });
  } catch (err) {
    console.error("Error fetching product details:", err);
    throw new Response("Internal Server Error", { status: 500 });
  }
};

// Action function to handle review submission
export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const reviewData = {
    productId: formData.get("productId"),
    rating: formData.get("rating"),
    comment: formData.get("comment"),
  };

  try {
    const response = await fetch("http:/api/reviews", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(reviewData),
    });

    if (!response.ok) {
      throw new Error("Failed to save review");
    }

    const result = await response.json();
    return Response.json(
      { message: "Review saved successfully ", review: result },
      { status: 201 },
    );
  } catch (error) {
    console.error("Error saving review", error);
    return Response.json({ error: "Failed to save review" }, { status: 500 });
  }
}

interface ActionData {
  message?: string;
  error?: string;
  review?: any;
}

const ReviewForm = ({ productId }: { productId: string }) => {
  const actionData = useActionData<typeof action>();
  const { product } = useLoaderData<typeof loader>();
  return (
    <Page>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack>
              <h2>Leave a Review for {product.title}</h2>
              {actionData?.message && <p>{actionData.message}</p>}
              {actionData?.error && (
                <p style={{ color: "red" }}>{actionData.error}</p>
              )}
              <form method="post" action="/api/reviews">
                <BlockStack gap="200">
                  <input type="hidden" name="productId" value={productId} />
                  <label htmlFor="">
                    Rating
                    <select name="rating" id="" required>
                      <option value="1">1 Star</option>
                      <option value="2">2 Star</option>
                      <option value="3">3 Star</option>
                      <option value="4">4 Star</option>
                      <option value="5">5 Star</option>
                    </select>
                  </label>
                </BlockStack>
                <BlockStack gap="200">
                  <label htmlFor="">
                    Comment:
                    <BlockStack>
                      <textarea name="comment" id="" required></textarea>
                    </BlockStack>
                  </label>
                </BlockStack>
                <button type="submit">Submit Review</button>
              </form>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
};

export default ReviewForm;
