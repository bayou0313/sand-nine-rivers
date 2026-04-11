import { useNavigate } from "react-router-dom";
import { useCountdown } from "@/hooks/use-countdown";
import { useGoogleMaps } from "@/hooks/useGoogleMaps";
import PlaceAutocompleteInput, { type PlaceSelectResult } from "@/components/PlaceAutocompleteInput";

declare global {
  interface Window { google: any; }
}

const LOGO_WHITE = "/lovable-uploads/riversand-logo_WHITE-2.png";

const HomeMobile = () => {
  const navigate = useNavigate();
  const { timeLeft, label } = useCountdown();
  const { loaded: apiLoaded } = useGoogleMaps();

  const handlePlaceSelect = (result: PlaceSelectResult) => {
    sessionStorage.setItem("mobile_prefill_address", result.formattedAddress);
    sessionStorage.setItem("mobile_prefill_place", JSON.stringify(result));
    navigate("/order");
  };

  const handleViewFullSite = () => {
    localStorage.setItem("force_desktop", "true");
    navigate("/");
    window.location.reload();
  };

  return (
    <div className="min-h-dvh flex flex-col" style={{ backgroundColor: "hsl(var(--primary))" }}>
      {/* Header */}
      <header className="flex items-center justify-center px-5 pt-5 pb-2">
        <img src={LOGO_WHITE} alt="River Sand" className="object-contain" style={{ width: '50%', maxWidth: '200px' }} />
      </header>

      {/* Hero */}
      <div className="flex-1 flex flex-col justify-center px-5 pb-4">
        <div className="text-center mb-8">
          <h1 className="font-display text-5xl text-white tracking-wide leading-[1.1] mb-3">
            SAME-DAY RIVER SAND DELIVERY
          </h1>
          <p className="font-body text-base text-accent">
            Get your exact price in seconds — no account needed
          </p>
          <div className="flex items-center justify-center gap-3 mt-4 font-body text-xs text-white/60">
            <span>✓ No minimums</span>
            <span>·</span>
            <span>✓ Cash or card</span>
            <span>·</span>
            <span>✓ Gulf South</span>
          </div>
        </div>

        {/* Address input */}
        <div className="mb-6">
          <p className="font-display text-xs text-accent tracking-[0.2em] uppercase mb-2 text-center">
            DELIVERY ADDRESS
          </p>
          {apiLoaded ? (
            <PlaceAutocompleteInput
              onPlaceSelect={handlePlaceSelect}
              onInputChange={() => {}}
              placeholder="Enter your delivery address"
              id="home-mobile-address"
              containerClassName="place-autocomplete-embedded"
            />
          ) : (
            <div className="h-16 rounded-2xl border border-white/20 bg-white/10 animate-pulse" />
          )}
          <p className="font-body text-xs text-white/40 text-center mt-2">
            Serving New Orleans, Metairie, Chalmette &amp; surrounding areas
          </p>
        </div>

        {/* Countdown */}
        {label && (
          <div className="text-center mb-6">
            <p className="font-body text-sm text-accent">
              {label} <span className="font-semibold">{timeLeft}</span>
            </p>
          </div>
        )}

        {/* Social proof */}
        <div className="flex items-center justify-center gap-0 font-body text-xs text-white/70 text-center">
          <span>15,000+ Loads</span>
          <span className="mx-2 text-accent/50">|</span>
          <span>Same-Day Available</span>
          <span className="mx-2 text-accent/50">|</span>
          <span>⭐ 4.9 Rating</span>
        </div>
      </div>

      {/* Footer */}
      <div className="px-5 pb-6 space-y-3">
        <a
          href="tel:+18554689297"
          className="flex items-center justify-center w-full h-14 rounded-2xl font-display text-xl tracking-wide"
          style={{ backgroundColor: "hsl(var(--accent))", color: "hsl(var(--primary))" }}
        >
          📞 1-855-GOT-WAYS
        </a>
        <div className="flex flex-col items-center gap-1 mt-3">
          <span className="font-body text-xs text-white/50">Operated by</span>
          <img 
            src="https://lclbexhytmpfxzcztzva.supabase.co/storage/v1/object/public/assets/Ways_Sitewide_Logo_white.png"
            alt="WAYS®"
            className="h-8"
          />
        </div>
        <button
          onClick={handleViewFullSite}
          className="w-full text-center font-body text-xs text-white/40 py-2"
        >
          View full site →
        </button>
      </div>
    </div>
  );
};

export default HomeMobile;
