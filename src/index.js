const CONFIG = {
    admins: [6522877528], // آیدی عددی شما (ادمین)
    supportUsername: "Mehdi_E_admin", // آیدی تلگرام پشتیبانی بدون @ را اینجا بنویسید
    
    // اطلاعات پرداخت شما
    cardNo: "6037-6917-9138-4449",
    tetherWallet: "0x865e5DA97a1a0f656Cfc2113097FC963b26E5165", // شبکه BEP20 یا ERC20
    
    appName: "بازار بزرگ بین‌المللی"
};

// لیست کامل کشورهای عربی + ایران با شهرهای مهم
const COUNTRIES = {
    "🇮🇷 ایران": { 
        currency: "تومان", 
        cities: ["تهران", "مشهد", "اصفهان", "کرج", "شیراز", "تبریز", "اهواز", "قم", "کرمانشاه", "ارومیه", "رشت", "زاهدان", "همدان", "کرمان", "یزد", "اردبیل", "بندرعباس", "اراک", "زنجان", "سنندج", "قزوین", "خرم‌آباد", "گرگان", "ساری", "بوشهر", "بیرجند", "ایلام", "شهرکرد", "سمنان", "یاسوج"] 
    },
    "🇮🇶 عراق": { 
        currency: "دینار", 
        cities: ["بغداد", "البصرة", "الموصل", "أربيل", "كركوك", "النجف", "كربلاء", "السليمانية", "الناصرية", "العمارة", "الحلة", "الديوانية", "الكوت", "دهوك", "الرمادي", "بعقوبة", "السماوة"] 
    },
    "🇦🇪 الإمارات": { 
        currency: "درهم", 
        cities: ["دبي", "أبوظبي", "الشارقة", "العين", "عجمان", "رأس الخيمة", "الفجيرة", "أم القيوين"] 
    },
    "🇸🇦 السعودية": { 
        currency: "ريال", 
        cities: ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الطائف", "تبوك", "بريدة", "خميس مشيط", "أبها", "حائل", "نجران", "الجبيل", "الخرج", "ينبع"] 
    },
    "🇹🇷 تركيا": { 
        currency: "ليرة", 
        cities: ["إسطنبول", "أنقرة", "إزمير", "بورصة", "أنطاليا", "أضنة", "غازي عنتاب", "قونية"] 
    },
    "🇶🇦 قطر": { currency: "ريال", cities: ["الدوحة", "الريان", "الوكره", "الخور", "الشمال"] },
    "🇴🇲 عمان": { currency: "ريال", cities: ["مسقط", "صلالة", "صحار", "نزوى", "صور", "البريمي"] },
    "🇰🇼 الكويت": { currency: "دينار", cities: ["مدينة الكويت", "الأحمدي", "حولي", "الفروانية", "الجهراء"] },
    "🇧🇭 البحرين": { currency: "دينار", cities: ["المنامة", "الرفاع", "المحرق", "مدينة حمد", "عالي"] },
    "🇪🇬 مصر": { currency: "جنيه", cities: ["القاهرة", "الإسكندرية", "الجيزة", "شبرا الخيمة", "بورسعيد", "السويس", "الأقصر", "أسوان", "الغردقة", "شرم الشيخ"] },
    "🇱🇧 لبنان": { currency: "ليرة", cities: ["بيروت", "طرابلس", "صيدا", "صور", "جونيه", "زحلة"] },
    "🇸🇾 سوريا": { currency: "ليرة", cities: ["دمشق", "حلب", "حمص", "اللاذقية", "حماة", "طرطوس"] },
    "🇯🇴 الأردن": { currency: "دینار", cities: ["عمان", "الزرقاء", "إربد", "الرصيفة", "العقبة"] },
    "🇾🇪 اليمن": { currency: "ريال", cities: ["صنعاء", "عدن", "تعز", "الحديدة", "المكلا"] }
};

export default {
    async fetch(request, env) {
        const { DB, BOT_TOKEN } = env;
        const url = new URL(request.url);

        // --- API: دریافت آگهی‌ها برای مینی‌اپ ---
        // آگهی‌های ویژه (premium) اول نمایش داده می‌شوند
        if (url.pathname === "/api/get-ads") {
            const { results } = await DB.prepare(`
                SELECT * FROM ads 
                WHERE status = 'active' 
                ORDER BY CASE WHEN ad_type = 'premium' THEN 1 ELSE 2 END, id DESC
            `).all();
            return Response.json(results || [], { headers: { "Access-Control-Allow-Origin": "*" } });
        }

        // --- منطق ربات تلگرام ---
        if (request.method === "POST") {
            const update = await request.json();

            // مدیریت دکمه‌های شیشه‌ای (تایید/حذف ادمین)
            if (update.callback_query) {
                return await handleCallback(update.callback_query, DB, BOT_TOKEN);
            }

            const msg = update.message;
            if (!msg) return new Response("OK");
            const chatId = msg.chat.id;
            const text = msg.text;

            // شروع ربات
            if (text === "/start") {
                await updateState(chatId, "IDLE", {}, DB);
                return await sendMainMenu(chatId, BOT_TOKEN, url.hostname);
            }

            // دریافت وضعیت کاربر از دیتابیس
            const user = await DB.prepare("SELECT * FROM user_states WHERE user_id = ?").bind(chatId).first();
            const state = user?.state || "IDLE";
            let tempData = JSON.parse(user?.temp_data || "{}");

            // --- ماشین حالت (State Machine) برای ثبت آگهی ---
            
            // ۱. انتخاب نوع آگهی
            if (text === "🛒 ثبت آگهی رایگان" || text === "💎 ثبت آگهی ویژه") {
                tempData = { ad_type: text.includes("ویژه") ? "premium" : "free", images: [] };
                await updateState(chatId, "GET_TITLE", tempData, DB);
                return await sendMessage(chatId, "🔹 لطفا **عنوان آگهی** خود را بنویسید:", BOT_TOKEN);
            }

            // ۲. دریافت عنوان -> درخواست کشور
            if (state === "GET_TITLE" && text) {
                tempData.title = text;
                await updateState(chatId, "GET_COUNTRY", tempData, DB);
                // ارسال کیبورد کشورها (به صورت ۲ ستونه برای زیبایی)
                return await sendKeyboard(chatId, "🌍 کشور خود را انتخاب کنید:", Object.keys(COUNTRIES), BOT_TOKEN, 2);
            }

            // ۳. انتخاب کشور -> درخواست شهر
            if (state === "GET_COUNTRY" && COUNTRIES[text]) {
                tempData.country = text;
                tempData.currency = COUNTRIES[text].currency;
                await updateState(chatId, "GET_CITY", tempData, DB);
                return await sendKeyboard(chatId, `🏙 شهر مورد نظر در **${text}** را انتخاب کنید:`, COUNTRIES[text].cities, BOT_TOKEN, 3);
            }

            // ۴. انتخاب شهر -> درخواست عکس
            if (state === "GET_CITY" && text) {
                tempData.city = text;
                await updateState(chatId, "GET_PHOTOS", tempData, DB);
                return await sendMessage(chatId, "📸 لطفا **عکس‌های آگهی** را ارسال کنید (حداکثر ۵ عدد).\n\n✅ پس از اینکه عکس‌ها تمام شد، دکمه یا کلمه **«پایان»** را ارسال کنید.", BOT_TOKEN, {
                    keyboard: [[{text: "پایان"}]], resize_keyboard: true, one_time_keyboard: true
                });
            }

            // ۵. دریافت عکس‌ها
            if (state === "GET_PHOTOS") {
                if (msg.photo) {
                    const fileId = msg.photo[msg.photo.length - 1].file_id;
                    tempData.images.push(fileId);
                    await updateState(chatId, "GET_PHOTOS", tempData, DB);
                    // تایید دریافت عکس (اختیاری برای UX بهتر)
                    // return await sendMessage(chatId, "👍 عکس دریافت شد. بعدی یا «پایان»", BOT_TOKEN); 
                    return new Response("OK");
                } else if (text === "پایان") {
                    await updateState(chatId, "GET_DESC", tempData, DB);
                    return await sendMessage(chatId, "📝 لطفا **توضیحات کامل** و **اطلاعات تماس** (شماره یا آیدی) را بنویسید:", BOT_TOKEN, {remove_keyboard: true});
                }
            }

            // ۶. دریافت توضیحات و ثبت نهایی
            if (state === "GET_DESC" && text) {
                tempData.desc = text;
                
                // ذخیره در دیتابیس با وضعیت 'pending'
                const result = await DB.prepare("INSERT INTO ads (user_id, title, description, country, city, currency, ad_type, image_ids, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)")
                    .bind(chatId, tempData.title, tempData.desc, tempData.country, tempData.city, tempData.currency, tempData.ad_type, tempData.images.join(','), 'pending').run();
                
                const adId = result.meta.last_row_id;
                await updateState(chatId, "IDLE", {}, DB);
                
                // ارسال به ادمین برای بررسی
                await sendToAdmin(adId, tempData, BOT_TOKEN, DB);

                // پیام پایان به کاربر
                let finalMsg = "";
                if (tempData.ad_type === "premium") {
                    finalMsg = `⭐ **آگهی ویژه شما ثبت موقت شد.**\n\n💰 جهت انتشار، مبلغ آگهی ویژه را به یکی از روش‌های زیر واریز کرده و رسید آن را برای پشتیبانی ارسال کنید:\n\n💳 **کارت:** \`${CONFIG.cardNo}\`\n🪙 **تتر (TRC20/BEP20):** \n\`${CONFIG.tetherWallet}\`\n\n📩 ارسال رسید به: @${CONFIG.supportUsername}`;
                } else {
                    finalMsg = "✅ **آگهی رایگان شما با موفقیت ثبت شد!**\n\nپس از تایید توسط مدیریت، در ویترین نمایش داده خواهد شد.";
                }
                return await sendMessage(chatId, finalMsg, BOT_TOKEN);
            }

            // دکمه‌های منوی اصلی
            if (text === "☎️ پشتیبانی" || text === "⭐ خرید اشتراک ویژه") {
                return await sendMessage(chatId, `👤 برای پشتیبانی و خرید اشتراک، لطفا به آیدی زیر پیام دهید:\n\n🆔 @${CONFIG.supportUsername}`, BOT_TOKEN);
            }

            return new Response("OK");
        }

        // --- نمایش مینی‌اپ (HTML) ---
        return new Response(generateHTML(CONFIG), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
};

// --- توابع کمکی ---

// مدیریت کلیک‌های ادمین
async function handleCallback(cb, DB, token) {
    const [action, id] = cb.data.split('_');
    if (action === 'approve') {
        await DB.prepare("UPDATE ads SET status = 'active' WHERE id = ?").bind(id).run();
        // خبر دادن به کاربر صاحب آگهی
        const ad = await DB.prepare("SELECT user_id, title FROM ads WHERE id = ?").bind(id).first();
        if(ad) await sendMessage(ad.user_id, `🎉 آگهی شما با عنوان **"${ad.title}"** تایید و منتشر شد!`, token);
        
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, { method: 'POST', body: JSON.stringify({ callback_query_id: cb.id, text: "✅ آگهی تایید شد" })});
        await editMessageCaption(cb.message.chat.id, cb.message.message_id, "✅ **این آگهی تایید و منتشر شد.**", token);
    } 
    else if (action === 'reject') {
        await DB.prepare("DELETE FROM ads WHERE id = ?").bind(id).run();
        await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, { method: 'POST', body: JSON.stringify({ callback_query_id: cb.id, text: "❌ آگهی حذف شد" })});
        await editMessageCaption(cb.message.chat.id, cb.message.message_id, "❌ **این آگهی رد و حذف شد.**", token);
    }
    return new Response("OK");
}

// ارسال آگهی جدید به ادمین
async function sendToAdmin(adId, data, token, DB) {
    const adminId = CONFIG.admins[0];
    const text = `🔔 **آگهی جدید دریافت شد!**\n\n` +
                 `📌 **عنوان:** ${data.title}\n` +
                 `🌍 **مکان:** ${data.country} - ${data.city}\n` +
                 `💰 **نوع:** ${data.ad_type === 'premium' ? 'ویژه (نیاز به پرداخت)' : 'رایگان'}\n` +
                 `📝 **توضیحات:**\n${data.desc}`;
                 
    const keyboard = { inline_keyboard: [[
        { text: "✅ تایید و انتشار", callback_data: `approve_${adId}` },
        { text: "❌ رد و حذف", callback_data: `reject_${adId}` }
    ]]};
    
    if (data.images.length > 0) {
        await fetch(`https://api.telegram.org/bot${token}/sendPhoto`, { 
            method: 'POST', 
            headers: {'Content-Type': 'application/json'}, 
            body: JSON.stringify({ chat_id: adminId, photo: data.images[0], caption: text, reply_markup: keyboard, parse_mode: "Markdown" })
        });
    } else {
        await sendMessage(adminId, text, token, keyboard);
    }
}

async function updateState(uid, state, data, DB) {
    await DB.prepare("INSERT OR REPLACE INTO user_states (user_id, state, temp_data) VALUES (?, ?, ?)")
        .bind(uid, state, JSON.stringify(data)).run();
}

async function sendMessage(chatId, text, token, replyMarkup = null) {
    const body = { chat_id: chatId, text: text, parse_mode: "Markdown" };
    if (replyMarkup) body.reply_markup = replyMarkup;
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(body)});
    return new Response("OK");
}

async function editMessageCaption(chatId, msgId, text, token) {
    await fetch(`https://api.telegram.org/bot${token}/editMessageCaption`, { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify({ chat_id: chatId, message_id: msgId, caption: text, parse_mode: "Markdown" })
    });
}

// کیبورد ساز هوشمند (چند ستونه)
async function sendKeyboard(chatId, text, buttons, token, columns = 2) {
    const keyboard = [];
    for (let i = 0; i < buttons.length; i += columns) {
        keyboard.push(buttons.slice(i, i + columns).map(b => ({ text: b })));
    }
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            chat_id: chatId, text, parse_mode: "Markdown",
            reply_markup: { keyboard, resize_keyboard: true, one_time_keyboard: true }
        })
    });
    return new Response("OK");
}

async function sendMainMenu(chatId, token, host) {
    const keyboard = {
        keyboard: [
            [{ text: "💎 ثبت آگهی ویژه" }, { text: "🛒 ثبت آگهی رایگان" }],
            [{ text: "🛍 ورود به بازار (ویترین آگهی‌ها)", web_app: { url: `https://${host}` } }],
            [{ text: "☎️ پشتیبانی" }, { text: "⭐ خرید اشتراک" }]
        ],
        resize_keyboard: true,
        persistent: true
    };
    return await sendMessage(chatId, "👋 به بازار بزرگ ایران و کشورهای عربی خوش آمدید.\n\nلطفاً یکی از گزینه‌های زیر را انتخاب کنید:", token, keyboard);
}

// HTML مینی‌اپ (UI)
function generateHTML(cfg) {
    return `
    <!DOCTYPE html>
    <html lang="fa" dir="rtl">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">
        <title>${cfg.appName}</title>
        <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
        <style>
            body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f2f2f7; margin: 0; padding: 15px; padding-bottom: 50px; }
            h2 { text-align: center; color: #333; margin-top: 0; }
            .loading { text-align: center; color: #888; margin-top: 20px; }
            
            .ad-card { background: white; border-radius: 16px; margin-bottom: 16px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08); position: relative; }
            .ad-card.premium { border: 2px solid #ffcc00; background: #fffdf5; }
            
            .badge { position: absolute; top: 12px; left: 12px; background: #ffcc00; color: #000; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
            
            .ad-img-container { width: 100%; height: 180px; background: #eee; display: flex; align-items: center; justify-content: center; overflow: hidden; }
            .ad-img { width: 100%; height: 100%; object-fit: cover; }
            
            .ad-content { padding: 15px; }
            .ad-title { margin: 0 0 5px 0; font-size: 16px; font-weight: 700; color: #000; }
            .ad-loc { font-size: 13px; color: #8e8e93; margin-bottom: 8px; display: flex; align-items: center; }
            .ad-loc i { margin-left: 5px; }
            .ad-desc { font-size: 13px; color: #333; line-height: 1.4; margin-bottom: 12px; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
            
            .ad-footer { display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f0f0f0; padding-top: 10px; margin-top: 5px; }
            .price-tag { font-weight: bold; color: #007aff; font-size: 14px; }
            
            .btn-contact { background: #34c759; color: white; padding: 8px 16px; border-radius: 20px; text-decoration: none; font-size: 13px; font-weight: bold; }
        </style>
    </head>
    <body>
        <h2>💎 ویترین السوق المفتوح +ایران</h2>
        <div id="list" class="loading"><i class="fa fa-spinner fa-spin"></i> در حال دریافت آگهی‌ها...</div>
        
        <script>
            // تابع دریافت فایل عکس از تلگرام (نیازمند پروکسی در فرانت است، اما اینجا عکس پیشفرض می‌گذاریم اگر لینک مستقیم نباشد)
            // نکته: در نسخه ساده، ما فقط آیدی فایل را داریم. برای نمایش عکس باید از API تلگرام استفاده کرد یا کاربر عکس را جای دیگری آپلود کند.
            // در اینجا برای سادگی، یک عکس پیش‌فرض نشان می‌دهیم مگر اینکه سیستم پیچیده‌تری برای پروکسی عکس تلگرام پیاده کنیم.
            
            async function loadAds() {
                try {
                    const res = await fetch('/api/get-ads');
                    const ads = await res.json();
                    
                    if (ads.length === 0) {
                        document.getElementById('list').innerHTML = '<p style="text-align:center">هنوز هیچ آگهی ثبت نشده است.</p>';
                        return;
                    }

                    document.getElementById('list').innerHTML = ads.map(a => \`
                        <div class="ad-card \${a.ad_type === 'premium' ? 'premium' : ''}">
                            \${a.ad_type === 'premium' ? '<span class="badge"><i class="fa fa-star"></i> ویژه</span>' : ''}
                            
                            <div class="ad-img-container">
                                <i class="fa fa-image fa-3x" style="color:#ccc"></i>
                            </div>
                            
                            <div class="ad-content">
                                <h3 class="ad-title">\${a.title}</h3>
                                <div class="ad-loc"><i class="fa fa-map-marker-alt"></i> \${a.country}، \${a.city}</div>
                                <p class="ad-desc">\${a.description}</p>
                                <div class="ad-footer">
                                    <span class="price-tag">\${a.currency}</span>
                                    <a href="https://t.me/${CONFIG.supportUsername}" class="btn-contact">📞 تماس / خرید</a>
                                </div>
                            </div>
                        </div>
                    \`).join('');
                } catch (e) {
                    document.getElementById('list').innerText = 'خطا در بارگذاری.';
                }
            }
            loadAds();
        </script>
    </body>
    </html>`;
                }
