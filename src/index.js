export default {
  async fetch(request, env) {
    const { DB } = env;
    const url = new URL(request.url);

    // هدرهای لازم برای اینکه دکمه‌ها در تلگرام کار کنند (CORS)
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json;charset=UTF-8"
    };

    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

    try {
      // --- بخش API ---
      
      // ۱. شناسایی کاربر
      if (url.pathname === "/api/init") {
        const body = await request.json();
        await DB.prepare("INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)")
          .bind(Number(body.id), body.user || 'Guest').run();
        const user = await DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(Number(body.id)).first();
        return Response.json(user, { headers: corsHeaders });
      }

      // ۲. دریافت آگهی‌ها (فقط تایید شده‌ها)
      if (url.pathname === "/api/get-ads") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active' ORDER BY is_featured DESC, id DESC").all();
        return Response.json(results || [], { headers: corsHeaders });
      }

      // ۳. ثبت آگهی جدید
      if (url.pathname === "/api/submit-ad") {
        const d = await request.json();
        await DB.prepare("INSERT INTO ads (user_id, title, category, price, currency, country, city, image_base64, description) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(Number(d.uid), d.title, d.cat, d.price, d.curr, d.country, d.city, d.img, d.desc).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

      // ۴. پنل مدیریت (نمایش آگهی‌های در انتظار تایید)
      if (url.pathname === "/api/admin/pending") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'pending'").all();
        return Response.json(results || [], { headers: corsHeaders });
      }

      // ۵. تایید یا رد آگهی توسط مدیر
      if (url.pathname === "/api/admin/approve") {
        const { id, action } = await request.json();
        await DB.prepare("UPDATE ads SET status = ? WHERE id = ?").bind(action, id).run();
        return Response.json({ success: true }, { headers: corsHeaders });
      }

    } catch (e) {
      return Response.json({ error: e.message }, { status: 500, headers: corsHeaders });
    }

    // --- بخش ظاهر (UI حرفه‌ای) ---
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
            body { font-family: sans-serif; background: var(--bg); margin: 0; padding-bottom: 80px; user-select: none; }
            .header { background: white; padding: 15px; position: sticky; top: 0; z-index: 100; border-bottom: 1px solid #ddd; text-align: center; font-weight: bold; }
            .page { display: none; padding: 15px; animation: fadeIn 0.3s; }
            .active { display: block; }
            .ad-card { background: white; border-radius: 15px; margin-bottom: 15px; overflow: hidden; box-shadow: 0 4px 10px rgba(0,0,0,0.05); }
            .ad-img { width: 100%; height: 180px; object-fit: cover; }
            .ad-body { padding: 12px; }
            .price { color: var(--p); font-weight: bold; font-size: 18px; }
            .nav { position: fixed; bottom: 0; width: 100%; background: white; display: flex; border-top: 1px solid #ddd; padding-bottom: 15px; }
            .nav-item { flex: 1; text-align: center; padding: 10px; color: #888; font-size: 11px; cursor: pointer; }
            .nav-item.active { color: var(--p); }
            input, select, textarea { width: 100%; padding: 12px; margin: 8px 0; border-radius: 10px; border: 1px solid #ddd; box-sizing: border-box; font-family: inherit; }
            .btn { width: 100%; padding: 15px; background: var(--p); color: white; border: none; border-radius: 12px; font-weight: bold; cursor: pointer; }
            .admin-btn { padding: 5px 10px; border-radius: 5px; border: none; color: white; cursor: pointer; margin: 5px; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>
    </head>
    <body>

    <div class="header">SOUQ <span style="color:var(--p)">PRO</span></div>

    <div id="p-home" class="page active">
        <div id="ad-list">در حال بارگذاری...</div>
    </div>

    <div id="p-add" class="page">
        <h3>📢 ثبت آگهی جدید</h3>
        <input type="text" id="a-title" placeholder="عنوان آگهی">
        <select id="a-cat">
            <option>خرید و فروش</option><option>اشتغال</option><option>خدمات</option><option>املاک</option><option>خودرو</option>
        </select>
        <div style="display:flex; gap:5px;">
            <input type="text" id="a-price" placeholder="قیمت" style="flex:2;">
            <select id="a-curr" style="flex:1;">
                <option>تومان</option><option>دینار</option><option>درهم</option><option>دلار</option>
            </select>
        </div>
        <select id="a-country">
            <option>ایران</option><option>عراق</option><option>امارات</option><option>عمان</option><option>قطر</option>
        </select>
        <input type="file" accept="image/*" onchange="upImg(this)">
        <textarea id="a-desc" placeholder="توضیحات و شماره تماس..."></textarea>
        <button class="btn" id="send-btn" onclick="send()">ارسال برای تایید مدیر</button>
    </div>

    <div id="p-tools" class="page">
        <h3>💱 مبدل ارز هوشمند</h3>
        <input type="number" id="v" placeholder="مقدار را وارد کنید...">
        <select id="t">
            <option value="45">تومان به دینار عراق</option>
            <option value="18000">درهم امارات به تومان</option>
        </select>
        <button class="btn" onclick="calc()">محاسبه تبدیل</button>
        <h2 id="res" style="text-align:center; color:var(--p)"></h2>
    </div>

    <div id="p-admin" class="page">
        <h3>🛡️ تایید آگهی‌های جدید</h3>
        <div id="admin-list"></div>
    </div>

    <nav class="nav">
        <div class="nav-item active" onclick="tab('home',this)"><i class="fa fa-home fa-lg"></i><br>ویترین</div>
        <div class="nav-item" onclick="tab('add',this)"><i class="fa fa-plus-circle fa-lg"></i><br>ثبت آگهی</div>
        <div class="nav-item" onclick="tab('tools',this)"><i class="fa fa-exchange-alt fa-lg"></i><br>ارز</div>
        <div class="nav-item" onclick="tab('admin',this)"><i class="fa fa-user-shield fa-lg"></i><br>مدیریت</div>
    </nav>

    <script>
        const tg = window.Telegram.WebApp;
        let uid = 0, imgB64 = "";

        // برای اینکه دکمه‌ها در گوشی کار کنند، باید آدرس کامل ورکر را اینجا بگذارید
        const API_BASE = window.location.origin;

        async function init() {
            tg.expand();
            uid = tg.initDataUnsafe?.user?.id || 12345;
            
            await fetch(API_BASE + '/api/init', {
                method: 'POST',
                body: JSON.stringify({ id: uid, user: tg.initDataUnsafe?.user?.first_name })
            });
            loadAds();
        }

        async function loadAds() {
            const res = await fetch(API_BASE + '/api/get-ads');
            const ads = await res.json();
            document.getElementById('ad-list').innerHTML = ads.map(a => \`
                <div class="ad-card">
                    <img src="\${a.image_base64}" class="ad-img">
                    <div class="ad-body">
                        <small style="color:#888">\${a.category} | \${a.country}</small>
                        <div style="font-weight:bold; margin:5px 0;">\${a.title}</div>
                        <div class="price">\${a.price} \${a.currency}</div>
                    </div>
                </div>
            \`).join('') || "آگهی فعالی وجود ندارد.";
        }

        function upImg(el) {
            const reader = new FileReader();
            reader.onload = (e) => imgB64 = e.target.result;
            reader.readAsDataURL(el.files[0]);
        }

        async function send() {
            if(!imgB64 || !document.getElementById('a-title').value) return alert("تکمیل عنوان و عکس الزامی است");
            document.getElementById('send-btn').innerText = "در حال ارسال...";
            
            await fetch(API_BASE + '/api/submit-ad', {
                method: 'POST',
                body: JSON.stringify({
                    uid: uid, title: document.getElementById('a-title').value,
                    cat: document.getElementById('a-cat').value, price: document.getElementById('a-price').value,
                    curr: document.getElementById('a-curr').value, country: document.getElementById('a-country').value,
                    city: 'Global', desc: document.getElementById('a-desc').value, img: imgB64
                })
            });
            alert("ارسال شد! پس از تایید مدیر نمایش داده می‌شود.");
            location.reload();
        }

        function calc() {
            const val = document.getElementById('v').value;
            const rate = document.getElementById('t').value;
            document.getElementById('res').innerText = (val / rate).toFixed(2);
        }

        async function loadAdmin() {
            const res = await fetch(API_BASE + '/api/admin/pending');
            const ads = await res.json();
            document.getElementById('admin-list').innerHTML = ads.map(a => \`
                <div style="background:white; padding:10px; margin-bottom:5px; border-radius:10px;">
                    <b>\${a.title}</b><br>
                    <button class="admin-btn" style="background:green" onclick="adm(\${a.id},'active')">تایید</button>
                    <button class="admin-btn" style="background:red" onclick="adm(\${a.id},'rejected')">رد</button>
                </div>
            \`).join('') || "آگهی در انتظار تایید نیست.";
        }

        async function adm(id, act) {
            await fetch(API_BASE + '/api/admin/approve', {
                method: 'POST',
                body: JSON.stringify({ id, action: act })
            });
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
