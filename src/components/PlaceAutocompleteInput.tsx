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
    onInputChangeRef.current?.(e.target.value);
  }, []);

  return (
    <div className={`place-autocomplete-container relative ${containerClassName}`}>
      <input
        ref={inputRef}
        type="text"
        id={id}
        placeholder={placeholder}
        className={`place-autocomplete-input w-full ${className}`}
        onKeyDown={handleKeyDown}
        onChange={handleChange}
        autoComplete="off"
      />
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
