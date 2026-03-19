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
