export default {
  async fetch(request, env) {
    const { DB } = env;
    const url = new URL(request.url);

    // ==========================================
    // 📡 بخش API (مدیریت درخواست‌های سمت سرور)
    // ==========================================
    try {
      // ۱. چک کردن وجود کاربر
      if (url.pathname === "/api/check-user") {
        const body = await request.json();
        const user = await DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(body.id).first();
        return Response.json({ exists: !!user });
      }

      // ۲. احراز هویت (ورود و ثبت‌نام)
      if (url.pathname === "/api/auth") {
        const { user_id, password, username, mode } = await request.json();
        if (mode === 'register') {
          await DB.prepare("INSERT INTO users (user_id, password, username) VALUES (?, ?, ?)")
            .bind(user_id, password, username).run();
          return Response.json({ success: true, msg: "ثبت‌نام انجام شد" });
        } else {
          const user = await DB.prepare("SELECT * FROM users WHERE user_id = ? AND password = ?")
            .bind(user_id, password).first();
          return Response.json({ success: !!user, msg: user ? "ورود موفق" : "رمز اشتباه است" });
        }
      }

      // ۳. دریافت آگهی‌ها
      if (url.pathname === "/api/get-ads") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active' ORDER BY is_vip DESC, id DESC").all();
        return Response.json(results || []);
      }

      // ۴. ثبت آگهی
      if (url.pathname === "/api/submit-ad") {
        const d = await request.json();
        await DB.prepare("INSERT INTO ads (user_id, title, price, country, city, image_base64, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')")
          .bind(d.user_id, d.title, d.price, d.country, d.city, d.img, d.desc).run();
        return Response.json({ success: true });
      }
    } catch (err) {
      if (url.pathname.startsWith("/api/")) {
        return Response.json({ success: false, msg: "خطای دیتابیس: " + err.message }, { status: 500 });
      }
    }

    // ==========================================
    // 🎨 بخش فرانت‌اند (رابط کاربری)
    // ==========================================
    const html = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>SOUQ IRAN ARAB</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            :root { --primary: #1e3799; --bg: #f4f7f6; --card: #ffffff; --text: #2c3e50; }
            body { margin: 0; font-family: Tahoma; background: var(--bg); color: var(--text); padding-bottom: 70px; }
            .theme-dark { --bg: #121212; --card: #1e1e1e; --text: #f1f1f1; --primary: #3498db; }
            
            /* سیستم صفحات */
            .page { display: none; padding: 15px; animation: fadeIn 0.3s; }
            .page.active { display: block; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

            /* باکس ورود */
            .login-screen { position: fixed; inset: 0; background: var(--bg); z-index: 9999; display: flex; align-items: center; justify-content: center; }
            .login-box { background: var(--card); padding: 30px; border-radius: 20px; width: 85%; max-width: 350px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
            
            input, select, textarea { width: 100%; padding: 12px; margin: 10px 0; border-radius: 12px; border: 1px solid #ddd; background: var(--card); color: var(--text); box-sizing: border-box; }
            .btn { width: 100%; padding: 15px; border-radius: 12px; border: none; background: var(--primary); color: white; font-weight: bold; cursor: pointer; }
            .captcha-box { background: #eee; padding: 10px; font-size: 22px; letter-spacing: 8px; margin: 10px 0; border-radius: 10px; color: #333; font-weight: bold; }

            /* نوار پایین */
            .nav { position: fixed; bottom: 0; width: 100%; background: var(--card); display: flex; border-top: 1px solid #eee; }
            .nav-item { flex: 1; text-align: center; padding: 12px; color: #888; cursor: pointer; font-size: 12px; }
            .nav-item.active { color: var(--primary); font-weight: bold; }

            .ad-card { background: var(--card); border-radius: 15px; display: flex; padding: 10px; margin-bottom: 10px; gap: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
            .ad-img { width: 80px; height: 80px; border-radius: 10px; object-fit: cover; }
        </style>
    </head>
    <body class="theme-light">

        <div id="login-screen" class="login-screen">
            <div class="login-box">
                <i class="fas fa-user-shield fa-3x" style="color:var(--primary); margin-bottom:15px;"></i>
                <h3 id="login-title">ورود به بازار</h3>
                <div id="browser-fields" style="display:none;">
                    <input type="number" id="login-id" placeholder="آیدی تلگرام شما">
                </div>
                <input type="password" id="login-pass" placeholder="رمز عبور">
                <div class="captcha-box" id="captcha-code" onclick="createCaptcha()"></div>
                <input type="number" id="login-captcha" placeholder="کد امنیتی بالا">
                <button class="btn" onclick="handleAuth()">ورود / تایید</button>
                <p id="login-hint" style="font-size:11px; color:#777; margin-top:10px;"></p>
            </div>
        </div>

        <div id="main-app" style="display:none;">
            <div id="page-home" class="page active">
                <div id="ads-list">در حال لود...</div>
            </div>

            <div id="page-add" class="page">
                <h3>ثبت آگهی</h3>
                <input type="text" id="ad-title" placeholder="عنوان آگهی">
                <input type="text" id="ad-price" placeholder="قیمت">
                <select id="ad-country">
                    <option value="ایران">ایران</option>
                    <option value="عراق">عراق</option>
                    <option value="امارات">امارات</option>
                </select>
                <input type="text" id="ad-city" placeholder="شهر">
                <input type="file" id="ad-file" accept="image/*" onchange="processFile(this)">
                <textarea id="ad-desc" placeholder="توضیحات..."></textarea>
                <button class="btn" onclick="submitAd()">ارسال آگهی</button>
            </div>

            <div id="page-profile" class="page">
                <h3>تنظیمات پروفایل</h3>
                <button class="btn" onclick="document.body.className='theme-dark'">تم تاریک</button>
                <button class="btn" style="margin-top:10px; background:#ddd; color:#000;" onclick="document.body.className='theme-light'">تم روشن</button>
                <hr>
                <p>آیدی شما: <span id="my-id"></span></p>
            </div>

            <nav class="nav">
                <div class="nav-item active" onclick="showPage('home', this)"><i class="fas fa-home"></i><br>ویترین</div>
                <div class="nav-item" onclick="showPage('add', this)"><i class="fas fa-plus"></i><br>ثبت آگهی</div>
                <div class="nav-item" onclick="showPage('profile', this)"><i class="fas fa-user"></i><br>پروفایل</div>
            </nav>
        </div>

        <script>
            const tg = window.Telegram.WebApp;
            let captchaVal = "";
            let userId = 0;
            let isNew = false;
            let base64Image = "";

            function createCaptcha() {
                captchaVal = Math.floor(1000 + Math.random() * 9000).toString();
                document.getElementById('captcha-code').innerText = captchaVal;
            }

            async function init() {
                createCaptcha();
                tg.expand();
                const user = tg.initDataUnsafe?.user;
                
                if (user) {
                    userId = user.id;
                    const res = await fetch('/api/check-user', { 
                        method: 'POST', body: JSON.stringify({ id: userId }) 
                    });
                    const data = await res.json();
                    if (!data.exists) {
                        isNew = true;
                        document.getElementById('login-title').innerText = "تعیین رمز اولیه";
                        document.getElementById('login-hint').innerText = "یک رمز برای استفاده در مرورگر انتخاب کنید";
                    }
                } else {
                    document.getElementById('browser-fields').style.display = 'block';
                }
            }

            async function handleAuth() {
                const pass = document.getElementById('login-pass').value;
                const captcha = document.getElementById('login-captcha').value;
                if (!userId) userId = document.getElementById('login-id').value;

                if (captcha !== captchaVal) return alert("کد امنیتی غلط است");
                if (!pass || !userId) return alert("فیلدها را پر کنید");

                try {
                    const res = await fetch('/api/auth', {
                        method: 'POST',
                        body: JSON.stringify({
                            user_id: userId,
                            password: pass,
                            username: tg.initDataUnsafe?.user?.username || 'Guest',
                            mode: isNew ? 'register' : 'login'
                        })
                    });
                    const result = await res.json();
                    if (result.success) {
                        document.getElementById('login-screen').style.display = 'none';
                        document.getElementById('main-app').style.display = 'block';
                        document.getElementById('my-id').innerText = userId;
                        loadAds();
                    } else {
                        alert(result.msg);
                        createCaptcha();
                    }
                } catch (e) {
                    alert("خطا در اتصال به سرور. مطمئن شوید دیتابیس D1 وصل است.");
                }
            }

            function processFile(el) {
                const file = el.files[0];
                const reader = new FileReader();
                reader.onload = (e) => { base64Image = e.target.result; };
                reader.readAsDataURL(file);
            }

            async function submitAd() {
                if(!base64Image) return alert("عکس الزامی است");
                const data = {
                    user_id: userId,
                    title: document.getElementById('ad-title').value,
                    price: document.getElementById('ad-price').value,
                    country: document.getElementById('ad-country').value,
                    city: document.getElementById('ad-city').value,
                    desc: document.getElementById('ad-desc').value,
                    img: base64Image
                };
                const res = await fetch('/api/submit-ad', { method: 'POST', body: JSON.stringify(data) });
                if(res.ok) { alert("آگهی ثبت شد"); showPage('home', document.querySelector('.nav-item')); }
            }

            async function loadAds() {
                const res = await fetch('/api/get-ads');
                const ads = await res.json();
                document.getElementById('ads-list').innerHTML = ads.map(ad => `
                    <div class="ad-card">
                        <img src="${ad.image_base64}" class="ad-img">
                        <div>
                            <b>${ad.title}</b><br>
                            <small>${ad.country} - ${ad.city}</small><br>
                            <span style="color:green; font-weight:bold;">${ad.price}</span>
                        </div>
                    </div>
                `).join('') || "آگهی نیست";
            }

            function showPage(p, el) {
                document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
                document.getElementById('page-' + p).classList.add('active');
                document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
                el.classList.add('active');
                if(p === 'home') loadAds();
            }

            window.onload = init;
        </script>
    </body>
    </html>`;

    return new Response(html, { headers: { "Content-Type": "text/html;charset=utf-8" } });
  }
};
