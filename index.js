const fs = require("fs");
const { Telegraf } = require("telegraf");
const jalaali = require("jalaali-js");
const express = require("express");
const moment = require("moment-timezone");

const BOT_TOKEN = "7938751872:AAHxcVS-24d2tLCYeJ5Jqu1rhHCpiGKFu9M";
const bot = new Telegraf(BOT_TOKEN);

const birthdaysFile = "./birthdays.json";
const groupFile = "./group.json";

function loadJson(filename) {
    if (!fs.existsSync(filename)) {
        fs.writeFileSync(filename, JSON.stringify({}));
    }
    return JSON.parse(fs.readFileSync(filename));
}
function saveJson(filename, data) {
    fs.writeFileSync(filename, JSON.stringify(data, null, 2));
}

let birthdays = loadJson(birthdaysFile);
let groupData = loadJson(groupFile);

bot.start((ctx) => {
    ctx.reply("سلام! ربات تولد آماده است.");
});

bot.on("new_chat_members", async (ctx) => {
    const botId = (await ctx.telegram.getMe()).id;
    const botAdded = ctx.message.new_chat_members.find((user) => user.id === botId);

    if (botAdded) {
        groupData.chatId = ctx.chat.id;
        saveJson(groupFile, groupData);
        ctx.reply("ربات به گروه اضافه شد و آماده به کار است!");
    }
});

// /addbirthday نام YYYY-MM-DD HH:mm
bot.command("addbirthday", (ctx) => {
    const args = ctx.message.text.split(" ").slice(1);
    if (args.length !== 3) {
        return ctx.reply("فرمت درست:\n/addbirthday نام YYYY-MM-DD HH:mm (تاریخ شمسی)");
    }

    const [name, date, time] = args;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return ctx.reply("تاریخ باید در فرمت YYYY-MM-DD (تاریخ شمسی) باشد.");
    }
    if (!/^\d{1,2}:\d{2}$/.test(time)) {
        return ctx.reply("ساعت باید در فرمت HH:mm باشد.");
    }

    const [hourStr, minuteStr] = time.split(":");
    const hour = parseInt(hourStr);
    const minute = parseInt(minuteStr);

    if (hour < 0 || hour > 23 || minute < 0 || minute > 59) {
        return ctx.reply("ساعت باید بین 0 تا 23 و دقیقه بین 0 تا 59 باشد.");
    }

    const [jy, jm, jd] = date.split("-").map(Number);
    const { gy, gm, gd } = jalaali.toGregorian(jy, jm, jd);
    const gregDate = `${gy}-${gm.toString().padStart(2, "0")}-${gd.toString().padStart(2, "0")}`;

    const userId = ctx.from.id.toString();

    birthdays[userId] = { name, birthdate: gregDate, hour, minute };
    saveJson(birthdaysFile, birthdays);

    ctx.reply(`🎂 تولد ${name} با تاریخ شمسی ${date} و ساعت ${hour}:${minuteStr} ثبت شد.`);
});

function checkBirthdays() {
    groupData = loadJson(groupFile);
    const now = moment().tz("Asia/Tehran");

    const jy = jalaali.toJalaali(now.year(), now.month() + 1, now.date()).jy;
    const jm = jalaali.toJalaali(now.year(), now.month() + 1, now.date()).jm;
    const jd = jalaali.toJalaali(now.year(), now.month() + 1, now.date()).jd;

    const currentHour = now.hour();
    const currentMinute = now.minute();

    console.log(`⏰ بررسی: ${jy}-${jm}-${jd} ${currentHour}:${currentMinute}`);

    if (!groupData.chatId) return;

    for (const userId in birthdays) {
        const b = birthdays[userId];

        const [gy, gm, gd] = b.birthdate.split("-").map(Number);
        const { jy: by, jm: bm, jd: bd } = jalaali.toJalaali(gy, gm, gd);

        if (jm === bm && jd === bd && currentHour === b.hour && currentMinute === b.minute) {
            const age = jy - by;
            const message = `🎉 امروز تولد ${b.name} است! تولدت ${age} سالگی مبارک! 🎂`;

            bot.telegram.sendMessage(groupData.chatId, message).catch((err) => {
                console.error("❌ خطا در ارسال پیام به گروه:", err.message);
            });

            bot.telegram.sendMessage(userId, message).catch((err) => {
                console.error("❌ خطا در ارسال پیام خصوصی:", err.message);
            });
        }
    }
}

bot.launch().then(() => {
    console.log("🤖 ربات با polling راه‌اندازی شد.");
});

setInterval(checkBirthdays, 60 * 1000);

const app = express();
app.get("/", (req, res) => {
    res.send("Bot is running.");
});
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log("زمان فعلی سیستم:", new Date().toISOString());
    console.log("زمان فعلی تهران:", moment().tz("Asia/Tehran").format());

    console.log(`🌐 سرور روی پورت ${PORT} اجرا شد.`);
});
