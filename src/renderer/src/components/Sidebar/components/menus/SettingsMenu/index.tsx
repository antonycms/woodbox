import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Text } from '@renderer/components/Text';
import { useThemeContext } from '@renderer/contexts/Theme';
import React from 'react';

const SettingsMenu = () => {
  const {
    activeTheme: { sideBar: colors },
  } = useThemeContext();

  return (
    <>
      <Text bold userSelect={false} color={colors.color}>
        Configurações Gerais
      </Text>
      <Divider />

      <Input
        label="Tamanho da Fonte"
        type="number"
        min="8"
        backgroundColor={colors.fieldBackgroundColor}
        color={colors.fieldColor}
      />
      <Input
        label="Cor do Texto"
        type="color"
        backgroundColor={colors.fieldBackgroundColor}
        color={colors.fieldColor}
      />

      <Divider />

      <Text bold userSelect={false} color={colors.color}>
        Configurações do Editor
      </Text>
      <Divider />

      <Input
        label="Tamanho da Fonte"
        type="number"
        min="8"
        backgroundColor={colors.fieldBackgroundColor}
        color={colors.fieldColor}
      />
      <Input
        label="Cor do Cursor"
        type="color"
        backgroundColor={colors.fieldBackgroundColor}
        color={colors.fieldColor}
      />
      <Input
        label="Cor das Palavras Reservadas"
        type="color"
        backgroundColor={colors.fieldBackgroundColor}
        color={colors.fieldColor}
      />
      <Input
        label="Cor das Funções"
        type="color"
        backgroundColor={colors.fieldBackgroundColor}
        color={colors.fieldColor}
      />
      <Input
        label="Cor dos Números"
        type="color"
        backgroundColor={colors.fieldBackgroundColor}
        color={colors.fieldColor}
      />
    </>
  );
};

export default React.memo(SettingsMenu);
