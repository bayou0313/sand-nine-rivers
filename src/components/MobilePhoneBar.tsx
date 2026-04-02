import { Phone } from "lucide-react";
import { useBusinessSettings } from "@/hooks/useBusinessSettings";

const MobilePhoneBar = () => {
  const biz = useBusinessSettings();

  return (
    <a
      href={`tel:${biz.phone_tel}`}
      className="fixed bottom-0 left-0 right-0 z-50 lg:hidden bg-primary flex items-center justify-center gap-3 py-3.5 shadow-[0_-4px_20px_rgba(0,0,0,0.3)]"
    >
      <Phone className="w-5 h-5 text-accent" />
      <span className="font-display text-accent text-lg tracking-wider">{biz.phone}</span>
    </a>
  );
};

export default MobilePhoneBar;
