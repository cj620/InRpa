# Playwright Amazon Scraper Design

## Overview

Python Playwright demo：打开 Amazon 网站，搜索 "belt"，爬取前 10 名商品的全量信息（含详情页），保存为 JSON。

## Tech Stack

- Python + Playwright (async API)
- playwright-stealth（反爬）
- 无其他第三方解析库

## Project Structure

```
rpa-mpv/
├── requirements.txt          # 依赖：playwright, playwright-stealth
├── config.py                 # 配置：关键词、数量、延迟范围、UA、模式
├── scraper.py                # 核心逻辑：搜索 + 列表解析 + 详情页抓取
├── main.py                   # 入口：命令行参数解析，调用 scraper
└── output/                   # JSON 结果输出目录
```

## Data Model

```json
{
  "keyword": "belt",
  "scraped_at": "2026-03-19T14:30:00",
  "products": [
    {
      "rank": 1,
      "title": "商品标题",
      "price": "$19.99",
      "rating": "4.5",
      "review_count": "1,234",
      "product_url": "https://www.amazon.com/dp/...",
      "image_url": "https://m.media-amazon.com/...",
      "detail": {
        "description": "商品描述文本",
        "seller": "卖家名称",
        "brand": "品牌",
        "availability": "In Stock"
      }
    }
  ]
}
```

Output filename: `output/<keyword>_<timestamp>.json`

## Core Flow

1. 启动浏览器（stealth 模式）
2. 打开 amazon.com
3. 输入关键词搜索（逐字输入模拟）
4. 等待搜索结果加载
5. 解析前 10 个商品基础信息（标题/价格/评分/评论数/链接/图片）
6. 逐个打开商品详情页，抓取描述/卖家/品牌/库存
7. 汇总数据，保存 JSON
8. 关闭浏览器

## Anti-Detection Strategy

| Strategy | Implementation |
|----------|---------------|
| Hide automation fingerprint | `playwright-stealth` plugin injected per page |
| Custom User-Agent | Configured in config.py, mimics real Chrome |
| Random delays | 1~3s random wait after each page action |
| Input simulation | `type()` with delay parameter, character by character |

## CLI Arguments

```bash
python main.py                    # 有头模式（默认）
python main.py --headless         # 无头模式
python main.py --keyword "watch"  # 自定义关键词（默认 belt）
```

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Less than 10 results | Scrape whatever is available |
| Detail page load failure | Skip detail, keep basic info, detail = null |
| Field extraction failure | Set field to null, continue |
| CAPTCHA detected | Print warning, save already-scraped data, terminate |

No retry mechanism — keep it simple for demo purposes.
