export const normalizeAIModelList = (models?: string[]) =>
  (models || [])
    .map((model) => model.trim())
    .filter((model, index, allModels) => !!model && allModels.indexOf(model) === index);

export const getAIModelLabel = (model?: string) => model?.trim().replace(/_/g, ' ') || undefined;
