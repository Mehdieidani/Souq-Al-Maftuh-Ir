/**
 * ------------------------------------------------------------------
 * بخش ۱: ریموت کنترل مرکزی (تنظیمات)
 * ------------------------------------------------------------------
 * تمام تغییرات (رنگ، متن، قوانین) را فقط در این قسمت انجام دهید.
 */
const CONFIG = {
    app: {
        name: "SOUQ MARKET",
        welcome: "به بازار بزرگ ما خوش آمدید 🌹",
        support: "@YourSupportID",
        version: "3.0.0"
    },
    theme: {
        primary: "#007aff",    // رنگ اصلی (آبی)
        vip: "#f1c40f",        // رنگ طلایی برای VIP
        bg: "#f2f2f7",         // رنگ پس‌زمینه
        font: "Tahoma, sans-serif"
    },
    business: {
        currency: "تومان",
        categories: ["خرید و فروش", "املاک", "خودرو", "خدمات", "کاریابی"],
        requireApproval: true, // آیا آگهی نیاز به تایید مدیر دارد؟
        admins: [6522877528]     // آیدی عددی تلگرام مدیران
    }
};

/**
 * ------------------------------------------------------------------
 * بخش ۲: موتور ظاهر ساز (UI Engine)
 * ------------------------------------------------------------------
 * این بخش HTML را بر اساس تنظیمات بالا می‌سازد. دست نزنید.
 */
function generateHTML(url) {
    return `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>${CONFIG.app.name}</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            :root { --p: ${CONFIG.theme.primary}; --vip: ${CONFIG.theme.vip}; --bg: ${CONFIG.theme.bg}; }
            body { font-family: ${CONFIG.theme.font}; background: var(--bg); margin: 0; padding-bottom: 80px; }
            .header { background: var(--p); color: white; padding: 15px; text-align: center; font-weight: bold; position: sticky; top:0; z-index:100; }
            .cat-scroll { display: flex; overflow-x: auto; padding: 10px; gap: 8px; background: white; white-space: nowrap; }
            .cat-btn { background: #eee; padding: 6px 12px; border-radius: 20px; font-size: 13px; color: #333; }
            .card { background: white; border-radius: 12px; margin: 10px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
            .card img { width: 100%; height: 160px; object-fit: cover; }
            .card-body { padding: 10px; }
            .price-tag { color: var(--p); font-weight: bold; font-size: 1.1em; }
            .nav { position: fixed; bottom: 0; width: 100%; background: white; display: flex; border-top: 1px solid #ddd; padding-bottom: env(safe-area-inset-bottom); }
            .nav-item { flex: 1; text-align: center; padding: 10px; color: #888; font-size: 11px; }
            .nav-item.active { color: var(--p); }
            .btn { width: 100%; padding: 14px; background: var(--p); color: white; border: none; border-radius: 10px; font-size: 16px; font-weight: bold; margin-top: 10px; }
            input, select, textarea { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; }
            .page { display: none; padding: 10px; }
            .page.active { display: block; }
        </style>
    </head>
    <body>
        <div class="header">${CONFIG.app.name}</div>

        <div id="p-home" class="page active">
            <div class="cat-scroll">
                <div class="cat-btn" style="background:var(--p); color:white">همه</div>
                ${CONFIG.business.categories.map(c => `<div class="cat-btn">${c}</div>`).join('')}
            </div>
            <div id="ad-list">در حال بارگذاری...</div>
        </div>

        <div id="p-add" class="page">
            <h3>📢 ثبت آگهی جدید</h3>
            <input id="t" placeholder="عنوان (مثلاً: فروش گوشی)">
            <select id="cat">${CONFIG.business.categories.map(c => `<option>${c}</option>`).join('')}</select>
            <input id="pr" type="text" placeholder="قیمت (به ${CONFIG.business.currency})">
            <input type="file" accept="image/*" onchange="up(this)">
            <textarea id="de" rows="3" placeholder="توضیحات تکمیلی..."></textarea>
            <button class="btn" onclick="send()">ارسال آگهی</button>
        </div>

        <div id="p-admin" class="page">
            <h3>🛡️ پنل مدیریت</h3>
            <div id="admin-list"></div>
        </div>

        <nav class="nav">
            <div class="nav-item active" onclick="tab('home',this)"><i class="fa fa-store fa-lg"></i><br>ویترین</div>
            <div class="nav-item" onclick="tab('add',this)"><i class="fa fa-plus-circle fa-lg"></i><br>ثبت</div>
            <div id="admin-tab" class="nav-item" style="display:none" onclick="tab('admin',this)"><i class="fa fa-shield-halved fa-lg"></i><br>مدیریت</div>
        </nav>

        <script>
            const tg = window.Telegram.WebApp;
            const cfg = ${JSON.stringify(CONFIG)};
            let uid = 0, img = "";

            async function init() {
                tg.expand();
                uid = tg.initDataUnsafe?.user?.id || 0;
                
                // بررسی ادمین بودن
                if (cfg.business.admins.includes(uid)) {
                    document.getElementById('admin-tab').style.display = 'block';
                }

                await fetch('/api/init', { method: 'POST', body: JSON.stringify({id: uid, user: tg.initDataUnsafe?.user?.first_name}) });
                loadAds();
            }

            async function loadAds() {
                const res = await fetch('/api/get-ads');
                const data = await res.json();
                document.getElementById('ad-list').innerHTML = data.map(a => \`
                    <div class="card">
                        <img src="\${a.image_base64}">
                        <div class="card-body">
                            <b>\${a.title}</b><br>
                            <small style="color:#666">\${a.category}</small>
                            <div class="price-tag">\${a.price} \${cfg.business.currency}</div>
                        </div>
                    </div>
                \`).join('') || "<p style='text-align:center; padding:20px;'>هنوز آگهی ثبت نشده است.</p>";
            }

            function up(el) {
                const r = new FileReader();
                r.onload = e => img = e.target.result;
                r.readAsDataURL(el.files[0]);
            }

            async function send() {
                if(!img) return alert("لطفاً یک عکس انتخاب کنید!");
                const btn = document.querySelector('#p-add .btn');
                btn.innerText = "در حال ارسال...";
                
                await fetch('/api/submit-ad', {
                    method: 'POST',
                    body: JSON.stringify({
                        uid, 
                        title: document.getElementById('t').value, 
                        cat: document.getElementById('cat').value,
                        price: document.getElementById('pr').value, 
                        img: img, 
                        desc: document.getElementById('de').value
                    })
                });
                
                alert(cfg.business.requireApproval ? "آگهی ثبت شد و پس از تایید مدیریت نمایش داده می‌شود." : "آگهی با موفقیت منتشر شد!");
                location.reload();
            }

            async function loadAdmin() {
                const res = await fetch('/api/admin/list');
                const data = await res.json();
                document.getElementById('admin-list').innerHTML = data.map(a => \`
                    <div class="card" style="padding:10px">
                        <b>\${a.title}</b><br>
                        <button onclick="adm(\${a.id},'active')" style="background:green; color:white; border:none; padding:5px 10px; margin:5px; border-radius:5px;">تایید</button>
                        <button onclick="adm(\${a.id},'rejected')" style="background:red; color:white; border:none; padding:5px 10px; margin:5px; border-radius:5px;">حذف</button>
                    </div>
                \`).join('') || "همه چیز تمیز است!";
            }

            async function adm(id, status) {
                await fetch('/api/admin/action', { method: 'POST', body: JSON.stringify({id, status}) });
                loadAdmin();
            }

            function tab(p, el) {
                document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
                document.getElementById('p-'+p).classList.add('active');
                document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
                el.classList.add('active');
                if(p === 'home') loadAds();
                if(p === 'admin') loadAdmin();
            }

            window.onload = init;
        </script>
    </body>
    </html>`;
}

/**
 * ------------------------------------------------------------------
 * بخش ۳: منطق سرور (Server Logic)
 * ------------------------------------------------------------------
 * اینجا به دیتابیس و تلگرام وصل می‌شویم. به این بخش دست نزنید.
 */
export default {
  async fetch(request, env) {
    const { DB, BOT_TOKEN } = env;
    const url = new URL(request.url);
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Content-Type": "application/json;charset=UTF-8"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      // 1. هندل کردن ربات تلگرام
      if (request.method === "POST" && !url.pathname.startsWith("/api/")) {
        const update = await request.json();
        if (update.message?.text === "/start") {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: update.message.chat.id,
              text: CONFIG.app.welcome,
              reply_markup: {
                inline_keyboard: [[{ text: "🚀 ورود به بازار", web_app: { url: `https://${url.hostname}` } }]]
              }
            })
          });
        }
        return new Response("OK");
      }

      // 2. هندل کردن API ها
      if (url.pathname === "/api/get-ads") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active' ORDER BY id DESC").all();
        return Response.json(results || [], { headers: corsHeaders });
      }

      if (url.pathname === "/api/submit-ad") {
        const d = await request.json();
        // وضعیت پیش‌فرض بر اساس تنظیمات ریموت کنترل
        const status = CONFIG.business.requireApproval ? 'pending' : 'active';
        await DB.prepare("INSERT INTO ads (user_id, title, category, price, currency, image_base64, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(Number(d.uid), d.title, d.cat, d.price, CONFIG.business.currency, d.img, d.desc, status).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (url.pathname === "/api/admin/list") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'pending'").all();
        return Response.json(results || [], { headers: corsHeaders });
      }

      if (url.pathname === "/api/admin/action") {
        const { id, status } = await request.json();
        await DB.prepare("UPDATE ads SET status = ? WHERE id = ?").bind(status, id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      if (url.pathname === "/api/init") {
        const body = await request.json();
        await DB.prepare("INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)")
          .bind(Number(body.id), body.user || 'Guest').run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // 3. نمایش HTML
      return new Response(generateHTML(url), { headers: { "Content-Type": "text/html;charset=UTF-8" } });

    } catch (e) {
      return new Response("خطا: " + e.message, { status: 200 });
    }
  }
};
