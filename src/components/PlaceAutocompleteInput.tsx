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
  containerClassName?: string;
}

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
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<any>(null);
  const [hasValue, setHasValue] = useState(
    !!(initialValue && initialValue.length > 0)
  );

  const onPlaceSelectRef = useRef(onPlaceSelect);
  const onInputChangeRef = useRef(onInputChange);
  const onEnterKeyRef = useRef(onEnterKey);
  useEffect(() => { onPlaceSelectRef.current = onPlaceSelect; }, [onPlaceSelect]);
  useEffect(() => { onInputChangeRef.current = onInputChange; }, [onInputChange]);
  useEffect(() => { onEnterKeyRef.current = onEnterKey; }, [onEnterKey]);

  useEffect(() => {
    if (!containerRef.current) return;

    const init = () => {
      if (elementRef.current) return true;
      if (!window.google?.maps?.places?.PlaceAutocompleteElement) return false;

      const el = new window.google.maps.places.PlaceAutocompleteElement({
        componentRestrictions: { country: "us" },
        types: ["address"],
      });

      el.style.width = "100%";
      el.style.display = "block";
      if (id) el.id = id;

      el.addEventListener("gmp-placeselect", async (event: any) => {
        const place = event.place;
        try {
          await place.fetchFields({
            fields: ["formattedAddress", "location", "addressComponents"],
          });
          const lat = place.location?.lat();
          const lng = place.location?.lng();
          if (lat != null && lng != null) {
            setHasValue(true);
            onInputChangeRef.current?.(place.formattedAddress || "");
            onPlaceSelectRef.current({
              formattedAddress: place.formattedAddress || "",
              lat,
              lng,
              addressComponents: place.addressComponents || [],
            });
          }
        } catch (err) {
          console.error("[PlaceAutocompleteInput] fetchFields failed:", err);
        }
      });

      el.addEventListener("input", (event: any) => {
        const val = event.target?.value || "";
        setHasValue(val.length > 0);
        onInputChangeRef.current?.(val);
      });

      el.addEventListener("keydown", (event: any) => {
        if (event.key === "Enter") {
          event.preventDefault();
          onEnterKeyRef.current?.();
        }
      });

      if (initialValue) {
        el.value = initialValue;
        setHasValue(true);
      }

      containerRef.current!.appendChild(el);
      elementRef.current = el;
      return true;
    };

    if (init()) return;

    const interval = setInterval(() => {
      if (init()) clearInterval(interval);
    }, 200);

    return () => {
      clearInterval(interval);
      if (elementRef.current && containerRef.current) {
        try { containerRef.current.removeChild(elementRef.current); } catch {}
        elementRef.current = null;
      }
    };
  }, []);

  const handleClear = useCallback(() => {
    if (elementRef.current) {
      elementRef.current.value = "";
    }
    setHasValue(false);
    onInputChangeRef.current?.("");
  }, []);

  return (
    <div ref={containerRef} className={`place-autocomplete-container relative ${containerClassName}`}>
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
  const el = containerEl.querySelector("gmp-placeautocomplete") as any;
  return el?.value || "";
}
