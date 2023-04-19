import * as dotenv from 'dotenv'
dotenv.config()

export default {
  telegramToken: process.env.TELEGRAM_TOKEN || "",
  speechmaticsApiKey: process.env.SPEECHMATICS_API_KEY || "",
  maxAudioDuration: process.env.MAX_AUDIO_DURATION || 20 * 60, // 20 minutes
}
