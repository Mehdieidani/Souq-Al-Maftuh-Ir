export default {
  async fetch(request, env) {
    const botToken = env.BOT_TOKEN;
    const miniAppUrl = env.MINI_APP_URL;

    // ۱. هندل کردن پیام‌های تلگرام (وقتی کاربر استارت می‌زند)
    if (request.method === "POST") {
      try {
        const data = await request.json();
        const chatId = data.message?.chat?.id;

        if (chatId) {
          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "🛍️ به بازار بزرگ Souq خوش آمدید!\nبرای مشاهده محصولات روی دکمه زیر بزنید:",
              reply_markup: {
                inline_keyboard: [[
                  { text: "ورود به بازار 🛒", web_app: { url: miniAppUrl } }
                ]]
              }
            }),
          });
        }
      } catch (e) { return new Response("OK"); }
      return new Response("OK");
    }

    // ۲. هندل کردن مینی‌اپ (خواندن از دیتابیس D1)
    let products = [];
    try {
      const { results } = await env.DB.prepare("SELECT * FROM products").all();
      products = results;
    } catch (e) {
      console.error("DB Error");
    }

    const productCards = products.length > 0 
      ? products.map(p => `
        <div class="card">
          <div class="name">${p.name}</div>
          <div class="price">${p.price} تومان</div>
          <button class="btn" onclick="alert('سفارش ${p.name} ثبت شد')">خرید</button>
        </div>`).join('')
      : `<p>فعلاً محصولی در ویترین نیست.</p>`;

    return new Response(`
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { font-family: tahoma; background: #f0f2f5; padding: 15px; text-align: center; margin: 0; }
            .card { background: white; border-radius: 15px; padding: 15px; margin-bottom: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); border: 1px solid #eee; }
            .name { font-weight: bold; font-size: 1.1em; color: #333; }
            .price { color: #28a745; font-size: 1.2em; margin: 10px 0; font-weight: bold; }
            .btn { background: #0088cc; color: white; border: none; padding: 10px; border-radius: 10px; width: 100%; font-size: 16px; cursor: pointer; }
        </style>
    </head>
    <body>
        <h2 style="color: #0088cc;">🛍️ ویترین Souq</h2>
        ${productCards}
    </body>
    </html>`, { headers: { "Content-Type": "text/html;charset=utf-8" } });
  }
};
