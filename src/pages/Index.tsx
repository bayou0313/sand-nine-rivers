import { useState, useEffect, useCallback } from "react";
import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import DeliveryEstimator from "@/components/DeliveryEstimator";
import About from "@/components/About";
import Stats from "@/components/Stats";
import RiverSandInfo from "@/components/RiverSandInfo";
import Features from "@/components/Features";
import Testimonials from "@/components/Testimonials";
import CTA from "@/components/CTA";
import FAQ from "@/components/FAQ";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import MobilePhoneBar from "@/components/MobilePhoneBar";
import ScrollToTop from "@/components/ScrollToTop";
import WhatsAppButton from "@/components/WhatsAppButton";
import ReturnVisitorBanner from "@/components/ReturnVisitorBanner";
import { initSession, getSession, incrementVisitCount, updateSession } from "@/lib/session";

const Index = () => {
  const [session, setSession] = useState<any>(null);
  const [returnAddress, setReturnAddress] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      await initSession();
      await incrementVisitCount();
      await updateSession({ stage: "visited" });
      const s = await getSession();
      setSession(s);
    };
    init();
  }, []);

  const handleRecalculate = useCallback((address: string) => {
    setReturnAddress(address);
    // Scroll to estimator
    const el = document.getElementById("estimator");
    if (el) el.scrollIntoView({ behavior: "smooth" });
  }, []);

  return (
    <div className="min-h-screen pb-14 lg:pb-0">
      <Navbar />
      <ReturnVisitorBanner session={session} onRecalculate={handleRecalculate} />
      <Hero />
      <Stats />
      <DeliveryEstimator prefillAddress={returnAddress} />
      <About />
      <RiverSandInfo />
      <Features />
      <Testimonials />
      <CTA />
      <FAQ />
      <ContactForm />
      <Footer />
      <MobilePhoneBar />
      <ScrollToTop />
      <WhatsAppButton />
    </div>
  );
};

export default Index;
