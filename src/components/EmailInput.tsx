import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";

const DOMAINS = ["gmail.com", "yahoo.com", "aol.com", "outlook.com", "hotmail.com", "icloud.com"];

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

const EmailInput = ({ value, onChange, placeholder = "john@example.com", required, className, maxLength = 255, id, name, onFocus, onBlur }: EmailInputProps) => {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleChange = (val: string) => {
    onChange(val);
    const atIndex = val.indexOf("@");
    if (atIndex >= 1) {
      const typed = val.slice(atIndex + 1).toLowerCase();
      const matches = DOMAINS.filter((d) => d.startsWith(typed) && d !== typed);
      setSuggestions(matches.map((d) => val.slice(0, atIndex + 1) + d));
      setShowSuggestions(matches.length > 0);
      setSelectedIndex(-1);
    } else {
      setShowSuggestions(false);
    }
  };

  const selectSuggestion = (s: string) => {
    onChange(s);
    setShowSuggestions(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && selectedIndex >= 0) {
      e.preventDefault();
      selectSuggestion(suggestions[selectedIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <Input
        type="email"
        id={id}
        name={name}
        autoComplete="email"
        placeholder={placeholder}
        required={required}
        maxLength={maxLength}
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        onKeyDown={handleKeyDown}
        onFocus={(e) => { if (suggestions.length > 0) setShowSuggestions(true); onFocus?.(e); }}
onBlur={() => {
          setShowSuggestions(false);
          onBlur?.(value);
        }}
        className={className}
      />
      {showSuggestions && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-background border border-border rounded-lg shadow-lg overflow-hidden">
          {suggestions.map((s, i) => (
            <button
              key={s}
              type="button"
              onClick={() => selectSuggestion(s)}
              className={`w-full text-left px-3 py-2 text-sm font-body transition-colors ${
                i === selectedIndex ? "bg-accent/20 text-foreground" : "text-muted-foreground hover:bg-muted"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmailInput;
