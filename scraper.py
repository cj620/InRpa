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
