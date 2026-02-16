const CONFIG = {
    admins: [6522877528], // آیدی عددی خودت را اینجا چک کن
    primaryColor: "#007aff",
    appName: "SOUQ BUILDER"
};

export default {
  async fetch(request, env) {
    const { DB, BOT_TOKEN } = env;
    const url = new URL(request.url);
    const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json;charset=UTF-8" };

    try {
      // --- ۱. API های مدیریت و ساخت ---
      
      // دریافت تمام صفحات ساخته شده
      if (url.pathname === "/api/get-pages") {
        const { results } = await DB.prepare("SELECT * FROM pages").all();
        return Response.json(results || [], { headers: cors });
      }

      // دریافت فیلدهای یک صفحه خاص
      if (url.pathname === "/api/get-fields") {
        const slug = url.searchParams.get("slug");
        const { results } = await DB.prepare("SELECT * FROM page_fields WHERE page_slug = ? ORDER BY field_order").bind(slug).all();
        return Response.json(results || [], { headers: cors });
      }

      // ذخیره ساختار کامل یک صفحه جدید
      if (url.pathname === "/api/save-page-full") {
        const d = await request.json();
        await DB.prepare("INSERT OR REPLACE INTO pages (title, slug, content) VALUES (?, ?, ?)")
          .bind(d.title, d.slug, d.content).run();
        
        await DB.prepare("DELETE FROM page_fields WHERE page_slug = ?").bind(d.slug).run();
        for (let i = 0; i < d.fields.length; i++) {
          const f = d.fields[i];
          await DB.prepare("INSERT INTO page_fields (page_slug, field_label, field_type, field_order) VALUES (?, ?, ?, ?)")
            .bind(d.slug, f.label, f.type, i).run();
        }
        return Response.json({ success: true }, { headers: cors });
      }

      // --- ۲. هندل کردن ربات تلگرام ---
      if (request.method === "POST" && !url.pathname.startsWith("/api/")) {
        const update = await request.json();
        if (update.message?.text === "/start") {
          await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: update.message.chat.id,
              text: `به پنل هوشمند ${CONFIG.appName} خوش آمدید.`,
              reply_markup: { inline_keyboard: [[{ text: "🛠 باز کردن اپلیکیشن", web_app: { url: `https://${url.hostname}` } }]] }
            })
          });
        }
        return new Response("OK");
      }

      // --- ۳. رابط کاربری (UI) ---
      return new Response(`
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
          <script src="https://telegram.org/js/telegram-web-app.js"></script>
          <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
          <style>
              :root { --p: ${CONFIG.primaryColor}; --bg: #f2f2f7; }
              body { font-family: system-ui, -apple-system, sans-serif; background: var(--bg); margin: 0; padding-bottom: 80px; transition: all 0.3s; }
              .header { background: var(--p); color: white; padding: 18px; text-align: center; font-weight: bold; position: sticky; top:0; z-index:100; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
              .page { display: none; padding: 15px; animation: slideUp 0.3s ease; }
              .page.active { display: block; }
              @keyframes slideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
              .card { background: white; border-radius: 18px; padding: 18px; margin-bottom: 15px; box-shadow: 0 4px 12px rgba(0,0,0,0.05); border: 1px solid #eee; }
              .nav { position: fixed; bottom: 0; width: 100%; background: rgba(255,255,255,0.9); backdrop-filter: blur(10px); display: flex; border-top: 1px solid #ddd; height: 70px; z-index: 1000; }
              .nav-item { flex: 1; text-align: center; padding-top: 12px; color: #8e8e93; font-size: 11px; transition: 0.2s; }
              .nav-item.active { color: var(--p); }
              .btn { background: var(--p); color: white; border: none; padding: 14px; border-radius: 12px; width: 100%; font-weight: bold; font-size: 16px; cursor: pointer; margin-top: 10px; }
              input, textarea, select { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #d1d1d6; border-radius: 10px; box-sizing: border-box; background: #fafafa; }
              .field-tag { display: inline-block; background: #e5e5ea; padding: 5px 12px; border-radius: 15px; margin: 4px; font-size: 13px; }
          </style>
      </head>
      <body>
          <div class="header" id="app-title">${CONFIG.appName}</div>

          <div id="p-home" class="page active">
              <div id="ads-container">در حال بارگذاری...</div>
          </div>

          <div id="p-explore" class="page">
              <h3>📂 بخش‌های پلتفرم</h3>
              <div id="pages-list"></div>
          </div>

          <div id="p-render" class="page">
              <div class="card" id="form-area"></div>
              <button class="btn" style="background:#8e8e93" onclick="showTab('explore')">برگشت</button>
          </div>

          <div id="p-admin" class="page">
              <div class="card">
                  <h3>🏗️ صفحه‌ساز پیشرفته</h3>
                  <input id="new-title" placeholder="نام صفحه (مثلاً: ثبت ملک)">
                  <input id="new-slug" placeholder="شناسه انگلیسی (slug)">
                  
                  <div style="background:#f9f9f9; padding:10px; border-radius:12px; margin:10px 0; border:1px dashed #ccc;">
                      <small>افزودن فیلد جدید به این صفحه:</small>
                      <input id="f-label" placeholder="نام فیلد (مثلاً: متراژ)">
                      <select id="f-type">
                          <option value="text">متن</option>
                          <option value="number">عدد</option>
                          <option value="textarea">توضیحات</option>
                      </select>
                      <button class="btn" style="background:#34c759; padding:8px;" onclick="addField()">➕ افزودن فیلد</button>
                  </div>
                  <div id="fields-preview"></div>
                  <button class="btn" onclick="saveFullPage()">🚀 انتشار نهایی صفحه</button>
              </div>
          </div>

          <nav class="nav">
              <div class="nav-item active" onclick="showTab('home')"><i class="fa fa-home fa-lg"></i><br>ویترین</div>
              <div class="nav-item" onclick="loadExplore()"><i class="fa fa-th-large fa-lg"></i><br>صفحات</div>
              <div id="adm-btn" class="nav-item" style="display:none" onclick="showTab('admin')"><i class="fa fa-wand-magic-sparkles fa-lg"></i><br>سازنده</div>
          </nav>

          <script>
              const tg = window.Telegram.WebApp;
              let tempFields = [];

              function showTab(id) {
                  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                  document.getElementById('p-' + id).classList.add('active');
                  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
                  event?.currentTarget?.classList?.add('active');
              }

              function addField() {
                  const label = document.getElementById('f-label').value;
                  const type = document.getElementById('f-type').value;
                  if(!label) return;
                  tempFields.push({ label, type });
                  document.getElementById('fields-preview').innerHTML = tempFields.map(f => \`
                      <span class="field-tag">\${f.label} <small>(\${f.type})</small></span>
                  \`).join('');
                  document.getElementById('f-label').value = '';
              }

              async function saveFullPage() {
                  const data = {
                      title: document.getElementById('new-title').value,
                      slug: document.getElementById('new-slug').value,
                      content: 'DYNAMIC_PAGE',
                      fields: tempFields
                  };
                  if(!data.slug) return alert("شناسه الزامی است");
                  await fetch('/api/save-page-full', { method: 'POST', body: JSON.stringify(data) });
                  tg.showAlert("✅ صفحه با موفقیت ساخته و در لیست صفحات قرار گرفت!");
                  location.reload();
              }

              async function loadExplore() {
                  const res = await fetch('/api/get-pages');
                  const pages = await res.json();
                  showTab('explore');
                  document.getElementById('pages-list').innerHTML = pages.map(p => \`
                      <div class="card" onclick="renderForm('\${p.slug}', '\${p.title}')" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                          <span><b>\${p.title}</b></span>
                          <i class="fa fa-chevron-left" style="color:#ccc"></i>
                      </div>
                  \`).join('');
              }

              async function renderForm(slug, title) {
                  const res = await fetch('/api/get-fields?slug=' + slug);
                  const fields = await res.json();
                  showTab('render');
                  document.getElementById('app-title').innerText = title;
                  document.getElementById('form-area').innerHTML = \`
                      <h3>\${title}</h3>
                      \${fields.map(f => \`
                          <label>\${f.field_label}</label>
                          \${f.field_type === 'textarea' ? '<textarea></textarea>' : '<input type="'+f.field_type+'">'}
                      \`).join('')}
                      <button class="btn" onclick="tg.showAlert('اطلاعات ثبت شد!')">ارسال اطلاعات</button>
                  \`;
              }

              if (${JSON.stringify(CONFIG.admins)}.includes(tg.initDataUnsafe?.user?.id)) {
                  document.getElementById('adm-btn').style.display = 'block';
              }
              tg.expand();
          </script>
      </body>
      </html>`, { headers: { "Content-Type": "text/html;charset=UTF-8" } });

    } catch (e) {
      return new Response(e.message, { status: 200 });
    }
  }
};
