import asyncio
from playwright.async_api import async_playwright
from playwright_stealth.stealth import Stealth


_stealth = Stealth()


async def main():
    async with async_playwright() as p:
        # 启动浏览器
        browser = await p.chromium.launch(headless=False)
        page = await browser.new_page()
        
        # 应用 stealth 插件防止被检测
        await _stealth.apply_stealth_async(page)
        
        try:
            # 打开 Shopee 搜索页面
            search_url = "https://www.shopee.com.tw/search?keyword=皮带"
            await page.goto(search_url)
            
            # 等待页面加载，等待商品列表出现
            await page.wait_for_selector('[data-sqe="item"]', timeout=30000)
            
            # 滚动页面加载更多商品
            for _ in range(3):
                await page.evaluate('window.scrollBy(0, 500)')
                await asyncio.sleep(0.5)
            
            # 获取商品信息
            items = await page.query_selector_all('[data-sqe="item"]')
            
            print("=" * 60)
            print("Shopee 皮带搜索结果 - 前10个商品")
            print("=" * 60)
            
            count = 0
            for item in items:
                if count >= 10:
                    break
                
                try:
                    # 尝试获取标题（Shopee 商品标题可能有多个选择器）
                    title_elem = await item.query_selector('.ie3A+n span')
                    if not title_elem:
                        title_elem = await item.query_selector('.x4jf4Ys a')
                    if not title_elem:
                        title_elem = await item.query_selector('.Cve6sh')
                    
                    title = await title_elem.inner_text() if title_elem else "无标题"
                    
                    # 尝试获取价格
                    price_elem = await item.query_selector('.a2CaCk')
                    if not price_elem:
                        price_elem = await item.query_selector('.TyDgRd')
                    if not price_elem:
                        price_elem = await item.query_selector('span[data-price]')
                    
                    price = await price_elem.inner_text() if price_elem else "无价格"
                    
                    # 清理标题中的多余空格和换行
                    title = ' '.join(title.split())
                    
                    print(f"{count + 1}. 标题: {title}")
                    print(f"   价格: {price}")
                    print("-" * 60)
                    
                    count += 1
                    
                except Exception as e:
                    print(f"获取第{count + 1}个商品时出错: {e}")
                    continue
            
            print(f"\n共成功获取 {count} 个商品信息")
            
        except Exception as e:
            print(f"发生错误: {e}")
        
        finally:
            # 关闭浏览器
            await asyncio.sleep(2)  # 等待查看结果
            await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
