// ریموت کنترل مرکزی - تمام تغییرات را اینجا انجام بده
export const SOUQ_SETTINGS = {
  identity: {
    appName: "سوپرمارکت بزرگ SOUQ",
    supportContact: "@YourSupportID",
    currencyDefault: "تومان"
  },
  
  // ریموتِ ظاهر (UI)
  ui: {
    primaryColor: "#007aff",    // رنگ اصلی دکمه‌ها
    vipColor: "#f1c40f",        // رنگ بخش‌های ویژه (طلایی)
    bgColor: "#f2f2f7",         // رنگ پس‌زمینه اپ
    fontFamily: "Tahoma, sans-serif"
  },

  // قوانین کسب‌وکار (Business Rules)
  logic: {
    requireApproval: true,      // آگهی ابتدا به مدیر برود؟ (true/false)
    canGuestsPost: false,       // آیا مهمان بدون عضویت می‌تواند آگهی بزند؟
    categories: ["🛍️ خرید و فروش", "🛠️ خدمات", "💼 اشتغال", "🏠 املاک", "🚗 خودرو"]
  },

  // ریموتِ اشتراک‌ها (Plans)
  plans: {
    free: { name: "عادی", limit: 3, icon: "📄" },
    vip: { name: "ویژه (VIP)", limit: 100, price: "۵۰,۰۰۰ تومان", icon: "✨" }
  },

  // دسترسی مدیریت (فقط این آیدی‌ها دکمه مدیریت را می‌بینند)
  adminList: [8587925383] // آیدی عددی تلگرام خودت را اینجا اضافه کن
};
