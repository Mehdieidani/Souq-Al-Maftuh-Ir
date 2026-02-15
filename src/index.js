export default {
  async fetch(request, env) {
    const botToken = "8587925383:AAElQXNbZ8YIDJMWwX4YyVFMCOsC2pV6H6c";

    if (request.method === "POST") {
      try {
        const data = await request.json();
        const chatId = data.message?.chat?.id;

        if (chatId) {
          const url = "https://api.telegram.org/bot" + botToken + "/sendMessage";
          await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              chat_id: chatId,
              text: "✅ بازار Souq آماده استفاده است!\nبرای ورود، دکمه زیر را بزنید:",
              reply_markup: {
                inline_keyboard: [[
                  { 
                    text: "🛍️ ورود به مینی‌اپ", 
                    web_app: { url: "https://proxytelegram12.mehdi11eidani.workers.dev/" } 
                  }
                ]]
              }
            }),
          });
        }
      } catch (e) {
        return new Response("Error");
      }
      return new Response("OK");
    }

    return new Response("Worker is running!", {
      headers: { "Content-Type": "text/plain" }
    });
  }
};
