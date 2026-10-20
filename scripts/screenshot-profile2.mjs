import { chromium } from "playwright";

const base = "http://localhost:3000";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1100 } });
page.setDefaultTimeout(10000);

const fieldInput = (label) => page.locator(`.form-field:has(.input-label:text-is("${label}")) input, .form-field:has(.input-label:text-is("${label}")) select`);

await page.goto(base, { waitUntil: "networkidle" });
await page.click(".profile-button");
await page.click("text=Sign in");
await page.waitForSelector(".auth-modal");
await page.fill(".auth-modal input:not([type=password])", "jane@nexatrade.test");
await page.fill(".auth-modal input[type=password]", "userpass123");
await page.click(".auth-modal button.primary-btn");
await page.waitForTimeout(1200);
await page.click(".profile-button");
await page.click("text=View profile");
await page.waitForSelector(".profile-header-card");
await page.waitForTimeout(500);

try {
  await fieldInput("Username *").fill("janedoe");
  await fieldInput("Date of birth *").fill("1992-04-12");
  await fieldInput("Gender").selectOption("female");
  await fieldInput("Country *").selectOption("NG");
  await fieldInput("Phone number *").fill("+2348099998888");
  await page.screenshot({ path: "/tmp/shot-profile-filled.png" });
  await page.click('button:has-text("Save changes")');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/shot-profile-saved.png" });
} catch (e) { console.log("fill/save step error:", e.message); }

try {
  await page.selectOption("[data-testid=currency-select]", "NGN");
  await page.waitForTimeout(1200);
  await page.screenshot({ path: "/tmp/shot-profile-ngn.png" });
} catch (e) { console.log("currency step error:", e.message); }

try {
  await page.click('button:has-text("Set up security question")');
  await page.waitForTimeout(300);
  await page.screenshot({ path: "/tmp/shot-profile-secform.png" });
} catch (e) { console.log("security step error:", e.message); }

await browser.close();
console.log("done");
