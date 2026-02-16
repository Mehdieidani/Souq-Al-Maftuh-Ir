// src/index.js
import { SETTINGS } from './config.js';
import { getHTML } from './ui.js';

export default {
  async fetch(request, env) {
    const { DB, BOT_TOKEN } = env; // توکن‌ها امن در کلودفلر می‌مانند
    const url = new URL(request.url);
    
    // هدرهای استاندارد
    const headers = { "Content-Type": "application/json;charset=UTF-8", "Access-Control-Allow-Origin": "*" };

    try {
      // 1. هندل کردن ربات تلگرام
      if (request.method === "POST" && !url.pathname.startsWith("/api/")) {
        const update = await request.json();
        if (update.message?.text === "/start") {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: update.message.chat.id,
              text: SETTINGS.app.welcomeMessage, // متن از فایل کانفیگ می‌آید
              reply_markup: {
                inline_keyboard: [[{ text: "🚀 ورود به بازار", web_app: { url: `https://${url.hostname}` } }]]
              }
            })
          });
        }
        return new Response("OK");
      }

      // 2. هندل کردن API ها
      if (url.pathname === "/api/get-ads") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active' ORDER BY id DESC").all();
        return Response.json(results, { headers });
      }
      
      // اگر نیاز به لیست دسته‌ها در سمت کلاینت بود
      if (url.pathname === "/api/config") {
        return Response.json(SETTINGS, { headers });
      }

      // 3. نمایش HTML
      return new Response(getHTML(url), { headers: { "Content-Type": "text/html;charset=UTF-8" } });

    } catch (e) {
      return new Response("Error: " + e.message, { status: 500 });
    }
  }
};
