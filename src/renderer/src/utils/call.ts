const ipcRederer = window.electron?.ipcRenderer;

/** Function to call backend application */
export default async function call<IData = any>(event: string, ...params): Promise<IData> {
  try {
    return await ipcRederer.invoke(event, ...params);
  } catch (error) {
    console.error(error);

    const [, message] = error?.message?.split?.('Error:');

    if (!message) throw error;
    throw new Error(message);
  }
}
