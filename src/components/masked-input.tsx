"use client";

type MaskedInputProps = {
  name: string;
  required?: boolean;
  placeholder?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>["inputMode"];
  autoComplete?: string;
  display: string;
  onDisplay: (next: string) => void;
  hiddenValue?: string;
};

export function MaskedInput({
  name,
  required,
  placeholder,
  inputMode,
  autoComplete,
  display,
  onDisplay,
  hiddenValue,
}: MaskedInputProps) {
  const submitted = hiddenValue ?? display;
  return (
    <>
      <input
        value={display}
        onChange={(event) => onDisplay(event.target.value)}
        placeholder={placeholder}
        inputMode={inputMode}
        autoComplete={autoComplete}
        required={required}
      />
      <input type="hidden" name={name} value={submitted} />
    </>
  );
}