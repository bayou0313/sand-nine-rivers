/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useCallback, useState } from "react";

export interface PlaceSelectResult {
  formattedAddress: string;
  lat: number;
  lng: number;
  addressComponents?: any[];
}

interface PlaceAutocompleteInputProps {
  onPlaceSelect: (result: PlaceSelectResult) => void;
  onInputChange?: (value: string) => void;
  onEnterKey?: () => void;
  placeholder?: string;
  initialValue?: string;
  className?: string;
  id?: string;
  /** Extra CSS class on the container div */
  containerClassName?: string;
}

/**
 * Google Places Autocomplete input using the legacy Autocomplete widget
 * wrapped around a standard <input> for full styling control.
 */
export default function PlaceAutocompleteInput({
  onPlaceSelect,
  onInputChange,
  onEnterKey,
  placeholder = "Enter your delivery address...",
  initialValue,
  className = "",
  id,
  containerClassName = "",
}: PlaceAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const [ready, setReady] = useState(false);
  const [hasValue, setHasValue] = useState(
    !!(initialValue && initialValue.length > 0)
  );

  const onPlaceSelectRef = useRef(onPlaceSelect);
  const onInputChangeRef = useRef(onInputChange);
  const onEnterKeyRef = useRef(onEnterKey);
  useEffect(() => { onPlaceSelectRef.current = onPlaceSelect; }, [onPlaceSelect]);
  useEffect(() => { onInputChangeRef.current = onInputChange; }, [onInputChange]);
  useEffect(() => { onEnterKeyRef.current = onEnterKey; }, [onEnterKey]);

  // Poll for Google Maps readiness then init Autocomplete
  useEffect(() => {
    if (!inputRef.current) return;

    const init = () => {
      if (autocompleteRef.current || !inputRef.current) return;
      if (!window.google?.maps?.places?.Autocomplete) return false;

      const ac = new window.google.maps.places.Autocomplete(inputRef.current!, {
        componentRestrictions: { country: "us" },
        types: ["address"],
        fields: ["formatted_address", "geometry", "address_components"],
      });

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place?.geometry?.location) return;
        const result: PlaceSelectResult = {
          formattedAddress: place.formatted_address || "",
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
          addressComponents: place.address_components || [],
        };
        onPlaceSelectRef.current(result);
      });

      autocompleteRef.current = ac;
      setReady(true);
      return true;
    };

    if (init()) return;

    // Poll until Google Maps loads
    const interval = setInterval(() => {
      if (init()) clearInterval(interval);
    }, 200);

    return () => clearInterval(interval);
  }, []);

  // Set initial value
  useEffect(() => {
    if (initialValue && inputRef.current && !inputRef.current.value) {
      inputRef.current.value = initialValue;
    }
  }, [initialValue, ready]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnterKeyRef.current?.();
    }
  }, []);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setHasValue(e.target.value.length > 0);
    onInputChangeRef.current?.(e.target.value);
  }, []);

  const handleClear = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = "";
      inputRef.current.focus();
    }
    setHasValue(false);
    onInputChangeRef.current?.("");
  }, []);

  return (
    <div className={`place-autocomplete-container relative ${containerClassName}`}>
      <input
        ref={inputRef}
        type="text"
        id={id}
        placeholder={placeholder}
        className={`place-autocomplete-input w-full ${hasValue ? "pr-8" : ""} ${className}`}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        autoComplete="off"
      />
      {hasValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted"
          aria-label="Clear address"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" 
            viewBox="0 0 24 24" fill="none" stroke="currentColor" 
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      )}
    </div>
  );
}

/**
 * Helper: get the text value from the autocomplete input.
 */
export function getPlaceInputValue(containerEl: HTMLElement | null): string {
  if (!containerEl) return "";
  const input = containerEl.querySelector<HTMLInputElement>(".place-autocomplete-input");
  return input?.value || "";
}
