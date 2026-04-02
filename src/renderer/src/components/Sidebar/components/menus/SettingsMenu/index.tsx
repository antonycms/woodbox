import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Text } from '@renderer/components/Text';
import React from 'react';

const SettingsMenu = () => {
  return (
    <>
      <Text bold userSelect={false}>
        Configurações Gerais
      </Text>
      <Divider />

      <Input label="Tamanho da Fonte" type="number" min="8" />
      <Input label="Cor do Texto" type="color" />

      <Divider />

      <Text bold userSelect={false}>
        Configurações do Editor
      </Text>
      <Divider />

      <Input label="Tamanho da Fonte" type="number" min="8" />
      <Input label="Cor do Cursor" type="color" />
      <Input label="Cor das Palavras Reservadas" type="color" />
      <Input label="Cor das Funções" type="color" />
      <Input label="Cor dos Números" type="color" />
    </>
  );
};

export default React.memo(SettingsMenu);
