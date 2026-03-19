# Playwright Amazon Scraper Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Python Playwright demo that searches Amazon for a keyword and scrapes the top 10 products' full information (including detail pages), saving results as JSON.

**Architecture:** Single-process async Playwright script. `config.py` holds all constants, `scraper.py` contains the core async scraping logic (browser setup, search, list parsing, detail extraction), `main.py` is the CLI entry point. Anti-detection via playwright-stealth + random delays + custom UA.

**Tech Stack:** Python 3.10+, playwright (async API), playwright-stealth

---

### Task 1: Project Setup & Dependencies

**Files:**
- Create: `requirements.txt`

**Step 1: Create requirements.txt**

```text
playwright==1.52.0
playwright-stealth==1.0.6
```

**Step 2: Install dependencies**

Run: `pip install -r requirements.txt`
Expected: Successfully installed playwright, playwright-stealth

**Step 3: Install Playwright browsers**

Run: `playwright install chromium`
Expected: Chromium browser downloaded

**Step 4: Create output directory**

Run: `mkdir -p output`

**Step 5: Commit**

```bash
git init
git add requirements.txt
git commit -m "chore: init project with playwright dependencies"
```

---

### Task 2: Configuration Module

**Files:**
- Create: `config.py`

**Step 1: Create config.py with all constants**

```python
"""Scraper configuration constants."""

# Search settings
DEFAULT_KEYWORD = "belt"
MAX_PRODUCTS = 10

# Amazon URL
AMAZON_URL = "https://www.amazon.com"

# Anti-detection settings
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
    "AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)

# Delay settings (seconds)
MIN_DELAY = 1.0
MAX_DELAY = 3.0
TYPE_DELAY_MS = 80  # milliseconds between keystrokes

# Timeouts (milliseconds)
PAGE_TIMEOUT = 30000
DETAIL_PAGE_TIMEOUT = 15000

# Browser settings
VIEWPORT = {"width": 1920, "height": 1080}
```

**Step 2: Verify module imports**

Run: `python -c "import config; print(config.DEFAULT_KEYWORD)"`
Expected: `belt`

**Step 3: Commit**

```bash
git add config.py
git commit -m "feat: add configuration module with search/anti-detection settings"
```

---

### Task 3: Scraper Core — Browser Setup & Search

**Files:**
- Create: `scraper.py`

**Step 1: Create scraper.py with browser setup and search function**

```python
"""Core scraping logic for Amazon product search."""

import asyncio
import json
import os
import random
from datetime import datetime

from playwright.async_api import async_playwright, Page, Browser
from playwright_stealth import stealth_async

import config


async def random_delay():
    """Wait a random duration to mimic human behavior."""
    delay = random.uniform(config.MIN_DELAY, config.MAX_DELAY)
    await asyncio.sleep(delay)


async def create_browser(headless: bool = False) -> tuple:
    """Launch a stealth browser and return (playwright, browser, page)."""
    pw = await async_playwright().start()
    browser = await pw.chromium.launch(headless=headless)
    context = await browser.new_context(
        user_agent=config.USER_AGENT,
        viewport=config.VIEWPORT,
        locale="en-US",
    )
    page = await context.new_page()
    await stealth_async(page)
    page.set_default_timeout(config.PAGE_TIMEOUT)
    return pw, browser, page


async def search_amazon(page: Page, keyword: str):
    """Navigate to Amazon and perform a keyword search."""
    await page.goto(config.AMAZON_URL)
    await random_delay()

    search_box = page.locator("#twotabsearchtextbox")
    await search_box.click()
    await search_box.type(keyword, delay=config.TYPE_DELAY_MS)
    await random_delay()

    await page.keyboard.press("Enter")
    await page.wait_for_load_state("domcontentloaded")
    await random_delay()
```

**Step 2: Verify syntax**

Run: `python -c "import scraper; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add scraper.py
git commit -m "feat: add browser setup with stealth and Amazon search"
```

---

### Task 4: Scraper Core — Search Results Parsing

**Files:**
- Modify: `scraper.py` (append functions)

**Step 1: Add search results parsing function to scraper.py**

Append after the `search_amazon` function:

```python
async def parse_search_results(page: Page, max_products: int) -> list[dict]:
    """Parse product cards from search results page."""
    # Wait for search results to render
    await page.wait_for_selector('[data-component-type="s-search-result"]', timeout=config.PAGE_TIMEOUT)

    items = page.locator('[data-component-type="s-search-result"]')
    count = await items.count()
    count = min(count, max_products)

    products = []
    for i in range(count):
        item = items.nth(i)
        product = await _extract_product_card(item, rank=i + 1)
        if product:
            products.append(product)

    return products


async def _extract_product_card(item, rank: int) -> dict | None:
    """Extract basic info from a single product card."""
    try:
        # Title and URL
        title_el = item.locator("h2 a.a-link-normal")
        title = await title_el.get_attribute("title") or await title_el.inner_text()
        href = await title_el.get_attribute("href")
        product_url = f"https://www.amazon.com{href}" if href and not href.startswith("http") else href

        # Price
        price = None
        price_whole = item.locator("span.a-price-whole").first
        price_fraction = item.locator("span.a-price-fraction").first
        if await price_whole.count() > 0:
            whole = await price_whole.inner_text()
            fraction = await price_fraction.inner_text() if await price_fraction.count() > 0 else "00"
            price = f"${whole}{fraction}"

        # Rating
        rating = None
        rating_el = item.locator("span.a-icon-alt").first
        if await rating_el.count() > 0:
            rating_text = await rating_el.inner_text()
            rating = rating_text.split(" ")[0] if rating_text else None

        # Review count
        review_count = None
        review_el = item.locator('[data-csa-c-func-deps="aui-da-a-popover"] + span.a-size-base, a.s-underline-text span.a-size-base').first
        if await review_el.count() > 0:
            review_count = await review_el.inner_text()

        # Image
        image_url = None
        img_el = item.locator("img.s-image").first
        if await img_el.count() > 0:
            image_url = await img_el.get_attribute("src")

        return {
            "rank": rank,
            "title": title.strip() if title else None,
            "price": price,
            "rating": rating,
            "review_count": review_count,
            "product_url": product_url,
            "image_url": image_url,
            "detail": None,
        }
    except Exception:
        return None
```

**Step 2: Verify syntax**

Run: `python -c "import scraper; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add scraper.py
git commit -m "feat: add search results parsing with product card extraction"
```

---

### Task 5: Scraper Core — Detail Page Extraction

**Files:**
- Modify: `scraper.py` (append function)

**Step 1: Add detail page scraping function to scraper.py**

Append after `_extract_product_card`:

```python
async def scrape_product_detail(page: Page, product: dict) -> dict | None:
    """Open product detail page and extract additional info."""
    if not product.get("product_url"):
        return None

    try:
        await page.goto(product["product_url"], timeout=config.DETAIL_PAGE_TIMEOUT)
        await page.wait_for_load_state("domcontentloaded")
        await random_delay()

        # Check for CAPTCHA
        captcha = page.locator("form[action*='validateCaptcha']")
        if await captcha.count() > 0:
            print("WARNING: CAPTCHA detected, stopping detail extraction.")
            return "CAPTCHA"

        detail = {}

        # Brand
        brand_el = page.locator("#bylineInfo").first
        if await brand_el.count() > 0:
            detail["brand"] = (await brand_el.inner_text()).strip()
        else:
            detail["brand"] = None

        # Description — feature bullets
        bullets = page.locator("#feature-bullets ul li span.a-list-item")
        if await bullets.count() > 0:
            texts = []
            for j in range(await bullets.count()):
                text = await bullets.nth(j).inner_text()
                text = text.strip()
                if text:
                    texts.append(text)
            detail["description"] = " | ".join(texts) if texts else None
        else:
            detail["description"] = None

        # Seller
        seller_el = page.locator("#merchant-info, #sellerProfileTriggerId").first
        if await seller_el.count() > 0:
            detail["seller"] = (await seller_el.inner_text()).strip()
        else:
            detail["seller"] = None

        # Availability
        avail_el = page.locator("#availability span").first
        if await avail_el.count() > 0:
            detail["availability"] = (await avail_el.inner_text()).strip()
        else:
            detail["availability"] = None

        return detail

    except Exception as e:
        print(f"  WARNING: Failed to scrape detail for rank {product['rank']}: {e}")
        return None
```

**Step 2: Verify syntax**

Run: `python -c "import scraper; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add scraper.py
git commit -m "feat: add product detail page extraction with CAPTCHA detection"
```

---

### Task 6: Scraper Core — Main Orchestrator & JSON Output

**Files:**
- Modify: `scraper.py` (append function)

**Step 1: Add the main orchestrator function to scraper.py**

Append at the end:

```python
async def run_scraper(keyword: str, headless: bool = False):
    """Main scraper orchestrator."""
    print(f"Starting scraper for keyword: '{keyword}'")
    print(f"Mode: {'headless' if headless else 'headed'}")

    pw, browser, page = await create_browser(headless=headless)

    try:
        # Search
        print(f"Searching Amazon for '{keyword}'...")
        await search_amazon(page, keyword)

        # Parse search results
        print("Parsing search results...")
        products = await parse_search_results(page, config.MAX_PRODUCTS)
        print(f"Found {len(products)} products.")

        # Scrape detail pages
        for product in products:
            print(f"  Scraping detail for rank {product['rank']}: {product['title'][:50]}...")
            detail = await scrape_product_detail(page, product)
            if detail == "CAPTCHA":
                print("CAPTCHA encountered. Saving scraped data and stopping.")
                break
            product["detail"] = detail
            await random_delay()

        # Save results
        result = {
            "keyword": keyword,
            "scraped_at": datetime.now().isoformat(timespec="seconds"),
            "products": products,
        }

        os.makedirs("output", exist_ok=True)
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"output/{keyword}_{timestamp}.json"
        with open(filename, "w", encoding="utf-8") as f:
            json.dump(result, f, ensure_ascii=False, indent=2)

        print(f"Results saved to {filename}")
        return result

    finally:
        await browser.close()
        await pw.stop()
```

**Step 2: Verify syntax**

Run: `python -c "import scraper; print('OK')"`
Expected: `OK`

**Step 3: Commit**

```bash
git add scraper.py
git commit -m "feat: add scraper orchestrator with JSON output and progress logging"
```

---

### Task 7: CLI Entry Point

**Files:**
- Create: `main.py`

**Step 1: Create main.py with argparse CLI**

```python
"""CLI entry point for the Amazon Playwright scraper."""

import argparse
import asyncio

from scraper import run_scraper
import config


def main():
    parser = argparse.ArgumentParser(description="Amazon Product Scraper (Playwright)")
    parser.add_argument(
        "--keyword",
        type=str,
        default=config.DEFAULT_KEYWORD,
        help=f"Search keyword (default: {config.DEFAULT_KEYWORD})",
    )
    parser.add_argument(
        "--headless",
        action="store_true",
        help="Run browser in headless mode",
    )
    args = parser.parse_args()

    asyncio.run(run_scraper(keyword=args.keyword, headless=args.headless))


if __name__ == "__main__":
    main()
```

**Step 2: Verify help output**

Run: `python main.py --help`
Expected: Shows usage with `--keyword` and `--headless` options

**Step 3: Commit**

```bash
git add main.py
git commit -m "feat: add CLI entry point with keyword and headless arguments"
```

---

### Task 8: End-to-End Smoke Test

**Step 1: Run in headed mode with default keyword**

Run: `python main.py`
Expected: Browser opens, searches "belt", scrapes products, saves JSON to `output/`

**Step 2: Verify JSON output**

Run: `python -c "import json; data=json.load(open([f for f in __import__('os').listdir('output') if f.endswith('.json')][0].replace('output/', 'output/'))); print(f'Products: {len(data[\"products\"])}'); print(json.dumps(data['products'][0], indent=2, ensure_ascii=False))"`

Expected: Shows product count and first product with all fields populated

**Step 3: Run in headless mode**

Run: `python main.py --headless`
Expected: Runs without visible browser, saves new JSON file

**Step 4: Fix any selector issues found during smoke test**

If selectors fail (Amazon changes their DOM frequently), inspect the page and update selectors in `scraper.py` accordingly.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: smoke test passed, fix any selector adjustments"
```
