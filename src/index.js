export default {
  async fetch(request, env) {
    // گرفتن توکن از تنظیمات یا استفاده از توکن مستقیم
    const botToken = "8587925383:AAElQXNbZ8YIDJMWwX4YyVFMCOsC2pV6H6c";

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
              text: "✅ ربات Souq با موفقیت متصل شد!\nبرای ورود به بازار روی دکمه زیر بزنید:",
              reply_markup: {
                inline_keyboard: [[
                  { 
                    text: "🛍️ ورود به مینی‌اپ", 
                    web_app: { url: "https://proxytelegram12.mehdi11eidani.workers.dev/" } 
                  }
                ]]
              }
            }),
          });
        }
        return new Response("OK", { status: 200 });
      } catch (e) {
        return new Response("JSON Error", { status: 200 });
      }
    }

    // ظاهر گرافیکی ساده برای مینی‌اپ
    const html = `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8">
    <style>body{font-family:tahoma;text-align:center;padding:50px;background:#f4f4f9;}
    .card{background:#fff;padding:20px;border-radius:15px;box-shadow:0 2px 10px rgba(0,0,0,0.1);}</style>
    </head><body><div class="card"><h2>به بازار Souq خوش آمدید 🛒</h2><p>سیستم فعال است.</p></div></body></html>`;

    return new Response(html, { headers: { "Content-Type": "text/html;charset=utf-8" } });
  }
};
