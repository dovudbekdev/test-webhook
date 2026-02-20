import express from "express";
import { Telegraf, Markup } from "telegraf";
import dotenv from "dotenv";

dotenv.config();

const { BOT_TOKEN, PORT = 3000, BASE_URL, WEBHOOK_SECRET } = process.env;

const bot = new Telegraf(BOT_TOKEN);
const app = express();

app.use(express.json());

// ===== ROLE CONFIG =====
const ROLES = {
  // chatId: role
  // "123456789": "founder1",
  // "987654321": "finance",
  // "111222333": "rop",
};

function role(ctx) {
  return ROLES[String(ctx.chat.id)] || "guest";
}

const canAddIn = (r) => r === "finance" || r === "rop";
const canAddOut = (r) => r === "finance";
const canViewFull = (r) => ["finance", "founder1", "founder2"].includes(r);
const canViewSales = (r) => r === "rop";

// ===== STATE =====
const state = new Map();

// ===== KEYBOARDS =====
const mainKeyboard = Markup.keyboard([
  ["➕ Kirim", "➖ Chiqim"],
  ["📅 Bugun", "🗓 Oy"],
  ["💰 Kassa"],
]).resize();

// ===== START =====
bot.start((ctx) => {
  ctx.reply("Holitech Cash Bot 🚀", mainKeyboard);
});

// ===== REPORT =====
bot.hears(["📅 Bugun", "🗓 Oy", "💰 Kassa"], async (ctx) => {
  const r = role(ctx);

  if (!canViewFull(r) && !canViewSales(r)) {
    return ctx.reply("⛔️ Ruxsat yo‘q");
  }

  return ctx.reply(
    "📊 Hozircha report placeholder (keyingi bosqichda qo‘shamiz)",
    mainKeyboard,
  );
});

// ===== KIRIM =====
bot.hears("➕ Kirim", (ctx) => {
  if (!canAddIn(role(ctx))) {
    return ctx.reply("⛔️ Siz kirim qo‘sha olmaysiz", mainKeyboard);
  }
  state.set(ctx.chat.id, { step: "amount", type: "IN" });
  ctx.reply("Summa kiriting:");
});

// ===== CHIQIM =====
bot.hears("➖ Chiqim", (ctx) => {
  if (!canAddOut(role(ctx))) {
    return ctx.reply("⛔️ Siz chiqim qo‘sha olmaysiz", mainKeyboard);
  }
  state.set(ctx.chat.id, { step: "amount", type: "OUT" });
  ctx.reply("Summa kiriting:");
});

// ===== SUMMA =====
bot.on("text", (ctx) => {
  const st = state.get(ctx.chat.id);
  if (!st) return;

  if (st.step === "amount") {
    const amount = Number(ctx.message.text.replace(/\D/g, ""));
    if (!amount) return ctx.reply("Noto‘g‘ri summa");

    st.amount = amount;
    st.step = "category";

    const categories =
      st.type === "IN"
        ? ["CourseSales", "Upsell", "Installment"]
        : ["Ads_Meta", "Ads_TG", "Ads_TGChannels"];

    return ctx.reply(
      "Kategoriya tanlang:",
      Markup.inlineKeyboard(
        categories.map((c) => Markup.button.callback(c, `cat_${c}`)),
      ),
    );
  }
});

// ===== CATEGORY CALLBACK =====
bot.action(/cat_(.+)/, async (ctx) => {
  const st = state.get(ctx.chat.id);
  if (!st) return;

  st.category = ctx.match[1];
  st.step = "done";

  await ctx.reply(
    `✅ ${st.type === "IN" ? "Kirim" : "Chiqim"}: ${st.amount}
Kategoriya: ${st.category}`,
    mainKeyboard,
  );

  state.delete(ctx.chat.id);
  await ctx.answerCbQuery();
});

// ===== WEBHOOK SETUP =====
app.get("/test", (req, res) => {
  res.json({
    ok: true,
    message: "Webhook endpoint ishlayapti. POST so'rovlarni Telegram yuboradi.",
    method: "GET (tekshirish uchun). Asl update'lar POST orqali keladi.",
  });
});

app.post(
  "/webhook",
  (req, res, next) => {
    console.log(`[webhook] 📥 Yangi update qabul qilindi (${new Date().toISOString()})`);
    next();
  },
  bot.webhookCallback("/webhook")
);

// app.get("/", (req, res) => res.send("OK"));

app.listen(PORT, async () => {
  console.log(`[server] 🚀 Server ${PORT} portda ishga tushdi`);
  try {
    await bot.telegram.setWebhook(
      `${BASE_URL}/webhook?secret=${WEBHOOK_SECRET}`
    );
    console.log(`[webhook] ✅ Webhook ro'yxatdan o'tkazildi: ${BASE_URL}/webhook`);
  } catch (err) {
    console.error("[webhook] ❌ Webhook sozlashda xato:", err.message);
  }
});
