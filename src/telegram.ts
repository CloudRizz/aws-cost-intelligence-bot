import {
  SSMClient,
  GetParameterCommand,
} from '@aws-sdk/client-ssm';

// Creates the SSM client in the region containing our Telegram parameters.
const ssmClient = new SSMClient({
  region: 'eu-west-2',
});

// Defines the Telegram configuration returned from Parameter Store.
type TelegramConfig = {
  token: string;
  chatId: string;
};

// Retrieves the Telegram bot token and Chat ID securely from SSM.
export const getTelegramConfig = async (): Promise<TelegramConfig> => {
  // Retrieves the encrypted Telegram bot token.
  const tokenResponse = await ssmClient.send(
    new GetParameterCommand({
      Name: '/cloudrizz/cost-bot/telegram/token',
      WithDecryption: true,
    }),
  );

  // Retrieves the Telegram Chat ID.
  const chatIdResponse = await ssmClient.send(
    new GetParameterCommand({
      Name: '/cloudrizz/cost-bot/telegram/chat-id',
    }),
  );

  // Extracts the parameter values.
  const token = tokenResponse.Parameter?.Value;
  const chatId = chatIdResponse.Parameter?.Value;

  // Stops execution if either required parameter is missing.
  if (!token || !chatId) {
    throw new Error('Telegram configuration is missing from SSM');
  }

  // Returns the configuration without logging sensitive values.
  return {
    token,
    chatId,
  };
};

// Sends a text message to our configured Telegram chat.
export const sendTelegramMessage = async (message: string): Promise<void> => {
  // Retrieves the bot token and Chat ID securely from Parameter Store.
  const { token, chatId } = await getTelegramConfig();

  // Sends the message using the Telegram Bot API.
  const response = await fetch(
    `https://api.telegram.org/bot${token}/sendMessage`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
      }),
    },
  );

  // Checks whether Telegram accepted the message.
  if (!response.ok) {
    throw new Error(`Telegram message failed with HTTP ${response.status}`);
  }

  // Reads Telegram's API response to confirm delivery was accepted.
  const result = (await response.json()) as { ok: boolean };

  // Stops execution if Telegram reports an error.
  if (!result.ok) {
    throw new Error('Telegram API rejected the message');
  }
};
