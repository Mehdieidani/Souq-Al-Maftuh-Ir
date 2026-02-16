const CONFIG = {
    admins: [6522877528], 
    supportUsername: "Mehdi_E_admin", 
    cardNo: "6037-6917-9138-4449",
    tetherWallet: "0x865e5DA97a1a0f656Cfc2113097FC963b26E5165",
    appName: "بازار بزرگ بین‌المللی"
};

const COUNTRIES = {
    "🇮🇷 ایران": { currency: "تومان", cities: ["تهران", "مشهد", "اصفهان", "کرج", "شیراز", "تبریز", "اهواز", "قم", "کرمانشاه", "ارومیه", "رشت", "زاهدان", "همدان", "کرمان", "یزد", "اردبیل", "بندرعباس", "اراک", "زنجان", "سنندج", "قزوین", "خرم‌آباد", "گرگان", "ساری", "بوشهر", "بیرجند", "ایلام", "شهرکرد", "سمنان", "یاسوج"] },
    "🇮🇶 عراق": { currency: "دینار", cities: ["بغداد", "البصرة", "الموصل", "أربيل", "كركوك", "النجف", "كربلاء", "السليمانية", "الناصرية", "العمارة", "الحلة", "الديوانية", "الكوت", "دهوك", "الرمادي", "بعقوبة", "السماوة"] },
    "🇦🇪 الإمارات": { currency: "درهم", cities: ["دبي", "أبوظبي", "الشارقة", "العين", "عجمان", "رأس الخيمة", "الفجيرة", "أم القيوين"] },
    "🇸🇦 السعودية": { currency: "ريال", cities: ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "الطائف", "تبوك", "بريدة", "خميس مشيط", "أبها", "حائل", "نجران", "الجبيل", "الخرج", "ينبع"] },
    "🇹🇷 تركيا": { currency: "ليرة", cities: ["إسطنبول", "أنقرة", "إزمير", "بورصة", "أنطاليا", "أضنة", "غازي عنتاب", "قونية"] },
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

        // API مینی‌اپ
        if (url.pathname === "/api/get-ads") {
            const { results } = await DB.prepare(`SELECT * FROM ads WHERE status = 'active' ORDER BY CASE WHEN ad_type = 'premium' THEN 1 ELSE 2 END, id DESC`).all();
            return Response.json(results || [], { headers: { "Access-Control-Allow-Origin": "*" } });
        }

        // ربات تلگرام
        if (request.method === "POST") {
            try {
                const update = await request.json();

                if (update.callback_query) {
                    const [action, id] = update.callback_query.data.split('_');
                    if (action === 'approve') {
                        await DB.prepare("UPDATE ads SET status = 'active' WHERE id = ?").bind(id).run();
                        const ad = await DB.prepare("SELECT user_id FROM ads WHERE id = ?").bind(id).first();
                        if(ad) await sendMessage(ad.user_id, "🎉 آگهی شما تایید و منتشر شد!", BOT_TOKEN);
                        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, { method: 'POST', body: JSON.stringify({ callback_query_id: update.callback_query.id, text: "تایید شد" })});
                    } else if (action === 'reject') {
                        await DB.prepare("DELETE FROM ads WHERE id = ?").bind(id).run();
                        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/answerCallbackQuery`, { method: 'POST', body: JSON.stringify({ callback_query_id: update.callback_query.id, text: "حذف شد" })});
                    }
                    return new Response("OK");
                }

                const msg = update.message;
                if (!msg) return new Response("OK");
                const chatId = msg.chat.id;
                const text = msg.text;

                if (text === "/start") {
                    await updateState(chatId, "IDLE", {}, DB);
                    return await sendMainMenu(chatId, BOT_TOKEN, url.hostname);
                }

                const user = await DB.prepare("SELECT * FROM user_states WHERE user_id = ?").bind(chatId).first();
                const state = user?.state || "IDLE";
                let tempData = JSON.parse(user?.temp_data || "{}");

                if (text === "🛒 ثبت آگهی رایگان" || text === "💎 ثبت آگهی ویژه") {
                    tempData = { ad_type: text.includes("ویژه") ? "premium" : "free", images: [] };
                    await updateState(chatId, "GET_TITLE", tempData, DB);
                    return await sendMessage(chatId, "🔹 لطفا **عنوان آگهی** خود را بنویسید:", BOT_TOKEN);
                }

                if (state === "GET_TITLE" && text) {
                    tempData.title = text;
                    await updateState(chatId, "GET_COUNTRY", tempData, DB);
                    return await sendKeyboard(chatId, "🌍 کشور خود را انتخاب کنید:", Object.keys(COUNTRIES), BOT_TOKEN, 2);
                }

                if (state === "GET_COUNTRY" && COUNTRIES[text]) {
                    tempData.country = text;
                    tempData.currency = COUNTRIES[text].currency;
                    await updateState(chatId, "GET_CITY", tempData, DB);
                    return await sendKeyboard(chatId, `🏙 شهر مورد نظر در **${text}** را انتخاب کنید:`, COUNTRIES[text].cities, BOT_TOKEN, 3);
                }

                if (state === "GET_CITY" && text) {
                    tempData.city = text;
                    await updateState(chatId, "GET_PHOTOS", tempData, DB);
                    return await sendMessage(chatId, "📸 لطفا **عکس‌های آگهی** را ارسال کنید.\n\n✅ پس از اتمام، دکمه **«پایان»** را بزنید.", BOT_TOKEN, {
                        keyboard: [[{text: "پایان"}]], resize_keyboard: true, one_time_keyboard: true
                    });
                }

                if (state === "GET_PHOTOS") {
                    if (msg.photo) {
                        tempData.images.push(msg.photo[msg.photo.length - 1].file_id);
                        await updateState(chatId, "GET_PHOTOS", tempData, DB);
                        return new Response("OK");
                    } else if (text === "پایان") {
                        await updateState(chatId, "GET_DESC", tempData, DB);
                        return await sendMessage(chatId, "📝 توضیحات کامل و اطلاعات تماس را بنویسید:", BOT_TOKEN, {remove_keyboard: true});
                    }
                }

                if (state === "GET_DESC" && text) {
                    tempData.desc = text;
                    const result = await DB.prepare("INSERT INTO ads (user_id, title, description, country, city, currency, ad_type, image_ids, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')")
                        .bind(chatId, tempData.title, tempData.desc, tempData.country, tempData.city, tempData.currency, tempData.ad_type, tempData.images.join(',')).run();
                    
                    await updateState(chatId, "IDLE", {}, DB);
                    
                    // ارسال به ادمین
                    const adminText = `🔔 آگهی جدید:\n📌 ${tempData.title}\n🌍 ${tempData.country}\n💰 ${tempData.ad_type}`;
                    const adminKb = { inline_keyboard: [[{ text: "✅ تایید", callback_data: `approve_${result.meta.last_row_id}` }, { text: "❌ حذف", callback_data: `reject_${result.meta.last_row_id}` }]]};
                    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ chat_id: CONFIG.admins[0], text: adminText, reply_markup: adminKb })});

                    let finalMsg = tempData.ad_type === "premium" ? `⭐ ویژه ثبت شد. واریز به کارت: \`${CONFIG.cardNo}\` و ارسال رسید به @${CONFIG.supportUsername}` : "✅ در صف تایید قرار گرفت.";
                    return await sendMessage(chatId, finalMsg, BOT_TOKEN);
                }

                if (text === "☎️ پشتیبانی" || text === "⭐ خرید اشتراک") {
                    return await sendMessage(chatId, `👤 پشتیبانی: @${CONFIG.supportUsername}`, BOT_TOKEN);
                }

            } catch (e) {
                return new Response("OK");
            }
        }

        // نمایش مینی‌اپ
        return new Response(generateHTML(CONFIG), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
};

async function updateState(uid, state, data, DB) {
    await DB.prepare("INSERT OR REPLACE INTO user_states (user_id, state, temp_data) VALUES (?, ?, ?)")
        .bind(uid, state, JSON.stringify(data)).run();
}

async function sendMessage(chatId, text, token, replyMarkup = null) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown", reply_markup: replyMarkup })
    });
    return new Response("OK");
}

async function sendKeyboard(chatId, text, buttons, token, columns = 2) {
    const keyboard = [];
    for (let i = 0; i < buttons.length; i += columns) {
        keyboard.push(buttons.slice(i, i + columns).map(b => ({ text: b })));
    }
    return await sendMessage(chatId, text, token, { keyboard, resize_keyboard: true, one_time_keyboard: true });
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
    return await sendMessage(chatId, "👋 به بازار بزرگ خوش آمدید.\nیکی از گزینه‌ها را انتخاب کنید:", token, keyboard);
}

function generateHTML(cfg) {
    return `<!DOCTYPE html><html lang="fa" dir="rtl"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>body{font-family:Tahoma;background:#f2f2f7;padding:15px;}.ad-card{background:white;border-radius:12px;margin-bottom:15px;padding:15px;box-shadow:0 2px 5px rgba(0,0,0,0.1);}.premium{border:2px solid #ffcc00;}.btn-contact{display:block;background:#34c759;color:white;text-align:center;padding:10px;border-radius:8px;text-decoration:none;margin-top:10px;}</style></head><body><h2 style="text-align:center">${cfg.appName}</h2><div id="list">در حال بارگذاری...</div><script>async function load(){try{const res=await fetch('/api/get-ads');const ads=await res.json();document.getElementById('list').innerHTML=ads.map(a=>\`<div class="ad-card \${a.ad_type==='premium'?'premium':''}"><h4>\${a.title}</h4><p>\${a.country} - \${a.city}</p><p>\${a.description}</p><a href="https://t.me/${cfg.supportUsername}" class="btn-contact">📞 تماس با آگهی دهنده</a></div>\`).join('');}catch(e){document.getElementById('list').innerHTML="خطا در بارگذاری آگهی‌ها";}}load();</script></body></html>`;
                                            }
