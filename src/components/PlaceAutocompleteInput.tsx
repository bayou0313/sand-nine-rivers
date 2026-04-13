// Stable Autocomplete — redeployed 2026-04-13
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useCallback, useState } from "react";

export interface PlaceSelectResult {
  formattedAddress: string;
  lat: number;
  lng: number;
  addressComponents?: any[];
}

export interface AddressMismatchData {
  typed: string;
  resolved: string;
  lat: number;
  lng: number;
  addressComponents: any[];
}

interface PlaceAutocompleteInputProps {
  onPlaceSelect: (result: PlaceSelectResult) => void;
  onAddressMismatch?: (data: AddressMismatchData) => void;
  onInputChange?: (value: string) => void;
  onEnterKey?: () => void;
  placeholder?: string;
  initialValue?: string;
  className?: string;
  id?: string;
  containerClassName?: string;
}

export default function PlaceAutocompleteInput({
  onPlaceSelect,
  onAddressMismatch,
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
  const resolvedAddressRef = useRef<string | null>(null);
  const [hasValue, setHasValue] = useState(
    !!(initialValue && initialValue.length > 0)
  );

  const onPlaceSelectRef = useRef(onPlaceSelect);
  const onAddressMismatchRef = useRef(onAddressMismatch);
  const onInputChangeRef = useRef(onInputChange);
  const onEnterKeyRef = useRef(onEnterKey);
  useEffect(() => { onPlaceSelectRef.current = onPlaceSelect; }, [onPlaceSelect]);
  useEffect(() => { onAddressMismatchRef.current = onAddressMismatch; }, [onAddressMismatch]);
  useEffect(() => { onInputChangeRef.current = onInputChange; }, [onInputChange]);
  useEffect(() => { onEnterKeyRef.current = onEnterKey; }, [onEnterKey]);

  useEffect(() => {
    if (!inputRef.current) return;

    const init = () => {
      if (autocompleteRef.current) return true;
      if (!window.google?.maps?.places?.Autocomplete) return false;

      try {
        const autocomplete = new window.google.maps.places.Autocomplete(inputRef.current!, {
          componentRestrictions: { country: "us" },
          fields: ["formatted_address", "geometry", "address_components"],
          language: "en",
        });

        autocomplete.addListener("place_changed", () => {
          const place = autocomplete.getPlace();
          console.log("[PlaceAutocompleteInput] place_changed fired", place);
          const lat = place.geometry?.location?.lat();
          const lng = place.geometry?.location?.lng();
          if (lat != null && lng != null) {
            const resolvedAddress = place.formatted_address || "";
            const typedAddress = inputRef.current?.value || "";

            const normalize = (s: string) => s
              .toLowerCase()
              .trim()
              .replace(/\./g, '')      // remove periods (U.S. → us)
              .replace(/\s+/g, ' ')   // normalize spaces
              .split(',')[0]           // first segment only
              .trim();

            // Compare first segment (street + number) to detect mismatches
            const typedFirst = normalize(typedAddress);
            const resolvedFirst = normalize(resolvedAddress);
            const addressesDiffer = typedFirst !== resolvedFirst
              && !resolvedFirst.includes(typedFirst)
              && !typedFirst.includes(resolvedFirst);

            if (addressesDiffer && onAddressMismatchRef.current) {
              console.log("[PlaceAutocompleteInput] Address mismatch detected", { typed: typedAddress, resolved: resolvedAddress });
              onAddressMismatchRef.current({
                typed: typedAddress,
                resolved: resolvedAddress,
                lat,
                lng,
                addressComponents: place.address_components || [],
              });
            } else {
              // Addresses match — proceed normally
              resolvedAddressRef.current = resolvedAddress;
              setHasValue(true);
              onInputChangeRef.current?.(resolvedAddress);
              onPlaceSelectRef.current({
                formattedAddress: resolvedAddress,
                lat,
                lng,
                addressComponents: place.address_components || [],
              });
            }
          }
        });

        autocompleteRef.current = autocomplete;
        console.log("[PlaceAutocompleteInput] Autocomplete initialized");
        return true;
      } catch (err) {
        console.error("[PlaceAutocompleteInput] init failed:", err);
        return false;
      }
    };

    if (init()) return;

    const interval = setInterval(() => {
      if (init()) clearInterval(interval);
    }, 300);

    return () => {
      clearInterval(interval);
      if (autocompleteRef.current) {
        window.google?.maps?.event?.clearInstanceListeners(autocompleteRef.current);
        autocompleteRef.current = null;
      }
    };
  }, []);

  const handleInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setHasValue(val.length > 0);
    if (resolvedAddressRef.current && val !== resolvedAddressRef.current) {
      resolvedAddressRef.current = null;
    }
    if (!resolvedAddressRef.current) {
      onInputChangeRef.current?.(val);
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      onEnterKeyRef.current?.();
    }
  }, []);

  const handleClear = useCallback(() => {
    if (inputRef.current) {
      inputRef.current.value = "";
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
        defaultValue={initialValue || ""}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        className={`w-full px-4 py-3 border border-input rounded-lg bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent ${className}`}
        autoComplete="off"
      />
      {hasValue && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 z-10 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted"
          aria-label="Clear address"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14"
            viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      )}
    </div>
  );
}

export function getPlaceInputValue(containerEl: HTMLElement | null): string {
  if (!containerEl) return "";
  const input = containerEl.querySelector("input") as HTMLInputElement | null;
  return input?.value || "";
}
