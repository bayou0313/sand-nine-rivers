import { useState } from "react";
import { Phone, Mail, MapPin, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

const ContactForm = () => {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
  };

  return (
    <section id="contact" className="py-24 bg-gradient-to-b from-sand-dark to-foreground">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <div className="space-y-10">
            <div>
              <p className="text-accent font-display text-lg tracking-widest mb-3">CONTACT</p>
              <h2 className="text-5xl md:text-7xl text-primary-foreground">TALK TO US</h2>
              <p className="font-body text-primary-foreground/60 mt-6 leading-relaxed text-lg">
                Ready to order or have questions? Reach out by phone, email, or fill out the form. We'll get back to you as soon as possible.
              </p>
            </div>

            <div className="space-y-5">
              <a href="tel:+18554689297" className="flex items-center gap-4 text-primary-foreground hover:text-accent transition-colors group">
                <div className="w-14 h-14 bg-primary-foreground/10 rounded-2xl flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Phone className="w-6 h-6 text-primary group-hover:text-accent" />
                </div>
                <div>
                  <p className="font-display text-lg tracking-widest">CALL US</p>
                  <p className="font-body text-primary-foreground/50">1-855-GOT-WAYS</p>
                </div>
              </a>
              <a href="mailto:info@riversand.net" className="flex items-center gap-4 text-primary-foreground hover:text-accent transition-colors group">
                <div className="w-14 h-14 bg-primary-foreground/10 rounded-2xl flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Mail className="w-6 h-6 text-primary group-hover:text-accent" />
                </div>
                <div>
                  <p className="font-display text-lg tracking-widest">EMAIL US</p>
                  <p className="font-body text-primary-foreground/50">info@riversand.net</p>
                </div>
              </a>
              <div className="flex items-center gap-4 text-primary-foreground">
                <div className="w-14 h-14 bg-primary-foreground/10 rounded-2xl flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-display text-lg tracking-widest">OUR YARD</p>
                  <p className="font-body text-primary-foreground/50">1215 River Rd, Bridge City, LA 70094</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-background rounded-2xl p-8 border border-border shadow-2xl">
            {submitted ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
                <CheckCircle2 className="w-16 h-16 text-primary" />
                <h3 className="font-display text-3xl text-foreground">MESSAGE SENT!</h3>
                <p className="font-body text-muted-foreground">We'll get back to you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="font-display text-2xl text-foreground tracking-wider mb-4">SEND US A MESSAGE</h3>
                <Input placeholder="Your Name" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 rounded-xl" />
                <Input type="email" placeholder="Email Address" required maxLength={255} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-12 rounded-xl" />
                <Input type="tel" placeholder="Phone Number" maxLength={20} value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="h-12 rounded-xl" />
                <Textarea placeholder="How can we help?" required maxLength={1000} rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="rounded-xl" />
                <Button type="submit" className="w-full h-12 font-display tracking-wider text-lg rounded-xl shadow-md shadow-primary/20">
                  <Send className="w-5 h-5 mr-2" />
                  SEND MESSAGE
                </Button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactForm;
