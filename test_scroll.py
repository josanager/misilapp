from playwright.sync_api import sync_playwright

with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    context = browser.new_context(viewport={'width': 1920, 'height': 1080})
    page = context.new_page()
    page.goto("http://localhost:5173", wait_until="networkidle")

    # Hero
    page.screenshot(path="/home/jules/verification/hero_new.png", full_page=False)

    # Scroll to Stats/Cansado
    page.evaluate("window.scrollBy(0, 1200)")
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/stats.png", full_page=False)

    # Scroll to Compare section
    page.evaluate("window.scrollBy(0, 1500)")
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/compare_new.png", full_page=False)

    # Scroll to Features
    page.evaluate("window.scrollBy(0, 1500)")
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/features.png", full_page=False)

    # Scroll to Testimonials
    page.evaluate("window.scrollBy(0, 1500)")
    page.wait_for_timeout(1000)
    page.screenshot(path="/home/jules/verification/testimonials_new.png", full_page=False)

    # Full page
    page.screenshot(path="/home/jules/verification/full_page.png", full_page=True)

    browser.close()
