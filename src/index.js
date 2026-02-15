export default {
  async fetch(request, env) {
    const { DB } = env;
    const url = new URL(request.url);

    try {
      // --- API: مدیریت آگهی‌ها و کاربران ---
      if (url.pathname === "/api/init") {
        const body = await request.json();
        await DB.prepare("INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)")
          .bind(body.id, body.user).run();
        const user = await DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(body.id).first();
        return Response.json(user);
      }

      if (url.pathname === "/api/get-ads") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active' ORDER BY is_featured DESC, id DESC").all();
        return Response.json(results);
      }

      if (url.pathname === "/api/submit-ad") {
        const d = await request.json();
        await DB.prepare("INSERT INTO ads (user_id, title, category, price, currency, country, city, image_base64, description, is_featured) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
          .bind(d.uid, d.title, d.cat, d.price, d.curr, d.country, d.city, d.img, d.desc, d.vip).run();
        return Response.json({ success: true });
      }

      // --- API: پنل مدیریت (ساده شده برای امنیت) ---
      if (url.pathname === "/api/admin/pending") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'pending'").all();
        return Response.json(results);
      }
      
      if (url.pathname === "/api/admin/approve") {
        const { id, action } = await request.json();
        await DB.prepare("UPDATE ads SET status = ? WHERE id = ?").bind(action, id).run();
        return Response.json({ success: true });
      }

    } catch (e) { return Response.json({ error: e.message }, { status: 500 }); }

    // --- رابط کاربری (UI) ---
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
            :root { --primary: #007aff; --vip: #f1c40f; --bg: #f2f2f7; --card: #ffffff; }
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto; background: var(--bg); margin: 0; color: #1c1c1e; }
            
            /* Glassmorphism Header */
            .header { background: rgba(255,255,255,0.8); backdrop-filter: blur(10px); padding: 15px; position: sticky; top: 0; z-index: 100; border-bottom: 1px solid #d1d1d6; display: flex; justify-content: space-between; align-items: center; }
            
            .categories { display: flex; overflow-x: auto; padding: 10px; gap: 10px; scrollbar-width: none; }
            .cat-item { background: var(--card); padding: 8px 15px; border-radius: 20px; white-space: nowrap; font-size: 13px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); cursor: pointer; border: 1px solid transparent; }
            .cat-item.active { background: var(--primary); color: white; }

            .ad-card { background: var(--card); margin: 10px; border-radius: 15px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); position: relative; display: flex; flex-direction: column; }
            .ad-img { width: 100%; height: 200px; object-fit: cover; }
            .ad-info { padding: 12px; }
            .badge-vip { position: absolute; top: 10px; right: 10px; background: var(--vip); color: #000; padding: 4px 8px; border-radius: 8px; font-size: 10px; font-weight: bold; }

            .price-tag { color: var(--primary); font-weight: bold; font-size: 17px; }
            
            /* Bottom Nav */
            .nav { position: fixed; bottom: 0; width: 100%; background: rgba(255,255,255,0.9); backdrop-filter: blur(10px); display: flex; border-top: 1px solid #d1d1d6; padding-bottom: env(safe-area-inset-bottom); }
            .nav-item { flex: 1; text-align: center; padding: 10px; color: #8e8e93; font-size: 11px; }
            .nav-item.active { color: var(--primary); }

            .btn-main { background: var(--primary); color: white; border: none; padding: 15px; border-radius: 12px; width: 100%; font-weight: bold; font-size: 16px; margin-top: 10px; }
            
            /* Currency Modal */
            #tool-box { background: #1c1c1e; color: white; margin: 10px; padding: 15px; border-radius: 15px; display: none; }
            
            .page { display: none; padding-bottom: 80px; animation: slideUp 0.3s ease; }
            @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            .active-page { display: block; }
        </style>
    </head>
    <body>

    <div class="header">
        <span style="font-weight: 800; font-size: 18px;">SOUQ <span style="color:var(--primary)">PRO</span></span>
        <div id="user-badge" style="font-size: 12px; background: #eee; padding: 5px 10px; border-radius: 15px;">...</div>
    </div>

    <div class="categories">
        <div class="cat-item active" onclick="filterCat('همه')">همه</div>
        <div class="cat-item" onclick="filterCat('فروش')">🛍️ خرید و فروش</div>
        <div class="cat-item" onclick="filterCat('اشتغال')">💼 اشتغال</div>
        <div class="cat-item" onclick="filterCat('خدمات')">🛠️ خدمات</div>
        <div class="cat-item" onclick="filterCat('املاک')">🏠 املاک</div>
        <div class="cat-item" onclick="filterCat('خودرو')">🚗 خودرو</div>
    </div>

    <div id="tool-box">
        <div style="display: flex; justify-content: space-between;">
            <span><i class="fas fa-robot"></i> دستیار هوشمند</span>
            <i class="fas fa-times" onclick="toggleTools()"></i>
        </div>
        <div style="margin-top: 10px;">
            <input type="number" id="conv-val" placeholder="مقدار..." style="width:60%; padding:5px;">
            <select id="conv-type" style="padding:5px;">
                <option value="تومان-دینار">تومان به دینار</option>
                <option value="درهم-تومان">درهم به تومان</option>
            </select>
            <button onclick="convertCurr()" style="padding:5px;">تبدیل</button>
            <p id="conv-res" style="color:var(--vip); font-size:14px; margin-top:5px;"></p>
        </div>
    </div>

    <div id="page-home" class="page active-page">
        <div id="ad-container"></div>
    </div>

    <div id="page-add" class="page" style="padding: 20px;">
        <h2>ثبت آگهی جدید</h2>
        <input type="text" id="add-title" placeholder="عنوان آگهی">
        <select id="add-cat">
            <option>فروش</option><option>اشتغال</option><option>خدمات</option><option>املاک</option>
        </select>
        <div style="display: flex; gap: 5px;">
            <input type="text" id="add-price" placeholder="قیمت" style="flex:2;">
            <select id="add-curr" style="flex:1;">
                <option>تومان</option><option>دینار</option><option>درهم</option><option>دلار</option>
            </select>
        </div>
        <select id="add-country">
            <option>ایران</option><option>عراق</option><option>امارات</option><option>عمان</option><option>قطر</option>
        </select>
        <input type="file" accept="image/*" id="add-file" onchange="encodeImg(this)">
        <textarea id="add-desc" rows="4" placeholder="توضیحات کامل..."></textarea>
        <label style="font-size: 13px;"><input type="checkbox" id="add-is-vip"> این آگهی ویژه (VIP) شود</label>
        <button class="btn-main" onclick="publishAd()">ارسال برای تایید مدیر</button>
    </div>

    <div id="page-vip" class="page" style="padding: 20px; text-align: center;">
        <i class="fas fa-crown fa-3x" style="color:var(--vip)"></i>
        <h2>ارتقای حساب به VIP</h2>
        <div class="ad-card" style="padding: 15px; border: 2px solid var(--vip);">
            <h3>۱ ماهه</h3>
            <p>مشاهده آگهی‌ها در صدر لیست</p>
            <button class="btn-main" style="background:var(--vip); color:black;">خرید ۵ دلار</button>
        </div>
        <div class="ad-card" style="padding: 15px;">
            <h3>۳ ماهه (تخفیف ویژه)</h3>
            <button class="btn-main">خرید ۱۲ دلار</button>
        </div>
    </div>

    <div id="page-admin" class="page" style="padding: 20px;">
        <h2>پنل تایید آگهی</h2>
        <div id="admin-list"></div>
    </div>

    <nav class="nav">
        <div class="nav-item active" onclick="showPage('home', this)"><i class="fas fa-th-large fa-lg"></i><br>ویترین</div>
        <div class="nav-item" onclick="showPage('add', this)"><i class="fas fa-plus-circle fa-lg"></i><br>ثبت آگهی</div>
        <div class="nav-item" onclick="toggleTools()"><i class="fas fa-exchange-alt fa-lg"></i><br>تبدیل ارز</div>
        <div class="nav-item" onclick="showPage('vip', this)"><i class="fas fa-crown fa-lg"></i><br>ویژه</div>
        <div class="nav-item" onclick="showPage('admin', this)"><i class="fas fa-user-shield fa-lg"></i><br>مدیریت</div>
    </nav>

    <script>
        const tg = window.Telegram.WebApp;
        let userId = 0, userName = "Guest", b64Img = "";

        async function init() {
            tg.expand();
            userId = tg.initDataUnsafe?.user?.id || 999;
            userName = tg.initDataUnsafe?.user?.first_name || "کاربر";
            
            const res = await fetch('/api/init', {
                method: 'POST',
                body: JSON.stringify({id: userId, user: userName})
            });
            const userData = await res.json();
            document.getElementById('user-badge').innerText = userData.is_vip ? "VIP Member 👑" : "کاربر عادی";
            loadAds();
        }

        async function loadAds() {
            const res = await fetch('/api/get-ads');
            const ads = await res.json();
            const container = document.getElementById('ad-container');
            container.innerHTML = ads.map(ad => \`
                <div class="ad-card">
                    \${ad.is_featured ? '<span class="badge-vip">ویژه ★</span>' : ''}
                    <img src="\${ad.image_base64}" class="ad-img">
                    <div class="ad-info">
                        <div style="font-size:12px; color:#888;">\${ad.category} | \${ad.country}</div>
                        <div style="font-weight:bold; margin:5px 0;">\${ad.title}</div>
                        <div class="price-tag">\${ad.price} \${ad.currency}</div>
                    </div>
                </div>
            \`).join('');
        }

        function encodeImg(el) {
            const reader = new FileReader();
            reader.onload = (e) => b64Img = e.target.result;
            reader.readAsDataURL(el.files[0]);
        }

        async function publishAd() {
            const data = {
                uid: userId,
                title: document.getElementById('add-title').value,
                cat: document.getElementById('add-cat').value,
                price: document.getElementById('add-price').value,
                curr: document.getElementById('add-curr').value,
                country: document.getElementById('add-country').value,
                city: 'Global',
                desc: document.getElementById('add-desc').value,
                img: b64Img,
                vip: document.getElementById('add-is-vip').checked ? 1 : 0
            };
            await fetch('/api/submit-ad', { method: 'POST', body: JSON.stringify(data) });
            alert("آگهی ثبت و پس از تایید مدیر منتشر می‌شود.");
            showPage('home', document.querySelector('.nav-item'));
        }

        // سیستم مدیریت (Admin)
        async function loadAdmin() {
            const res = await fetch('/api/admin/pending');
            const ads = await res.json();
            document.getElementById('admin-list').innerHTML = ads.map(ad => \`
                <div class="ad-card" style="padding:10px;">
                    <b>\${ad.title}</b>
                    <button onclick="adminAction(\${ad.id}, 'active')" style="background:green; color:white;">تایید</button>
                    <button onclick="adminAction(\${ad.id}, 'rejected')" style="background:red; color:white;">حذف</button>
                </div>
            \`).join('');
        }

        async function adminAction(id, action) {
            await fetch('/api/admin/approve', { method:'POST', body: JSON.stringify({id, action}) });
            loadAdmin();
        }

        // ابزارها
        function toggleTools() {
            const box = document.getElementById('tool-box');
            box.style.display = box.style.display === 'block' ? 'none' : 'block';
        }

        function convertCurr() {
            const val = document.getElementById('conv-val').value;
            const type = document.getElementById('conv-type').value;
            let res = 0;
            if(type === 'تومان-دینار') res = val / 45; // مثال
            else res = val * 18000;
            document.getElementById('conv-res').innerText = "نتیجه تقریبی: " + res.toFixed(2);
        }

        function showPage(p, el) {
            document.querySelectorAll('.page').forEach(x => x.classList.remove('active-page'));
            document.getElementById('page-' + p).classList.add('active-page');
            document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            if(p === 'admin') loadAdmin();
        }

        window.onload = init;
    </script>
    </body>
    </html>`;

    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
};
