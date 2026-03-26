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
    // In production, this would send to a backend
    setSubmitted(true);
  };

  return (
    <section id="contact" className="py-20 bg-sand-dark">
      <div className="container mx-auto px-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl mx-auto">
          <div className="space-y-8">
            <div>
              <p className="text-accent font-display text-xl tracking-wider mb-2">CONTACT</p>
              <h2 className="text-5xl md:text-6xl text-primary-foreground">
                TALK TO US
              </h2>
              <p className="font-body text-primary-foreground/70 mt-4 leading-relaxed">
                Ready to order or have questions? Reach out by phone, email, or fill out the form. We'll get back to you as soon as possible.
              </p>
            </div>

            <div className="space-y-4">
              <a href="tel:+15551234567" className="flex items-center gap-4 text-primary-foreground hover:text-accent transition-colors group">
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Phone className="w-5 h-5 text-primary group-hover:text-accent" />
                </div>
                <div>
                  <p className="font-display text-lg tracking-wider">CALL US</p>
                  <p className="font-body text-primary-foreground/60">(555) 123-4567</p>
                </div>
              </a>
              <a href="mailto:info@riversand.net" className="flex items-center gap-4 text-primary-foreground hover:text-accent transition-colors group">
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Mail className="w-5 h-5 text-primary group-hover:text-accent" />
                </div>
                <div>
                  <p className="font-display text-lg tracking-wider">EMAIL US</p>
                  <p className="font-body text-primary-foreground/60">info@riversand.net</p>
                </div>
              </a>
              <div className="flex items-center gap-4 text-primary-foreground">
                <div className="w-12 h-12 bg-primary/20 rounded-lg flex items-center justify-center">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-display text-lg tracking-wider">OUR YARD</p>
                  <p className="font-body text-primary-foreground/60">1215 River Rd, Bridge City, LA 70094</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-background rounded-lg p-8 border border-border">
            {submitted ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-12">
                <CheckCircle2 className="w-16 h-16 text-primary" />
                <h3 className="font-display text-3xl text-foreground">MESSAGE SENT!</h3>
                <p className="font-body text-muted-foreground">We'll get back to you shortly.</p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                <h3 className="font-display text-2xl text-foreground tracking-wider mb-2">SEND US A MESSAGE</h3>
                <Input
                  placeholder="Your Name"
                  required
                  maxLength={100}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="h-12"
                />
                <Input
                  type="email"
                  placeholder="Email Address"
                  required
                  maxLength={255}
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className="h-12"
                />
                <Input
                  type="tel"
                  placeholder="Phone Number"
                  maxLength={20}
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  className="h-12"
                />
                <Textarea
                  placeholder="How can we help? (e.g., delivery date, project details)"
                  required
                  maxLength={1000}
                  rows={4}
                  value={form.message}
                  onChange={(e) => setForm({ ...form, message: e.target.value })}
                />
                <Button type="submit" className="w-full h-12 font-display tracking-wider text-lg">
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
