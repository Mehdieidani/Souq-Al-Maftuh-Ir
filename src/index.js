export default {
  async fetch(request, env) {
    if (request.method === "POST") {
      try {
        const payload = await request.json();
        
        if (payload && payload.message && payload.message.chat) {
          const chatId = payload.message.chat.id;
          const userText = payload.message.text || "";

          // تلاش برای ذخیره در دیتابیس
          try {
            await env.DB.prepare(
              "INSERT OR IGNORE INTO users (user_id, last_message) VALUES (?, ?)"
            ).bind(chatId.toString(), userText).run();
          } catch (dbError) {
            console.error("Database Error:", dbError.message);
          }

          const botToken = "7721832049:AAH1W8N_hO69p98v1u-6f5h-z4l8m2nQ"; 
          const url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
          
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "پیام شما در سیستم Souq ثبت شد! :white_check_mark:",
            }),
          });
        }
        return new Response("OK", { status: 200 });
      } catch (err) {
        return new Response("Error: " + err.message, { status: 500 });
      }
    }
    return new Response("Worker is active!");
  },
};
