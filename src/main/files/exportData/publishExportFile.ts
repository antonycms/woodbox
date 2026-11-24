import { randomUUID } from 'crypto';
import { rename, rm } from 'fs/promises';

// Keep the destination untouched until writing and cancellation checks have completed.
export const publishExportFile = async <T>(
  filePath: string,
  checkCanceled: () => void,
  write: (temporaryPath: string) => Promise<T>,
  beginPublishing = checkCanceled,
): Promise<T> => {
  const temporaryPath = `${filePath}.${randomUUID()}.partial`;
  try {
    checkCanceled();
    const result = await write(temporaryPath);
    beginPublishing();
    await rename(temporaryPath, filePath);
    return result;
  } finally {
    await rm(temporaryPath, { force: true });
  }
};
