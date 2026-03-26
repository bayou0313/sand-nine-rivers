import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Pricing from "@/components/Pricing";
import DeliveryEstimator from "@/components/DeliveryEstimator";
import About from "@/components/About";
import Stats from "@/components/Stats";
import RiverSandInfo from "@/components/RiverSandInfo";
import Features from "@/components/Features";
import Testimonials from "@/components/Testimonials";
import CTA from "@/components/CTA";
import RelatedProducts from "@/components/RelatedProducts";
import FAQ from "@/components/FAQ";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";
import MobilePhoneBar from "@/components/MobilePhoneBar";
import ScrollToTop from "@/components/ScrollToTop";
import WhatsAppButton from "@/components/WhatsAppButton";

const Index = () => {
  return (
    <div className="min-h-screen pb-14 lg:pb-0">
      <Navbar />
      <Hero />
      <Stats />
      <Pricing />
      <DeliveryEstimator />
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
