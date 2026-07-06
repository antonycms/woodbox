const ipcRenderer = window.electron?.ipcRenderer;

type CallErrorParams = {
  message?: string;
  position?: string;
};

type CallResult<IData> = {
  data: IData;
  error: CallErrorParams | null;
};

class CallError extends Error {
  position?: string;

  constructor(params: CallErrorParams = {}) {
    super(params?.message || 'unknown error');
    this.position = params?.position;
  }
}

/** Function to call backend application */
export default async function call<IData = unknown>(
  event: string,
  ...params: unknown[]
): Promise<IData> {
  const result = (await ipcRenderer.invoke(event, ...params)) as CallResult<IData>;

  const { data, error } = result;

  if (error) {
    throw new CallError(error);
  }

  return data;
}
