import * as dotenv from 'dotenv'
dotenv.config()

export default {
  telegramToken: process.env.TELEGRAM_TOKEN || '',
  telegramApiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
  telegramApiHash: process.env.TELEGRAM_API_HASH || '',
  speechmaticsApiKey: process.env.SPEECHMATICS_API_KEY || '',
}
