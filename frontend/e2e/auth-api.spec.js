import { test, expect } from "@playwright/test";

test.describe("Auth API (Bearer token)", () => {
  test("requisição à API inclui Authorization quando VITE_API_TOKEN está definido", async ({
    page,
  }) => {
    let capturedAuth = null;

    await page.route("**/api/**", async (route) => {
      capturedAuth = route.request().headers()["authorization"] ?? null;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          success: true,
          data: [],
          pagination: {
            currentPage: 1,
            totalPages: 1,
            totalItems: 0,
            itemsPerPage: 10,
          },
        }),
      });
    });

    await page.goto("/");
    await page.waitForTimeout(1500);

    const token = process.env.VITE_API_TOKEN || "";
    if (token.trim()) {
      expect(capturedAuth).toBe(`Bearer ${token.trim()}`);
    } else {
      expect(capturedAuth).toBeNull();
    }
  });
});
