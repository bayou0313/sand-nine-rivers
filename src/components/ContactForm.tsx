import { useState } from "react";
import { Phone, Mail, MapPin, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { formatPhone } from "@/lib/format";
import EmailInput from "@/components/EmailInput";
import BrandedConfirmation from "@/components/BrandedConfirmation";

const ContactForm = ({ cityName }: { cityName?: string }) => {
  const [submitted, setSubmitted] = useState(false);
  const [form, setForm] = useState({ name: "", email: "", phone: "", message: "" });
  const [sending, setSending] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSending(true);
    setSubmitted(true);

    supabase.functions.invoke("send-email", {
      body: { type: "contact", data: form },
    }).catch((err) => console.error("Contact email failed:", err))
      .finally(() => setSending(false));
  };

  if (submitted) {
    return (
      <BrandedConfirmation
        title="Message Sent!"
        subtitle="Thank you for reaching out. We'll get back to you as soon as possible."
        detail="Typical response time: within 2 hours during business hours"
      />
    );
  }

  return (
    <section id="contact" className="py-24 bg-muted/50">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <div className="space-y-10">
            <div>
              <p className="text-accent font-display text-lg tracking-widest mb-3">CONTACT</p>
              <h2 className="text-3xl md:text-4xl text-foreground">Talk to Us</h2>
              <p className="font-body text-muted-foreground mt-6 leading-relaxed text-lg">
                Ready to order or have questions? Reach out by phone, email, or fill out the form. We'll get back to you as soon as possible.
              </p>
            </div>

            <div className="space-y-5">
              <a href="tel:+18554689297" className="flex items-center gap-4 text-foreground hover:text-accent transition-colors group">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Phone className="w-6 h-6 text-primary group-hover:text-accent" />
                </div>
                <div>
                  <p className="font-display text-lg tracking-widest">CALL US</p>
                  <p className="font-body text-muted-foreground">1-855-GOT-WAYS</p>
                </div>
              </a>
              <a href="mailto:orders@riversand.net" className="flex items-center gap-4 text-foreground hover:text-accent transition-colors group">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Mail className="w-6 h-6 text-primary group-hover:text-accent" />
                </div>
                <div>
                  <p className="font-display text-lg tracking-widest">EMAIL US</p>
                  <p className="font-body text-muted-foreground">orders@riversand.net</p>
                </div>
              </a>
              <div className="flex items-center gap-4 text-foreground">
                <div className="w-14 h-14 bg-primary/10 rounded-2xl flex items-center justify-center">
                  <MapPin className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <p className="font-display text-lg tracking-widest">SERVICE AREA</p>
                  <p className="font-body text-muted-foreground">Greater New Orleans, LA</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-background rounded-2xl p-8 border border-border shadow-2xl">
            <form onSubmit={handleSubmit} className="space-y-4">
              <h3 className="font-display text-2xl text-foreground tracking-wider mb-4">SEND US A MESSAGE</h3>
              <div>
                <label htmlFor="contact-name" className="sr-only">Your Name</label>
                <Input id="contact-name" name="name" autoComplete="name" placeholder="Your Name" required maxLength={100} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-12 rounded-xl" />
              </div>
              <div>
                <label htmlFor="contact-email" className="sr-only">Email</label>
                <EmailInput id="contact-email" name="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required className="h-12 rounded-xl" />
              </div>
              <div>
                <label htmlFor="contact-phone" className="sr-only">Phone Number</label>
                <Input id="contact-phone" name="phone" type="tel" autoComplete="tel" placeholder="Phone Number" maxLength={14} value={form.phone} onChange={(e) => setForm({ ...form, phone: formatPhone(e.target.value) })} className="h-12 rounded-xl" />
              </div>
              <div>
                <label htmlFor="contact-message" className="sr-only">Message</label>
                <Textarea id="contact-message" name="message" placeholder="How can we help?" required maxLength={1000} rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} className="rounded-xl" />
              </div>
              <Button type="submit" disabled={sending} className="w-full h-12 font-display tracking-wider text-lg rounded-xl shadow-md shadow-primary/20">
                <Send className="w-5 h-5 mr-2" />
                SEND MESSAGE
              </Button>
            </form>
          </div>
        </div>
      </div>
    </section>
  );
};

export default ContactForm;
