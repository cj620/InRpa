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
