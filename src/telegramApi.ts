import { Api, TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import config from './config'

const { telegramToken, telegramApiId, telegramApiHash} = config

const sessionId = ''

const stringSession = new StringSession(sessionId);

export const initTelegramClient = async () => {
  const client = new TelegramClient(stringSession, telegramApiId, telegramApiHash, {
    connectionRetries: 5,
  });
  await client.start({
    botAuthToken: telegramToken,
    onError: (err) => console.log(err),
  });
  console.log('Session:', client.session.save());
  return client
}
