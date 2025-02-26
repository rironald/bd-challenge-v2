import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useActionData, useLoaderData, Form } from "@remix-run/react";
import { BlockStack, Card, Layout, Page } from "@shopify/polaris";
import { apiVersion, authenticate } from "app/shopify.server";
import fs from "fs/promises";
import path from "path";

// GraphQL query to fetch product details
const productQuery = `
  query product($id: ID!) {
    product(id: $id) {
      id
      title
      handle
    }
  }
`;

// Loader function to fetch product details
export async function loader({ request, params }: LoaderFunctionArgs) {
  const { session } = await authenticate.admin(request);
  console.log("Session in loader:", session);

  if (!session) {
    console.log("No session found, redirecting to login");
    throw new Response("Unauthorized", { status: 401 });
  }

  const { shop, accessToken } = session;
  console.log("Shop:", shop); // Log the shop
  console.log("Access Token:", accessToken);

  if (!shop || !accessToken) {
    throw new Response("Invalid session", { status: 401 });
  }

  const productId = params.productId;
  console.log("Product ID from params:", productId); // Debugging: Log the productId

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
          "X-Shopify-Access-Token": accessToken!,
        },
        body: JSON.stringify({
          query: productQuery,
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
}

// Action function to handle review submission
export async function action({ request, params }: ActionFunctionArgs) {
  const formData = await request.formData();
  const productId = params.productId;
  console.log("Product ID in action:", productId); // Debugging: Log the productId

  const reviewData = {
    productId,
    rating: formData.get("rating"),
    comment: formData.get("comment"),
  };

  // Validate the review data
  if (!reviewData.productId || !reviewData.rating || !reviewData.comment) {
    return Response.json({ error: "All fields are required" }, { status: 400 });
  }

  // Save the review to a JSON file (for testing purposes)
  const reviewsFilePath = path.resolve(process.cwd(), "app/data/reviews.json");
  let reviews = [];

  try {
    const existingData = await fs.readFile(reviewsFilePath, "utf-8");
    reviews = JSON.parse(existingData);
  } catch (error) {
    console.error("Error reading reviews file:", error);
  }

  reviews.push({
    ...reviewData,
    id: Date.now().toString(), // Generate a unique ID
    date: new Date().toISOString(),
  });

  await fs.writeFile(reviewsFilePath, JSON.stringify(reviews, null, 2));

  return Response.json(
    { message: "Review saved successfully" },
    { status: 201 },
  );
}

type ActionData = {
  message?: string;
  error?: string;
};

// Component to display the product and review form
export default function ProductPage() {
  const { product } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();

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
              <Form method="post">
                <BlockStack gap="200">
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
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
