import React from 'react';

export const Form = (props: IFormProps) => {
  const { children, id, onSubmit, onChange } = props;

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const element = e.target as HTMLFormElement;

    console.log(element.validity);

    const x = element.checkValidity();
    // const x = element.reportValidity();

    if (!x) return;

    onSubmit?.(e);
  };

  return (
    <form noValidate id={id} onSubmit={handleSubmit} onChange={onChange}>
      {children}
    </form>
  );
};

export interface IFormProps {
  id?: string;
  onChange?: React.FormEventHandler<HTMLFormElement>;
  onSubmit?: React.FormEventHandler<HTMLFormElement>;
  children?: React.ReactNode;
}
