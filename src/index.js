export default {
  async fetch(request, env) {
    const { DB, BOT_TOKEN } = env;
    const url = new URL(request.url);

    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json;charset=UTF-8"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    // --- ۱. بخش ربات تلگرام (Webhook) ---
    if (request.method === "POST" && !url.pathname.startsWith("/api/")) {
      try {
        const update = await request.json();
        if (update.message && update.message.text) {
          const chatId = update.message.chat.id;
          const user = update.message.from;
          
          if (update.message.text === "/start") {
            await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                text: `سلام ${user.first_name} عزیز! 🌹\nبه سوپرمارکت و بازار SOUQ خوش آمدید.\n\nاینجا می‌توانید آگهی‌های خرید، فروش، خدمات و اشتغال را در سراسر کشورهای عربی و ایران ثبت و مشاهده کنید.`,
                reply_markup: {
                  inline_keyboard: [[
                    { text: "🛍️ ورود به بازار و مینی‌اپ", web_app: { url: `https://${url.hostname}` } }
                  ]]
                }
              })
            });
          }
        }
        return new Response("OK", { status: 200 });
      } catch (e) { return new Response("OK"); }
    }

    // --- ۲. بخش API ها ---
    try {
      if (url.pathname === "/api/init") {
        const body = await request.json();
        await DB.prepare("INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)")
          .bind(Number(body.id), body.user).run();
        const userData = await DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(Number(body.id)).first();
        return Response.json(userData, { headers: corsHeaders });
      }

      if (url.pathname === "/api/get-ads") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active' ORDER BY is_featured DESC, id DESC").all();
        return Response.json(results || [], { headers: corsHeaders });
      }

      if (url.pathname === "/api/submit-ad") {
        const d = await request.json();
        await DB.prepare("INSERT INTO ads (user_id, title, category, price, currency, country, city, image_base64, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(Number(d.uid), d.title, d.cat, d.price, d.curr, d.country, d.city, d.img, d.desc).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (url.pathname === "/api/admin/list") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'pending'").all();
        return Response.json(results, { headers: corsHeaders });
      }

      if (url.pathname === "/api/admin/action") {
        const { id, status } = await request.json();
        await DB.prepare("UPDATE ads SET status = ? WHERE id = ?").bind(status, id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }
    } catch (e) {
      if (url.pathname.startsWith("/api/")) return Response.json({ error: e.message }, { headers: corsHeaders });
    }

    // --- ۳. بخش رابط کاربری (HTML/JS) ---
    const html = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>SOUQ PRO</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            :root { --p: #007aff; --vip: #f1c40f; --bg: #f2f2f7; }
            body { font-family: system-ui, -apple-system; background: var(--bg); margin: 0; padding-bottom: 80px; }
            .header { background: white; padding: 15px; text-align: center; border-bottom: 1px solid #ddd; position: sticky; top: 0; z-index: 10; font-weight: bold; }
            .page { display: none; padding: 15px; animation: fadeIn 0.2s ease; }
            .active { display: block; }
            .cat-bar { display: flex; overflow-x: auto; padding: 10px; gap: 8px; background: white; }
            .cat-item { background: #eee; padding: 6px 12px; border-radius: 20px; font-size: 13px; white-space: nowrap; }
            .cat-item.selected { background: var(--p); color: white; }
            .ad-card { background: white; border-radius: 15px; margin-bottom: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
            .ad-img { width: 100%; height: 180px; object-fit: cover; }
            .nav { position: fixed; bottom: 0; width: 100%; background: white; display: flex; border-top: 1px solid #ddd; padding-bottom: env(safe-area-inset-bottom); }
            .nav-item { flex: 1; text-align: center; padding: 12px; color: #888; font-size: 11px; }
            .nav-item.active { color: var(--p); }
            input, select, textarea { width: 100%; padding: 12px; margin: 8px 0; border-radius: 10px; border: 1px solid #ddd; box-sizing: border-box; }
            .btn { width: 100%; padding: 15px; background: var(--p); color: white; border: none; border-radius: 12px; font-weight: bold; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>
    </head>
    <body>

    <div class="header">بازار بزرگ SOUQ</div>

    <div id="p-home" class="page active">
        <div class="cat-bar">
            <div class="cat-item selected">همه</div><div class="cat-item">فروش</div><div class="cat-item">اشتغال</div><div class="cat-item">خدمات</div>
        </div>
        <div id="ad-list" style="margin-top:10px;">در حال بارگذاری...</div>
    </div>

    <div id="p-add" class="page">
        <h3>📢 ثبت آگهی جدید</h3>
        <input id="a-title" placeholder="عنوان آگهی">
        <select id="a-cat"><option>فروش</option><option>اشتغال</option><option>خدمات</option><option>املاک</option></select>
        <div style="display:flex; gap:5px;">
            <input id="a-price" placeholder="قیمت" style="flex:2;">
            <select id="a-curr" style="flex:1;"><option>تومان</option><option>دینار</option><option>درهم</option><option>دلار</option></select>
        </div>
        <select id="a-country"><option>ایران</option><option>عراق</option><option>امارات</option><option>عمان</option></select>
        <input type="file" accept="image/*" onchange="up(this)">
        <textarea id="a-desc" placeholder="توضیحات و تماس..."></textarea>
        <button class="btn" id="s-btn" onclick="send()">ارسال آگهی</button>
    </div>

    <div id="p-tools" class="page">
        <h3>💱 مبدل ارز</h3>
        <input type="number" id="v" placeholder="مقدار...">
        <select id="r"><option value="45">تومان به دینار</option><option value="0.00005">تومان به درهم</option></select>
        <button class="btn" onclick="calc()">تبدیل</button>
        <h2 id="res" style="text-align:center;"></h2>
    </div>

    <div id="p-admin" class="page">
        <h3>🛡️ مدیریت</h3>
        <div id="adm-list"></div>
    </div>

    <nav class="nav">
        <div class="nav-item active" onclick="tab('home',this)"><i class="fa fa-home fa-lg"></i><br>ویترین</div>
        <div class="nav-item" onclick="tab('add',this)"><i class="fa fa-plus-circle fa-lg"></i><br>ثبت</div>
        <div class="nav-item" onclick="tab('tools',this)"><i class="fa fa-exchange-alt fa-lg"></i><br>ارز</div>
        <div class="nav-item" onclick="tab('admin',this)"><i class="fa fa-user-shield fa-lg"></i><br>مدیریت</div>
    </nav>

    <script>
        const tg = window.Telegram.WebApp;
        let uid = 0, imgB64 = "";

        async function init() {
            tg.expand();
            uid = tg.initDataUnsafe?.user?.id || 12345;
            await fetch('/api/init', { method: 'POST', body: JSON.stringify({id: uid, user: tg.initDataUnsafe?.user?.first_name}) });
            loadAds();
        }

        async function loadAds() {
            const res = await fetch('/api/get-ads');
            const data = await res.json();
            document.getElementById('ad-list').innerHTML = data.map(a => \`
                <div class="ad-card">
                    <img src="\${a.image_base64}" class="ad-img">
                    <div style="padding:10px;">
                        <b>\${a.title}</b><br>
                        <small>\${a.country} | \${a.category}</small>
                        <div style="color:var(--p); font-weight:bold; margin-top:5px;">\${a.price} \${a.currency}</div>
                    </div>
                </div>
            \`).join('') || "آگهی یافت نشد.";
        }

        function up(el) {
            const r = new FileReader();
            r.onload = (e) => imgB64 = e.target.result;
            r.readAsDataURL(el.files[0]);
        }

        async function send() {
            if(!imgB64) return alert("عکس الزامی است");
            document.getElementById('s-btn').innerText = "در حال ارسال...";
            await fetch('/api/submit-ad', {
                method: 'POST',
                body: JSON.stringify({
                    uid, title: document.getElementById('a-title').value, cat: document.getElementById('a-cat').value,
                    price: document.getElementById('a-price').value, curr: document.getElementById('a-curr').value,
                    country: document.getElementById('a-country').value, city: 'Global', desc: document.getElementById('a-desc').value, img: imgB64
                })
            });
            alert("ثبت شد و پس از تایید مدیر منتشر می‌شود.");
            location.reload();
        }

        function calc() {
            const val = document.getElementById('v').value;
            const rate = document.getElementById('r').value;
            document.getElementById('res').innerText = (val / rate).toFixed(2);
        }

        async function loadAdmin() {
            const res = await fetch('/api/admin/list');
            const data = await res.json();
            document.getElementById('adm-list').innerHTML = data.map(a => \`
                <div class="ad-card" style="padding:10px;">
                    <b>\${a.title}</b><br>
                    <button onclick="adm(\${a.id},'active')" style="background:green; color:white; border:none; padding:5px; border-radius:5px;">تایید</button>
                    <button onclick="adm(\${a.id},'rejected')" style="background:red; color:white; border:none; padding:5px; border-radius:5px;">حذف</button>
                </div>
            \`).join('') || "موردی نیست.";
        }

        async function adm(id, status) {
            await fetch('/api/admin/action', { method: 'POST', body: JSON.stringify({id, status}) });
            loadAdmin();
        }

        function tab(p, el) {
            document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
            document.getElementById('p-' + p).classList.add('active');
            document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            if(p === 'admin') loadAdmin();
            if(p === 'home') loadAds();
        }

        window.onload = init;
    </script>
    </body>
    </html>`;

    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
};
