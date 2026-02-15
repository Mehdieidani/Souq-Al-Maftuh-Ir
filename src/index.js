export default {
  async fetch(request, env) {
    if (request.method === "POST") {
      try {
        const payload = await request.json();
        
        if (payload && payload.message && payload.message.chat) {
          const chatId = payload.message.chat.id;
          const userText = payload.message.text || "";

          // ۱. ذخیره در دیتابیس Cloudflare D1
          try {
            if (env.DB) {
              await env.DB.prepare(
                "INSERT OR IGNORE INTO users (user_id, last_message) VALUES (?, ?)"
              ).bind(chatId.toString(), userText).run();
            }
          } catch (dbError) {
            console.error("D1 Error:", dbError.message);
          }

          // ۲. مشخصات ربات و لینک مینی‌اپ
          const botToken = "8587925383:AAElQXNbZ8YIDJMWwX4YyVFMCOsC2pV6H6c";
          const miniAppUrl = "https://proxytelegram12.mehdi11eidani.workers.dev/"; // آدرس مینی‌اپ شما
          
          const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
          
          // ۳. ارسال پاسخ به همراه دکمه مینی‌اپ
          await fetch(telegramUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "سلام به بازار Souq خوش آمدید! 🛒\nبرای ثبت آگهی یا مشاهده محصولات، روی دکمه زیر کلیک کنید:",
              reply_markup: {
                inline_keyboard: [[
                  { 
                    text: "ورود به مینی‌اپ 🛍️", 
                    web_app: { url: miniAppUrl } 
                  }
                ]]
              }
            }),
          });
        }
        return new Response("OK", { status: 200 });
      } catch (err) {
        return new Response("Error: " + err.message, { status: 500 });
      }
    }
    
    // ظاهر ساده برای وقتی که لینک ورکر را در مرورگر باز می‌کنید
    return new Response(`
      <html>
        <body style="font-family: sans-serif; text-align: center; padding-top: 50px;">
          <h1>Souq Mini App Server</h1>
          <p style="color: green;">Worker is Active and Running! ✅</p>
        </body>
      </html>
    `, { headers: { "Content-Type": "text/html" } });
  },
};
