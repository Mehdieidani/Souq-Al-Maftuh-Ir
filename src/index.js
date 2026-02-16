import { SOUQ_SETTINGS as config } from './SOUQ_CORE.js';

export default {
  async fetch(request, env) {
    const { DB, BOT_TOKEN } = env;
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json;charset=UTF-8"
    };

    try {
      // --- ۱. بخش تلگرام (ثابت و ایمن) ---
      if (request.method === "POST" && !url.pathname.startsWith("/api/")) {
        const update = await request.json();
        if (update.message?.text === "/start") {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: update.message.chat.id,
              text: `🌹 به ${config.identity.appName} خوش آمدید\n\nامروز چه کمکی از دست ما برمی‌آید؟`,
              reply_markup: {
                inline_keyboard: [[{ text: "🚀 باز کردن اپلیکیشن", web_app: { url: `https://${url.hostname}` } }]]
              }
            })
          });
        }
        return new Response("OK");
      }

      // --- ۲. بخش API (هماهنگ با ریموت کنترل) ---
      if (url.pathname === "/api/get-ads") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active' ORDER BY id DESC").all();
        return Response.json(results, { headers: corsHeaders });
      }

      if (url.pathname === "/api/config") {
        return Response.json(config, { headers: corsHeaders });
      }

      // --- ۳. بخش ظاهر (رندرینگ هوشمند) ---
      const html = `
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <script src="https://telegram.org/js/telegram-web-app.js"></script>
          <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
          <style>
              body { font-family: ${config.ui.fontFamily}; background: ${config.ui.bgColor}; margin: 0; padding-bottom: 70px; }
              .header { background: ${config.ui.primaryColor}; color: white; padding: 15px; text-align: center; font-weight: bold; }
              .btn-primary { background: ${config.ui.primaryColor}; color: white; border: none; padding: 12px; border-radius: 10px; width: 100%; font-weight: bold; }
              .nav-item.active { color: ${config.ui.primaryColor}; }
              .vip-tag { color: ${config.ui.vipColor}; font-weight: bold; }
              /* استایل‌های دیگر... */
          </style>
      </head>
      <body>
          <div class="header">${config.identity.appName}</div>
          <div id="app"></div>
          
          <script>
              const tg = window.Telegram.WebApp;
              const adminList = ${JSON.stringify(config.security?.admins || [])};
              
              function init() {
                  tg.expand();
                  // اگر کاربر مدیر بود، تب مدیریت را نشان بده
                  if (adminList.includes(tg.initDataUnsafe?.user?.id)) {
                      document.getElementById('admin-tab').style.display = 'block';
                  }
              }
              window.onload = init;
          </script>
      </body>
      </html>`;

      return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });

    } catch (e) {
      return new Response("Error: " + e.message, { status: 200 });
    }
  }
};
