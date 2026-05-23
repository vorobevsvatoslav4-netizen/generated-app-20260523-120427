import * as React from 'react';
import { Link, useLocation, useNavigate, useInRouterContext } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Shield, LogOut, User as UserIcon, ShoppingBag, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ThemeToggle } from '@/components/ThemeToggle';
import { motion } from 'framer-motion';
import { useUserStore } from '@/store/userStore';
import { APP_CONFIG } from '@/lib/constants';
function NavbarContent() {
  const location = useLocation();
  const navigate = useNavigate();
  // Zustand - Atomic selectors
  const userExists = useUserStore(state => !!state.user);
  const userBalance = useUserStore(state => state.user?.balance);
  const userEmail = useUserStore(state => state.user?.email);
  const logout = useUserStore(state => state.logout);
  const isActive = (path: string) => location.pathname === path;
  const handleLogout = () => {
    logout();
    navigate('/');
  };
  const navItems = React.useMemo(() => [
    { name: 'Главная', path: '/' },
    { name: 'Магазин', path: '/store', icon: ShoppingBag },
    ...(userExists ? [{ name: 'Профиль', path: '/profile', icon: UserIcon }] : []),
    { name: 'Поддержка', path: APP_CONFIG.supportLink, external: true, icon: MessageCircle },
  ], [userExists]);
  return (
    <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
      <Link to="/" className="flex items-center gap-2 md:gap-3 group shrink-0">
        <motion.div
          whileHover={{ rotate: -5, scale: 1.05 }}
          className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl md:rounded-2xl bg-telegram shadow-lg shadow-primary/20 transition-all duration-300 group-hover:shadow-primary/40"
        >
          <Shield className="h-4 w-4 md:h-5 md:w-5 text-white" />
        </motion.div>
        <span className="text-lg md:text-xl font-display font-black tracking-tight text-foreground transition-opacity group-hover:opacity-80">
          Milfa Sell
        </span>
      </Link>
      <nav className="hidden lg:flex items-center gap-1">
        {navItems.map((item) => (
          item.external ? (
            <a
              key={item.path}
              href={item.path}
              target="_blank"
              rel="noopener noreferrer"
              className="relative px-5 py-2 text-sm font-bold transition-all hover:text-primary flex items-center gap-2 text-muted-foreground"
            >
              {item.name}
              {item.icon && <item.icon className="h-3.5 w-3.5 opacity-40" />}
            </a>
          ) : (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "relative px-5 py-2 text-sm font-bold transition-all hover:text-primary flex items-center gap-2",
                isActive(item.path) ? "text-primary" : "text-muted-foreground"
              )}
            >
              {item.icon && <item.icon className="h-4 w-4 opacity-70" />}
              {item.name}
              {isActive(item.path) && (
                <motion.div
                  layoutId="nav-active"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full mx-5"
                  transition={{ type: "spring", stiffness: 400, damping: 30 }}
                />
              )}
            </Link>
          )
        ))}
      </nav>
      <div className="flex items-center gap-2 md:gap-3">
        <ThemeToggle className="relative top-0 right-0 hover:bg-accent rounded-lg md:rounded-xl h-9 w-9 md:h-10 md:w-10 transition-colors" />
        {userExists ? (
          <div className="flex items-center gap-1.5 md:gap-2">
            <Link to="/profile" className="hidden xs:block">
              <Button variant="ghost" size="sm" className="rounded-lg md:rounded-xl h-9 md:h-10 gap-1.5 md:gap-2 hover:bg-accent px-2.5 md:px-4 border border-border bg-card/50">
                <span className="text-primary font-black text-[10px] sm:text-xs md:text-sm">${userBalance?.toFixed(2) ?? '0.00'}</span>
                <div className="h-3 md:h-4 w-px bg-border" />
                <span className="max-w-[50px] sm:max-w-[80px] md:max-w-[120px] truncate text-foreground font-bold text-[10px] sm:text-xs md:text-sm">{userEmail?.split('@')[0] ?? 'User'}</span>
              </Button>
            </Link>
            <Button
              variant="outline"
              size="icon"
              onClick={handleLogout}
              className="rounded-lg md:rounded-xl h-9 w-9 md:h-10 md:w-10 border-border hover:bg-destructive/10 hover:text-destructive hover:border-destructive/20 transition-all"
            >
              <LogOut className="h-3.5 w-3.5 md:h-4 md:w-4" />
            </Button>
          </div>
        ) : (
          <Link to="/auth">
            <Button className="rounded-lg md:rounded-xl h-9 md:h-10 px-4 md:px-6 text-[11px] md:text-sm font-black bg-telegram text-white shadow-lg shadow-primary/10 hover:shadow-primary/30 transition-all">
              Войти
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}
function NavbarFallback() {
  return (
    <div className="container max-w-7xl mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
      <div className="flex items-center gap-2 md:gap-3">
        <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-xl md:rounded-2xl bg-telegram shadow-lg shadow-primary/20">
          <Shield className="h-4 w-4 md:h-5 md:w-5 text-white" />
        </div>
        <span className="text-lg md:text-xl font-display font-black tracking-tight text-foreground/60">
          Milfa Sell
        </span>
      </div>
      <ThemeToggle className="relative top-0 right-0 hover:bg-accent rounded-lg md:rounded-xl h-9 w-9 md:h-10 md:w-10" />
    </div>
  );
}
export function Navbar() {
  const inRouter = useInRouterContext();
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/10 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      {inRouter ? <NavbarContent /> : <NavbarFallback />}
    </header>
  );
}