export default {
  async fetch(request, env) {
    const { DB } = env;
    const url = new URL(request.url);

    // ==========================================
    // 📡 بخش API (مدیریت درخواست‌ها)
    // ==========================================
    try {
      if (url.pathname === "/api/check-user") {
        const body = await request.json();
        // جلوگیری از ارسال مقدار undefined به دیتابیس
        if (!body.id) return Response.json({ exists: false });

        const user = await DB.prepare("SELECT * FROM users WHERE user_id = ?")
          .bind(Number(body.id)) // تبدیل حتمی به عدد
          .first();
        return Response.json({ exists: !!user });
      }

      if (url.pathname === "/api/auth") {
        const { user_id, password, mode } = await request.json();
        
        if (!user_id || !password) {
          return Response.json({ success: false, msg: "اطلاعات ناقص است" });
        }

        if (mode === 'register') {
          await DB.prepare("INSERT INTO users (user_id, password) VALUES (?, ?)")
            .bind(Number(user_id), String(password))
            .run();
          return Response.json({ success: true });
        } else {
          const user = await DB.prepare("SELECT * FROM users WHERE user_id = ? AND password = ?")
            .bind(Number(user_id), String(password))
            .first();
          return Response.json({ success: !!user, msg: user ? "" : "رمز عبور اشتباه است" });
        }
      }
    } catch (e) {
      // نمایش دقیق خطا برای دیباگ
      return Response.json({ error: e.message }, { status: 500 });
    }

    // ==========================================
    // 🎨 بخش Frontend (رابط کاربری)
    // ==========================================
    const html = `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>SOUQ MARKET</title>
        <script src="https://telegram.org/js/telegram-web-app.js"></script>
        <style>
            :root { --p: #1e3799; --bg: #f5f6fa; }
            body { font-family: Tahoma; background: var(--bg); display: flex; justify-content: center; padding: 20px; margin: 0; }
            .card { background: white; padding: 25px; border-radius: 20px; box-shadow: 0 10px 20px rgba(0,0,0,0.05); width: 100%; max-width: 350px; text-align: center; }
            input { width: 100%; padding: 12px; margin: 10px 0; border-radius: 10px; border: 1px solid #ddd; box-sizing: border-box; font-size: 16px; }
            .btn { width: 100%; padding: 15px; background: var(--p); color: white; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; }
            .captcha { background: #eee; padding: 10px; margin: 10px 0; border-radius: 8px; font-weight: bold; letter-spacing: 5px; cursor: pointer; user-select: none; }
            #err { color: red; font-size: 12px; background: #fff1f1; padding: 10px; border-radius: 8px; display: none; margin-bottom: 10px; border: 1px solid red; }
        </style>
    </head>
    <body>
        <div class="card">
            <div id="err"></div>
            <h2 id="title">ورود به سیستم</h2>
            
            <div id="id-box" style="display:none;">
                <input type="number" id="inp-id" placeholder="آیدی عددی تلگرام">
            </div>
            
            <input type="password" id="inp-pass" placeholder="رمز عبور">
            <div class="captcha" id="cap-box" onclick="genCap()"></div>
            <input type="number" id="inp-cap" placeholder="کد امنیتی بالا">
            
            <button class="btn" onclick="auth()">تایید و ورود</button>
            <p style="font-size: 11px; color: #888; margin-top: 15px;">طراحی شده برای بازار ایران و عرب</p>
        </div>

        <script>
            const tg = window.Telegram.WebApp;
            let currentCap = "";
            let myId = null;
            let mode = "login";

            function genCap() {
                currentCap = Math.floor(1000 + Math.random()*9000).toString();
                document.getElementById('cap-box').innerText = currentCap;
            }

            async function init() {
                genCap();
                tg.expand();
                const user = tg.initDataUnsafe?.user;
                
                if (user && user.id) {
                    myId = user.id;
                    try {
                        const res = await fetch('/api/check-user', {
                            method: 'POST',
                            headers: {'Content-Type': 'application/json'},
                            body: JSON.stringify({ id: myId })
                        });
                        const data = await res.json();
                        if (!data.exists) {
                            mode = "register";
                            document.getElementById('title').innerText = "تعیین رمز اولیه";
                        }
                    } catch(e) { 
                        document.getElementById('err').style.display = 'block';
                        document.getElementById('err').innerText = "خطا در اتصال به دیتابیس";
                    }
                } else {
                    // نمایش فیلد آیدی برای کاربران مرورگر
                    document.getElementById('id-box').style.display = 'block';
                }
            }

            async function auth() {
                const pass = document.getElementById('inp-pass').value;
                const capInput = document.getElementById('inp-cap').value;
                if (!myId) myId = document.getElementById('inp-id').value;

                if (capInput !== currentCap) return alert("کد امنیتی اشتباه است");
                if (!pass || !myId) return alert("لطفاً فیلدها را پر کنید");

                try {
                    const res = await fetch('/api/auth', {
                        method: 'POST',
                        headers: {'Content-Type': 'application/json'},
                        body: JSON.stringify({ user_id: myId, password: pass, mode: mode })
                    });
                    const result = await res.json();
                    
                    if (result.error) {
                        alert("خطا: " + result.error);
                    } else if (result.success) {
                        alert("خوش آمدید! ورود موفقیت‌آمیز بود.");
                        // در اینجا می‌توانید کاربر را به صفحه اصلی هدایت کنید
                    } else {
                        alert(result.msg || "خطا در ورود");
                    }
                } catch(e) { alert("خطای سیستمی رخ داد"); }
            }

            window.onload = init;
        </script>
    </body>
    </html>`;

    return new Response(html, { headers: { "Content-Type": "text/html;charset=UTF-8" } });
  }
};
