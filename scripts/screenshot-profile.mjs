import { chromium } from "playwright";

const base = "http://localhost:3000";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });

// 1. Registration modal
await page.goto(base, { waitUntil: "networkidle" });
await page.click("text=Create an account").catch(async () => {
  await page.click(".profile-button");
  await page.click("text=Create an account");
});
await page.waitForSelector(".register-modal");
await page.screenshot({ path: "/tmp/shot-register.png" });

// scroll down within modal to see account setup section
await page.evaluate(() => { document.querySelector(".register-modal").scrollTop = 600; });
await page.screenshot({ path: "/tmp/shot-register-2.png" });

await page.click(".modal-close");

// 2. Login as jane, go to Profile page
await page.click(".profile-button");
await page.click("text=Sign in");
await page.waitForSelector(".auth-modal");
await page.fill(".auth-modal input[type=text], .auth-modal input:not([type=password])", "jane@nexatrade.test");
await page.fill(".auth-modal input[type=password]", "userpass123");
await page.click(".auth-modal button.primary-btn");
await page.waitForTimeout(1500);

await page.click(".profile-button");
await page.click("text=View profile");
await page.waitForSelector(".profile-header-card");
await page.waitForTimeout(800);
await page.screenshot({ path: "/tmp/shot-profile.png", fullPage: true });

await browser.close();
console.log("done");
