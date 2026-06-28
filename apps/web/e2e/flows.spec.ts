import { test, expect } from "@playwright/test";

/**
 * Key-flow smoke tests covering tenant-facing navigation and the demo data
 * surfaces judges will exercise. Each maps to a requirement in the brief:
 * tenant overview, treasury config, payroll setup, agent decisions, legal context.
 */

test("overview hero and CTAs render", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Agentic Treasury & Payroll on Stellar/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /Request demo/i }).first()).toBeVisible();
  await expect(page.getByRole("img", { name: /architecture diagram/i })).toBeVisible();
});

test("treasury dashboard shows allocation and positions", async ({ page }) => {
  await page.goto("/treasury");
  await expect(page.getByText(/Total treasury/i)).toBeVisible();
  await expect(page.getByText(/Liquidity vs yield/i)).toBeVisible();
  await expect(page.getByText(/CETES/)).toBeVisible();
});

test("payroll lists LATAM employees and a funding simulation", async ({ page }) => {
  await page.goto("/payroll");
  await expect(page.getByText("Ana Souza")).toBeVisible();
  await expect(page.getByText(/Funding simulation/i)).toBeVisible();
});

test("agent page links decisions to legal context", async ({ page }) => {
  await page.goto("/agent");
  await expect(page.getByText(/Agent decisions/i)).toBeVisible();
  await expect(page.getByText(/legal-context.json/i).first()).toBeVisible();
});

test("primary navigation reaches every section", async ({ page }) => {
  await page.goto("/");
  for (const section of ["Treasury", "Payroll", "Integrations", "Security", "Docs & SCF"]) {
    await page.getByRole("link", { name: section, exact: true }).first().click();
    await expect(page).toHaveURL(/treasury|payroll|integrations|security|docs/);
    await page.goto("/");
  }
});
