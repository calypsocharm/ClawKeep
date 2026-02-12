/**
 * PidgeyPost Browser Testing Script (Interactive REPL)
 * 
 * Launches a visible Chromium browser and accepts commands via stdin.
 * The browser stays alive across commands since they run in the same process.
 * 
 * Usage:
 *   node scripts/browser.mjs                   - Start interactive REPL
 *   echo "open https://..." | node scripts/browser.mjs  - Pipe commands
 * 
 * Commands:
 *   open <url>                    - Navigate to URL
 *   screenshot [filename]         - Take screenshot (saved to scripts/screenshots/)
 *   click <selector>              - Click element (CSS selector or text)
 *   type <selector> <text>        - Type into input
 *   scroll [down|up] [pixels]     - Scroll page
 *   evaluate <js>                 - Run JavaScript in page
 *   text [selector]               - Get text content
 *   buttons                       - List all buttons
 *   inputs                        - List all inputs
 *   links                         - List all links
 *   wait <ms>                     - Wait duration
 *   waitfor <selector>            - Wait for element
 *   close / exit                  - Close browser and exit
 */

import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const SCREENSHOT_DIR = path.join(__dirname, 'screenshots');

if (!fs.existsSync(SCREENSHOT_DIR)) {
    fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
}

// ============ COMMANDS ============

async function cmdOpen(page, url) {
    console.log(`📂 Navigating to: ${url}`);
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForTimeout(4000);
    const title = await page.title();
    console.log(`✅ Page loaded: "${title}"`);
    console.log(`   URL: ${page.url()}`);
}

async function cmdScreenshot(page, filename) {
    const name = filename || `screenshot-${Date.now()}`;
    const filepath = path.join(SCREENSHOT_DIR, `${name}.png`);
    await page.screenshot({ path: filepath, fullPage: false });
    console.log(`📸 Screenshot saved: ${filepath}`);
}

async function cmdClick(page, selector) {
    console.log(`🖱️ Clicking: ${selector}`);
    try {
        await page.click(selector, { timeout: 10000 });
        console.log(`✅ Clicked successfully`);
        await page.waitForTimeout(1500);
    } catch (e) {
        try {
            await page.getByText(selector, { exact: false }).first().click({ timeout: 5000 });
            console.log(`✅ Clicked via text match`);
            await page.waitForTimeout(1500);
        } catch {
            console.error(`❌ Click failed: ${e.message}`);
        }
    }
}

async function cmdType(page, selector, text) {
    console.log(`⌨️ Typing into: ${selector}`);
    try {
        await page.fill(selector, text, { timeout: 10000 });
        console.log(`✅ Typed: "${text}"`);
    } catch (e) {
        try {
            await page.getByPlaceholder(selector).first().fill(text, { timeout: 5000 });
            console.log(`✅ Typed via placeholder match: "${text}"`);
        } catch {
            console.error(`❌ Type failed: ${e.message}`);
        }
    }
}

async function cmdScroll(page, direction = 'down', amount = 500) {
    const delta = direction === 'up' ? -parseInt(amount) : parseInt(amount);
    await page.evaluate((d) => window.scrollBy(0, d), delta);
    console.log(`📜 Scrolled ${direction} ${Math.abs(delta)}px`);
}

async function cmdEvaluate(page, js) {
    console.log(`🧪 Evaluating: ${js}`);
    try {
        const result = await page.evaluate(js);
        console.log(`📤 Result:`, typeof result === 'string' ? result : JSON.stringify(result, null, 2));
    } catch (e) {
        console.error(`❌ Evaluate failed: ${e.message}`);
    }
}

async function cmdText(page, selector) {
    if (selector) {
        try {
            const text = await page.textContent(selector, { timeout: 5000 });
            console.log(`📝 Text: ${text?.trim()}`);
        } catch (e) {
            console.error(`❌ Text failed: ${e.message}`);
        }
    } else {
        const text = await page.evaluate(() => {
            return (document.querySelector('main') || document.body).innerText;
        });
        const truncated = text.substring(0, 3000);
        console.log(`📝 Page text:\n${truncated}`);
        if (text.length > 3000) console.log(`\n... (${text.length - 3000} more chars)`);
    }
}

async function cmdButtons(page) {
    const buttons = await page.evaluate(() => {
        return [...document.querySelectorAll('button, [role="button"], input[type="submit"]')].map(el => ({
            text: (el.innerText || el.value || el.ariaLabel || '').trim().substring(0, 80),
            id: el.id || '',
            disabled: el.disabled || false,
            visible: el.offsetParent !== null
        })).filter(b => b.text && b.visible);
    });
    console.log(`� Found ${buttons.length} visible buttons:`);
    buttons.forEach((b, i) => console.log(`  ${i + 1}. [${b.text}] ${b.disabled ? '(disabled)' : ''} ${b.id ? `#${b.id}` : ''}`));
}

async function cmdInputs(page) {
    const inputs = await page.evaluate(() => {
        return [...document.querySelectorAll('input, textarea, select')].map(el => ({
            type: el.tagName.toLowerCase() + (el.type ? `[${el.type}]` : ''),
            name: el.name || el.id || '',
            placeholder: el.placeholder || '',
            value: el.value || '',
            selector: el.id ? `#${el.id}` : (el.name ? `[name="${el.name}"]` : ''),
            visible: el.offsetParent !== null
        })).filter(i => i.visible);
    });
    console.log(`📝 Found ${inputs.length} visible inputs:`);
    inputs.forEach((inp, i) => console.log(`  ${i + 1}. ${inp.type} | name="${inp.name}" | placeholder="${inp.placeholder}" | selector="${inp.selector}"`));
}

async function cmdLinks(page) {
    const links = await page.evaluate(() => {
        return [...document.querySelectorAll('a[href]')].map(a => ({
            text: a.innerText.trim().substring(0, 50),
            href: a.href,
            visible: a.offsetParent !== null
        })).filter(l => l.text && l.visible);
    });
    console.log(`� Found ${links.length} visible links:`);
    links.forEach((l, i) => console.log(`  ${i + 1}. [${l.text}] → ${l.href}`));
}

async function cmdWait(page, ms) {
    console.log(`⏳ Waiting ${ms}ms...`);
    await page.waitForTimeout(parseInt(ms));
    console.log(`✅ Done`);
}

async function cmdWaitFor(page, selector) {
    console.log(`👀 Waiting for: ${selector}`);
    try {
        await page.waitForSelector(selector, { timeout: 15000 });
        console.log(`✅ Element appeared!`);
    } catch (e) {
        console.error(`❌ Timeout: ${e.message}`);
    }
}

// ============ COMMAND DISPATCHER ============

async function runCommand(page, line) {
    const parts = line.trim().split(/\s+/);
    const cmd = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    if (!cmd) return true;

    switch (cmd) {
        case 'open': await cmdOpen(page, args[0]); break;
        case 'screenshot': await cmdScreenshot(page, args[0]); break;
        case 'click': await cmdClick(page, args.join(' ')); break;
        case 'type': await cmdType(page, args[0], args.slice(1).join(' ')); break;
        case 'scroll': await cmdScroll(page, args[0], args[1]); break;
        case 'evaluate': await cmdEvaluate(page, args.join(' ')); break;
        case 'text': await cmdText(page, args[0]); break;
        case 'buttons': await cmdButtons(page); break;
        case 'inputs': await cmdInputs(page); break;
        case 'links': await cmdLinks(page); break;
        case 'wait': await cmdWait(page, args[0] || 1000); break;
        case 'waitfor': await cmdWaitFor(page, args.join(' ')); break;
        case 'close': case 'exit': return false;
        default: console.log(`❌ Unknown: ${cmd}`); break;
    }
    return true;
}

// ============ MAIN ============

async function main() {
    console.log('🐦 PidgeyPost Browser Tool - Starting...');

    const browser = await chromium.launch({
        headless: false,
        args: ['--window-size=1440,900', '--disable-blink-features=AutomationControlled']
    });

    const context = await browser.newContext({
        viewport: { width: 1440, height: 900 },
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'
    });

    const page = await context.newPage();
    console.log('✅ Browser ready! Enter commands (type "close" to exit):\n');

    // Check if stdin is a pipe (non-interactive) or TTY (interactive)
    const isTTY = process.stdin.isTTY;

    const rl = readline.createInterface({
        input: process.stdin,
        output: isTTY ? process.stdout : undefined,
        prompt: isTTY ? '🐦> ' : '',
        terminal: !!isTTY
    });

    if (isTTY) rl.prompt();

    for await (const line of rl) {
        try {
            const cont = await runCommand(page, line);
            if (!cont) break;
        } catch (e) {
            console.error(`❌ Error: ${e.message}`);
        }
        if (isTTY) rl.prompt();
    }

    await browser.close();
    console.log('🔒 Browser closed. Goodbye!');
    process.exit(0);
}

main().catch(e => { console.error(e); process.exit(1); });
