export default {
  async fetch(request, env) {
    const { DB } = env;
    const url = new URL(request.url);

    // بخش API
    try {
      if (url.pathname === "/api/check-user") {
        const body = await request.json();
        const user = await DB.prepare("SELECT * FROM users WHERE user_id = ?").bind(body.id).first();
        return Response.json({ exists: !!user });
      }

      if (url.pathname === "/api/auth") {
        const { user_id, password, username, mode } = await request.json();
        if (mode === 'register') {
          await DB.prepare("INSERT INTO users (user_id, password, username) VALUES (?, ?, ?)")
            .bind(user_id, password, username).run();
          return Response.json({ success: true });
        } else {
          const user = await DB.prepare("SELECT * FROM users WHERE user_id = ? AND password = ?")
            .bind(user_id, password).first();
          return Response.json({ success: !!user, msg: user ? "" : "رمز اشتباه" });
        }
      }
      
      if (url.pathname === "/api/get-ads") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active'").all();
        return Response.json(results || []);
      }
    } catch (e) {
      return Response.json({ error: e.message, stack: e.stack }, { status: 500 });
    }

    // بخش ظاهر (HTML)
    const html = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SOUQ</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <style>
            body { font-family: Tahoma; background: #f0f2f5; padding: 20px; text-align: center; }
            .card { background: white; padding: 20px; border-radius: 15px; box-shadow: 0 4px 10px rgba(0,0,0,0.1); }
            input { width: 90%; padding: 12px; margin: 10px 0; border-radius: 8px; border: 1px solid #ddd; }
            .btn { width: 95%; padding: 15px; background: #1e3799; color: white; border: none; border-radius: 10px; cursor: pointer; }
            #error-log { display: none; background: #ffebeb; color: red; padding: 10px; border-radius: 8px; margin-bottom: 15px; font-size: 12px; border: 1px solid red; text-align: left; direction: ltr; }
        </style>
    </head>
    <body>
        <div id="error-log"></div>
        
        <div id="login-page" class="card">
            <h2 id="title">ورود به مینی‌اپ</h2>
            <input type="number" id="u-id" placeholder="آیدی تلگرام" style="display:none;">
            <input type="password" id="u-pass" placeholder="رمز عبور">
            <div id="captcha-box" onclick="genCap()" style="background:#eee; padding:10px; margin:10px; cursor:pointer; letter-spacing:5px; font-weight:bold;"></div>
            <input type="number" id="u-cap" placeholder="کد بالا">
            <button class="btn" onclick="login()">تایید و ورود</button>
        </div>

        <div id="app" class="card" style="display:none;">
            <h3>خوش آمدید! ✅</h3>
            <p>آیدی شما: <span id="my-id"></span></p>
            <button class="btn" onclick="location.reload()">خروج</button>
        </div>

        <script>
            const tg = window.Telegram.WebApp;
            let cap = "";
            let uid = 0;
            let isNew = false;

            function logErr(msg) {
                const el = document.getElementById('error-log');
                el.style.display = 'block';
                el.innerText = "Error: " + msg;
            }

            function genCap() {
                cap = Math.floor(1000 + Math.random()*9000).toString();
                document.getElementById('captcha-box').innerText = cap;
            }

            async function init() {
                genCap();
                tg.expand();
                const user = tg.initDataUnsafe?.user;
                if(user) {
                    uid = user.id;
                    try {
                        const res = await fetch('/api/check-user', { 
                            method: 'POST', body: JSON.stringify({id: uid}) 
                        });
                        const data = await res.json();
                        if(data.error) logErr(data.error);
                        if(!data.exists) {
                            isNew = true;
                            document.getElementById('title').innerText = "تعیین رمز اولیه";
                        }
                    } catch(e) { logErr("اتصال به دیتابیس برقرار نشد"); }
                } else {
                    document.getElementById('u-id').style.display = 'block';
                }
            }

            async function login() {
                const pass = document.getElementById('u-pass').value;
                const userCap = document.getElementById('u-cap').value;
                if(!uid) uid = document.getElementById('u-id').value;

                if(userCap !== cap) return alert("کد امنیتی غلط");
                if(!pass || !uid) return alert("فیلدها خالی است");

                try {
                    const res = await fetch('/api/auth', {
                        method: 'POST',
                        body: JSON.stringify({
                            user_id: uid, password: pass, mode: isNew ? 'register' : 'login'
                        })
                    });
                    const result = await res.json();
                    if(result.error) {
                        logErr(result.error);
                    } else if(result.success) {
                        document.getElementById('login-page').style.display = 'none';
                        document.getElementById('app').style.display = 'block';
                        document.getElementById('my-id').innerText = uid;
                    } else {
                        alert("اطلاعات غلط");
                    }
                } catch(e) { logErr(e.message); }
            }
            window.onload = init;
        </script>
    </body>
    </html>`;

    return new Response(html, { headers: { "content-type": "text/html;charset=UTF-8" } });
  }
};
