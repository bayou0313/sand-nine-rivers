const Footer = () => {
  return (
    <footer className="py-8 bg-foreground">
      <div className="container mx-auto px-6 text-center">
        <p className="font-body text-background/60 text-sm">
          © {new Date().getFullYear()} RiverSand.net — Serving the Greater New Orleans Area
        </p>
      </div>
    </footer>
  );
};

export default Footer;
