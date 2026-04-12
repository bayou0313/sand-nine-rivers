import { Input } from "@/components/ui/input";

interface EmailInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  className?: string;
  maxLength?: number;
  id?: string;
  name?: string;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: (value: string) => void;
}

const EmailInput = ({ 
  value, 
  onChange, 
  placeholder = "john@example.com", 
  required, 
  className, 
  maxLength = 255, 
  id, 
  name, 
  onFocus, 
  onBlur 
}: EmailInputProps) => {
  return (
    <Input
      type="email"
      id={id}
      name={name}
      autoComplete="email"
      placeholder={placeholder}
      required={required}
      maxLength={maxLength}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onFocus={onFocus}
      onBlur={() => onBlur?.(value)}
      className={className}
    />
  );
};

export default EmailInput;
