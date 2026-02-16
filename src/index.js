const CONFIG = {
    admins: [6522877528], 
    supportUsername: "Mehdi_E_admin", 
    cardNo: "6037-6917-9138-4449",
    tetherWallet: "0x865e5DA97a1a0f656Cfc2113097FC963b26E5165",
    appName: "بازار بزرگ بین‌المللی"
};

const COUNTRIES = {
    "🇮🇷 ایران": { currency: "تومان", cities: ["تهران", "مشهد", "اصفهان", "کرج", "شیراز", "تبریز", "اهواز", "قم", "کرمانشاه", "ارومیه", "رشت", "زاهدان", "همدان", "کرمان", "یزد", "اردبیل", "بندرعباس", "اراک", "زنجان", "سنندج", "قزوین", "خرم‌آباد", "گرگان", "ساری", "بوشهر", "بیرجند", "ایلام", "شهرکرد", "سمنان", "یاسوج"] },
    "🇮🇶 عراق": { currency: "دینار", cities: ["بغداد", "البصرة", "الموصل", "أربيل", "كركوك", "النجف", "كربلاء", "السليمانية"] },
    "🇹🇷 تركيا": { currency: "ليرة", cities: ["إسطنبول", "أنقرة", "إزمير", "بورصة", "أنطاليا"] }
};

export default {
    async fetch(request, env) {
        const { DB, BOT_TOKEN } = env;
        const url = new URL(request.url);

        if (url.pathname === "/api/get-ads") {
            const { results } = await DB.prepare(`SELECT * FROM ads WHERE status = 'active' ORDER BY id DESC`).all();
            return Response.json(results || [], { headers: { "Access-Control-Allow-Origin": "*" } });
        }

        if (request.method === "POST") {
            try {
                const update = await request.json();

                // مدیریت دکمه‌های شیشه‌ای
                if (update.callback_query) {
                    const data = update.callback_query.data;
                    const chatId = update.callback_query.message.chat.id;

                    if (data === "start_free" || data === "start_premium") {
                        await updateState(chatId, "GET_TITLE", { ad_type: data.includes("premium") ? "premium" : "free", images: [] }, DB);
                        await sendMessage(chatId, "🔹 لطفا **عنوان آگهی** خود را بنویسید:", BOT_TOKEN);
                    } else if (data.startsWith('approve_')) {
                        const id = data.split('_')[1];
                        await DB.prepare("UPDATE ads SET status = 'active' WHERE id = ?").bind(id).run();
                        await sendMessage(chatId, "✅ آگهی تایید شد.", BOT_TOKEN);
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

                // ثبت عنوان
                if (state === "GET_TITLE" && text) {
                    tempData.title = text;
                    await updateState(chatId, "GET_COUNTRY", tempData, DB);
                    return await sendKeyboard(chatId, "🌍 کشور را انتخاب کنید:", Object.keys(COUNTRIES), BOT_TOKEN);
                }

                // سایر مراحل به همین ترتیب... (خلاصه شده برای تست دکمه)
                if (text === "☎️ پشتیبانی") {
                    return await sendMessage(chatId, `👤 پشتیبانی: @${CONFIG.supportUsername}`, BOT_TOKEN);
                }

            } catch (e) { return new Response("OK"); }
        }
        return new Response(generateHTML(CONFIG), { headers: { "Content-Type": "text/html;charset=UTF-8" } });
    }
};

async function sendMainMenu(chatId, token, host) {
    const inlineKeyboard = {
        inline_keyboard: [
            [{ text: "🛍 ورود به ویترین بازار", web_app: { url: `https://${host}` } }],
            [{ text: "💎 ثبت آگهی ویژه", callback_data: "start_premium" }, { text: "🛒 ثبت آگهی رایگان", callback_data: "start_free" }],
            [{ text: "☎️ پشتیبانی", url: `https://t.me/Mehdi_E_admin` }]
        ]
    };
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ chat_id: chatId, text: "👋 خوش آمدید! برای شروع یکی از گزینه‌های زیر را بزنید:", reply_markup: inlineKeyboard })
    });
    return new Response("OK");
}

async function updateState(uid, state, data, DB) {
    await DB.prepare("INSERT OR REPLACE INTO user_states (user_id, state, temp_data) VALUES (?, ?, ?)")
        .bind(uid, state, JSON.stringify(data)).run();
}

async function sendMessage(chatId, text, token) {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" })
    });
    return new Response("OK");
}

async function sendKeyboard(chatId, text, buttons, token) {
    const keyboard = buttons.map(b => [{ text: b }]);
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ chat_id: chatId, text, reply_markup: { keyboard, resize_keyboard: true, one_time_keyboard: true } })
    });
    return new Response("OK");
}

function generateHTML(cfg) { return `<html><body><h1>${cfg.appName}</h1></body></html>`; }
