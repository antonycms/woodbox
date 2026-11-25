import React from 'react';
import { toAIChatImageDataUrl } from '@shared/utils/aiChatImages';
import type { IAIChatImage } from '@shared/types/ai';
import { useAIStore } from '@renderer/stores/AI';
import { useI18nStore } from '@renderer/stores/I18n';
import styles from './styles.module.css';

export const AIChatImagePreview = React.memo(({ image, draft }: { image: IAIChatImage; draft?: boolean }) => {
  const readImage = useAIStore((state) => state.readAIChatImage);
  const t = useI18nStore((state) => state.t);
  const [stored, setStored] = React.useState<{ id: string; url?: string }>();
  const { id, name, mimeType, data } = image;

  React.useEffect(() => {
    if (data) return;

    let active = true;
    readImage({ id, name, mimeType }).then(
      (url) => { if (active) setStored({ id, url }); },
      () => { if (active) setStored({ id }); },
    );
    return () => { active = false; };
  }, [data, id, mimeType, name, readImage]);

  const url = data ? toAIChatImageDataUrl(mimeType, data) : stored?.id === id ? stored.url : undefined;
  if (!url) {
    return <span className={styles.status}>{t(stored?.id === id ? 'aiChat.imageUnavailable' : 'aiChat.imageLoading')}</span>;
  }

  return <img className={draft ? styles.draft : styles.image} src={url} alt={name} draggable={false} />;
});

AIChatImagePreview.displayName = 'AIChatImagePreview';
