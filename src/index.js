export default {
  async fetch(request, env) {
    const botToken = "8587925383:AAElQXNbZ8YIDJMWwX4YyVFMCOsC2pV6H6c";

    // بررسی اینکه آیا درخواست از طرف تلگرام است (POST)
    if (request.method === "POST") {
      try {
        const data = await request.json();
        
        // پیدا کردن Chat ID در هر نوع پیامی (متن یا استارت)
        const chatId = data.message?.chat?.id || data.callback_query?.message?.chat?.id;

        if (chatId) {
          const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
          
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "🎊 تبریک! ربات Souq بیدار شد.\n\nمن پیام شما را دریافت کردم. برای باز کردن مینی‌اپ روی دکمه زیر بزنید:",
              reply_markup: {
                inline_keyboard: [[
                  { 
                    text: "🛍️ ورود به بازار Souq", 
                    web_app: { url: "https://proxytelegram12.mehdi11eidani.workers.dev/" } 
                  }
                ]]
              }
            }),
          });
        }
      } catch (e) {
        // اگر خطایی رخ داد، لاگ بگیر (در پنل کلودفلر قابل مشاهده است)
        return new Response("Error: " + e.message, { status: 200 });
      }
      return new Response("OK", { status: 200 });
    }

    // ظاهر مینی‌اپ برای نمایش در مرورگر یا داخل تلگرام
    return new Response(`
      <!DOCTYPE html>
      <html dir="rtl">
        <head><meta charset="UTF-8"></head>
        <body style="text-align:center; font-family:tahoma; padding-top:50px; background:#f0f0f0;">
          <h1>🛍️ مینی‌اپ بازار Souq</h1>
          <p>سیستم فعال است. لطفاً از داخل تلگرام امتحان کنید.</p>
          <button style="padding:10px 20px; background:#0088cc; color:#fff; border:none; border-radius:5px;">نسخه ۱.۰</button>
        </body>
      </html>`, 
      { headers: { "Content-Type": "text/html;charset=utf-8" } }
    );
  }
};
