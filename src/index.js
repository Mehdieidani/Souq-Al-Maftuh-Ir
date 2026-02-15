export default {
  async fetch(request, env) {
    const { DB, BOT_TOKEN } = env;
    const url = new URL(request.url);

    // تنظیمات سربرگ برای ارتباط مینی‌اپ
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json;charset=UTF-8"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // --- بخش اول: زنده کردن ربات (Webhook) ---
    if (request.method === "POST" && !url.pathname.startsWith("/api/")) {
      try {
        const update = await request.json();
        if (update.message) {
          const chatId = update.message.chat.id;
          
          // ارسال پیام خوش‌آمدگویی با دکمه مینی‌اپ
          const botResponse = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: "✅ سیستم فعال شد!\nبرای ورود به بازار و مدیریت آگهی‌ها از دکمه زیر استفاده کنید:",
              reply_markup: {
                inline_keyboard: [[
                  { text: "🚀 ورود به مینی‌اپ SOUQ", web_app: { url: `https://${url.hostname}` } }
                ]]
              }
            })
          });

          // اگر ارسال پیام به تلگرام خطا داشت، اینجا متوجه می‌شویم
          if (!botResponse.ok) {
            console.error("Telegram API Error:", await botResponse.text());
          }
        }
      } catch (e) {
        console.error("Webhook Logic Error:", e.message);
      }
      return new Response("OK", { status: 200 }); // تلگرام همیشه باید OK بگیره
    }

    // --- بخش دوم: APIهای دیتابیس ---
    try {
      if (url.pathname === "/api/init") {
        const body = await request.json();
        await DB.prepare("INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)")
          .bind(Number(body.id), body.user || 'Guest').run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (url.pathname === "/api/get-ads") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active' ORDER BY id DESC").all();
        return Response.json(results || [], { headers: corsHeaders });
      }

      if (url.pathname === "/api/submit-ad") {
        const d = await request.json();
        await DB.prepare("INSERT INTO ads (user_id, title, category, price, currency, country, image_base64, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')")
          .bind(Number(d.uid), d.title, d.cat, d.price, d.curr, d.country, d.img, d.desc).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // بخش مدیریت: لیست آگهی‌های در انتظار تایید
      if (url.pathname === "/api/admin/list") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'pending'").all();
        return Response.json(results || [], { headers: corsHeaders });
      }

      // بخش مدیریت: تایید یا رد
      if (url.pathname === "/api/admin/action") {
        const { id, status } = await request.json();
        await DB.prepare("UPDATE ads SET status = ? WHERE id = ?").bind(status, id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

    } catch (e) {
      if (url.pathname.startsWith("/api/")) {
        return Response.json({ error: e.message }, { headers: corsHeaders });
      }
    }

    // --- بخش سوم: ظاهر مینی‌اپ (HTML) ---
    // (همان کد HTML قبلی با منوی مدیریت و ویترین)
    const html = `... (کدهای HTML شامل اسکریپت‌های تب‌بندی و fetch) ...`; 
    // نکته: برای جلوگیری از طولانی شدن، کد HTML کامل رو در پیام قبلی داشتی.
    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
};
