const puppeteer = require('puppeteer');

(async () => {
    try {
        const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox']
        });
        const page = await browser.newPage();
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36');
        await page.setViewport({ width: 1280, height: 800 });

        console.log('Navigating to pidgeypost.com...');
        await page.goto('https://pidgeypost.com', { waitUntil: 'networkidle2', timeout: 30000 });

        // Wait for app to render
        await new Promise(r => setTimeout(r, 3000));

        const title = await page.title();
        console.log('TITLE:', title);

        // Get all clickable elements
        const buttons = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('button, a, [role="button"]'))
                .slice(0, 40)
                .map(el => ({
                    tag: el.tagName,
                    text: el.innerText.trim().slice(0, 80),
                    href: el.href || '',
                    id: el.id || '',
                    cls: el.className.toString().slice(0, 100)
                }))
                .filter(b => b.text);
        });
        console.log('BUTTONS:', JSON.stringify(buttons, null, 2));

        // Get visible text
        const text = await page.evaluate(() => document.body.innerText.slice(0, 2000));
        console.log('TEXT:', text.slice(0, 1500));

        // Take screenshot
        await page.screenshot({ path: '/tmp/pidgeypost_landing.png', fullPage: false });
        console.log('Screenshot saved to /tmp/pidgeypost_landing.png');

        await browser.close();
        console.log('DONE');
    } catch (e) {
        console.error('ERROR:', e.message);
    }
})();
