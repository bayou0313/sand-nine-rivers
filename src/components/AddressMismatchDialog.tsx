import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin } from "lucide-react";
import type { AddressMismatchData } from "@/components/PlaceAutocompleteInput";

interface AddressMismatchDialogProps {
  data: AddressMismatchData | null;
  onUseResolved: () => void;
  onKeepTyped: () => void;
  onChangeAddress: () => void;
}

export default function AddressMismatchDialog({
  data,
  onUseResolved,
  onChangeAddress,
}: AddressMismatchDialogProps) {
  if (!data) return null;

  return (
    <Dialog open={!!data} onOpenChange={(open) => { if (!open) onChangeAddress(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <MapPin className="w-5 h-5 text-accent" />
            Address Confirmed at Different ZIP
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Your address resolved to a different ZIP code. We've updated your delivery location.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
            <p className="text-xs font-medium text-accent uppercase tracking-wide mb-1">Delivering to</p>
            <p className="text-sm font-semibold text-foreground">{data.resolved}</p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">You entered</p>
            <p className="text-sm text-foreground">{data.typed}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={onUseResolved} className="w-full">
            Continue with confirmed address
          </Button>
          <Button variant="ghost" onClick={onChangeAddress} className="w-full text-muted-foreground">
            Change address
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
