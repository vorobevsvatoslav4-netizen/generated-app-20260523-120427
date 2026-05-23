import React from 'react';
import { motion } from 'framer-motion';
import { MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { APP_CONFIG } from '@/lib/constants';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
export function FloatingSupport() {
  const handleSupportClick = () => {
    window.open(APP_CONFIG.supportLink, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="fixed bottom-8 right-8 z-[100]">
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div
              initial={{ scale: 0, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              whileHover={{ scale: 1.1, rotate: 5 }}
              whileTap={{ scale: 0.9 }}
              transition={{ type: "spring", stiffness: 260, damping: 20 }}
            >
              <Button
                onClick={handleSupportClick}
                className="h-16 w-16 rounded-full bg-telegram shadow-2xl shadow-primary/40 flex items-center justify-center p-0 group overflow-hidden"
                aria-label="Служба поддержки"
              >
                <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                <MessageCircle className="h-7 w-7 text-white" />
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="left" className="bg-card border-white/5 text-foreground font-black text-[10px] uppercase tracking-widest px-4 py-2 rounded-xl zen-shadow mb-2">
            Тех. Поддержка
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}