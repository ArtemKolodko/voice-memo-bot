import * as dotenv from 'dotenv'
dotenv.config()

export default {
  servicePublicUrl: process.env.SERVICE_PUBLIC_URL || '',
  telegramToken: process.env.TELEGRAM_TOKEN || '',
  telegramApiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
  telegramApiHash: process.env.TELEGRAM_API_HASH || '',
  speechmaticsApiKey: process.env.SPEECHMATICS_API_KEY || '',
  kagiApiKey: process.env.KAGI_API_KEY || '',
  gpt4ApiKey: process.env.GPT4_API_KEY || '',
}
