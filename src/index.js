export default {
  async fetch(request, env) {
    const { DB, BOT_TOKEN } = env;
    const url = new URL(request.url);

    // ۱. پاسخ به تلگرام (Webhook)
    if (request.method === "POST" && !url.pathname.startsWith("/api/")) {
      try {
        const update = await request.json();
        if (update.message && update.message.text) {
          const chatId = update.message.chat.id;
          const text = update.message.text;

          if (text === "/start") {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: "✨ به مینی‌اپ SOUQ خوش آمدید!\n\nبرای ثبت آگهی یا مشاهده ویترین، دکمه زیر را لمس کنید:",
                reply_markup: {
                  inline_keyboard: [[
                    { text: "🚀 باز کردن بازار", web_app: { url: `https://${url.hostname}` } }
                  ]]
                }
              })
            });
          }
        }
        return new Response("OK", { status: 200 });
      } catch (e) {
        return new Response("OK", { status: 200 });
      }
    }

    // ۲. بخش API ها برای دیتابیس
    if (url.pathname === "/api/get-ads") {
      const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active' ORDER BY id DESC").all();
      return Response.json(results || [], { headers: { "Access-Control-Allow-Origin": "*" } });
    }

    // ۳. نمایش ظاهر مینی‌اپ (HTML)
    const html = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SOUQ</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <style>
            body { font-family: Tahoma; background: #f0f0f5; text-align: center; padding: 20px; }
            .btn { background: #007aff; color: white; border: none; padding: 15px; border-radius: 10px; width: 100%; font-weight: bold; }
        </style>
    </head>
    <body>
        <h2>ویترین آگهی‌ها</h2>
        <div id="list">در حال بارگذاری...</div>
        <script>
            const tg = window.Telegram.WebApp;
            tg.expand();
            fetch('/api/get-ads').then(r => r.json()).then(data => {
                document.getElementById('list').innerHTML = data.length ? "آگهی موجود است" : "آگهی یافت نشد";
            });
        </script>
    </body>
    </html>`;

    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
};
