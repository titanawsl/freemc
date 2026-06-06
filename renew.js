const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

// TG 通知函数
async function sendTG(message) {
  const token = process.env.TG_BOT_TOKEN;
  const chatId = process.env.TG_CHAT_ID;
  
  if (!token || !chatId || token.includes('替换')) {
    console.log('未配置有效的 TG 参数，跳过通知。');
    return;
  }

  const url = `https://api.telegram.org/bot${token}/sendMessage`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' })
    });
    console.log('📢 TG 通知已发送！');
  } catch (e) {
    console.error("❌ TG推送失败:", e.message);
  }
}

(async () => {
  // 确保截图保存目录存在
  const screenshotDir = path.join(__dirname, 'screenshots');
  if (!fs.existsSync(screenshotDir)) {
    fs.mkdirSync(screenshotDir);
  }

  // 启动无头浏览器
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  try {
    // 🚨 修正点 1：直接前往图2的登录专属页面
    console.log('🚀 正在打开 Freemchost 登录页面...');
    await page.goto('https://new.freemchost.com/login', { waitUntil: 'networkidle', timeout: 60000 }); 

    console.log('📝 正在输入账号密码...');
    await page.waitForSelector('input[type="email"]', { timeout: 15000 });
    await page.locator('input[type="email"]').fill(process.env.FREE_EMAIL);
    await page.locator('input[type="password"]').fill(process.env.FREE_PASSWORD);
    
    // 匹配图2中的红色的 "Sign in" 按钮
    console.log('🔐 正在尝试登录...');
    await page.locator('button:has-text("Sign in")').click();
    
    // 等待跳转到图3的控制台页面
    console.log('⏳ 等待登录跳转...');
    await page.waitForNavigation({ waitUntil: 'networkidle', timeout: 30000 });
    console.log('✅ 登录成功！');

    // 🚨 修正点 2：直接跳转到你的服务器详情页（对应图5）
    console.log('📂 正在直达服务器详情页...');
    await page.goto(process.env.SERVER_PAGE_URL, { waitUntil: 'networkidle', timeout: 30000 });

    // 🚨 修正点 3：必须先点击 "Manage" 标签页
    console.log('🗂️ 正在切换到 [Manage] 标签页...');
    // 使用精准匹配，寻找文字完全等于 Manage 的元素并点击
    const manageTab = page.getByText('Manage', { exact: true });
    await manageTab.waitFor({ state: 'visible', timeout: 15000 });
    await manageTab.click();

    // 稍微等 2 秒，让 Manage 页面里的内容加载出来
    await page.waitForTimeout(2000);

    // 此时图6中的续期按钮才会出现
    console.log('🔍 正在寻觅红色的 [Renew now] 按钮...');
    const renewBtn = page.locator('button:has-text("Renew now")').last();
    
    await renewBtn.waitFor({ state: 'visible', timeout: 10000 });
    
    if (await renewBtn.isVisible()) {
      await renewBtn.click();
      console.log('🎉 【成功】已精准点击续期按钮！');
      // 留出 5 秒等待后端确认请求
      await page.waitForTimeout(5000);
    } else {
      console.log('⚠️ 未找到续期按钮，可能已被续期，或者页面结构有变。');
    }

  } catch (error) {
    console.error('❌ 自动化执行期间发生异常:', error.message);
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const screenshotPath = path.join(screenshotDir, `error-${timestamp}.png`);
    
    try {
      // 拍下案发现场
      await page.screenshot({ path: screenshotPath, fullPage: true });
      console.log(`📸 现场截图已保存至: ${screenshotPath}`);
    } catch (screenshotError) {
      console.error('❌ 截图保存失败:', screenshotError.message);
    }
    
    process.exit(1);
  } finally {
    await browser.close();
    console.log('🏁 浏览器已关闭，任务结束。');
  }
})();
