export default {
  async fetch(request, env) {
    const { DB } = env;
    const url = new URL(request.url);

    // ==========================================
    // 📡 بخش API (مدیریت درخواست‌های سمت سرور)
    // ==========================================
    try {
      // ۱. بررسی وجود کاربر (Check User)
      if (url.pathname === "/api/check-user") {
        const body = await request.json();
        const user = await DB.prepare("SELECT * FROM users WHERE user_id = ?")
                       .bind(body.id).first();
        return Response.json({ exists: !!user });
      }

      // ۲. احراز هویت (Auth: Login/Register)
      if (url.pathname === "/api/auth") {
        const { user_id, password, username, mode } = await request.json();
        
        if (mode === 'register') {
          await DB.prepare("INSERT INTO users (user_id, password, username) VALUES (?, ?, ?)")
            .bind(user_id, password, username).run();
          return Response.json({ success: true, msg: "ثبت‌نام موفقیت‌آمیز بود" });
        } else {
          const user = await DB.prepare("SELECT * FROM users WHERE user_id = ? AND password = ?")
            .bind(user_id, password).first();
          if (user) {
            return Response.json({ success: true, msg: "ورود موفق" });
          } else {
            return Response.json({ success: false, msg: "رمز عبور اشتباه است یا کاربر یافت نشد" });
          }
        }
      }

      // ۳. دریافت لیست آگهی‌ها (Get Ads)
      if (url.pathname === "/api/get-ads") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active' ORDER BY id DESC").all();
        return Response.json(results || []);
      }

      // ۴. ثبت آگهی (Submit Ad)
      if (url.pathname === "/api/submit-ad") {
        const d = await request.json();
        await DB.prepare("INSERT INTO ads (user_id, title, price, country, city, image_base64, description, status) VALUES (?, ?, ?, ?, ?, ?, ?, 'active')")
          .bind(d.user_id, d.title, d.price, d.country, d.city, d.img, d.desc).run();
        return Response.json({ success: true });
      }

    } catch (err) {
      // اگر خطایی در دیتابیس رخ دهد، اینجا شکار می‌شود
      if (url.pathname.startsWith("/api/")) {
        return Response.json({ 
            success: false, 
            msg: "خطای فنی دیتابیس: " + err.message 
        }, { status: 500 });
      }
    }

    // ==========================================
    // 🎨 بخش Frontend (HTML/JS)
    // ==========================================
    const html = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>SOUQ MARKET</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            :root { --primary: #1e3799; --bg: #f0f2f5; --card: #ffffff; --text: #2c3e50; }
            body { margin: 0; font-family: Tahoma, sans-serif; background: var(--bg); color: var(--text); padding-bottom: 70px; }
            .login-screen { position: fixed; inset: 0; background: var(--bg); z-index: 10000; display: flex; align-items: center; justify-content: center; }
            .login-box { background: var(--card); padding: 30px; border-radius: 20px; width: 85%; max-width: 350px; text-align: center; box-shadow: 0 10px 25px rgba(0,0,0,0.1); }
            input, select, textarea { width: 100%; padding: 12px; margin: 10px 0; border-radius: 12px; border: 1px solid #ddd; background: var(--card); color: var(--text); box-sizing: border-box; font-family: inherit; }
            .btn { width: 100%; padding: 15px; border-radius: 12px; border: none; background: var(--primary); color: white; font-weight: bold; cursor: pointer; transition: 0.2s; }
            .btn:active { transform: scale(0.98); }
            .captcha-box { background: #eee; padding: 10px; font-size: 22px; letter-spacing: 8px; margin: 10px 0; border-radius: 10px; color: #333; font-weight: bold; cursor: pointer; }
            .nav { position: fixed; bottom: 0; width: 100%; background: var(--card); display: flex; border-top: 1px solid #eee; z-index: 1000; }
            .nav-item { flex: 1; text-align: center; padding: 12px; color: #888; cursor: pointer; font-size: 11px; }
            .nav-item.active { color: var(--primary); font-weight: bold; }
            .page { display: none; padding: 15px; animation: fadeIn 0.3s; }
            .page.active { display: block; }
            .ad-card { background: var(--card); border-radius: 15px; display: flex; padding: 10px; margin-bottom: 10px; gap: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
            .ad-img { width: 80px; height: 80px; border-radius: 10px; object-fit: cover; }
            @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        </style>
    </head>
    <body>

        <div id="login-screen" class="login-screen">
            <div class="login-box">
                <i class="fas fa-user-lock fa-3x" style="color:var(--primary); margin-bottom:15px;"></i>
                <h3 id="login-title">ورود به سیستم</h3>
                <div id="browser-only" style="display:none;">
                    <input type="number" id="login-id" placeholder="آیدی عددی تلگرام">
                </div>
                <input type="password" id="login-pass" placeholder="رمز عبور">
                <div class="captcha-box" id="captcha-code" title="برای تغییر کلیک کنید" onclick="createCaptcha()"></div>
                <input type="number" id="login-captcha" placeholder="کد امنیتی بالا">
                <button class="btn" id="auth-btn" onclick="handleAuth()">تایید و ورود</button>
                <p id="login-hint" style="font-size:11px; color:#777; margin-top:10px;"></p>
            </div>
        </div>

        <div id="main-app" style="display:none;">
            <div id="page-home" class="page active">
                <div id="ads-list">در حال بارگذاری...</div>
            </div>

            <div id="page-add" class="page">
                <h3>📢 ثبت آگهی جدید</h3>
                <input type="text" id="ad-title" placeholder="عنوان آگهی">
                <input type="text" id="ad-price" placeholder="قیمت">
                <select id="ad-country">
                    <option value="ایران">ایران</option>
                    <option value="عراق">عراق</option>
                    <option value="امارات">امارات</option>
                </select>
                <input type="text" id="ad-city" placeholder="شهر">
                <input type="file" id="ad-file" accept="image/*" onchange="encodeImage(this)">
                <textarea id="ad-desc" placeholder="توضیحات محصول..."></textarea>
                <button class="btn" onclick="submitAd()">ارسال آگهی</button>
            </div>

            <div id="page-profile" class="page">
                <h3>👤 حساب کاربری</h3>
                <p>آیدی عددی شما: <b id="display-id"></b></p>
                <button class="btn" style="background:#dc3545;" onclick="location.reload()">خروج</button>
            </div>

            <nav class="nav">
                <div class="nav-item active" onclick="showPage('home', this)"><i class="fas fa-store"></i><br>ویترین</div>
                <div class="nav-item" onclick="showPage('add', this)"><i class="fas fa-plus-circle"></i><br>ثبت آگهی</div>
                <div class="nav-item" onclick="showPage('profile', this)"><i class="fas fa-user-circle"></i><br>پروفایل</div>
            </nav>
        </div>

        <script>
            const tg = window.Telegram.WebApp;
            let captchaCode = "";
            let myUserId = 0;
            let isFirstTime = false;
            let uploadedImg = "";

            function createCaptcha() {
                captchaCode = Math.floor(1000 + Math.random() * 9000).toString();
                document.getElementById('captcha-code').innerText = captchaCode;
            }

            async function startApp() {
                createCaptcha();
                tg.expand();
                const user = tg.initDataUnsafe?.user;

                if (user) {
                    myUserId = user.id;
                    try {
                        const res = await fetch('/api/check-user', { 
                            method: 'POST', 
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ id: myUserId }) 
                        });
                        const data = await res.json();
                        if (!data.exists) {
                            isFirstTime = true;
                            document.getElementById('login-title').innerText = "تعیین رمز اولیه";
                            document.getElementById('login-hint').innerText = "این رمز برای ورودهای بعدی شماست.";
                        }
                    } catch(e) { console.log("DB Check failed"); }
                } else {
                    document.getElementById('browser-only').style.display = 'block';
                }
            }

            async function handleAuth() {
                const pass = document.getElementById('login-pass').value;
                const captcha = document.getElementById('login-captcha').value;
                if (!myUserId) myUserId = document.getElementById('login-id').value;

                if (captcha !== captchaCode) { alert("کد امنیتی اشتباه است"); createCaptcha(); return; }
                if (!pass || !myUserId) { alert("لطفاً تمام فیلدها را پر کنید"); return; }

                document.getElementById('auth-btn').innerText = "لطفاً صبر کنید...";

                try {
                    const res = await fetch('/api/auth', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({
                            user_id: myUserId,
                            password: pass,
                            username: tg.initDataUnsafe?.user?.username || 'Guest',
                            mode: isFirstTime ? 'register' : 'login'
                        })
                    });
                    const result = await res.json();
                    if (result.success) {
                        document.getElementById('login-screen').style.display = 'none';
                        document.getElementById('main-app').style.display = 'block';
                        document.getElementById('display-id').innerText = myUserId;
                        loadAds();
                    } else {
                        alert(result.msg);
                        createCaptcha();
                        document.getElementById('auth-btn').innerText = "تایید و ورود";
                    }
                } catch (e) {
                    alert("خطا در برقراری ارتباط با دیتابیس D1. مطمئن شوید جدول‌ها ساخته شده‌اند.");
                    document.getElementById('auth-btn').innerText = "تایید و ورود";
                }
            }

            function encodeImage(input) {
                const file = input.files[0];
                const reader = new FileReader();
                reader.onload = (e) => { uploadedImg = e.target.result; };
                reader.readAsDataURL(file);
            }

            async function submitAd() {
                if(!uploadedImg) return alert("انتخاب عکس آگهی الزامی است");
                const data = {
                    user_id: myUserId,
                    title: document.getElementById('ad-title').value,
                    price: document.getElementById('ad-price').value,
                    country: document.getElementById('ad-country').value,
                    city: document.getElementById('ad-city').value,
                    desc: document.getElementById('ad-desc').value,
                    img: uploadedImg
                };
                const res = await fetch('/api/submit-ad', { 
                    method: 'POST', 
                    headers: {'Content-Type': 'application/json'},
                    body: JSON.stringify(data) 
                });
                if(res.ok) { 
                    alert("آگهی با موفقیت ثبت شد"); 
                    showPage('home', document.querySelector('.nav-item')); 
                }
            }

            async function loadAds() {
                const res = await fetch('/api/get-ads');
                const ads = await res.json();
                document.getElementById('ads-list').innerHTML = ads.map(ad => `
                    <div class="ad-card">
                        <img src="${ad.image_base64}" class="ad-img">
                        <div style="flex:1;">
                            <b style="font-size:15px;">${ad.title}</b><br>
                            <small style="color:#777;">${ad.country} - ${ad.city}</small><br>
                            <span style="color:var(--primary); font-weight:bold; display:block; margin-top:5px;">${ad.price}</span>
                        </div>
                    </div>
                `).join('') || "<p style='text-align:center; padding:20px;'>هیچ آگهی فعالی وجود ندارد.</p>";
            }

            function showPage(p, el) {
                document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
                document.getElementById('page-' + p).classList.add('active');
                document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
                el.classList.add('active');
                if(p === 'home') loadAds();
            }

            window.onload = startApp;
        </script>
    </body>
    </html>`;

    return new Response(html, { headers: { "Content-Type": "text/html;charset=utf-8" } });
  }
};
