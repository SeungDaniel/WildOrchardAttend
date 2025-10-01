
import { adminDb } from '@/lib/firebase-admin';
import { Timestamp, FieldValue } from 'firebase-admin/firestore';

/**
 * Checks if a scan for a given code has already been recorded for the current day.
 * @param code The QR code string.
 * @returns A promise that resolves to an object with isDuplicate and name.
 */
export async function checkForDuplicateScan(
  code: string
): Promise<{ isDuplicate: boolean; name?: string }> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const scansRef = adminDb.collection('scans');
    const q = scansRef
      .where('code', '==', code)
      .where('timestamp', '>=', Timestamp.fromDate(today))
      .where('timestamp', '<', Timestamp.fromDate(tomorrow));

    const querySnapshot = await q.get();

    if (!querySnapshot.empty) {
      const docData = querySnapshot.docs[0].data();
      return { isDuplicate: true, name: docData.name };
    }
    return { isDuplicate: false };
  } catch (error) {
    console.error('Error checking for duplicate scan in Firestore:', error);
    // Re-throw the error to ensure the calling function is aware of the DB failure.
    throw error;
  }
}

/**
 * Records a new scan in the Firestore database.
 * @param code The QR code string.
 * @param name The name of the person associated with the code.
 * @returns A promise that resolves when the write is complete.
 */
export async function recordScan(code: string, name: string): Promise<void> {
  try {
    const scansRef = adminDb.collection('scans');
    await scansRef.add({
      code: code,
      name: name,
      timestamp: FieldValue.serverTimestamp(),
    });
  } catch (error) {
    console.error(
      'Critical Error: Failed to record scan to Firestore. This should not be ignored.',
      error
    );
    // Re-throw the error to ensure the calling function knows about the failure.
    throw error;
  }
}

/**
 * Deletes all documents from the 'scans' collection using Admin SDK.
 * This bypasses security rules and is safe to use from a server action.
 */
export async function clearAllScans(): Promise<void> {
  try {
    const scansRef = adminDb.collection('scans');
    const snapshot = await scansRef.get();

    if (snapshot.empty) {
      console.log('No scans to delete.');
      return;
    }

    const batch = adminDb.batch();
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();

    console.log(`Successfully deleted ${snapshot.size} scans using Admin SDK.`);
  } catch (error) {
    console.error('Error clearing scans from Firestore with Admin SDK:', error);
    throw error;
  }
}
