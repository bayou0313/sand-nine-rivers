import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

interface RefundPolicyModalProps {
  open: boolean;
  onClose: () => void;
}

export default function RefundPolicyModal({ open, onClose }: RefundPolicyModalProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading text-lg">Refund &amp; Cancellation Policy</DialogTitle>
          <DialogDescription className="sr-only">Full refund and cancellation policy for WAYS® Materials LLC</DialogDescription>
        </DialogHeader>
        <div className="space-y-4 font-body text-sm text-muted-foreground leading-relaxed">
          <p className="font-semibold text-foreground">All sales are final.</p>
          <p>
            Orders placed through RiverSand.net are non-refundable once submitted. This applies to all payment
            methods including credit/debit card and cash-on-delivery.
          </p>
          <p>
            <span className="font-medium text-foreground">Processing fees</span> are non-refundable under any
            circumstances. These fees cover payment processing costs incurred at the time of transaction.
          </p>
          <p>
            Once an order is placed, our dispatch team begins scheduling and allocating resources for your
            delivery. Because of the operational costs involved — including truck routing, driver scheduling,
            and material preparation — we are unable to offer refunds or cancellations.
          </p>
          <p>
            If you have questions or concerns about your order, please contact us at{" "}
            <a href="tel:+19045791285" className="text-primary underline">(904) 579-1285</a> and we will do
            our best to accommodate your needs.
          </p>
          <p className="text-xs text-muted-foreground/70 pt-2 border-t border-border">
            WAYS® Materials LLC · RiverSand.net
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
