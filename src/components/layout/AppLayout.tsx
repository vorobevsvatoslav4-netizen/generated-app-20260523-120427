import React from "react";
import { Navbar } from "./Navbar";
import { Toaster } from "@/components/ui/sonner";
import { FloatingSupport } from "@/components/FloatingSupport";
type AppLayoutProps = {
  children: React.ReactNode;
  container?: boolean;
};
export function AppLayout({ children, container = true }: AppLayoutProps): JSX.Element {
  return (
    <div className="min-h-screen bg-background flex flex-col font-sans selection:bg-primary/30">
      <Navbar />
      <main className={`flex-1 ${container ? "container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 md:py-10" : ""}`}>
        {children}
      </main>
      <footer className="py-8 bg-black/[0.01] border-t border-border/5 mt-auto">
        <div className="container max-w-7xl mx-auto px-4 text-center">
          <p className="text-[10px] font-black text-muted-foreground/30 tracking-[0.6em] uppercase">
            © 2026 Milfa Sell
          </p>
        </div>
      </footer>
      <FloatingSupport />
      <Toaster richColors position="bottom-right" />
    </div>
  );
}