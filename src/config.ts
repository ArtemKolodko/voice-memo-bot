import * as dotenv from 'dotenv'
dotenv.config()

export default {
  telegramToken: process.env.TELEGRAM_TOKEN || '',
  telegramApiId: parseInt(process.env.TELEGRAM_API_ID || '0'),
  telegramApiHash: process.env.TELEGRAM_API_HASH || '',
  speechmaticsApiKey: process.env.SPEECHMATICS_API_KEY || '',
  kagiApiKey: process.env.KAGI_API_KEY || '',
  servicePublicUrl: process.env.SERVICE_PUBLIC_URL || '',
  paymentsServiceUrl: process.env.PAYMENTS_SERVICE_URL || '',
  paymentsServiceApiKey: process.env.PAYMENTS_SERVICE_API_KEY || '',
  paymentsWhitelist: (process.env.PAYMENTS_TELEGRAM_WHITELIST || '')
    .split(',').map(item => item.toLowerCase().trim())
}
