const CONFIG = {
    admins: [8587925383], // آیدی خودت را چک کن
    primaryColor: "#007aff"
};

export default {
  async fetch(request, env) {
    const { DB, BOT_TOKEN } = env;
    const url = new URL(request.url);
    const cors = { "Access-Control-Allow-Origin": "*", "Content-Type": "application/json;charset=UTF-8" };

    try {
      // --- بخش API ها ---
      
      // دریافت لیست صفحات
      if (url.pathname === "/api/get-pages") {
        const { results } = await DB.prepare("SELECT * FROM pages").all();
        return Response.json(results || [], { headers: cors });
      }

      // ذخیره صفحه جدید (توسط ادمین)
      if (url.pathname === "/api/save-page") {
        const d = await request.json();
        await DB.prepare("INSERT OR REPLACE INTO pages (title, slug, content, icon) VALUES (?, ?, ?, ?)")
          .bind(d.title, d.slug, d.content, d.icon).run();
        return Response.json({ success: true }, { headers: cors });
      }

      // حذف صفحه
      if (url.pathname === "/api/delete-page") {
        const d = await request.json();
        await DB.prepare("DELETE FROM pages WHERE id = ?").bind(d.id).run();
        return Response.json({ success: true }, { headers: cors });
      }

      // سایر APIهای قبلی (آگهی‌ها و ...)
      if (url.pathname === "/api/get-ads") {
        const { results } = await DB.prepare("SELECT * FROM ads WHERE status = 'active' ORDER BY id DESC").all();
        return Response.json(results || [], { headers: cors });
      }

      // --- بخش نمایش (UI) ---
      return new Response(`
      <!DOCTYPE html>
      <html lang="fa" dir="rtl">
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <script src="https://telegram.org/js/telegram-web-app.js"></script>
          <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
          <style>
              :root { --p: ${CONFIG.primaryColor}; }
              body { font-family: Tahoma; background: #f4f4f9; margin: 0; padding-bottom: 70px; }
              .header { background: var(--p); color: white; padding: 15px; text-align: center; position: sticky; top:0; z-index:10; }
              .page { display: none; padding: 15px; }
              .active { display: block; }
              .card { background: white; border-radius: 12px; padding: 15px; margin-bottom: 10px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
              .nav { position: fixed; bottom: 0; width: 100%; background: white; display: flex; border-top: 1px solid #ddd; }
              .nav-item { flex: 1; text-align: center; padding: 10px; font-size: 11px; color: #777; }
              .nav-item.active { color: var(--p); }
              .btn { background: var(--p); color: white; border: none; padding: 10px 15px; border-radius: 8px; width: 100%; margin-top: 10px; }
              input, textarea { width: 100%; padding: 10px; margin: 5px 0; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; }
              .menu-item { display: flex; align-items: center; background: white; padding: 15px; margin-bottom: 5px; border-radius: 10px; }
              .menu-item i { margin-left: 10px; color: var(--p); }
          </style>
      </head>
      <body>
          <div class="header" id="top-title">SOUQ MARKET</div>

          <div id="p-home" class="page active">
              <div id="ads-list">در حال بارگذاری...</div>
          </div>

          <div id="p-dynamic" class="page">
              <div class="card" id="dynamic-content"></div>
              <button class="btn" onclick="showTab('home')">بازگشت</button>
          </div>

          <div id="p-admin" class="page">
              <div class="card">
                  <h3>📄 ساخت صفحه جدید</h3>
                  <input id="pg-title" placeholder="عنوان صفحه (مثلاً: قوانین)">
                  <input id="pg-slug" placeholder="شناسه انگلیسی (مثلاً: rules)">
                  <textarea id="pg-content" rows="4" placeholder="محتوای صفحه (متن یا HTML)"></textarea>
                  <button class="btn" onclick="savePage()">ذخیره و انتشار صفحه</button>
              </div>
              <hr>
              <h3>مدیریت صفحات موجود</h3>
              <div id="pages-list"></div>
          </div>

          <nav class="nav">
              <div class="nav-item active" onclick="showTab('home')"><i class="fa fa-home fa-lg"></i><br>خانه</div>
              <div id="more-menu" class="nav-item" onclick="toggleMenu()"><i class="fa fa-bars fa-lg"></i><br>صفحات</div>
              <div id="adm-tab" class="nav-item" style="display:none" onclick="showTab('admin')"><i class="fa fa-cog fa-lg"></i><br>تنظیمات</div>
          </nav>

          <div id="side-menu" style="display:none; position:fixed; bottom:60px; left:0; right:0; background:white; padding:10px; border-top:2px solid var(--p); z-index:100;">
              <div id="custom-pages-menu"></div>
          </div>

          <script>
              const tg = window.Telegram.WebApp;
              
              function showTab(id) {
                  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
                  document.getElementById('p-'+id).classList.add('active');
                  document.getElementById('side-menu').style.display = 'none';
              }

              function toggleMenu() {
                  const m = document.getElementById('side-menu');
                  m.style.display = m.style.display === 'none' ? 'block' : 'none';
                  loadCustomPages();
              }

              async function savePage() {
                  const data = {
                      title: document.getElementById('pg-title').value,
                      slug: document.getElementById('pg-slug').value,
                      content: document.getElementById('pg-content').value,
                      icon: 'fa-file'
                  };
                  await fetch('/api/save-page', { method: 'POST', body: JSON.stringify(data) });
                  tg.showAlert("صفحه با موفقیت ساخته شد!");
                  location.reload();
              }

              async function loadCustomPages() {
                  const res = await fetch('/api/get-pages');
                  const pages = await res.json();
                  const menu = document.getElementById('custom-pages-menu');
                  const adminList = document.getElementById('pages-list');
                  
                  menu.innerHTML = pages.map(p => \`
                      <div class="menu-item" onclick="openPage('\${p.title}', '\${p.content.replace(/\\n/g, '<br>')}')">
                          <i class="fa \${p.icon}"></i> \${p.title}
                      </div>
                  \`).join('');

                  if(adminList) {
                      adminList.innerHTML = pages.map(p => \`
                          <div class="card" style="display:flex; justify-content:space-between;">
                              <span>\${p.title}</span>
                              <button onclick="deletePage(\${p.id})" style="color:red; border:none; background:none;">حذف</button>
                          </div>
                      \`).join('');
                  }
              }

              function openPage(title, content) {
                  document.getElementById('top-title').innerText = title;
                  document.getElementById('dynamic-content').innerHTML = content;
                  showTab('dynamic');
              }

              async function deletePage(id) {
                  if(confirm("آیا از حذف این صفحه مطمئن هستید؟")) {
                      await fetch('/api/delete-page', { method: 'POST', body: JSON.stringify({id}) });
                      loadCustomPages();
                  }
              }

              async function loadAds() {
                  const res = await fetch('/api/get-ads');
                  const ads = await res.json();
                  document.getElementById('ads-list').innerHTML = ads.map(a => \`
                      <div class="card"><b>\${a.title}</b><br><small>\${a.price}</small></div>
                  \`).join('') || "آگهی یافت نشد.";
              }

              if (${JSON.stringify(CONFIG.admins)}.includes(tg.initDataUnsafe?.user?.id)) {
                  document.getElementById('adm-tab').style.display = 'block';
              }

              tg.expand();
              loadAds();
          </script>
      </body>
      </html>`, { headers: { "Content-Type": "text/html;charset=UTF-8" } });

    } catch (e) {
      return new Response(e.message, { status: 200 });
    }
  }
};
