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
import FAQ from "@/components/FAQ";
import ContactForm from "@/components/ContactForm";
import Footer from "@/components/Footer";

const Index = () => {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Hero />
      <Pricing />
      <DeliveryEstimator />
      <About />
      <Stats />
      <RiverSandInfo />
      <Features />
      <Testimonials />
      <CTA />
      <FAQ />
      <ContactForm />
      <Footer />
    </div>
  );
};

export default Index;
