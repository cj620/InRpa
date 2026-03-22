import time
from playwright.sync_api import sync_playwright
from urllib.parse import quote


def scroll_page(page, times=3, wait_time=1.5):
    """滚动页面以加载更多内容"""
    for i in range(times):
        page.evaluate("window.scrollTo(0, document.body.scrollHeight);")
        time.sleep(wait_time)
        print(f"  已滚动第 {i+1}/{times} 次")


def get_product_info(page, item):
    """提取单个商品的详细信息"""
    product_info = {
        'name': '',
        'price': 0.0,
        'sales': '',
        'location': ''
    }
    
    try:
        # 尝试获取商品名称 - 多种选择器
        name_selectors = [
            '[data-sqe="name"]',
            '.product-title',
            'a[data-sqe="name"] span',
        ]
        
        for selector in name_selectors:
            try:
                name_element = item.locator(selector).first
                if name_element.count() > 0:
                    product_info['name'] = name_element.inner_text().strip()
                    if product_info['name']:
                        break
            except:
                continue
        
        # 尝试获取价格 - 多种选择器
        price_selectors = [
            '.price',
            '[class*="price"]',
            '.items .price',
        ]
        
        for selector in price_selectors:
            try:
                price_element = item.locator(selector).first
                if price_element.count() > 0:
                    price_text = price_element.inner_text().strip()
                    # 提取数字
                    import re
                    numbers = re.findall(r'[\d.]+', price_text)
                    if numbers:
                        product_info['price'] = float(numbers[0])
                        break
            except:
                continue
        
        # 尝试获取销量
        try:
            sales_selectors = [
                '[class*="sold"]',
                '.sold',
            ]
            for selector in sales_selectors:
                try:
                    sales_element = item.locator(selector).first
                    if sales_element.count() > 0:
                        product_info['sales'] = sales_element.inner_text().strip()
                        break
                except:
                    continue
        except:
            pass
        
        # 尝试获取商品位置
        try:
            location_selectors = [
                '[class*="location"]',
                '[class*="shop"]',
            ]
            for selector in location_selectors:
                try:
                    location_element = item.locator(selector).first
                    if location_element.count() > 0:
                        product_info['location'] = location_element.inner_text().strip()
                        break
                except:
                    continue
        except:
            pass
            
    except Exception as e:
        print(f"  提取商品信息时出错: {e}")
    
    return product_info


def main():
    print("=" * 60)
    print("Shopee 皮带商品信息采集工具 (Playwright版)")
    print("=" * 60)
    
    with sync_playwright() as p:
        # 启动浏览器
        print("\n正在启动浏览器...")
        browser = p.chromium.launch(
            headless=False,  # 设置为 True 可以无头运行
            args=['--disable-blink-features=AutomationControlled']
        )
        
        # 创建上下文（可添加用户代理）
        context = browser.new_context(
            viewport={'width': 1920, 'height': 1080},
            user_agent='Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            ignore_https_errors=True,
        )
        
        # 创建页面
        page = context.new_page()
        
        try:
            # 打开Shopee搜索页面
            search_keyword = "皮带"
            search_url = f"https://shopee.cn/search?keyword={quote(search_keyword)}"
            
            print(f"\n正在打开 Shopee 并搜索: {search_keyword}")
            page.goto(search_url, wait_until="networkidle", timeout=30000)
            
            # 等待页面加载
            print("正在等待页面加载...")
            time.sleep(5)
            
            # 尝试等待商品列表出现 - 使用 Playwright 自动等待
            try:
                page.wait_for_selector('.shopee-search-item-result__item', timeout=15000)
                print("✓ 商品列表已加载\n")
            except Exception:
                print("警告: 未能找到商品列表，尝试继续...")
            
            # 滚动页面以加载更多商品
            print("正在滚动页面以加载更多商品...")
            scroll_page(page, times=3, wait_time=2)
            
            # 查找所有商品元素
            items = page.locator('.shopee-search-item-result__item').all()
            print(f"✓ 共找到 {len(items)} 个商品\n")
            
            # 获取前10个商品的信息
            target_count = min(10, len(items))
            products = []
            
            print("=" * 60)
            print(f"前 {target_count} 个皮带商品信息")
            print("=" * 60)
            
            for i in range(target_count):
                try:
                    # 获取当前商品
                    item = items[i]
                    
                    # 滚动到元素可见位置
                    item.scroll_into_view_if_needed()
                    time.sleep(0.3)
                    
                    product = get_product_info(page, item)
                    
                    if product['price'] > 0 or product['name']:
                        products.append(product)
                        
                        print(f"\n【商品 {i+1}】")
                        if product['name']:
                            # 截断过长的名称
                            display_name = product['name'][:40] + "..." if len(product['name']) > 40 else product['name']
                            print(f"  名称: {display_name}")
                        else:
                            print(f"  名称: [未能获取]")
                        
                        if product['price'] > 0:
                            print(f"  价格: ¥{product['price']:.2f}")
                        else:
                            print(f"  价格: [未能获取]")
                            
                        if product['sales']:
                            print(f"  销量: {product['sales']}")
                        if product['location']:
                            print(f"  店铺: {product['location']}")
                        
                        print("-" * 60)
                        
                except IndexError:
                    print(f"第 {i+1} 个商品索引超出范围")
                    break
                except Exception as e:
                    print(f"处理第 {i+1} 个商品时出错: {e}")
                    continue
            
            # 统计价格信息
            if products:
                prices = [p['price'] for p in products if p['price'] > 0]
                
                print("\n" + "=" * 60)
                print("价格统计")
                print("=" * 60)
                print(f"成功获取商品数: {len(products)}")
                
                if prices:
                    print(f"最低价格: ¥{min(prices):.2f}")
                    print(f"最高价格: ¥{max(prices):.2f}")
                    print(f"平均价格: ¥{sum(prices)/len(prices):.2f}")
                    print(f"价格总和: ¥{sum(prices):.2f}")
                
                print("=" * 60)
            else:
                print("\n未能获取到有效的商品信息")
                print("可能的原因:")
                print("  1. 网页结构已更新，选择器不正确")
                print("  2. 网络加载问题")
                print("  3. 反爬虫机制阻止")
                
        except Exception as e:
            print(f"\n发生错误: {e}")
            import traceback
            traceback.print_exc()
        
        finally:
            try:
                input("\n按回车键关闭浏览器...")
            except:
                pass
            browser.close()
            print("浏览器已关闭")


if __name__ == "__main__":
    main()