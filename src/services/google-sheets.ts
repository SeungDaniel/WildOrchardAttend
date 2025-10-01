
import { google } from 'googleapis';
import { GoogleAuth } from 'google-auth-library';
import type { TelegramSendResult } from '@/ai/flows/telegram-flow';
import serviceAccount from '../../private_key.json';

// 환경 변수에서 스프레드시트 ID와 시트 이름을 직접 읽어옵니다.
const SPREADSHEET_ID = process.env.GOOGLE_SPREADSHEET_ID;
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME || 'Users';
// 사용자가 지정한 시작 행. 값이 없으면 1행부터 시작.
const START_ROW = parseInt(process.env.GOOGLE_SHEET_START_ROW || '1', 10);


/**
 * Creates and creates a Google Auth client using service account credentials from env vars.
 * @returns A promise that resolves to an authenticated GoogleAuth client.
 */
async function getGoogleAuth(spreadsheetIdOverride?: string): Promise<{ auth: GoogleAuth; spreadsheetId: string }> {
  
  const targetSpreadsheetId = spreadsheetIdOverride || SPREADSHEET_ID;

   if (!targetSpreadsheetId) {
    console.error('CRITICAL: GOOGLE_SPREADSHEET_ID environment variable is not set and no ID was provided.');
    throw new Error('서버 환경 변수(Spreadsheet ID)가 설정되지 않았습니다. .env 또는 Vercel 환경 변수 설정을 확인하세요.');
  }

  try {
    const auth = new GoogleAuth({
      credentials: {
        project_id: serviceAccount.project_id,
        client_email: serviceAccount.client_email,
        private_key: serviceAccount.private_key,
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });
    
    return { auth, spreadsheetId: targetSpreadsheetId };

  } catch (err: any) {
    console.error("Error during Google Auth creation:", err);
    throw new Error(`Google 인증 클라이언트 생성 실패: ${err.message}`);
  }
}

/**
 * Appends a code to column A and timestamp to column B, then reads columns C, D, and E from the newly added row.
 * @param code The QR code string to append.
 * @returns A promise that resolves to an object with name, chatId, message and row number, or null.
 */
export async function appendCodeAndReadRow(code: string): Promise<{ name: string; chatId: string; message: string, newRowNumber: number, sheetName: string } | null> {
  try {
    const { auth, spreadsheetId } = await getGoogleAuth();
    if (!SHEET_NAME) throw new Error("Sheet name is missing.");

    const sheets = google.sheets({ version: 'v4', auth });
    
    const timestamp = new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });

    // 1. Find the first empty row in column A, starting from the specified START_ROW
    const checkRange = `${SHEET_NAME}!A${START_ROW}:A`;
    const aColumnValues = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: checkRange,
    });
    
    // Calculate the new row number based on the START_ROW and the number of values found
    const newRowNumber = (START_ROW - 1) + (aColumnValues.data.values ? aColumnValues.data.values.length : 0) + 1;


    // 2. Use 'update' to write *only* to columns A and B of that specific new row.
    // This is safer than 'append' as it won't touch other columns' formulas.
    const writeRange = `${SHEET_NAME}!A${newRowNumber}:B${newRowNumber}`;
    await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: writeRange,
        valueInputOption: 'USER_ENTERED',
        requestBody: {
            values: [[code, timestamp]], // Write code to A, timestamp to B
        },
    });

    // 3. Give the sheet a moment to process the formulas in C, D, E
    await new Promise(resolve => setTimeout(resolve, 500));

    // 4. Read the required cells from the new row (C, D, E)
    const readRange = `${SHEET_NAME}!C${newRowNumber}:E${newRowNumber}`;
    const readResponse = await sheets.spreadsheets.values.get({
        spreadsheetId: spreadsheetId,
        range: readRange,
    });

    const rowValues = readResponse.data.values?.[0];
    if (!rowValues) {
      console.warn('Could not read back values from new row, but proceeding.', {range: readRange});
      // Return empty values to allow processing to continue, e.g., for non-telegram users
      return { name: '', chatId: '', message: '', newRowNumber, sheetName: SHEET_NAME };
    }
    
    const [name, chatId, message] = rowValues;

    return {
      name: name || '',
      chatId: chatId || '',
      message: message || '',
      newRowNumber: newRowNumber,
      sheetName: SHEET_NAME,
    };

  } catch (err: any) {
    console.error('Error in appendCodeAndReadRow:', err);
    if (err.message && err.message.includes('Unable to parse range')) {
      throw new Error(`'${SHEET_NAME}' 시트를 찾을 수 없습니다. 시트가 존재하는지, GOOGLE_SHEET_NAME 환경변수가 올바른지 확인해주세요.`);
    }
     if (err.message && err.message.includes('permission to access')) {
      throw new Error(`Google Sheet에 접근할 권한이 없습니다. 서비스 계정 이메일을 시트의 '편집자'로 공유했는지 확인하세요.`);
    }
    const errorMessage = `Google Sheet 처리 실패. 권한 또는 설정을 확인하세요.\nOriginal error: ${err.message}`;
    throw new Error(errorMessage);
  }
}


/**
 * Updates columns F and G in a specific row with the Telegram send result.
 * @param rowNumber The row number to update.
 * @param result The result object from the sendTelegramMessage flow. Can be null if no message was sent.
 */
export async function updateTelegramResultInSheet(rowNumber: number, result: TelegramSendResult | null): Promise<void> {
  if (rowNumber <= 0) {
    console.error("Invalid row number provided for updating Telegram result:", rowNumber);
    return;
  }
  
  try {
    const { auth, spreadsheetId } = await getGoogleAuth();
     if (!SHEET_NAME) throw new Error("Sheet name is missing.");
    const sheets = google.sheets({ version: 'v4', auth });

    let resultText = '';
    let statusText = '';

    if (result === null) {
      // Case where no Telegram message was intended to be sent (no chatId/message)
      resultText = "메시지 없음";
      statusText = "해당 없음";
    } else if (result.success) {
      resultText = "자동 발송됨";
      statusText = "발송성공";
    } else if (result.isBlocked) {
      resultText = "봇을 차단함";
      statusText = "봇 차단됨";
    } else if (result.isNotApproved) {
      resultText = "봇 미승인";
      statusText = "봇 미승인";
    } else if (result.isChatNotFound) {
        resultText = "계정 확인 필요";
        statusText = "계정 없음";
    } else {
      // Limit the error message length to prevent overly large cell content
      const safeError = (result.error || '알수없는 오류').substring(0, 100);
      resultText = `발송실패: ${safeError}`;
      statusText = "발송실패";
    }

    const updateRange = `${SHEET_NAME}!F${rowNumber}:G${rowNumber}`;
    await sheets.spreadsheets.values.update({
      spreadsheetId: spreadsheetId,
      range: updateRange, 
      valueInputOption: 'USER_ENTERED',
      requestBody: {
        values: [[resultText, statusText]],
      },
    });

  } catch (err: any) {
    console.error('Error updating telegram result in Google Sheet:', err);
    // This function runs in the background, so we just log the error
    // instead of throwing it to the user.
  }
}

type ValueToInsert = {
  value: string;
  column: string;
};

type WriteToSheetParams = {
  spreadsheetId: string;
  sheetName: string;
  startRow?: number;
  valuesToInsert: ValueToInsert[];
};

/**
 * Writes multiple values to their specified columns in the next available row.
 */
export async function writeToSheet({
  spreadsheetId,
  sheetName,
  startRow = 1,
  valuesToInsert
}: WriteToSheetParams): Promise<void> {
  try {
    const { auth } = await getGoogleAuth(spreadsheetId);
    const sheets = google.sheets({ version: 'v4', auth });

    if (valuesToInsert.length === 0) {
        return; // Nothing to insert
    }

    // Find the primary column to determine the next empty row.
    // We'll assume the first item in the array is the primary "key" for checking emptyness.
    const primaryColumn = (valuesToInsert[0].column || 'A').toUpperCase();

    // Check for the next empty row starting from the specified primary column and row
    const checkRange = `${sheetName}!${primaryColumn}${startRow}:${primaryColumn}`;
    const columnData = await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: checkRange,
    });
    
    const nextRow = (startRow - 1) + (columnData.data.values ? columnData.data.values.length : 0) + 1;

    // Prepare batch update data
    const data: { range: string; values: string[][] }[] = valuesToInsert
      .filter(item => item.column && item.value) // Ensure column and value exist
      .map(item => ({
        range: `${sheetName}!${item.column.toUpperCase()}${nextRow}`,
        values: [[item.value]],
    }));

    if (data.length === 0) {
        return;
    }

    await sheets.spreadsheets.values.batchUpdate({
        spreadsheetId,
        requestBody: {
            valueInputOption: 'USER_ENTERED',
            data: data,
        }
    });

  } catch (err: any) {
    console.error('Error in writeToSheet:', err);
     if (err.message && err.message.includes('Unable to parse range')) {
      throw new Error(`'${sheetName}' 시트를 찾을 수 없습니다. 시트 이름이 올바른지 확인해주세요.`);
    }
    if (err.message && err.message.includes('permission to access')) {
      throw new Error(`Google Sheet에 접근할 권한이 없습니다. 서비스 계정 이메일을 시트의 '편집자'로 공유했는지 확인하세요.`);
    }
    const errorMessage = `Google Sheet 쓰기 실패. 권한, 시트 ID, 시트 이름을 확인하세요.\nOriginal error: ${err.message}`;
    throw new Error(errorMessage);
  }
}
