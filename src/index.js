export default {
  async fetch(request, env) {
    if (request.method === "POST") {
      try {
        const payload = await request.json();
        if (payload.message && payload.message.chat) {
          const chatId = payload.message.chat.id;
          const username = payload.message.chat.username || "NoUsername";

          // ذخیره در دیتابیس D1
          await env.DB.prepare(
            "INSERT OR IGNORE INTO users (chat_id, username) VALUES (?, ?)"
          ).bind(chatId.toString(), username).run();

          // ارسال پاسخ
          const url = "https://api.telegram.org/bot" + env.TELEGRAM_BOT_TOKEN + "/sendMessage";
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "سلام! اطلاعات شما در دیتابیس souq_db ثبت شد. :white_check_mark:",
            })
          });
        }
      } catch (e) {
        return new Response("Error: " + e.message);
      }
      return new Response("OK");
    }
    return new Response("Bot is running!");
  }
};
