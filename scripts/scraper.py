"""Core scraping logic for Amazon product search."""

import asyncio
import json
import os
import random
from datetime import datetime

from playwright.async_api import async_playwright, Page
from playwright_stealth.stealth import Stealth

_stealth = Stealth()

import sys
sys.path.insert(0, os.path.dirname(__file__))
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
    await _stealth.apply_stealth_async(page)
    page.set_default_timeout(config.PAGE_TIMEOUT)
    return pw, browser, page


async def search_amazon(page: Page, keyword: str):
    """Navigate to Amazon and perform a keyword search."""
    await page.goto(config.AMAZON_URL)
    await random_delay()

    # Dismiss any delivery location popups
    try:
        dismiss_btn = page.locator("#nav-global-location-popover-dismiss, .a-popover-footer input")
        if await dismiss_btn.count() > 0:
            await dismiss_btn.first.click()
            await random_delay()
    except Exception:
        pass

    search_box = page.locator("#twotabsearchtextbox")
    await search_box.click()
    await search_box.type(keyword, delay=config.TYPE_DELAY_MS)
    await random_delay()

    await page.keyboard.press("Enter")

    # Wait for search results URL and page render
    await page.wait_for_url("**/s?k=*", timeout=config.PAGE_TIMEOUT)
    await page.wait_for_load_state("domcontentloaded")
    await asyncio.sleep(3)
    await random_delay()


async def parse_search_results(page: Page, max_products: int) -> list[dict]:
    """Parse product cards from search results page using JS evaluation."""
    # Use JavaScript to extract product data directly from the DOM
    products = await page.evaluate("""(maxProducts) => {
        const results = [];
        // Try multiple selectors for product cards
        const cards = document.querySelectorAll(
            '[data-component-type="s-search-result"], ' +
            '.s-result-item[data-asin]:not([data-asin=""])'
        );

        for (let i = 0; i < Math.min(cards.length, maxProducts); i++) {
            const card = cards[i];
            try {
                // Title
                const titleEl = card.querySelector('h2 span, h2 a span, h2');
                const title = titleEl ? titleEl.textContent.trim() : null;

                // URL
                const linkEl = card.querySelector('a[href*="/dp/"]');
                const href = linkEl ? linkEl.getAttribute('href') : null;
                const productUrl = href ? (href.startsWith('http') ? href : 'https://www.amazon.com' + href) : null;

                // Price
                const priceEl = card.querySelector('span.a-price .a-offscreen');
                const price = priceEl ? priceEl.textContent.trim() : null;

                // Rating
                const ratingEl = card.querySelector('span.a-icon-alt');
                const ratingText = ratingEl ? ratingEl.textContent : null;
                const rating = ratingText ? ratingText.split(' ')[0] : null;

                // Review count — from aria-label like "7,607 ratings"
                const reviewLinkEl = card.querySelector('a[aria-label$="ratings"], a[aria-label$="rating"]');
                let reviewCount = null;
                if (reviewLinkEl) {
                    const label = reviewLinkEl.getAttribute('aria-label');
                    const match = label.match(/^([\\d,]+)/);
                    reviewCount = match ? match[1] : null;
                }

                // Image
                const imgEl = card.querySelector('img.s-image');
                const imageUrl = imgEl ? imgEl.getAttribute('src') : null;

                if (title) {
                    results.push({
                        rank: results.length + 1,
                        title: title,
                        price: price,
                        rating: rating,
                        review_count: reviewCount,
                        product_url: productUrl,
                        image_url: imageUrl,
                        detail: null
                    });
                }
            } catch(e) {
                // Skip this card
            }
        }
        return results;
    }""", max_products)

    return products


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

        # Use JS to extract detail info
        detail = await page.evaluate("""() => {
            const detail = {};

            // Brand
            const brandEl = document.querySelector('#bylineInfo');
            detail.brand = brandEl ? brandEl.textContent.trim() : null;

            // Description - feature bullets
            const bullets = document.querySelectorAll('#feature-bullets ul li span.a-list-item');
            if (bullets.length > 0) {
                const texts = [];
                bullets.forEach(b => {
                    const t = b.textContent.trim();
                    if (t) texts.push(t);
                });
                detail.description = texts.length > 0 ? texts.join(' | ') : null;
            } else {
                // Fallback: product description
                const descEl = document.querySelector('#productDescription p, #productDescription span');
                detail.description = descEl ? descEl.textContent.trim() : null;
            }

            // Seller
            const sellerEl = document.querySelector('#merchant-info, #sellerProfileTriggerId');
            detail.seller = sellerEl ? sellerEl.textContent.trim() : null;

            // Availability
            const availEl = document.querySelector('#availability span');
            detail.availability = availEl ? availEl.textContent.trim() : null;

            return detail;
        }""")

        return detail

    except Exception as e:
        print(f"  WARNING: Failed to scrape detail for rank {product['rank']}: {e}")
        return None


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


if __name__ == "__main__":
    keyword = sys.argv[1] if len(sys.argv) > 1 else config.DEFAULT_KEYWORD
    headless = "--headless" in sys.argv
    asyncio.run(run_scraper(keyword, headless=headless))
