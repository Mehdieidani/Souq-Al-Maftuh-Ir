export default {
  async fetch(request, env) {
    const { DB } = env;
    const url = new URL(request.url);

    // ==========================================
    // 📡 بخش API (ارتباط با دیتابیس)
    // ==========================================

    // ۱. بررسی کاربر (آیا قبلاً ثبت‌نام کرده؟)
    if (url.pathname === "/api/check-user") {
      const { id } = await request.json();
      const user = await DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(id).first();
      return Response.json({ exists: !!user });
    }

    // ۲. ثبت‌نام یا ورود (Login/Register)
    if (url.pathname === "/api/auth") {
      const { user_id, password, username, mode } = await request.json(); // mode: 'login' or 'register'
      
      if (mode === 'register') {
        // ثبت کاربر جدید (از تلگرام)
        try {
          await DB.prepare("INSERT INTO users (user_id, password, username) VALUES (?, ?, ?)")
            .bind(user_id, password, username).run();
          return Response.json({ success: true, msg: "ثبت‌نام موفق" });
        } catch (e) { return Response.json({ success: false, msg: "خطا در ثبت‌نام" }); }
      } 
      else {
        // ورود (از مرورگر یا تلگرام)
        const user = await DB.prepare("SELECT * FROM users WHERE user_id = ? AND password = ?")
          .bind(user_id, password).first();
        return Response.json({ success: !!user, msg: user ? "خوش آمدید" : "اطلاعات اشتباه است" });
      }
    }

    // ۳. تغییر رمز عبور
    if (url.pathname === "/api/change-pass") {
        const { user_id, new_pass } = await request.json();
        await DB.prepare("UPDATE users SET password = ? WHERE user_id = ?").bind(new_pass, user_id).run();
        return Response.json({ success: true });
    }

    // ۴. ثبت آگهی جدید
    if (url.pathname === "/api/submit-ad") {
      const data = await request.json();
      await DB.prepare(`
        INSERT INTO ads (user_id, title, price, country, city, image_base64, description, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
      `).bind(data.user_id, data.title, data.price, data.country, data.city, data.img, data.desc).run();
      return Response.json({ success: true });
    }

    // ۵. دریافت آگهی‌های فعال
    if (url.pathname === "/api/get-ads") {
      const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active' ORDER BY is_vip DESC, created_at DESC").all();
      return Response.json(results);
    }

    // ==========================================
    // 🎨 بخش Frontend (HTML/CSS/JS)
    // ==========================================
    const html = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <title>Souq Market</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            :root { 
                --primary: #1e3799; --accent: #2ecc71; --gold: #f1c40f; 
                --bg: #f1f2f6; --card: #ffffff; --text: #2c3e50;
            }
            /* تم‌ها */
            .theme-dark { --bg: #121212; --card: #1e1e1e; --text: #f1f1f1; --primary: #3498db; }
            .theme-royal { --bg: #2c3e50; --card: #34495e; --text: #fff; --primary: #f1c40f; }
            .theme-glass { --bg: linear-gradient(135deg, #eee 0%, #aaa 100%); --card: rgba(255,255,255,0.8); }

            body { margin:0; font-family:'Tahoma', sans-serif; background:var(--bg); color:var(--text); padding-bottom: 80px; transition:0.3s; }
            
            /* لاگین */
            .login-container { position:fixed; top:0; left:0; width:100%; height:100%; background:var(--bg); z-index:9999; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box; }
            .login-box { background:var(--card); padding:25px; border-radius:20px; width:100%; max-width:350px; text-align:center; box-shadow:0 10px 30px rgba(0,0,0,0.1); }
            .captcha-box { background:#ddd; padding:10px; font-size:24px; letter-spacing:8px; margin:15px 0; border-radius:8px; font-family:monospace; color:#333; user-select:none; }
            
            /* هدر و نویگیشن */
            .header { background:var(--primary); color:white; padding:15px; position:sticky; top:0; z-index:100; display:flex; justify-content:space-between; align-items:center; box-shadow:0 2px 10px rgba(0,0,0,0.1); }
            .nav { position:fixed; bottom:0; left:0; right:0; background:var(--card); display:flex; padding:10px 0; border-top:1px solid rgba(0,0,0,0.05); z-index:100; }
            .nav-item { flex:1; text-align:center; color:#999; font-size:12px; cursor:pointer; }
            .nav-item.active { color:var(--primary); font-weight:bold; transform:scale(1.1); }

            /* المان‌های فرم و کارت */
            input, select, textarea { width:100%; padding:12px; margin:8px 0; border-radius:10px; border:1px solid #ddd; background:var(--card); color:var(--text); box-sizing:border-box; }
            .btn { width:100%; padding:14px; border-radius:12px; border:none; font-weight:bold; cursor:pointer; margin-top:10px; }
            .btn-primary { background:var(--primary); color:white; }
            
            .ad-card { background:var(--card); margin:10px; padding:10px; border-radius:12px; display:flex; gap:12px; box-shadow:0 2px 5px rgba(0,0,0,0.05); }
            .ad-img { width:90px; height:90px; border-radius:10px; object-fit:cover; background:#eee; }
            
            .page { display:none; animation:fadeIn 0.4s; }
            .page.active { display:block; }
            @keyframes fadeIn { from{opacity:0; transform:translateY(10px);} to{opacity:1; transform:translateY(0);} }
        </style>
    </head>
    <body class="theme-light">

        <div id="p-login" class="login-container">
            <div class="login-box">
                <i class="fas fa-fingerprint fa-3x" style="color:var(--primary); margin-bottom:15px;"></i>
                <h2 id="login-title">احراز هویت</h2>
                
                <div id="browser-input" style="display:none;">
                    <input type="number" id="inp-id" placeholder="آیدی عددی تلگرام">
                </div>
                
                <input type="password" id="inp-pass" placeholder="رمز عبور">
                <div id="captcha-display" class="captcha-box" onclick="genCaptcha()">1234</div>
                <input type="number" id="inp-captcha" placeholder="کد امنیتی بالا را وارد کنید">
                
                <button class="btn btn-primary" onclick="processAuth()" id="btn-auth">ورود به سیستم</button>
                <p style="font-size:11px; margin-top:15px; color:#777;" id="login-desc"></p>
            </div>
        </div>

        <div id="main-app" style="display:none;">
            <div class="header">
                <b>Souq Market | السوق</b>
                <i class="fas fa-language fa-lg" onclick="alert('تغییر زبان به زودی...')"></i>
            </div>

            <div id="page-home" class="page active" style="padding:5px;">
                <div id="ads-container">
                    <div style="text-align:center; padding:50px; color:#999;">
                        <i class="fas fa-spinner fa-spin fa-2x"></i><br>در حال بارگذاری آگهی‌ها...
                    </div>
                </div>
            </div>

            <div id="page-add" class="page" style="padding:20px;">
                <h3>📢 ثبت آگهی جدید</h3>
                <input type="text" id="ad-title" placeholder="عنوان کالا (مثلاً: آیفون ۱۳)">
                <div style="display:flex; gap:5px;">
                    <select id="ad-country">
                        <option value="ایران">ایران (Iran)</option>
                        <option value="عراق">عراق (Iraq)</option>
                        <option value="امارات">امارات (UAE)</option>
                    </select>
                    <input type="text" id="ad-city" placeholder="شهر">
                </div>
                <input type="text" id="ad-price" placeholder="قیمت (تومان / دلار)">
                
                <label style="font-size:12px; margin-top:10px; display:block;">تصویر آگهی:</label>
                <input type="file" id="ad-file" accept="image/*" onchange="previewImage()">
                <img id="img-preview" style="width:100%; height:150px; object-fit:cover; border-radius:10px; display:none; margin-top:5px;">
                
                <textarea id="ad-desc" rows="3" placeholder="توضیحات تکمیلی..."></textarea>
                <button class="btn btn-primary" onclick="submitAd()">ارسال جهت بررسی</button>
            </div>

            <div id="page-settings" class="page" style="padding:20px;">
                <div class="login-box" style="margin:0 auto;">
                    <h3>👤 پروفایل کاربری</h3>
                    <p>آیدی شما: <span id="user-display-id" style="font-weight:bold;"></span></p>
                    <hr>
                    <h4>🎨 انتخاب تم</h4>
                    <div style="display:flex; gap:5px; flex-wrap:wrap;">
                        <button class="btn" style="flex:1; background:#eee; color:#000" onclick="setTheme('light')">روشن</button>
                        <button class="btn" style="flex:1; background:#333; color:#fff" onclick="setTheme('dark')">تاریک</button>
                        <button class="btn" style="flex:1; background:#f1c40f; color:#000" onclick="setTheme('royal')">سلطنتی</button>
                    </div>
                    <hr>
                    <h4>🔑 تغییر رمز عبور</h4>
                    <input type="password" id="new-pass" placeholder="رمز عبور جدید">
                    <button class="btn btn-primary" onclick="changePass()">بروزرسانی رمز</button>
                </div>
            </div>

            <div class="nav">
                <div class="nav-item active" onclick="nav('home', this)"><i class="fas fa-home fa-lg"></i><br>خانه</div>
                <div class="nav-item" onclick="nav('add', this)"><i class="fas fa-plus-circle fa-lg"></i><br>ثبت آگهی</div>
                <div class="nav-item" onclick="nav('settings', this)"><i class="fas fa-user-cog fa-lg"></i><br>پروفایل</div>
            </div>
        </div>

        <script>
            const tg = window.Telegram.WebApp;
            let currentCaptcha = "";
            let currentUserId = 0;
            let isRegisterMode = false;
            let imageBase64 = "";

            // --- 🔐 بخش امنیت و لاگین ---
            function genCaptcha() {
                currentCaptcha = Math.floor(1000 + Math.random() * 9000).toString();
                document.getElementById('captcha-display').innerText = currentCaptcha;
            }

            async function checkLogin() {
                genCaptcha();
                const tgUser = tg.initDataUnsafe?.user;

                if (tgUser) {
                    // ورود از طریق تلگرام
                    currentUserId = tgUser.id;
                    document.getElementById('browser-input').style.display = 'none';
                    
                    // چک کردن وضعیت در سرور
                    const res = await fetch('/api/check-user', { 
                        method: 'POST', body: JSON.stringify({ id: currentUserId }) 
                    });
                    const data = await res.json();

                    if (!data.exists) {
                        isRegisterMode = true;
                        document.getElementById('login-title').innerText = "تعیین رمز عبور (اولین ورود)";
                        document.getElementById('inp-pass').placeholder = "یک رمز برای خود انتخاب کنید";
                        document.getElementById('btn-auth').innerText = "ثبت‌نام و ورود";
                        document.getElementById('login-desc').innerText = "این رمز برای ورود از طریق مرورگر استفاده خواهد شد.";
                    } else {
                        // اگر کاربر وجود داشت، می‌تواند رمز را وارد کند یا (در آپدیت‌های بعد) ورود خودکار داشته باشد
                        document.getElementById('login-desc').innerText = "لطفاً رمز عبور خود را وارد کنید.";
                    }
                } else {
                    // ورود از مرورگر
                    document.getElementById('browser-input').style.display = 'block';
                    document.getElementById('login-title').innerText = "ورود از مرورگر";
                    document.getElementById('login-desc').innerText = "آیدی تلگرام و رمز عبور خود را وارد کنید.";
                }
            }

            async function processAuth() {
                const inputCaptcha = document.getElementById('inp-captcha').value;
                const inputPass = document.getElementById('inp-pass').value;
                
                // اگر مرورگر باشد، آیدی را از اینپوت می‌گیریم
                if (!currentUserId) {
                    currentUserId = document.getElementById('inp-id').value;
                }

                if (inputCaptcha !== currentCaptcha) {
                    alert("کد امنیتی اشتباه است!");
                    genCaptcha();
                    return;
                }
                if (!inputPass || !currentUserId) {
                    alert("لطفاً اطلاعات را کامل وارد کنید.");
                    return;
                }

                const res = await fetch('/api/auth', {
                    method: 'POST',
                    body: JSON.stringify({
                        user_id: currentUserId,
                        password: inputPass,
                        username: tg.initDataUnsafe?.user?.username || 'User',
                        mode: isRegisterMode ? 'register' : 'login'
                    })
                });
                const result = await res.json();

                if (result.success) {
                    document.getElementById('p-login').style.display = 'none';
                    document.getElementById('main-app').style.display = 'block';
                    document.getElementById('user-display-id').innerText = currentUserId;
                    loadAds(); // بارگذاری آگهی‌ها
                } else {
                    alert(result.msg);
                    genCaptcha();
                }
            }

            // --- 📢 بخش آگهی‌ها ---
            function previewImage() {
                const file = document.getElementById('ad-file').files[0];
                if (file) {
                    const reader = new FileReader();
                    reader.onload = function(e) {
                        document.getElementById('img-preview').src = e.target.result;
                        document.getElementById('img-preview').style.display = 'block';
                        imageBase64 = e.target.result;
                    }
                    reader.readAsDataURL(file);
                }
            }

            async function submitAd() {
                const title = document.getElementById('ad-title').value;
                const price = document.getElementById('ad-price').value;
                
                if(!title || !price || !imageBase64) return alert("عنوان، قیمت و عکس الزامی است.");

                const data = {
                    user_id: currentUserId,
                    title: title,
                    country: document.getElementById('ad-country').value,
                    city: document.getElementById('ad-city').value,
                    price: price,
                    img: imageBase64,
                    desc: document.getElementById('ad-desc').value
                };

                tg.MainButton.showProgress();
                const res = await fetch('/api/submit-ad', { method: 'POST', body: JSON.stringify(data) });
                tg.MainButton.hideProgress();
                
                if (res.ok) {
                    alert("آگهی ثبت شد و پس از تایید مدیریت نمایش داده می‌شود.");
                    nav('home', document.querySelector('.nav-item')); // بازگشت به خانه
                }
            }

            async function loadAds() {
                const res = await fetch('/api/get-ads');
                const ads = await res.json();
                const container = document.getElementById('ads-container');
                
                if (ads.length === 0) {
                    container.innerHTML = '<p style="text-align:center; padding:50px;">هنوز آگهی فعالی وجود ندارد.</p>';
                    return;
                }

                container.innerHTML = ads.map(ad => \`
                    <div class="ad-card">
                        <img src="\${ad.image_base64}" class="ad-img">
                        <div style="flex:1;">
                            <div style="font-weight:bold;">\${ad.title} \${ad.is_vip ? '⭐' : ''}</div>
                            <div style="font-size:12px; color:#666; margin-top:5px;">
                                <i class="fas fa-map-marker-alt"></i> \${ad.country} - \${ad.city}
                            </div>
                            <div style="color:green; font-weight:bold; margin-top:5px;">\${ad.price}</div>
                        </div>
                    </div>
                \`).join('');
            }

            // --- ⚙️ تنظیمات ---
            async function changePass() {
                const newP = document.getElementById('new-pass').value;
                if(!newP) return;
                await fetch('/api/change-pass', { method: 'POST', body: JSON.stringify({ user_id: currentUserId, new_pass: newP }) });
                alert("رمز عبور تغییر کرد.");
            }

            function setTheme(t) { document.body.className = 'theme-'+t; }
            function nav(p, el) {
                document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
                document.getElementById('page-'+p).classList.add('active');
                document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
                el.classList.add('active');
                if(p === 'home') loadAds();
            }

            window.onload = () => { tg.expand(); checkLogin(); };
        </script>
    </body>
    </html>`;

    return new Response(html, { headers: { "Content-Type": "text/html;charset=utf-8" } });
  }
};
