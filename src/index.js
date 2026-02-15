export default {
  async fetch(request, env) {
    const botToken = env.BOT_TOKEN;
    const miniAppUrl = env.MINI_APP_URL;

    // ۱. مدیریت پیام‌های تلگرام
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
              text: "✅ بازار Souq آماده است | سوق Souq جاهز",
              reply_markup: {
                inline_keyboard: [[
                  { text: "🛍️ ورود به بازار | دخول السوق", web_app: { url: miniAppUrl } }
                ]]
              }
            }),
          });
        }
      } catch (e) { return new Response("OK"); }
      return new Response("OK");
    }

    // ۲. گرفتن داده‌ها از دیتابیس
    let products = [];
    try {
      const { results } = await env.DB.prepare("SELECT * FROM products").all();
      products = results;
    } catch (e) { products = []; }

    // ۳. تولید ردیف‌های جدول/کارت‌ها
    const productList = products.map(p => `
      <div class="product-row">
        <div class="info">
          <div class="title-fa">${p.name_fa}</div>
          <div class="title-ar">${p.name_ar}</div>
          <div class="price">${p.price} <small>Toman</small></div>
        </div>
        <button class="buy-btn" onclick="order('${p.name_fa}')">
          <span>خرید</span>
          <hr>
          <span>شراء</span>
        </button>
      </div>
    `).join('');

    // ۴. کل فایل HTML
    const finalHtml = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <style>
            :root { --main-color: #248bcf; --bg-color: #efeff4; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: var(--bg-color); margin: 0; padding: 10px; color: #333; }
            .header { background: white; padding: 15px; border-radius: 12px; margin-bottom: 15px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
            .header h2 { margin: 0; font-size: 18px; color: var(--main-color); }
            
            .product-row { background: white; display: flex; align-items: center; justify-content: space-between; padding: 15px; border-radius: 15px; margin-bottom: 10px; box-shadow: 0 2px 8px rgba(0,0,0,0.04); }
            .info { text-align: right; flex-grow: 1; }
            .title-fa { font-weight: bold; font-size: 16px; color: #222; }
            .title-ar { font-size: 14px; color: #666; margin-bottom: 5px; }
            .price { color: #28a745; font-weight: bold; font-size: 17px; }
            
            .buy-btn { background: var(--main-color); color: white; border: none; border-radius: 10px; padding: 8px 15px; min-width: 80px; font-weight: bold; cursor: pointer; transition: 0.2s; }
            .buy-btn:active { transform: scale(0.95); opacity: 0.9; }
            .buy-btn hr { border: 0; border-top: 1px solid rgba(255,255,255,0.3); margin: 3px 0; }
            
            .empty { padding: 50px; color: #999; }
        </style>
    </head>
    <body>
        <div class="header">
            <h2>🛍️ Souq Market | سوق Souq</h2>
            <small>بهترین کالاها | أفضل البضائع</small>
        </div>

        <div id="app">
            ${products.length > 0 ? productList : '<div class="empty">لیست خالی است | القائمة فارغة</div>'}
        </div>

        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <script>
            const tg = window.Telegram.WebApp;
            tg.ready();
            tg.expand();

            function order(name) {
                tg.showConfirm("آیا قصد خرید " + name + " را دارید؟ \\n هل تريد شراء هذا المنتج؟", (ok) => {
                    if(ok) tg.close();
                });
            }
        </script>
    </body>
    </html>`;

    return new Response(finalHtml, { headers: { "Content-Type": "text/html;charset=utf-8" } });
  }
};
