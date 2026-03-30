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
 * Wraps the new google.maps.places.PlaceAutocompleteElement (web component)
 * with an automatic fallback to the legacy Autocomplete widget when the
 * new API isn't available.
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
  const containerRef = useRef<HTMLDivElement>(null);
  const elementRef = useRef<any>(null);
  const fallbackInputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<any>(null);
  const initialValueSet = useRef(false);
  const [useFallback, setUseFallback] = useState(false);

  const onPlaceSelectRef = useRef(onPlaceSelect);
  const onInputChangeRef = useRef(onInputChange);
  const onEnterKeyRef = useRef(onEnterKey);
  useEffect(() => { onPlaceSelectRef.current = onPlaceSelect; }, [onPlaceSelect]);
  useEffect(() => { onInputChangeRef.current = onInputChange; }, [onInputChange]);
  useEffect(() => { onEnterKeyRef.current = onEnterKey; }, [onEnterKey]);

  const initElement = useCallback(() => {
    if (!containerRef.current || elementRef.current) return;

    // Try new PlaceAutocompleteElement first
    if (window.google?.maps?.places?.PlaceAutocompleteElement) {
      try {
        const el = new window.google.maps.places.PlaceAutocompleteElement({
          componentRestrictions: { country: "us" },
          types: ["address"],
        });

        if (id) el.id = id;
        el.classList.add("place-autocomplete-element");
        if (className) {
          className.split(/\s+/).forEach(c => c && el.classList.add(c));
        }

        el.addEventListener("gmp_placeselect", async (event: any) => {
          const place = event.place;
          if (!place) return;
          try {
            await place.fetchFields({
              fields: ["formattedAddress", "location", "addressComponents"],
            });
            const result: PlaceSelectResult = {
              formattedAddress: place.formattedAddress || "",
              lat: place.location?.lat() ?? 0,
              lng: place.location?.lng() ?? 0,
              addressComponents: place.addressComponents || [],
            };
            onPlaceSelectRef.current(result);
          } catch (e) {
            console.error("[PlaceAutocompleteInput] fetchFields error:", e);
          }
        });

        containerRef.current.appendChild(el);
        elementRef.current = el;

        requestAnimationFrame(() => {
          const innerInput =
            el.querySelector("input") ||
            el.shadowRoot?.querySelector("input");

          if (innerInput) {
            if (placeholder) innerInput.placeholder = placeholder;
            if (initialValue && !initialValueSet.current) {
              innerInput.value = initialValue;
              initialValueSet.current = true;
            }
            innerInput.addEventListener("keydown", (e: KeyboardEvent) => {
              if (e.key === "Enter") onEnterKeyRef.current?.();
            });
            innerInput.addEventListener("input", (e: Event) => {
              onInputChangeRef.current?.((e.target as HTMLInputElement).value);
            });
          } else {
            // Web component rendered but no inner input found — switch to fallback
            console.warn("[PlaceAutocompleteInput] No inner input found, using fallback");
            try { containerRef.current?.removeChild(el); } catch {}
            elementRef.current = null;
            setUseFallback(true);
          }
        });
        return;
      } catch (e) {
        console.warn("[PlaceAutocompleteInput] PlaceAutocompleteElement failed, using fallback:", e);
      }
    }

    // Fallback to legacy Autocomplete or plain input
    setUseFallback(true);
  }, [id, className, placeholder, initialValue]);

  // Initialize legacy Autocomplete on fallback input
  useEffect(() => {
    if (!useFallback || !fallbackInputRef.current || autocompleteRef.current) return;

    if (window.google?.maps?.places?.Autocomplete) {
      const ac = new window.google.maps.places.Autocomplete(fallbackInputRef.current, {
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
    }

    if (initialValue && fallbackInputRef.current && !initialValueSet.current) {
      fallbackInputRef.current.value = initialValue;
      initialValueSet.current = true;
    }
  }, [useFallback, initialValue]);

  useEffect(() => {
    if (!useFallback) {
      initElement();
    }
    return () => {
      if (elementRef.current && containerRef.current) {
        try { containerRef.current.removeChild(elementRef.current); } catch {}
      }
      elementRef.current = null;
      autocompleteRef.current = null;
      initialValueSet.current = false;
    };
  }, [initElement, useFallback]);

  // Update initial value if it changes after mount
  useEffect(() => {
    if (!initialValue) return;
    if (useFallback && fallbackInputRef.current) {
      if (fallbackInputRef.current.value !== initialValue) {
        fallbackInputRef.current.value = initialValue;
      }
      return;
    }
    if (elementRef.current) {
      const innerInput =
        elementRef.current.querySelector("input") ||
        elementRef.current.shadowRoot?.querySelector("input");
      if (innerInput && innerInput.value !== initialValue) {
        innerInput.value = initialValue;
      }
    }
  }, [initialValue, useFallback]);

  if (useFallback) {
    return (
      <div className={`place-autocomplete-container relative ${containerClassName}`}>
        <input
          ref={fallbackInputRef}
          type="text"
          id={id}
          placeholder={placeholder}
          className={`place-autocomplete-fallback w-full ${className}`}
          onKeyDown={(e) => { if (e.key === "Enter") onEnterKeyRef.current?.(); }}
          onChange={(e) => onInputChangeRef.current?.(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`place-autocomplete-container relative ${containerClassName}`}
    />
  );
}

/**
 * Helper: get the text value from the autocomplete input (works for both modes).
 */
export function getPlaceInputValue(containerEl: HTMLElement | null): string {
  if (!containerEl) return "";
  // Try new web component
  const gmpEl = containerEl.querySelector("gmp-place-autocomplete");
  if (gmpEl) {
    const input = gmpEl.querySelector("input") || (gmpEl as any).shadowRoot?.querySelector("input");
    return input?.value || "";
  }
  // Try fallback input
  const fallback = containerEl.querySelector<HTMLInputElement>(".place-autocomplete-fallback");
  return fallback?.value || "";
}
