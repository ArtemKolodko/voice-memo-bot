import {Bot, InputFile, webhookCallback} from "grammy";
import express from "express";
import axios from 'axios'
import config from './config'
import {Speechmatics} from "./speechmatics";

const { telegramToken, speechmaticsApiKey, maxAudioDuration } = config

const bot = new Bot(telegramToken);
const speechmatics = new Speechmatics(speechmaticsApiKey)

const introductionMessage = `Hello! I'm a Harmony Voice Memo bot. Please send me audio file or voice memo to translate.`;

const replyWithIntro = (ctx: any) =>
  ctx.reply(introductionMessage);

const downloadFile = async (filePath: string) => {
  const url = `https://api.telegram.org/file/bot${telegramToken}/${filePath}`
  const { data } = await axios.get(url)
  return data
}

const getDataUrl = (filePath: string) => {
  return `https://api.telegram.org/file/bot${telegramToken}/${filePath}`
}

const onMessage = async (ctx: any) => {
  const { id, username, first_name } = ctx.update.message.chat
  const audio = ctx.update.message.voice || ctx.update.message.audio
  if(audio) {
    const { file_id, duration } = audio

    console.log(`Received new message from ${first_name} ("${username}", user id ${id}). File id: ${file_id}, duration: ${duration}`)

    if(duration > maxAudioDuration) {
      await ctx.reply(`Audio duration: ${duration} seconds, max duration: ${maxAudioDuration} seconds. Please upload file with duration less than ${maxAudioDuration} seconds.`);
      return
    }

    const fileData = await bot.api.getFile(file_id)
    if(fileData.file_path) {
      try {
        // const file = await downloadFile(fileData.file_path)
        const dataUrl = getDataUrl(fileData.file_path)
        await ctx.reply(`Translation started, wait for the result`)
        const translation = await speechmatics.getTranslation(dataUrl)
        console.log('Translation:', translation)

        if(typeof translation === 'string') {
          if(translation.length <= 5000) {
            await ctx.reply(translation);
          } else {
            const blob = Buffer.from(translation, "utf-8");
            await ctx.replyWithDocument(new InputFile(blob, 'translation.txt'))
          }
        } else {
          await ctx.reply('Translation failed');
        }
      } catch (e) {
        console.log('Translation failed', (e as Error).message)
        await ctx.reply('Translation failed');
      }
    }
  } else {
    await ctx.reply('Please send audio file or voice memo');
  }
}

bot.command("start", replyWithIntro);
bot.on("message", onMessage);

if (process.env.NODE_ENV === "production") {
  const app = express();
  app.use(express.json());
  app.use(webhookCallback(bot, "express"));

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Bot listening on port ${PORT}`);
  });
  bot.start();
} else {
  console.log('Bot started (development)')
  bot.start();
}
