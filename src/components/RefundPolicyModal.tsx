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
        <div className="space-y-4 font-body text-sm text-muted-foreground">
          <p className="font-semibold text-foreground text-base">WAYS® Materials LLC</p>
          <p>We understand that plans can change, and we aim to be as flexible as possible.</p>
          <p>Orders may be canceled at no penalty as long as the truck has not been loaded. Once materials are loaded for delivery, the order becomes non-refundable, due to the costs involved in preparing and dispatching your delivery.</p>
          <p>If your order is canceled before loading, you will receive a refund minus the payment processing fee. Please note that this fee is charged and retained by third-party payment processors, not by WAYS® Materials LLC, and is therefore non-refundable.</p>
          <p>We recommend reviewing your order details carefully before submitting to avoid any issues.</p>
          <p>If you need help or have questions, please call us at <a href="tel:+18554689297" className="text-accent underline font-medium whitespace-nowrap">1-855-GOT-WAYS</a> — our team is here to help.</p>
          <div className="bg-muted/50 rounded-xl p-3 text-xs mt-2">
            <p>By placing an order you agree to this refund and cancellation policy. WAYS® Materials LLC reserves the right to make final decisions on all refund requests.</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
