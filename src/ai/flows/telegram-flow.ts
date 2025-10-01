
'use server';
/**
 * @fileOverview A Genkit flow for sending messages via the Telegram Bot API.
 * 
 * - sendTelegramMessage - A function that sends a message to a given chat ID.
 * - SendTelegramMessageInput - The input type for the sendTelegramMessage function.
 * - TelegramSendResult - The return type for the sendTelegramMessage function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'zod';
import axios from 'axios';

// Define the input schema for the flow
const SendTelegramMessageInputSchema = z.object({
  chatId: z.string().or(z.number()).describe('The Telegram chat ID to send the message to.'),
  message: z.string().describe('The message content to send. Can include HTML for formatting.'),
});
export type SendTelegramMessageInput = z.infer<typeof SendTelegramMessageInputSchema>;


// Define the output schema for the flow
const TelegramSendResultSchema = z.object({
  success: z.boolean().describe('Whether the message was sent successfully.'),
  error: z.string().nullable().describe('The error message if sending failed.'),
  isBlocked: z.boolean().describe('True if the user has blocked the bot.'),
  isNotApproved: z.boolean().describe('True if the bot cannot initiate a conversation.'),
  isChatNotFound: z.boolean().describe('True if the chat ID is invalid or not found.'),
});
export type TelegramSendResult = z.infer<typeof TelegramSendResultSchema>;


/**
 * The main flow function for sending a Telegram message.
 * This is not directly exported to the client, but wrapped by the `sendTelegramMessage` function.
 */
const sendTelegramMessageFlow = ai.defineFlow(
  {
    name: 'sendTelegramMessageFlow',
    inputSchema: SendTelegramMessageInputSchema,
    outputSchema: TelegramSendResultSchema,
  },
  async ({ chatId, message }) => {
    
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    if (!botToken) {
        console.error("TELEGRAM_BOT_TOKEN is not set in environment variables.");
        return {
            success: false,
            error: "Server configuration error: Bot token not found.",
            isBlocked: false,
            isNotApproved: false,
            isChatNotFound: false,
        };
    }

    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    
    try {
        const response = await axios.post(url, {
            chat_id: chatId,
            text: message,
            parse_mode: 'HTML',
        });

        if (response.data.ok) {
            return {
                success: true,
                error: null,
                isBlocked: false,
                isNotApproved: false,
                isChatNotFound: false,
            };
        } else {
             // Handle cases where Telegram API returns ok:false (e.g., bot blocked)
             const description = response.data.description || 'Unknown Telegram error';
             let isBlocked = false;
             let isNotApproved = false;
             let isChatNotFound = false;

             if (description.includes("bot was blocked by the user")) {
                 isBlocked = true;
             } else if (description.includes("bot can't initiate conversation with a user")) {
                 isNotApproved = true;
             } else if (description.includes("chat not found")) {
                 isChatNotFound = true;
             }

            return {
                success: false,
                error: `Telegram API Error: ${description}`,
                isBlocked,
                isNotApproved,
                isChatNotFound,
            };
        }

    } catch (error: any) {
        let isBlocked = false;
        let isNotApproved = false;
        let isChatNotFound = false;
        let errorMessage = `Execution error: ${error.message}`;

        if (axios.isAxiosError(error) && error.response) {
            const { status, data } = error.response;
            const description = data?.description || error.message;
            errorMessage = `HTTP Error: ${status} - ${description}`;
            
            if (status === 403) {
                if (description.includes("bot was blocked by the user")) {
                    isBlocked = true;
                } else if (description.includes("bot can't initiate conversation with a user")) {
                    isNotApproved = true;
                }
            } else if (status === 400 && description.includes("chat not found")) {
                isChatNotFound = true;
            }
        }
        
        return {
            success: false,
            error: errorMessage,
            isBlocked,
            isNotApproved,
            isChatNotFound,
        };
    }
  }
);


/**
 * Exported wrapper function to be used by server actions.
 * @param input The data for the message to be sent.
 * @returns A promise that resolves to the result of the send operation.
 */
export async function sendTelegramMessage(input: SendTelegramMessageInput): Promise<TelegramSendResult> {
  return await sendTelegramMessageFlow(input);
}
