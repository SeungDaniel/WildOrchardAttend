
'use server';

import { checkForDuplicateScan, recordScan, clearAllScans } from '@/services/firebase';
import { appendCodeAndReadRow, updateTelegramResultInSheet, writeToSheet } from '@/services/google-sheets';
import { sendTelegramMessage, type SendTelegramMessageInput, type TelegramSendResult } from '@/ai/flows/telegram-flow';

type SaveScanResult = {
  success: boolean;
  error?: string;
  isDuplicate?: boolean;
  name?: string;
  notificationResult?: string;
  sheetName?: string;
};

export async function saveScanAndNotify(
  code: string
): Promise<SaveScanResult> {
  try {
    // 1. Check for duplicates in Firestore first.
    const duplicateCheck = await checkForDuplicateScan(code);
    if (duplicateCheck.isDuplicate) {
      return { success: false, isDuplicate: true, name: duplicateCheck.name || '방문자', sheetName: 'Firestore' };
    }

    // 2. Append code to Google Sheets and read user info.
    const sheetData = await appendCodeAndReadRow(code);

    // 3. CRITICAL: If sheetData is null or name is missing, it's an unregistered user.
    // This is a key defensive check.
    if (!sheetData || !sheetData.name) {
       // Record the scan attempt with an "Unknown" name for logging purposes.
       await recordScan(code, '미등록 사용자');
       return { success: false, error: '유효하지 않은 코드입니다. 등록된 사용자가 아닙니다.' };
    }
    
    const { name, chatId, message, newRowNumber, sheetName } = sheetData;

    // 4. Record the successful scan in Firestore with the correct name.
    await recordScan(code, name);
    
    let notificationResult = '출석이 기록되었습니다.';
    let telegramResult: TelegramSendResult | null = null;

    // 5. If Chat ID and Message exist, send a Telegram message.
    if (chatId && message) {
        telegramResult = await sendTelegramMessage({ chatId, message });
        
        if (telegramResult.success) {
           notificationResult = '출석이 기록되었고, Telegram 메시지가 발송되었습니다.';
        } else {
           notificationResult = `출석 기록 완료. Telegram 발송 실패: ${telegramResult.error}`;
        }
    }
    
    // 6. ALWAYS update the sheet with the result, even if no message was sent.
    // This call is outside the `if` block to ensure it always runs for registered users.
    await updateTelegramResultInSheet(newRowNumber, telegramResult);

    // 7. Return final success to the user.
    return { success: true, name, notificationResult, sheetName };

  } catch (e) {
    console.error('Failed to save scan and notify:', e);
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
    return { success: false, error: errorMessage };
  }
}

/**
 * Server action to clear all documents from the 'scans' collection.
 */
export async function clearScansAction(): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    await clearAllScans();
    return { success: true };
  } catch (e) {
    const errorMessage =
      e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error('Failed to clear scans:', e);
    return { success: false, error: errorMessage };
  }
}


type ValueToInsert = {
  value: string;
  column: string;
};

type PersonalSheetInput = {
    spreadsheetId: string;
    sheetName: string;
    startRow: number;
    valuesToInsert: ValueToInsert[];
}

/**
 * Server action for Personal Mode.
 * Writes a code to a user-specified Google Sheet.
 */
export async function saveToPersonalSheet(
  input: PersonalSheetInput
): Promise<{ success: boolean; error?: string; message?: string }> {
  const { spreadsheetId, sheetName, valuesToInsert } = input;
  if (!spreadsheetId || !sheetName || valuesToInsert.length === 0) {
    return { success: false, error: 'Sheet ID, Sheet Name, and at least one value to insert are required.' };
  }
  try {
    await writeToSheet({spreadsheetId, sheetName, startRow: input.startRow, valuesToInsert});
    return { success: true, message: `'${sheetName}' 시트에 코드가 저장되었습니다.` };
  } catch (e) {
    const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred.';
    console.error('Failed to save to personal sheet:', e);
    return { success: false, error: errorMessage };
  }
}
