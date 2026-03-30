/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useRef, useCallback } from "react";

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
 * Wraps the new google.maps.places.PlaceAutocompleteElement (web component).
 * Replaces the deprecated google.maps.places.Autocomplete.
 *
 * The element creates its own <input> inside shadow DOM.
 * We style it via CSS custom properties and ::part(input) in index.css.
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
  const initialValueSet = useRef(false);

  const onPlaceSelectRef = useRef(onPlaceSelect);
  const onInputChangeRef = useRef(onInputChange);
  const onEnterKeyRef = useRef(onEnterKey);
  useEffect(() => { onPlaceSelectRef.current = onPlaceSelect; }, [onPlaceSelect]);
  useEffect(() => { onInputChangeRef.current = onInputChange; }, [onInputChange]);
  useEffect(() => { onEnterKeyRef.current = onEnterKey; }, [onEnterKey]);

  const initElement = useCallback(() => {
    if (!containerRef.current || elementRef.current) return;
    if (!window.google?.maps?.places?.PlaceAutocompleteElement) return;

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

    // Access inner input for keyboard handlers, initial value, and change tracking
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
      }
    });
  }, [id, className, placeholder, initialValue]);

  useEffect(() => {
    initElement();
    return () => {
      if (elementRef.current && containerRef.current) {
        try { containerRef.current.removeChild(elementRef.current); } catch {}
      }
      elementRef.current = null;
      initialValueSet.current = false;
    };
  }, [initElement]);

  // Update initial value if it changes after mount
  useEffect(() => {
    if (!initialValue || !elementRef.current) return;
    const innerInput =
      elementRef.current.querySelector("input") ||
      elementRef.current.shadowRoot?.querySelector("input");
    if (innerInput && innerInput.value !== initialValue) {
      innerInput.value = initialValue;
    }
  }, [initialValue]);

  return (
    <div
      ref={containerRef}
      className={`place-autocomplete-container relative ${containerClassName}`}
    />
  );
}

/**
 * Helper: get the text value from a PlaceAutocompleteElement's inner input.
 * Useful when user types but doesn't select a suggestion.
 */
export function getPlaceInputValue(containerEl: HTMLElement | null): string {
  if (!containerEl) return "";
  const gmpEl = containerEl.querySelector("gmp-place-autocomplete");
  if (!gmpEl) return "";
  const input = gmpEl.querySelector("input") || (gmpEl as any).shadowRoot?.querySelector("input");
  return input?.value || "";
}
