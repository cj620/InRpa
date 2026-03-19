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
