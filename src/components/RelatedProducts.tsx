import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Truck } from "lucide-react";

const products = [
  { name: "Fill Dirt Delivery", path: "/products/fill-dirt" },
  { name: "Limestone Delivery", path: "/products/limestone" },
  { name: "Masonry Sand Delivery", path: "/products/masonry-sand" },
  { name: "Topsoil Delivery", path: "/products/topsoil" },
];

const RelatedProducts = () => {
  return (
    <section className="py-20 bg-background">
      <div className="container mx-auto px-6">
        <div className="text-center mb-12">
          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-3xl md:text-4xl text-foreground"
          >
            Also Available for Same-Day Delivery
          </motion.h2>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-4xl mx-auto">
          {products.map((product, i) => (
            <motion.div
              key={product.path}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
            >
              <Link
                to={product.path}
                className="flex flex-col items-center gap-3 p-6 bg-card border border-border rounded-2xl hover:border-accent/50 hover:shadow-lg transition-all duration-300 group text-center"
              >
                <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center group-hover:bg-accent/20 transition-colors">
                  <Truck className="w-6 h-6 text-primary group-hover:text-accent transition-colors" />
                </div>
                <span className="font-display text-foreground text-sm tracking-wider">
                  {product.name}
                </span>
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default RelatedProducts;
