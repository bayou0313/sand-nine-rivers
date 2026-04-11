import type { PlaceSelectResult } from "@/components/PlaceAutocompleteInput";

let pendingPlace: PlaceSelectResult | null = null;

export function setPendingPlace(place: PlaceSelectResult): void {
  pendingPlace = place;
}

export function consumePendingPlace(): PlaceSelectResult | null {
  const place = pendingPlace;
  pendingPlace = null;
  return place;
}