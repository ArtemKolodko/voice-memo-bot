import { Bot, webhookCallback } from "grammy";
import express from "express";
import axios from 'axios'

const TelegramToken = process.env.TELEGRAM_TOKEN || ""

const bot = new Bot(TelegramToken);

const introductionMessage = `Hello! I'm a Telegram bot.`;

const replyWithIntro = (ctx: any) =>
  ctx.reply(introductionMessage);

const downloadFile = async (filePath: string) => {
  const url = `https://api.telegram.org/file/bot${TelegramToken}/${filePath}`
  console.log('url', url)
  const { data } = await axios.get(url)
  return data
}

const onMessage = async (ctx: any) => {
  const { voice } = ctx.update.message
  if(voice) {
    const { file_id } = voice
    const fileData = await bot.api.getFile(file_id)
    if(fileData.file_path) {
      try {
        const file = await downloadFile(fileData.file_path)
      } catch (e) {
        console.log('cannot download file', (e as Error).message)
      }
    }
  }
  ctx.reply('Test reply');
}

bot.command("start", replyWithIntro);
bot.on("message", onMessage);

// Start the server
if (process.env.NODE_ENV === "production") {
  // Use Webhooks for the production server
  const app = express();
  app.use(express.json());
  app.use(webhookCallback(bot, "express"));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Bot listening on port ${PORT}`);
  });
} else {
  // Use Long Polling for development
  bot.start();
}
