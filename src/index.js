export default {
  async fetch(request, env) {
    const { DB } = env; // مطمئن شو در wrangler.toml نام همین DB باشد
    const url = new URL(request.url);

    try {
      // API: دریافت آگهی‌ها (بدون نیاز به آیدی)
      if (url.pathname === "/api/get-ads") {
        const { results } = await DB.prepare("SELECT * FROM ads ORDER BY id DESC").all();
        return Response.json(results || []);
      }

      // API: ثبت کاربر (با محافظت در برابر مقادیر خالی)
      if (url.pathname === "/api/user-init") {
        const body = await request.json();
        if (body.id) {
          await DB.prepare("INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)")
            .bind(Number(body.id), body.username || 'User').run();
        }
        return Response.json({ success: true });
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

    // ظاهر برنامه
    const html = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SOUQ</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            body { font-family: Tahoma; background: #f5f6fa; margin: 0; padding-bottom: 80px; }
            .header { background: #1e3799; color: white; padding: 15px; text-align: center; font-weight: bold; }
            .page { display: none; padding: 15px; }
            .active { display: block; }
            .ad-card { background: white; border-radius: 12px; display: flex; padding: 10px; margin-bottom: 10px; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
            .ad-img { width: 80px; height: 80px; border-radius: 8px; object-fit: cover; margin-left: 10px; }
            input, select, textarea { width: 100%; padding: 12px; margin: 8px 0; border-radius: 10px; border: 1px solid #ddd; box-sizing: border-box; }
            .btn { width: 100%; padding: 15px; background: #1e3799; color: white; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; }
            .nav { position: fixed; bottom: 0; width: 100%; background: white; display: flex; border-top: 1px solid #eee; }
            .nav-item { flex: 1; text-align: center; padding: 12px; color: #888; cursor: pointer; font-size: 11px; }
            .nav-item.active { color: #1e3799; }
        </style>
    </head>
    <body>
        <div class="header">بازار ایران و عرب</div>
        
        <div id="p-home" class="page active"><div id="list">در حال لود...</div></div>
        
        <div id="p-add" class="page">
            <input id="t" placeholder="عنوان">
            <input id="p" placeholder="قیمت">
            <select id="c"><option value="ایران">ایران</option><option value="عراق">عراق</option></select>
            <input id="ci" placeholder="شهر">
            <input type="file" accept="image/*" onchange="up(this)">
            <textarea id="d" placeholder="توضیحات"></textarea>
            <button class="btn" onclick="send()">انتشار آگهی</button>
        </div>

        <nav class="nav">
            <div class="nav-item active" onclick="tab('home',this)"><i class="fa fa-home"></i><br>ویترین</div>
            <div class="nav-item" onclick="tab('add',this)"><i class="fa fa-plus-circle"></i><br>ثبت آگهی</div>
        </nav>

        <script>
            const tg = window.Telegram.WebApp;
            let uid = 0, img = "";

            async function init() {
                tg.expand();
                uid = tg.initDataUnsafe?.user?.id || 12345; // آیدی تستی اگر در تلگرام نبود
                
                await fetch('/api/user-init', {
                    method: 'POST',
                    body: JSON.stringify({ id: uid, username: tg.initDataUnsafe?.user?.username })
                });
                load();
            }

            async function load() {
                const res = await fetch('/api/get-ads');
                const ads = await res.json();
                document.getElementById('list').innerHTML = ads.map(a => \`
                    <div class="ad-card">
                        <img src="\${a.image_base64}" class="ad-img">
                        <div><b>\${a.title}</b><br><small>\${a.price}</small></div>
                    </div>
                \`).join('') || "آگهی نیست";
            }

            function up(el) {
                const r = new FileReader();
                r.onload = (e) => { img = e.target.result; };
                r.readAsDataURL(el.files[0]);
            }

            async function send() {
                if(!img) return alert("عکس کو؟");
                await fetch('/api/submit-ad', {
                    method: 'POST',
                    body: JSON.stringify({
                        user_id: uid, title: document.getElementById('t').value,
                        price: document.getElementById('p').value, country: document.getElementById('c').value,
                        city: document.getElementById('ci').value, desc: document.getElementById('d').value, img: img
                    })
                });
                alert("ثبت شد!"); location.reload();
            }

            function tab(p, el) {
                document.querySelectorAll('.page').forEach(x => x.classList.remove('active'));
                document.getElementById('p-' + p).classList.add('active');
                document.querySelectorAll('.nav-item').forEach(x => x.classList.remove('active'));
                el.classList.add('active');
            }
            window.onload = init;
        </script>
    </body>
    </html>`;

    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
};
