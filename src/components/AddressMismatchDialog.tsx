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
  onKeepTyped,
  onChangeAddress,
}: AddressMismatchDialogProps) {
  if (!data) return null;

  return (
    <Dialog open={!!data} onOpenChange={(open) => { if (!open) onChangeAddress(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-foreground">
            <MapPin className="w-5 h-5 text-accent" />
            Address Confirmation
          </DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Google resolved your address to a different location.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-accent/30 bg-accent/5 p-3">
            <p className="text-xs font-medium text-accent uppercase tracking-wide mb-1">Resolved address</p>
            <p className="text-sm font-semibold text-foreground">{data.resolved}</p>
          </div>

          <div className="rounded-lg border border-border bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1">You entered</p>
            <p className="text-sm text-foreground">{data.typed}</p>
          </div>
        </div>

        <div className="flex flex-col gap-2 pt-2">
          <Button onClick={onUseResolved} className="w-full">
            Use resolved address
          </Button>
          <Button variant="outline" onClick={onKeepTyped} className="w-full">
            Keep my address
          </Button>
          <Button variant="ghost" onClick={onChangeAddress} className="w-full text-muted-foreground">
            Change address
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
