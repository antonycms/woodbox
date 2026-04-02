const ipcRederer = window.electron?.ipcRenderer;

class CallError extends Error {
  position?: string;

  constructor(params) {
    super(params?.message || 'unknown error');
    this.position = params?.position;
  }
}

/** Function to call backend application */
export default async function call<IData = any>(event: string, ...params): Promise<IData> {
  const result = await ipcRederer.invoke(event, ...params);

  const { data, error } = result;

  if (error) {
    throw new CallError(error);
  }

  return data;
}
