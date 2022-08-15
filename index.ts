import playwright from "playwright";
import * as cheerio from "cheerio";

const productList = ["finasterida", "sildenafil"];
const baseUrl = "https://www.farmaciasanpablo.com.mx";
const headers = {
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36",
};

/**
 * Basic example of going to the San Pablo search page for a query,
 * selecting the first result, and logging data about it
 */
async function main() {
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage(headers);
  for (let product of productList) {
    const productUrl = new URL(`/search/${product}`, baseUrl);
    await page.goto(productUrl.toString());

    // Just select the first one, will need to be smarter to go through the entire list of items,
    // click on "next" page element if present
    await page.locator("app-product-list-item a >> nth=0").click();

    // Scrape data from summary section
    const productName = await page.locator("app-product-summary h3").textContent();
    const productDescription = await page.locator("app-product-summary p >> nth=0").textContent();
    const productUPC = await page.locator("app-product-summary p >> nth=1").textContent();
    const productItemNum = await page.locator("app-product-summary p >> nth=2").textContent();

    // Scrape data from information section
    const informationName = await page
      .locator("text=Nombre del producto")
      .locator("..")
      .locator("..")
      .locator("div:last-of-type > span")
      .textContent();

    const informationBrand = await page
      .locator("text=Marca")
      .locator("..")
      .locator("..")
      .locator("div:last-of-type > span")
      .textContent();

    const informationCompany = await page
      .locator("text=Compañía")
      .locator("..")
      .locator("..")
      .locator("div:last-of-type > span")
      .textContent();

    console.log({
      productName,
      productDescription,
      productUPC,
      productItemNum,
      informationName,
      informationBrand,
      informationCompany,
    });

    // Shows loading html into cheerio to look through the markup with a jQuery like API
    // It's not that different from the playwright selectors but could be easier to work
    // with depending on the use case or what you are comfortable with
    const pageContent = await page.content();
    const $ = cheerio.load(pageContent);
  }

  await browser.close();
}

main();
