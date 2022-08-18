import playwright from "playwright";
import * as fs from "fs";
import { Status } from "@prisma/client";
import type { Ingredient, Product, ScrapeActivity } from "@prisma/client";

const productList = [
  "amlodipine",
  "atorvastatin",
  "azithromycin",
  "duloxetine",
  "escitalopram",
  "finasterida",
  "levofloxacin",
  "losartan",
  "omeprazole",
  "pantoprazole",
  "sertraline",
  "sildenafil",
];

const products = productList.slice(0, 1);
const BASE_URL = "https://www.farmaciasanpablo.com.mx";
const SEARCH_PAGE_SIZE = 12;
const headers = {
  userAgent:
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/83.0.4103.116 Safari/537.36",
};

async function main() {
  const productDataList: ProductData[] = [];
  const browser = await playwright.chromium.launch();
  const page = await browser.newPage(headers);
  for (let product of products) {
    const productUrl = new URL(`/search/${product}`, BASE_URL);
    await page.goto(productUrl.toString());

    // Determine number of pages
    const resultCountText = (await page.locator(".qtyResults").textContent()) ?? "0";
    const resultCount = Number.parseInt(resultCountText.match(/\d+/)?.[0] ?? "0");

    if (resultCount === 0) {
      console.log(`No results for ${product}. On to the next product...`);
      continue;
    }

    const resultPagesCount = Math.ceil(resultCount / SEARCH_PAGE_SIZE);
    console.log(`${resultCountText} for ${product} and ${resultPagesCount} pages`);

    // Get paths to all of the results for all pages
    let resultPathList = [];
    for (let currPage = 0; currPage < resultPagesCount; currPage++) {
      // Go to the specific page
      const productSearchPageUrl = new URL(
        `/search/${product}?pageSize=${SEARCH_PAGE_SIZE}&currentPage=${currPage}`,
        BASE_URL
      );
      console.log(`Navigating to ${productSearchPageUrl.toString()}`);
      await page.goto(productSearchPageUrl.toString());

      // Get the paths to all of the products on the page
      await page.waitForTimeout(500);
      const queryResultList = await page.$$("app-product-list-item a");
      for (let result of queryResultList) {
        const resultPath = await result?.getAttribute("href");
        if (resultPath) {
          resultPathList.push(resultPath);
        } else {
          console.log("Couldn't find href for element. Skipping...");
        }
      }
    }

    // For each url, go to the page and get the data
    for (let resultPath of resultPathList) {
      const data = await getDataForSanPabloProductPage(page, resultPath);

      // Instead of pushing to list we can write to db
      productDataList.push(data);
    }
  }

  // Instead of writing to file write to the database
  // Write product to DB, then write ingredients, linked to the product
  // Lastly record the scrape activity
  // Finally, write the data to the file and close the browser
  fs.writeFileSync("data.json", JSON.stringify(productDataList));
  await browser.close();
}

// TOOD: return 1. product data 2. list of ingredients
async function getDataForSanPabloProductPage(page: playwright.Page, productPath: string): Promise<ProductData> {
  const productUrl = new URL(productPath, BASE_URL);
  console.log(`Navigating to ${productUrl.toString()}`);
  await page.goto(productUrl.toString());

  let product: Product;
  const ingredientList: Array<Ingredient> = [];

  // Scrape data from summary section
  const name = await page.locator("app-product-summary h3").textContent();
  const upc = await page.locator("app-product-summary p >> nth=1").textContent();
  const productItemNum = await page.locator("app-product-summary p >> nth=2").textContent();
  const price = parseFloatFromText(await page.locator("h3.priceTotal").textContent());

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

  return {
    productName,
    productDescription,
    productUPC,
    productPrice,
    productItemNum,
    informationName,
    informationBrand,
    informationCompany,
  };
}

function parseIntFromText(text: string) {
  Number.parseInt(text.match(/\d+/)?.[0] ?? "0");
}

function parseFloatFromText(text: string | null) {
  if (text === null) {
    /**
     * TODO: what should this be stored as in the db
     * I think we set it as null and have that as something to come back to
     * and look at in the future, manually.
     */
    return null;
  }

  Number.parseInt(text.match(/\d+\.?\d{0,2}/)?.[0] ?? "0");
}

main();
