export default {
  async fetch(request, env) {
    const { DB } = env;
    const url = new URL(request.url);

    try {
      // API: ثبت یا شناسایی کاربر بدون رمز
      if (url.pathname === "/api/user-init") {
        const { id, username } = await request.json();
        if (!id) return Response.json({ success: false });
        
        // اگر کاربر نبود، ثبت‌نام کن
        await DB.prepare("INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)")
          .bind(Number(id), username || 'Guest').run();
        
        return Response.json({ success: true });
      }

      // API: دریافت آگهی‌ها
      if (url.pathname === "/api/get-ads") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active' ORDER BY id DESC").all();
        return Response.json(results || []);
      }

      // API: ثبت آگهی
      if (url.pathname === "/api/submit-ad") {
        const d = await request.json();
        await DB.prepare("INSERT INTO ads (user_id, title, price, country, city, image_base64, description) VALUES (?, ?, ?, ?, ?, ?, ?)")
          .bind(Number(d.user_id), d.title, d.price, d.country, d.city, d.img, d.desc).run();
        return Response.json({ success: true });
      }
    } catch (e) {
      return Response.json({ error: e.message }, { status: 500 });
    }

    // ظاهر برنامه (بدون صفحه لاگین)
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
            :root { --p: #1e3799; --bg: #f5f6fa; }
            body { font-family: Tahoma; background: var(--bg); margin: 0; padding-bottom: 70px; }
            .header { background: var(--p); color: white; padding: 15px; text-align: center; position: sticky; top:0; z-index:100; }
            .page { display: none; padding: 15px; animation: fadeIn 0.3s; }
            .page.active { display: block; }
            .ad-card { background: white; border-radius: 15px; display: flex; padding: 10px; margin-bottom: 12px; gap: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
            .ad-img { width: 90px; height: 90px; border-radius: 12px; object-fit: cover; }
            input, select, textarea { width: 100%; padding: 12px; margin: 8px 0; border-radius: 10px; border: 1px solid #ddd; box-sizing: border-box; }
            .btn { width: 100%; padding: 15px; background: var(--p); color: white; border: none; border-radius: 12px; font-weight: bold; cursor: pointer; }
            .nav { position: fixed; bottom: 0; width: 100%; background: white; display: flex; border-top: 1px solid #eee; }
            .nav-item { flex: 1; text-align: center; padding: 12px; color: #888; font-size: 11px; cursor: pointer; }
            .nav-item.active { color: var(--p); font-weight: bold; }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        </style>
    </head>
    <body>

    <div class="header"><b id="header-title">سوق ایران و عرب</b></div>

    <div id="main-app">
        <div id="p-home" class="page active">
            <div id="ad-list">در حال بارگذاری...</div>
        </div>

        <div id="p-add" class="page">
            <h3>📢 ثبت آگهی جدید</h3>
            <input type="text" id="a-title" placeholder="عنوان کالا یا خدمات">
            <input type="text" id="a-price" placeholder="قیمت (مثلاً ۱۰ تومان یا توافقی)">
            <select id="a-country">
                <option value="ایران">ایران</option>
                <option value="عراق">عراق</option>
                <option value="امارات">امارات</option>
            </select>
            <input type="text" id="a-city" placeholder="شهر">
            <input type="file" accept="image/*" onchange="upImg(this)">
            <textarea id="a-desc" placeholder="توضیحات بیشتر..."></textarea>
            <button class="btn" id="send-btn" onclick="sendAd()">ارسال و انتشار</button>
        </div>

        <div id="p-user" class="page">
            <h3>👤 حساب کاربری</h3>
            <div class="ad-card" style="display:block; text-align:center;">
                <p>خوش آمدید!</p>
                <p>آیدی تلگرام شما: <b id="my-id">---</b></p>
            </div>
        </div>

        <nav class="nav">
            <div class="nav-item active" onclick="tab('home',this)"><i class="fa fa-home fa-lg"></i><br>ویترین</div>
            <div class="nav-item" onclick="tab('add',this)"><i class="fa fa-plus-circle fa-lg"></i><br>ثبت آگهی</div>
            <div class="nav-item" onclick="tab('user',this)"><i class="fa fa-user fa-lg"></i><br>پروفایل</div>
        </nav>
    </div>

    <script>
        const tg = window.Telegram.WebApp;
        let userId = 0, imgB64 = "";

        async function init() {
            tg.expand();
            tg.ready();
            const user = tg.initDataUnsafe?.user;
            
            // اگر در تلگرام بود، آیدی رو بگیر، اگر نبود برای تست یک عدد بزار
            userId = user ? user.id : 12345678; 
            document.getElementById('my-id').innerText = userId;

            // شناسایی کاربر در دیتابیس بدون رمز
            await fetch('/api/user-init', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ id: userId, username: user?.username })
            });

            loadAds();
        }

        async function loadAds() {
            try {
                const res = await fetch('/api/get-ads');
                const ads = await res.json();
                document.getElementById('ad-list').innerHTML = ads.map(a => `
                    <div class="ad-card">
                        <img src="${a.image_base64}" class="ad-img">
                        <div style="flex:1;">
                            <b style="font-size:16px;">${a.title}</b><br>
                            <small style="color:#777;">${a.country}، ${a.city}</small><br>
                            <span style="color:var(--p); font-weight:bold; display:block; margin-top:8px;">${a.price}</span>
                        </div>
                    </div>
                `).join('') || "<p style='text-align:center; margin-top:50px;'>هنوز آگهی ثبت نشده است.</p>";
            } catch(e) { console.error("Error loading ads"); }
        }

        function upImg(el) {
            const reader = new FileReader();
            reader.onload = (e) => { imgB64 = e.target.result; };
            reader.readAsDataURL(el.files[0]);
        }

        async function sendAd() {
            const title = document.getElementById('a-title').value;
            if(!title || !imgB64) return alert("عنوان و عکس الزامی است");
            
            document.getElementById('send-btn').innerText = "در حال ارسال...";
            await fetch('/api/submit-ad', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({
                    user_id: userId, title, price: document.getElementById('a-price').value,
                    country: document.getElementById('a-country').value,
                    city: document.getElementById('a-city').value,
                    desc: document.getElementById('a-desc').value, img: imgB64
                })
            });
            alert("آگهی با موفقیت ثبت شد");
            location.reload(); 
        }

        function tab(p, el) {
            document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
            document.getElementById('p-' + p).classList.add('active');
            document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
            el.classList.add('active');
            if(p === 'home') loadAds();
        }

        window.onload = init;
    </script>
    </body>
    </html>`;

    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
};
