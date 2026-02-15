export default {
  async fetch(request, env) {
    const { DB, BOT_TOKEN } = env;
    const url = new URL(request.url);

    // --- بخش API برای ارتباط با دیتابیس ---
    
    // ۱. دریافت لیست آگهی‌های تایید شده
    if (url.pathname === "/get-ads") {
      const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active' ORDER BY is_special DESC, created_at DESC").all();
      return new Response(JSON.stringify(results), { headers: { "Content-Type": "application/json" } });
    }

    // ۲. ثبت آگهی جدید (ارسال به دیتابیس)
    if (request.method === "POST" && url.pathname === "/submit-ad") {
      const data = await request.json();
      await DB.prepare(`
        INSERT INTO ads (title_fa, title_ar, price, phone, desc_fa, country, city, image_url, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
      `).bind(data.title, data.title, data.price, data.phone, data.desc, data.country, data.city, data.img).run();
      
      return new Response(JSON.stringify({ success: true }));
    }

    // --- بخش نمایش مینی‌اپ (کد شما با اصلاحات) ---
    const html = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>السوق المفتوح + ایران</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            /* تمام استایل‌های زیبای شما اینجا می‌ماند */
            :root { 
                --primary: #1e3799; --accent: #2ecc71; --gold: #f1c40f; 
                --bg: #f1f2f6; --card: #ffffff; --text: #2c3e50;
            }
            ${getStyles()} /* استایل‌های تم و بدنه */
        </style>
    </head>
    <body class="theme-light" id="body-tag">
        
        <div id="p-login" class="page page-active" style="padding:40px 20px;">
            <div class="login-box">
                <i class="fas fa-shield-alt fa-3x" style="color:var(--primary); margin-bottom:15px;"></i>
                <h2 id="lang-login-title">ورود امنیتی</h2>
                <input type="password" id="pass-input" placeholder="رمز عبور">
                <div id="captcha-code" class="captcha-box"></div>
                <input type="text" id="captcha-input" placeholder="کد امنیتی">
                <button class="btn" style="background:var(--primary); color:#fff;" onclick="handleLogin()">ورود</button>
            </div>
        </div>

        <div id="main-app" style="display:none;">
            <header class="header">
                <b>Souq Iran & Arab</b>
                <div class="lang-group">
                    <button class="lang-btn lang-active" onclick="setLang('fa', this)">FA</button>
                    <button class="lang-btn" onclick="setLang('ar', this)">AR</button>
                </div>
            </header>

            <div id="p-home" class="page active" style="padding:10px;">
                <div id="ads-list">در حال بارگذاری...</div>
            </div>

            <div id="p-add" class="page" style="padding:20px;">
                <h3>ثبت آگهی جدید</h3>
                <input type="text" id="ad-title" placeholder="عنوان آگهی">
                <div style="display:flex; gap:5px;">
                    <select id="ad-country">
                        <option value="ایران">ایران</option>
                        <option value="عراق">العراق</option>
                        <option value="امارات">الإمارات</option>
                    </select>
                    <input type="text" id="ad-city" placeholder="شهر">
                </div>
                <input type="text" id="ad-price" placeholder="قیمت (مثلاً 100$)">
                <input type="text" id="ad-img" placeholder="لینک عکس (به زودی آپلود مستقیم)">
                <textarea id="ad-desc" placeholder="توضیحات کامل..."></textarea>
                <button class="btn" style="background:var(--accent); color:#fff;" onclick="submitToDB()">ارسال برای تایید</button>
            </div>

            <nav class="nav">
                <div class="nav-item nav-active" onclick="showPage('home', this)"><i class="fas fa-home"></i><br>خانه</div>
                <div class="nav-item" onclick="showPage('add', this)"><i class="fas fa-plus-circle"></i><br>ثبت آگهی</div>
                <div class="nav-item" onclick="showPage('settings', this)"><i class="fas fa-cog"></i><br>تنظیمات</div>
            </nav>
        </div>

        <script>
            const tg = window.Telegram.WebApp;
            
            // تابع لود آگهی‌ها از دیتابیس واقعی
            async function loadAds() {
                const res = await fetch('/get-ads');
                const data = await res.json();
                const list = document.getElementById('ads-list');
                list.innerHTML = data.map(ad => \`
                    <div class="ad-card">
                        <img src="\${ad.image_url}" class="ad-img">
                        <div>
                            <b>\${ad.title_fa}</b><br>
                            <small>\${ad.country} - \${ad.city}</small><br>
                            <span style="color:green">\${ad.price}</span>
                        </div>
                    </div>
                \`).join('') || "آگهی یافت نشد.";
            }

            async function submitToDB() {
                const data = {
                    title: document.getElementById('ad-title').value,
                    price: document.getElementById('ad-price').value,
                    country: document.getElementById('ad-country').value,
                    city: document.getElementById('ad-city').value,
                    desc: document.getElementById('ad-desc').value,
                    img: document.getElementById('ad-img').value
                };
                
                await fetch('/submit-ad', {
                    method: 'POST',
                    body: JSON.stringify(data)
                });
                
                tg.showAlert("آگهی با موفقیت ارسال شد و در صف تایید قرار گرفت.");
                showPage('home');
            }

            function showPage(p, btn) {
                document.querySelectorAll('.page').forEach(el => el.style.display = 'none');
                document.getElementById('p-'+p).style.display = 'block';
                if(p === 'home') loadAds();
            }

            window.onload = () => { tg.expand(); };
        </script>
    </body>
    </html>`;

    return new Response(html, { headers: { "Content-Type": "text/html;charset=utf-8" } });
  }
};

// تابع کمکی برای تمیز ماندن کد (استایل‌های شما)
function getStyles() {
    return `
        body { margin:0; font-family:tahoma; background:var(--bg); color:var(--text); }
        .header { background:var(--primary); color:white; padding:15px; display:flex; justify-content:space-between; }
        .nav { position:fixed; bottom:0; width:100%; background:white; display:flex; padding:10px 0; border-top:1px solid #ddd; }
        .nav-item { flex:1; text-align:center; font-size:12px; color:#888; }
        .nav-active { color:var(--primary); font-weight:bold; }
        .ad-card { background:white; margin:10px; padding:10px; display:flex; gap:10px; border-radius:10px; box-shadow:0 2px 5px rgba(0,0,0,0.1); }
        .ad-img { width:80px; height:80px; border-radius:8px; object-fit:cover; }
        .login-box { background:white; padding:30px; border-radius:20px; text-align:center; margin:20px; }
        input, select, textarea { width:100%; padding:12px; margin:5px 0; border-radius:10px; border:1px solid #ddd; }
        .btn { width:100%; padding:15px; border-radius:10px; border:none; font-weight:bold; cursor:pointer; }
    `;
}
