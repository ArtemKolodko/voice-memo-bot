import express from "express";
import config from './config'
import {Speechmatics} from "./speechmatics";
import { initTelegramClient } from './telegramApi'
import {NewMessage, NewMessageEvent} from "telegram/events";
import fs from "fs";
import {Api} from "telegram";
import path from "path";

const { speechmaticsApiKey } = config
const TempDirectory = './temp/'

const speechmatics = new Speechmatics(speechmaticsApiKey)

const introductionMessage = `Hello! I'm a Harmony Voice Memo bot. Please send me audio file or voice memo to translate.`;

const writeTempFile = (buffer: string | Buffer, filename: string) => {
  const filePath = TempDirectory + filename
  fs.writeFileSync(filePath, buffer)
  return filePath
}

const deleteTempFile = (filePath: string) => {
  if(fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

const clearTempDirectory = () => {
  const directory = TempDirectory
  fs.readdir(directory, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      fs.unlink(path.join(directory, file), (err) => {
        if (err) throw err;
      });
    }
  });
}

const listenEvents = async () => {
  const client = await initTelegramClient()

  const postMessage = (chatId: any, message: string) => {
    if(chatId) {
      return client.sendMessage(chatId, { message })
    }
  }

  async function onEvent(event: NewMessageEvent) {
    const { media, chatId } = event.message;

    let errorMessage  = ''
    if(media && (media instanceof Api.MessageMediaDocument) && media.document) {
      // @ts-ignore
      const { mimeType = '' } = media.document
      if(!mimeType.includes('audio')) {
        errorMessage = 'Please send audio file or voice memo'
      }
    } else {
      errorMessage = 'Please send audio file or voice memo'
    }

    if(errorMessage) {
      // await postMessage(chatId, errorMessage)
      return
    }

    if(chatId && media instanceof Api.MessageMediaDocument && media && media.document) {
      console.log('Received new media:', media)
      await client.sendMessage(chatId, { message: 'Translation started', replyTo: event.message })
      const buffer = await client.downloadMedia(media);

      if(buffer) {
        const documentId = media.document.id.toString()
        try {
          const filePath = writeTempFile(buffer, documentId)
          const translation = await speechmatics.getTranslation(filePath)

          if(translation.length < 512) {
            console.log('Translation ready:', translation)
            await client.sendMessage(chatId, { message: translation, replyTo: event.message })
          } else {
            console.log('Translation ready, length:', translation.length)
            const file = new Buffer(translation)
            // @ts-ignore
            file.name = 'translation.txt' // hack from gramjs typings
            await client.sendFile(chatId, { file, replyTo: event.message })
          }
        } catch (e: any) {
          if(e.response && e.response.data) {
            console.log('Error: ', e.response.data)
            const { code, detail, error } = e.response.data
            if(detail) {
              await client.sendMessage(chatId, { message: `Speechmatics error: ${error}. ${detail}.` })
            }
          } else {
            console.log('Error:', e)
          }
        } finally {
          deleteTempFile(TempDirectory + documentId)
        }
      } else {
        console.log('Buffer is empty')
      }
    }
  }

  client.addEventHandler(onEvent, new NewMessage({}));
}

if (process.env.NODE_ENV === "production") {
  const app = express();
  app.use(express.json());

  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`Bot listening on port ${PORT}`);
  });
  clearTempDirectory()
  listenEvents()
} else {
  console.log('Bot started (development)')
  clearTempDirectory()
  listenEvents()
}
