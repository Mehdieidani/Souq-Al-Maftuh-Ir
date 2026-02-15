export default {
  async fetch(request, env) {
    const { DB, BOT_TOKEN } = env;
    const url = new URL(request.url);

    // ۱. هدرهای CORS برای کارکرد دکمه‌ها
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json;charset=UTF-8"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // ۲. بخش حیاتی: هندل کردن پیام‌های ربات (Webhook)
    // اگر متد POST باشد و به API مربوط نباشد، یعنی پیام از طرف تلگرام است
    if (request.method === "POST" && !url.pathname.startsWith("/api/")) {
      try {
        const update = await request.json();
        if (update.message && update.message.text) {
          const chatId = update.message.chat.id;
          const text = update.message.text;

          if (text === "/start") {
            const botUrl = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
            await fetch(botUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: "🚀 به سوپرمارکت SOUQ خوش آمدید!\n\nبرای خرید، فروش و مشاهده آگهی‌های ایران و کشورهای عربی، روی دکمه زیر کلیک کنید:",
                reply_markup: {
                  inline_keyboard: [[
                    { text: "ورود به مینی‌اپ 📱", web_app: { url: `https://${url.hostname}` } }
                  ]]
                }
              })
            });
          }
        }
        return new Response("OK", { status: 200 });
      } catch (e) {
        return new Response("Webhook Error", { status: 200 }); // تلگرام همیشه باید 200 بگیرد
      }
    }

    // ۳. بخش API های مینی‌اپ
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
        await DB.prepare("INSERT INTO ads (user_id, title, category, price, currency, country, city, image_base64, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')")
          .bind(Number(d.uid), d.title, d.cat, d.price, d.curr, d.country, d.city, d.img, d.desc).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }
    } catch (e) {
      if (url.pathname.startsWith("/api/")) {
        return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
      }
    }

    // ۴. بخش نمایش ظاهر (HTML)
    const html = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SOUQ PRO</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            body { font-family: Tahoma, sans-serif; background: #f2f2f7; margin: 0; padding-bottom: 70px; }
            .header { background: #007aff; color: white; padding: 15px; text-align: center; font-weight: bold; position: sticky; top: 0; z-index: 10; }
            .page { display: none; padding: 15px; }
            .active { display: block; }
            .card { background: white; border-radius: 12px; padding: 10px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
            .nav { position: fixed; bottom: 0; width: 100%; background: white; display: flex; border-top: 1px solid #ddd; padding-bottom: env(safe-area-inset-bottom); }
            .nav-item { flex: 1; text-align: center; padding: 12px; color: #888; font-size: 11px; }
            .nav-item.active { color: #007aff; font-weight: bold; }
            input, select, textarea { width: 100%; padding: 12px; margin: 8px 0; border-radius: 10px; border: 1px solid #ddd; box-sizing: border-box; }
            .btn { width: 100%; padding: 15px; background: #007aff; color: white; border: none; border-radius: 12px; font-weight: bold; }
        </style>
    </head>
    <body>
        <div class="header">SOUQ PRO</div>
        
        <div id="p-home" class="page active">
            <div id="list">در حال بارگذاری آگهی‌ها...</div>
        </div>

        <div id="p-add" class="page">
            <input id="a-t" placeholder="عنوان آگهی">
            <select id="a-c"><option>فروش</option><option>خدمات</option><option>اشتغال</option></select>
            <input id="a-p" placeholder="قیمت">
            <input type="file" accept="image/*" onchange="up(this)">
            <textarea id="a-d" placeholder="توضیحات..."></textarea>
            <button class="btn" onclick="send()">ثبت آگهی</button>
        </div>

        <nav class="nav">
            <div class="nav-item active" onclick="tab('home',this)"><i class="fa fa-home fa-lg"></i><br>ویترین</div>
            <div class="nav-item" onclick="tab('add',this)"><i class="fa fa-plus-circle fa-lg"></i><br>ثبت آگهی</div>
        </nav>

        <script>
            const tg = window.Telegram.WebApp;
            let uid = 0, img = "";

            async function init() {
                tg.expand();
                uid = tg.initDataUnsafe?.user?.id || 123;
                await fetch('/api/init', { method:'POST', body: JSON.stringify({id:uid, user: tg.initDataUnsafe?.user?.first_name}) });
                load();
            }

            async function load() {
                const res = await fetch('/api/get-ads');
                const data = await res.json();
                document.getElementById('list').innerHTML = data.map(a => \`
                    <div class="card">
                        <img src="\${a.image_base64}" style="width:100%; height:150px; object-fit:cover; border-radius:8px;">
                        <div style="margin-top:8px;"><b>\${a.title}</b></div>
                        <div style="color:#007aff">\${a.price}</div>
                    </div>
                \`).join('') || "آگهی یافت نشد.";
            }

            function up(el) {
                const r = new FileReader();
                r.onload = (e) => img = e.target.result;
                r.readAsDataURL(el.files[0]);
            }

            async function send() {
                if(!img) return alert("عکس انتخاب کنید");
                await fetch('/api/submit-ad', {
                    method: 'POST',
                    body: JSON.stringify({
                        uid, title: document.getElementById('a-t').value,
                        cat: document.getElementById('a-c').value, price: document.getElementById('a-p').value,
                        curr: 'تومان', country: 'ایران', city: '-', desc: document.getElementById('a-d').value, img: img
                    })
                });
                alert("ثبت شد!"); tab('home', document.querySelector('.nav-item'));
            }

            function tab(p, el) {
                document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
                document.getElementById('p-' + p).classList.add('active');
                document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
                el.classList.add('active'); if(p=='home') load();
            }
            window.onload = init;
        </script>
    </body>
    </html>`;

    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
};
