import { Truck, Users, Shield, Clock } from "lucide-react";

const About = () => {
  return (
    <section id="about" className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <p className="text-primary font-display text-xl tracking-wider mb-2">ABOUT US</p>
          <h2 className="text-5xl md:text-6xl text-foreground">OUR STORY</h2>
          <p className="font-body text-muted-foreground mt-4 max-w-2xl mx-auto leading-relaxed">
            Based out of Bridge City, Louisiana, we've been providing quality river sand to the Greater New Orleans area for over 15 years. Our commitment is simple — deliver clean, screened sand on time, at a fair price, every single time.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mt-12">
          {[
            { icon: Truck, title: "RELIABLE FLEET", desc: "Our trucks are maintained and ready to deliver on your schedule." },
            { icon: Users, title: "LOCAL TEAM", desc: "We're your neighbors — a local, family-run operation you can trust." },
            { icon: Shield, title: "QUALITY MATERIAL", desc: "Clean, screened river sand perfect for any construction or landscaping project." },
            { icon: Clock, title: "FAST TURNAROUND", desc: "Same-day and next-day delivery available throughout our service area." },
          ].map((item) => (
            <div key={item.title} className="text-center p-6 bg-card border border-border rounded-lg hover:border-primary/50 transition-colors">
              <item.icon className="w-10 h-10 text-primary mx-auto mb-4" />
              <h3 className="font-display text-2xl text-foreground mb-2">{item.title}</h3>
              <p className="font-body text-muted-foreground text-sm leading-relaxed">{item.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default About;
