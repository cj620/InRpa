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
