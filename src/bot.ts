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
import {PaymentsService} from "./payment";

const {
  speechmaticsApiKey,
  kagiApiKey,
  servicePublicUrl,
  paymentsServiceUrl,
  paymentsServiceApiKey
} = config

const filesDirectoryName = 'public'
const filesDirectory = './' + filesDirectoryName
const audioExtension = 'ogg'

const speechmatics = new Speechmatics(speechmaticsApiKey)
const kagi = new Kagi(kagiApiKey)
const paymentsService = new PaymentsService(paymentsServiceUrl, paymentsServiceApiKey)

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
    let text = await kagi.getSummarization(audioUrl)
    console.log('Raw summary from Kagi:', text)
    text = text.replace('The speakers', 'We')
    const splitText = text.split('.').map(part => part.trim())
    let resultText = ''
    for(let i = 0; i < splitText.length; i++) {
      if(i % 2 !== 0) {
        continue
      }
      const sentence1 = splitText[i]
      const sentence2 = splitText[i + 1] || ''
      const twoSentences = sentence1 + (sentence2 ? '. ' + sentence2 + '.' : '')
      resultText +=  twoSentences
      if(i < splitText.length - 3) {
        resultText += '\n\n'
      }
    }
    console.log('Result summary:', resultText)
    return resultText
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

  async function onBalanceRequest(event: NewMessageEvent) {
    const { sender, senderId, chatId } = event.message;

    if(!chatId) {
      console.log('No chat id, return', event)
      return
    }

    const userId = senderId ? senderId.toString() : ''
    const userName = sender instanceof Api.User ? '@' + sender.username: ''
    let userAddress = ''

    try {
      const user = await paymentsService.getUser(userId)
      userAddress = user.userAddress
    } catch (e) {
      if((e as any).response.status === 404) {
        const user = await paymentsService.createUser(userId)
        userAddress = user.userAddress
      }
    }

    try {
      const { one, usd } = await paymentsService.getUserBalance(userId)
      const amountOne = (+one / Math.pow(10, 18)).toFixed(4)
      await client.sendMessage(chatId, {
        message: `User ${userName} balance: ${usd} USD (${amountOne} ONE)\nRefill address (Harmony): ${userAddress}`,
        replyTo: event.message
      })
    } catch (e) {
      console.log('onBalanceRequest error', e)
    }
  }

  async function onEvent(event: NewMessageEvent) {
    // console.log('event', event)
    const { media, chatId, message, fromId } = event.message;

    if(message === 'balance') {
      onBalanceRequest(event)
      return
    }

    let senderUsername = ''
    try {
      if(event.message.sender instanceof Api.User && event.message.sender.username) {
        senderUsername = event.message.sender.username
      }
      console.log('Message from username:', senderUsername)
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
            const fileName = `${senderUsername ? 'From  @'+senderUsername : ''} ${messageDate}.txt`
            console.log('Filename:', fileName)
            // hack from gramjs type docs
            // @ts-ignore
            file.name = fileName
            await client.sendFile(chatId, {
              file,
              replyTo: event.message,
              caption: summarization.slice(0, 1024) || translation.slice(0, 512)
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
