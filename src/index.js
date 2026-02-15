export default {
  async fetch(request, env) {
    const { DB } = env;
    const url = new URL(request.url);

    // ==========================================
    // 📡 بخش API
    // ==========================================
    try {
      if (url.pathname === "/api/check-user") {
        const body = await request.json();
        if (!body.id) return Response.json({ exists: false });
        const user = await DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(Number(body.id)).first();
        return Response.json({ exists: !!user });
      }

      if (url.pathname === "/api/auth") {
        const { user_id, password, mode } = await request.json();
        if (mode === 'register') {
          await DB.prepare("INSERT INTO users (user_id, password) VALUES (?, ?)")
            .bind(Number(user_id), String(password)).run();
          return Response.json({ success: true });
        } else {
          const user = await DB.prepare("SELECT * FROM users WHERE user_id = ? AND password = ?")
            .bind(Number(user_id), String(password)).first();
          return Response.json({ success: !!user });
        }
      }

      if (url.pathname === "/api/get-ads") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active' ORDER BY id DESC").all();
        return Response.json(results || []);
      }

      if (url.pathname === "/api/submit-ad") {
        const d = await request.json();
        await DB.prepare("INSERT INTO ads (user_id, title, price, country, city, image_base64, description) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(Number(d.user_id), d.title, d.price, d.country, d.city, d.img, d.desc).run();
        return Response.json({ success: true });
      }
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }

    // ==========================================
    // 🎨 بخش Frontend
    // ==========================================
    const html = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
        <title>Souq Almaftuh +Iran</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            :root { --p: #1e3799; --bg: #f5f6fa; --card: #ffffff; }
            body { font-family: Tahoma; background: var(--bg); margin: 0; padding-bottom: 70px; }
            .login-screen { position: fixed; inset: 0; background: var(--bg); z-index: 999; display: flex; align-items: center; justify-content: center; }
            .card { background: var(--card); padding: 30px; border-radius: 20px; width: 85%; max-width: 350px; text-align: center; box-shadow: 0 10px 20px rgba(0,0,0,0.1); }
            input, select, textarea { width: 100%; padding: 12px; margin: 10px 0; border-radius: 10px; border: 1px solid #ddd; box-sizing: border-box; }
            .btn { width: 100%; padding: 15px; background: var(--p); color: white; border: none; border-radius: 12px; font-weight: bold; cursor: pointer; }
            .captcha { background: #eee; padding: 10px; margin: 10px 0; border-radius: 10px; font-weight: bold; letter-spacing: 5px; cursor: pointer; }
            .page { display: none; padding: 15px; }
            .page.active { display: block; }
            .nav { position: fixed; bottom: 0; width: 100%; background: white; display: flex; border-top: 1px solid #eee; }
            .nav-item { flex: 1; text-align: center; padding: 10px; color: #888; font-size: 12px; }
            .nav-item.active { color: var(--p); font-weight: bold; }
            .ad-item { background: white; border-radius: 15px; display: flex; padding: 10px; margin-bottom: 10px; gap: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
            .ad-img { width: 80px; height: 80px; border-radius: 10px; object-fit: cover; }
        </style>
    </head>
    <body>

    <div id="login-screen" class="login-screen">
        <div class="card">
            <h2 id="l-title">ورود به سیستم</h2>
            <div id="id-area" style="display:none;"><input type="number" id="l-id" placeholder="آیدی تلگرام"></div>
            <input type="password" id="l-pass" placeholder="رمز عبور">
            <div class="captcha" id="cap-box" onclick="newCap()"></div>
            <input type="number" id="l-cap" placeholder="کد امنیتی بالا">
            <button class="btn" onclick="handleAuth()">تایید و ورود</button>
            <p id="l-hint" style="font-size:11px; color:#777; margin-top:10px;"></p>
        </div>
    </div>

    <div id="main-app" style="display:none;">
        <div id="p-home" class="page active"><div id="ad-list">در حال بارگذاری...</div></div>
        <div id="p-add" class="page">
            <h3>ثبت آگهی</h3>
            <input type="text" id="a-title" placeholder="عنوان">
            <input type="text" id="a-price" placeholder="قیمت">
            <select id="a-country"><option value="ایران">ایران</option><option value="عراق">عراق</option></select>
            <input type="text" id="a-city" placeholder="شهر">
            <input type="file" accept="image/*" onchange="upImg(this)">
            <textarea id="a-desc" placeholder="توضیحات"></textarea>
            <button class="btn" onclick="sendAd()">ارسال آگهی</button>
        </div>
        <div id="p-user" class="page"><h3>پروفایل</h3><p>آیدی: <span id="my-id"></span></p><button class="btn" onclick="location.reload()">خروج</button></div>

        <nav class="nav">
            <div class="nav-item active" onclick="tab('home',this)"><i class="fa fa-home"></i><br>خانه</div>
            <div class="nav-item" onclick="tab('add',this)"><i class="fa fa-plus"></i><br>ثبت</div>
            <div class="nav-item" onclick="tab('user',this)"><i class="fa fa-user"></i><br>من</div>
        </nav>
    </div>

    <script>
        const tg = window.Telegram.WebApp;
        let cap = "", uid = null, isNew = false, imgB64 = "";

        function newCap() { cap = Math.floor(1000+Math.random()*9000).toString(); document.getElementById('cap-box').innerText = cap; }

        async function init() {
            newCap(); tg.expand();
            const user = tg.initDataUnsafe?.user;
            if(user) {
                uid = user.id;
                const res = await fetch('/api/check-user', { method:'POST', body:JSON.stringify({id:uid}) });
                const data = await res.json();
                if(!data.exists) { isNew = true; document.getElementById('l-title').innerText = "تعیین رمز اولیه"; }
            } else { document.getElementById('id-area').style.display = 'block'; }
        }

        async function handleAuth() {
            const pass = document.getElementById('l-pass').value;
            if(document.getElementById('l-cap').value !== cap) return alert("کد امنیتی غلط");
            if(!uid) uid = document.getElementById('l-id').value;
            if(!pass || !uid) return alert("فیلدها را پر کنید");

            const res = await fetch('/api/auth', {
                method:'POST', body: JSON.stringify({user_id:uid, password:pass, mode:isNew?'register':'login'})
            });
            const r = await res.json();
            if(r.error) return alert("خطا: " + r.error);
            if(r.success || !r.msg) {
                document.getElementById('login-screen').style.display = 'none';
                document.getElementById('main-app').style.display = 'block';
                document.getElementById('my-id').innerText = uid;
                loadAds();
            } else { alert("رمز اشتباه است"); }
        }

        function upImg(el) {
            const reader = new FileReader();
            reader.onload = (e) => { imgB64 = e.target.result; };
            reader.readAsDataURL(el.files[0]);
        }

        async function sendAd() {
            if(!imgB64) return alert("عکس الزامی است");
            await fetch('/api/submit-ad', { method:'POST', body: JSON.stringify({
                user_id:uid, title:document.getElementById('a-title').value, 
                price:document.getElementById('a-price').value, country:document.getElementById('a-country').value,
                city:document.getElementById('a-city').value, desc:document.getElementById('a-desc').value, img:imgB64
            })});
            alert("ثبت شد"); tab('home', document.querySelector('.nav-item'));
        }

        async function loadAds() {
            const res = await fetch('/api/get-ads');
            const ads = await res.json();
            document.getElementById('ad-list').innerHTML = ads.map(a => \`
                <div class="ad-item">
                    <img src="\${a.image_base64}" class="ad-img">
                    <div><b>\${a.title}</b><br><small>\${a.country} - \${a.city}</small><br><span style="color:green">\${a.price}</span></div>
                </div>
            \`).join('') || "آگهی یافت نشد";
        }

        function tab(p,el) {
            document.querySelectorAll('.page').forEach(x=>x.classList.remove('active'));
            document.getElementById('p-'+p).classList.add('active');
            document.querySelectorAll('.nav-item').forEach(x=>x.classList.remove('active'));
            el.classList.add('active'); if(p==='home') loadAds();
        }
        window.onload = init;
    </script>
    </body>
    </html>`;

    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
};
