import time
from selenium import webdriver
from selenium.webdriver.common.by import By
from selenium.webdriver.chrome.service import Service
from selenium.webdriver.chrome.options import Options
from selenium.webdriver.support.ui import WebDriverWait
from selenium.webdriver.support import expected_conditions as EC


def main():
    # 配置Chrome选项
    chrome_options = Options()
    chrome_options.add_argument("--disable-blink-features=AutomationControlled")
    chrome_options.add_experimental_option("excludeSwitches", ["enable-automation"])
    chrome_options.add_experimental_option("useAutomationExtension", False)
    
    # 创建浏览器实例
    driver = webdriver.Chrome(options=chrome_options)
    
    try:
        # 打开Shopee搜索页面
        search_url = "https://shopee.cn/search?keyword=%E7%9A%AE%E5%B8%A6"
        driver.get(search_url)
        
        # 等待页面加载
        print("正在等待页面加载...")
        time.sleep(5)
        
        # 等待商品列表出现
        WebDriverWait(driver, 15).until(
            EC.presence_of_element_located((By.CSS_SELECTOR, ".shopee-search-item-result__item"))
        )
        
        print("页面加载完成，正在获取商品信息...\n")
        
        # 滚动页面以加载更多商品
        for _ in range(3):
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
        
        # 定位所有商品元素
        items = driver.find_elements(By.CSS_SELECTOR, ".shopee-search-item-result__item")
        
        prices = []
        print("=" * 50)
        print("前10个皮带商品价格统计")
        print("=" * 50)
        
        for i, item in enumerate(items[:10], 1):
            try:
                # 获取价格
                price_element = item.find_element(By.CSS_SELECTOR, "div[class*='price'] span[class*='price__literal']")
                price_text = price_element.text.strip().replace("¥", "").replace(",", "")
                price = float(price_text)
                prices.append(price)
                
                # 尝试获取商品名称
                try:
                    name_element = item.find_element(By.CSS_SELECTOR, ".FWZZg")
                    name = name_element.text[:30] + "..." if len(name_element.text) > 30 else name_element.text
                except:
                    name = "未知商品"
                
                print(f"{i}. {name}")
                print(f"   价格: ¥{price:.2f}")
                print("-" * 50)
                
            except Exception as e:
                print(f"第{i}个商品获取失败: {e}")
                continue
        
        # 统计价格信息
        if prices:
            print("\n" + "=" * 50)
            print("价格统计")
            print("=" * 50)
            print(f"商品数量: {len(prices)}")
            print(f"最低价格: ¥{min(prices):.2f}")
            print(f"最高价格: ¥{max(prices):.2f}")
            print(f"平均价格: ¥{sum(prices)/len(prices):.2f}")
            print(f"价格总和: ¥{sum(prices):.2f}")
            print("=" * 50)
        
    except Exception as e:
        print(f"发生错误: {e}")
    
    finally:
        input("\n按回车键关闭浏览器...")
        driver.quit()


if __name__ == "__main__":
    main()