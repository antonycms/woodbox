import React from "react";
import { Column, IGridSystem } from "../Grid";
import { generateHash } from "@renderer/utils/string";
import styles from './styles.module.css';

interface ActivatableSection extends IGridSystem {
  children?: React.ReactNode;
  title: string;
  color: string;
  backgroundColor: string;
  checked?: boolean;
  onChecked?(checked: boolean): void;
}

export function ActivatableSection(props: ActivatableSection) {
  const {
    title,
    checked,
    onChecked,
    children,
    color,
    backgroundColor,
    ...gridSystem
  } = props;

  const [id] = React.useState(generateHash(10));

  return (
    <Column {...gridSystem}>
      <section className={styles.section} style={{ color }}>
        <label className={styles.sectionToggle} style={{ backgroundColor }}>
          <span>{title}</span>

          <input
            type="checkbox"
            role="switch"
            checked={checked}
            aria-expanded={checked}
            aria-controls={id}
            onChange={(event) => onChecked?.(event.target.checked)}
          />
        </label>

        {checked && (
          <div id={id} className={styles.sectionFields}>
            {children}
          </div>
        )}
      </section>
    </Column>
  )
}