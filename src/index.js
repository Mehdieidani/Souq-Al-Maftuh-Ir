export default {
  async fetch(request, env) {
    const botToken = env.BOT_TOKEN || "8587925383:AAElQXNbZ8YIDJMWwX4YyVFMCOsC2pV6H6c";
    const miniAppUrl = env.MINI_APP_URL || "https://proxytelegram12.mehdi11eidani.workers.dev/";

    // ۱. پاسخ به پیام‌های تلگرام (POST)
    if (request.method === "POST") {
      try {
        const data = await request.json();
        const chatId = data.message?.chat?.id;

        if (chatId) {
          const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "🛍️ به بازار Souq خوش آمدید!\nبرای مشاهده محصولات و ثبت آگهی، روی دکمه زیر بزنید:",
              reply_markup: {
                inline_keyboard: [[
                  { text: "ورود به بازار 🛒", web_app: { url: miniAppUrl } }
                ]]
              }
            }),
          });
        }
      } catch (e) {
        return new Response("OK");
      }
      return new Response("OK");
    }

    // ۲. ظاهر گرافیکی مینی‌اپ (برای نمایش در تلگرام)
    const html = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <style>
            body { font-family: sans-serif; background-color: #f0f0f5; margin: 0; padding: 20px; text-align: center; }
            .card { background: white; padding: 20px; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
            .btn { background: #248bcf; color: white; border: none; padding: 12px 20px; border-radius: 10px; font-weight: bold; width: 100%; cursor: pointer; }
        </style>
    </head>
    <body>
        <div class="card">
            <h2>بازار Souq 🛒</h2>
            <p>محصولات جدید در انتظار شماست!</p>
            <button class="btn" onclick="tg.showAlert('بزودی لیست کالاها اضافه می‌شود')">مشاهده ویترین</button>
        </div>
        <script>
            const tg = window.Telegram.WebApp;
            tg.expand();
        </script>
    </body>
    </html>`;

    return new Response(html, { headers: { "Content-Type": "text/html;charset=utf-8" } });
  }
};
