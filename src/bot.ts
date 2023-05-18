import express from "express";
import config from './config'
import {Speechmatics} from "./speechmatics";
import { initTelegramClient } from './telegramApi'
import {NewMessage, NewMessageEvent} from "telegram/events";
import fs from "fs";
import {Api} from "telegram";
import path from "path";
import moment from "moment";
import UserEmpty = Api.UserEmpty;
import {Kagi} from "./kagi";

const { speechmaticsApiKey, kagiApiKey, servicePublicUrl } = config

const filesDirectoryName = 'public'
const filesDirectory = './' + filesDirectoryName
const audioExtension = 'ogg'

const speechmatics = new Speechmatics(speechmaticsApiKey)
const kagi = new Kagi(kagiApiKey)

const writeTempFile = (buffer: string | Buffer, filename: string) => {
  const filePath = `${filesDirectory}/${filename}.${audioExtension}`
  fs.writeFileSync(filePath, buffer)
  return filePath
}

const deleteTempFile = (filePath: string) => {
  if(fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

const clearTempDirectory = () => {
  fs.readdir(filesDirectory, (err, files) => {
    if (err) throw err;

    for (const file of files) {
      if(!['audio.ogg', 'test.txt'].includes(file)) {
        fs.unlink(path.join(filesDirectory, file), (err) => {
          if (err) throw err;
        });
      }
    }
  });
}

const getAudioSummarization = async (audioUrl: string) => {
  try {
    const summarization = await kagi.getSummarization(audioUrl)
    return summarization
  } catch (e) {
    console.log(`Error: cannot get audio "${audioUrl}" summarization:`, e)
  }
  return ''
}

const listenEvents = async () => {
  const client = await initTelegramClient()

  const postMessage = (chatId: any, message: string) => {
    if(chatId) {
      return client.sendMessage(chatId, { message })
    }
  }

  async function getUserById(id: string): Promise<Api.User | UserEmpty | null> {
    const { users } = await client.invoke(
      new Api.users.GetFullUser({
        id,
      })
    );
    return users.length ? users[0] : null
  }

  async function onEvent(event: NewMessageEvent) {
    // console.log('event', event)
    const { media, chatId } = event.message;

    let senderUsername = ''
    try {
      let userId = ''
      if(event.message.peerId instanceof Api.PeerUser) {
        userId = event.message.peerId.userId.toString()
      } else if(event.message.fromId instanceof Api.PeerUser) {
        userId = event.message.fromId.userId.toString()
      }
      console.log('userId:', userId)
      if(userId) {
        const sender = await getUserById(userId)
        if(sender instanceof Api.User && sender.username) {
          senderUsername = sender.username
          console.log('senderUsername', senderUsername)
        }
      }
    } catch (e) {
      console.log("Can't get sender username:", e)
    }

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
      // console.log('Received new media:', media)
      // await client.sendMessage(chatId, { message: 'Translation started', replyTo: event.message })
      const buffer = await client.downloadMedia(media);

      if(buffer) {
        const documentId = media.document.id.toString()
        try {
          const filePath = writeTempFile(buffer, documentId)
          const externalFileUrl = `${servicePublicUrl}/${documentId}.${audioExtension}`
          console.log('External file url: ', externalFileUrl)
          let [translation, summarization] = await Promise.all([
            speechmatics.getTranslation(filePath),
            getAudioSummarization(externalFileUrl)
          ])
          console.log('Summarization:', summarization)

          translation = translation
            // @ts-ignore
            .replaceAll('SPEAKER: S', 'SPEAKER ')
            .replaceAll('\n', '\n\n')

          if(translation.length < 512) {
            console.log('Translation ready:', translation)
            await client.sendMessage(chatId, {
              message: translation,
              replyTo: event.message
            })
          } else {
            console.log('Translation ready, length:', translation.length)
            const file = new Buffer(translation)

            const messageDate = moment(event.message.date * 1000).utcOffset(-7).format('MM-DD h:mm a')
            // @ts-ignore
            const fileName = `From @${senderUsername} ${messageDate}.txt`
            console.log('fileName', fileName)
            // hack from gramjs type docs
            // @ts-ignore
            file.name = fileName
            await client.sendFile(chatId, {
              file,
              replyTo: event.message,
              caption: summarization || translation.slice(0, 512)
            })
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
          deleteTempFile(`${filesDirectory}/${documentId}.${audioExtension}`)
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

  app.use(express.static(filesDirectory))

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
