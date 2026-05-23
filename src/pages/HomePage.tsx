import React from 'react';
import { Link } from 'react-router-dom';
import { motion, Variants } from 'framer-motion';
import { ArrowRight, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Navbar } from '@/components/layout/Navbar';
import { useUserStore } from '@/store/userStore';
const containerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1, delayChildren: 0.2 }
  }
};
const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.16, 1, 0.3, 1] }
  }
};
export function HomePage() {
  const user = useUserStore(state => state.user);
  const userExists = !!user;
  return (
    <div className="min-h-screen bg-background flex flex-col selection:bg-primary/20 overflow-x-hidden font-sans">
      <Navbar />
      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 text-center relative">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="max-w-5xl z-10 w-full"
        >
          <motion.h1
            variants={itemVariants}
            className="text-[11vw] xs:text-5xl sm:text-6xl md:text-8xl lg:text-9xl font-display font-black tracking-tighter text-foreground leading-[0.9] mb-12 sm:mb-16"
          >
            Продажа <br />
            аккаунтов <br />
            <span className="text-primary italic">Telegram</span>
          </motion.h1>
          <motion.div variants={itemVariants} className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6">
            <Link to="/store" className="w-full sm:w-auto">
              <Button
                size="lg"
                className="w-full sm:w-auto rounded-full px-10 md:px-16 h-18 md:h-20 text-lg md:text-xl font-black bg-foreground text-background hover:scale-105 active:scale-95 transition-all duration-300"
              >
                В магазин
                <ArrowRight className="ml-3 h-5 w-5" />
              </Button>
            </Link>
            <Link to={userExists ? "/profile" : "/auth"} className="w-full sm:w-auto">
              <Button
                variant="outline"
                size="lg"
                className="w-full sm:w-auto rounded-full px-10 md:px-12 h-18 md:h-20 text-lg md:text-xl font-black border-2 border bg-card hover:bg-accent transition-all duration-300"
              >
                {userExists ? "Профиль" : "Войти"}
                <User className="ml-3 h-5 w-5 opacity-40" />
              </Button>
            </Link>
          </motion.div>
        </motion.div>
        {/* Visual Background Decoration */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] sm:w-[600px] h-[300px] sm:h-[600px] bg-primary/5 rounded-full blur-[100px] -z-0 pointer-events-none" />
      </main>
      <footer className="py-8 border-t border-black/5 bg-black/[0.01]">
        <div className="container max-w-7xl mx-auto px-4 text-center">
          <p className="text-[10px] font-black text-muted-foreground/30 tracking-[0.6em] uppercase">
            © 2026 Milfa Sell
          </p>
        </div>
      </footer>
    </div>
  );
}