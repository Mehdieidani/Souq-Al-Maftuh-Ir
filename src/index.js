const CONFIG = {
    admins: [6522877528], // آیدی خودت
    primaryColor: "#007aff",
    supportUsername: "YourSupportID", // آیدی تلگرام پشتیبانی بدون @
    appName: "SOUQ PRO"
};

export default {
  async fetch(request, env) {
    const { DB, BOT_TOKEN } = env;
    const url = new URL(request.url);
    const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json;charset=UTF-8" };

    try {
      // --- API های جدید ---
      if (url.pathname === "/api/get-pages") {
        const { results } = await DB.prepare("SELECT * FROM pages").all();
        return Response.json(results || [], { headers: cors });
      }

      if (url.pathname === "/api/get-fields") {
        const slug = url.searchParams.get("slug");
        const { results } = await DB.prepare("SELECT * FROM page_fields WHERE page_slug = ?").all();
        return Response.json(results || [], { headers: cors });
      }

      // ثبت اطلاعات فرم (رسید، پشتیبانی، آگهی)
      if (url.pathname === "/api/submit-form") {
        const d = await request.json();
        await DB.prepare("INSERT INTO submissions (user_id, page_slug, data) VALUES (?, ?, ?)")
          .bind(d.uid, d.slug, JSON.stringify(d.formData)).run();
        return Response.json({ success: true }, { headers: cors });
      }

      if (url.pathname === "/api/save-page-full") {
        const d = await request.json();
        await DB.prepare("INSERT OR REPLACE INTO pages (title, slug, content) VALUES (?, ?, ?)")
          .bind(d.title, d.slug, d.content).run();
        await DB.prepare("DELETE FROM page_fields WHERE page_slug = ?").bind(d.slug).run();
        for (const f of d.fields) {
          await DB.prepare("INSERT INTO page_fields (page_slug, field_label, field_type) VALUES (?, ?, ?)")
            .bind(d.slug, f.label, f.type).run();
        }
        return Response.json({ success: true }, { headers: cors });
      }

      // --- رابط کاربری (UI) ---
      return new Response(`
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0">
          <script src="https://telegram.org/js/telegram-web-app.js"></script>
          <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
          <style>
              :root { --p: ${CONFIG.primaryColor}; }
              body { font-family: system-ui; background: #f2f2f7; margin: 0; padding-bottom: 80px; direction: rtl; }
              .header { background: var(--p); color: white; padding: 15px; text-align: center; font-weight: bold; position: sticky; top:0; z-index:100; }
              .page { display: none; padding: 15px; }
              .page.active { display: block; }
              .card { background: white; border-radius: 15px; padding: 15px; margin-bottom: 12px; box-shadow: 0 2px 8px rgba(0,0,0,0.05); }
              .nav { position: fixed; bottom: 0; width: 100%; background: white; display: flex; border-top: 1px solid #ddd; height: 65px; }
              .nav-item { flex: 1; text-align: center; padding-top: 12px; color: #888; font-size: 11px; }
              .nav-item.active { color: var(--p); }
              .btn { background: var(--p); color: white; border: none; padding: 12px; border-radius: 12px; width: 100%; font-weight: bold; cursor: pointer; margin-top: 10px; }
              input, textarea, select { width: 100%; padding: 12px; margin: 8px 0; border: 1px solid #ddd; border-radius: 10px; box-sizing: border-box; }
              .vip-card { background: linear-gradient(135deg, #ffd700, #ffa500); color: #000; padding: 20px; border-radius: 15px; text-align: center; }
          </style>
      </head>
      <body>
          <div class="header" id="top-bar">${CONFIG.appName}</div>

          <div id="p-home" class="page active">
              <div class="vip-card" onclick="openVIP()">
                  <i class="fa fa-crown fa-2x"></i>
                  <h3>ارتقا به حساب ویژه (VIP)</h3>
                  <p>دسترسی به آگهی‌های طلایی و امکانات نامحدود</p>
              </div>
              <div id="ads-list"></div>
          </div>

          <div id="p-explore" class="page">
              <div class="card" onclick="openSupport()">
                  <i class="fa fa-headset" style="margin-left:10px"></i> پشتیبانی آنلاین
              </div>
              <hr>
              <div id="dynamic-pages-menu"></div>
          </div>

          <div id="p-form" class="page">
              <div id="form-content"></div>
          </div>

          <div id="p-admin" class="page">
              <div class="card">
                  <h3>🏗️ صفحه‌ساز و افزونه‌ساز</h3>
                  <input id="pg-title" placeholder="نام (مثلاً: ثبت رسید)">
                  <input id="pg-slug" placeholder="شناسه (مثلاً: receipt)">
                  <div id="f-preview"></div>
                  <button class="btn" style="background:#34c759" onclick="addNewField()">➕ افزودن فیلد جدید</button>
                  <button class="btn" onclick="saveMasterPage()">🚀 انتشار صفحه</button>
              </div>
          </div>

          <nav class="nav">
              <div class="nav-item active" onclick="showTab('home')"><i class="fa fa-house fa-lg"></i><br>خانه</div>
              <div class="nav-item" onclick="loadExplore()"><i class="fa fa-compass fa-lg"></i><br>بخش‌ها</div>
              <div id="admin-nav" class="nav-item" style="display:none" onclick="showTab('admin')"><i class="fa fa-screwdriver-wrench fa-lg"></i><br>سازنده</div>
          </nav>

          <script>
              const tg = window.Telegram.WebApp;
              let currentFields = [];

              function showTab(id) {
                  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                  document.getElementById('p-' + id).classList.add('active');
                  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
              }

              function addNewField() {
                  const label = prompt("نام فیلد را وارد کنید:");
                  const type = prompt("نوع فیلد (text, number, photo, textarea):", "text");
                  if(label) {
                      currentFields.push({label, type});
                      document.getElementById('f-preview').innerHTML += \`<div class="card" style="padding:5px">\${label} (\${type})</div>\`;
                  }
              }

              async function saveMasterPage() {
                  const data = {
                      title: document.getElementById('pg-title').value,
                      slug: document.getElementById('pg-slug').value,
                      content: 'FORM',
                      fields: currentFields
                  };
                  await fetch('/api/save-page-full', { method: 'POST', body: JSON.stringify(data) });
                  tg.showAlert("صفحه ساخته شد!");
                  location.reload();
              }

              async function loadExplore() {
                  showTab('explore');
                  const res = await fetch('/api/get-pages');
                  const pages = await res.json();
                  document.getElementById('dynamic-pages-menu').innerHTML = pages.map(p => \`
                      <div class="card" onclick="renderDynamicForm('\${p.slug}', '\${p.title}')">
                          <b>\${p.title}</b>
                      </div>
                  \`).join('');
              }

              async function renderDynamicForm(slug, title) {
                  const res = await fetch('/api/get-fields?slug=' + slug);
                  const fields = await res.json();
                  showTab('form');
                  document.getElementById('top-bar').innerText = title;
                  let html = \`<h3>\${title}</h3>\`;
                  fields.forEach(f => {
                      html += \`<label>\${f.field_label}</label>\`;
                      if(f.field_type === 'photo') html += \`<input type="file" class="dyn-input" data-label="\${f.field_label}" accept="image/*">\`;
                      else if(f.field_type === 'textarea') html += \`<textarea class="dyn-input" data-label="\${f.field_label}"></textarea>\`;
                      else html += \`<input type="\${f.field_type}" class="dyn-input" data-label="\${f.field_label}">\`;
                  });
                  html += \`<button class="btn" onclick="submitFinalForm('\${slug}')">ارسال نهایی</button>\`;
                  document.getElementById('form-content').innerHTML = html;
              }

              async function submitFinalForm(slug) {
                  const inputs = document.querySelectorAll('.dyn-input');
                  let formData = {};
                  inputs.forEach(i => formData[i.getAttribute('data-label')] = i.value);
                  await fetch('/api/submit-form', { method: 'POST', body: JSON.stringify({
                      uid: tg.initDataUnsafe?.user?.id,
                      slug: slug,
                      formData: formData
                  })});
                  tg.showAlert("اطلاعات با موفقیت ارسال شد!");
                  showTab('home');
              }

              function openVIP() {
                  tg.showConfirm("هزینه اشتراک ویژه ۱۰۰ هزار تومان است. آیا رسید پرداخت را آپلود می‌کنید؟", (ok) => {
                      if(ok) renderDynamicForm('receipt', 'آپلود رسید پرداخت');
                  });
              }

              function openSupport() {
                  tg.openTelegramLink("https://t.me/${CONFIG.supportUsername}");
              }

              if (${JSON.stringify(CONFIG.admins)}.includes(tg.initDataUnsafe?.user?.id)) {
                  document.getElementById('admin-nav').style.display = 'block';
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
