import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription as UICardDescription } from '@/components/ui/card';
import {
  Wallet, Eye, EyeOff,
  RefreshCcw, Copy, Loader2, Lock,
  ExternalLink, Key, Sparkles,
  Wifi, ShieldCheck, Info
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api } from '@/lib/api-client';
import type { User, TelegramAccount, CreateInvoiceResponse, GetCodeResponse } from '@shared/types';
import { toast } from 'sonner';
import { Link, useNavigate } from 'react-router-dom';
import { useUserStore } from '@/store/userStore';
import { cn } from '@/lib/utils';
import { APP_CONFIG, CATEGORIES_RUS } from '@/lib/constants';
const INVOICE_STORE_KEY = 'latest_milfa_invoice';
const getFlagEmoji = (countryCode?: string) => {
  const codes: Record<string, string> = { 'US': '🇺🇸', 'GB': '🇬🇧', 'RU': '🇷🇺', 'NL': '🇳🇱', 'KZ': '🇰🇿' };
  return codes[countryCode || ''] || '🏳️';
};
export function ProfilePage() {
  const navigate = useNavigate();
  const [purchases, setPurchases] = useState<TelegramAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [depositing, setDepositing] = useState(false);
  const [revealedIds, setRevealedIds] = useState<Set<string>>(new Set());
  const [showTopUpDialog, setShowTopUpDialog] = useState(false);
  const [depositAmount, setDepositAmount] = useState<string>("1");
  const [retrievingCodeId, setRetrievingCodeId] = useState<string | null>(null);
  const [retrievedCodes, setRetrievedCodes] = useState<Record<string, GetCodeResponse>>({});
  // Zustand selectors
  const userEmail = useUserStore((state) => state.user?.email ?? '');
  const userBalance = useUserStore((state) => state.user?.balance ?? 0);
  const setUser = useUserStore((state) => state.setUser);
  const pollingIntervals = useRef<Record<string, number>>({});
  const fetchData = useCallback(async () => {
    if (!userEmail) return;
    try {
      const u = await api<User>(`/profile/${encodeURIComponent(userEmail)}`);
      setUser(u);
      const p = await api<TelegramAccount[]>(`/profile/${encodeURIComponent(userEmail)}/purchases`);
      setPurchases(p || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [userEmail, setUser]);
  useEffect(() => {
    if (!userEmail) { navigate('/auth'); return; }
    fetchData();
  }, [userEmail, navigate, fetchData]);
  useEffect(() => {
    const intervals = pollingIntervals.current;
    return () => {
      Object.values(intervals).forEach((id) => {
        if (id) window.clearInterval(id);
      });
    };
  }, []);
  const handleGetCode = useCallback(async (accountId: string, isPoll = false) => {
    if (!userEmail) return;
    if (!isPoll) setRetrievingCodeId(accountId);
    try {
      const res = await api<GetCodeResponse>(`/accounts/get-code/${accountId}?email=${encodeURIComponent(userEmail)}`);
      setRetrievedCodes(prev => ({ ...prev, [accountId]: res }));
      if (res.status === 'ready') {
        if (pollingIntervals.current[accountId]) {
          window.clearInterval(pollingIntervals.current[accountId]);
          delete pollingIntervals.current[accountId];
        }
        if (!isPoll) toast.success("Код успешно получен!");
      } else if (res.status === 'waiting') {
        if (!pollingIntervals.current[accountId]) {
          const intervalId = window.setInterval(() => {
            handleGetCode(accountId, true);
          }, 5000) as unknown as number;
          
          // Re-check if we still need this interval (state might have changed during async)
          if (!pollingIntervals.current[accountId]) {
            pollingIntervals.current[accountId] = intervalId;
            if (!isPoll) toast.info("Подключение к аккаунту...");
          } else {
            window.clearInterval(intervalId);
          }
        }
      } else {
        if (pollingIntervals.current[accountId]) {
          window.clearInterval(pollingIntervals.current[accountId]);
          delete pollingIntervals.current[accountId];
        }
      }
    } catch (err) {
      if (!isPoll) toast.error("Ошибка при запросе кода");
    } finally {
      if (!isPoll) setRetrievingCodeId(null);
    }
  }, [userEmail]);
  const handleDepositInitiate = async () => {
    const amountNum = parseFloat(depositAmount);
    if (isNaN(amountNum) || amountNum < APP_CONFIG.minDeposit) {
      toast.error(`Минимум: ${APP_CONFIG.minDeposit}`);
      return;
    }
    setDepositing(true);
    try {
      const res = await api<CreateInvoiceResponse>('/payments/create-invoice', {
        method: 'POST',
        body: JSON.stringify({ amount: amountNum, email: userEmail })
      });
      if (res.payUrl) {
        setShowTopUpDialog(false);
        window.open(res.payUrl, '_blank');
        toast.success("Счет открыт в Crypto Bot");
      }
    } catch (err) {
      toast.error('Ошибка создания счета');
    } finally {
      setDepositing(false);
    }
  };
  const handleVerifyPayment = async () => {
    setVerifying(true);
    try {
      await fetchData();
      toast.info('Проверка статуса оплаты...');
    } finally {
      setVerifying(false);
    }
  };
  if (loading) return <div className="min-h-screen flex items-center justify-center bg-background"><Loader2 className="h-12 w-12 animate-spin opacity-20" /></div>;
  return (
    <AppLayout>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-4 space-y-6">
          <Card className="rounded-[2.5rem] bg-card/50 glass-effect border-white/5 overflow-hidden zen-shadow">
            <CardHeader className="text-center py-12">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="mx-auto h-16 w-16 rounded-[1.5rem] bg-telegram flex items-center justify-center shadow-2xl mb-4"
              >
                <Wallet className="h-8 w-8 text-white" />
              </motion.div>
              <CardTitle className="text-4xl font-display font-black tracking-tighter text-glow text-primary">${Number(userBalance).toFixed(2)}</CardTitle>
              <UICardDescription className="text-[10px] font-mono opacity-40 mt-3 truncate px-4">{userEmail}</UICardDescription>
            </CardHeader>
            <CardContent className="px-6 pb-10 space-y-3">
              <Button className="w-full rounded-2xl h-14 text-lg font-black bg-telegram shadow-xl transition-all" onClick={() => setShowTopUpDialog(true)}>Пополнить</Button>
              <Button variant="outline" className="w-full rounded-2xl h-12 border-primary/20 text-primary font-bold hover:bg-primary/5" onClick={handleVerifyPayment} disabled={verifying}>
                {verifying ? <Loader2 className="animate-spin mr-2" /> : <RefreshCcw className="h-4 w-4 mr-2" />} Проверить оплату
              </Button>
            </CardContent>
          </Card>
        </div>
        <div className="lg:col-span-8 space-y-4">
          <h2 className="text-2xl font-display font-black px-2 flex items-center gap-3">
            Инвентарь <Sparkles className="h-5 w-5 text-primary" />
          </h2>
          {purchases.length > 0 ? (
            <div className="space-y-4">
              {purchases.map((item) => {
                const retrieved = retrievedCodes[item.id];
                const isRevealed = revealedIds.has(item.id);
                const isPolling = !!retrieved && retrieved.status === 'waiting';
                return (
                  <Card key={item.id} className="border-white/5 bg-card/50 glass-effect rounded-[2rem] overflow-hidden zen-shadow p-8 flex flex-col md:flex-row gap-8">
                    <div className="flex-1 space-y-6">
                      <div className="flex items-center gap-4">
                        <span className="text-4xl">{getFlagEmoji(item.countryCode)}</span>
                        <div>
                          <h4 className="text-lg font-black uppercase tracking-tight">{item.country} SESSION</h4>
                          <Badge className="bg-primary/10 text-primary uppercase text-[8px] tracking-widest border-none">
                            {CATEGORIES_RUS[item.category as keyof typeof CATEGORIES_RUS] || item.category}
                          </Badge>
                        </div>
                      </div>
                      <div className="relative group">
                        {retrieved && retrieved.status === 'ready' ? (
                          <motion.div
                            initial={{ y: 10, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="p-6 rounded-[1.5rem] bg-primary/10 border border-primary/20 flex items-center justify-between"
                          >
                            <div className="space-y-1">
                              <p className="text-5xl font-display font-black text-primary tracking-[0.2em]">{retrieved.code}</p>
                              <span className="text-[9px] font-black uppercase text-primary/60 tracking-wider flex items-center gap-1.5">
                                <ShieldCheck className="h-3 w-3" /> Код получен
                              </span>
                            </div>
                            <Button className="rounded-xl h-12 w-12 bg-telegram shadow-lg" onClick={() => { navigator.clipboard.writeText(retrieved.code); toast.success('Код скопирован'); }} size="icon">
                              <Copy className="h-5 w-5" />
                            </Button>
                          </motion.div>
                        ) : (
                          <Button
                            className={cn(
                              "w-full h-16 rounded-2xl font-black shadow-lg gap-3 transition-all text-lg",
                              isPolling ? "bg-muted text-muted-foreground cursor-wait" : "bg-telegram text-white"
                            )}
                            onClick={() => handleGetCode(item.id)}
                            disabled={retrievingCodeId === item.id || isPolling}
                          >
                            {retrievingCodeId === item.id ? (
                               <div className="flex items-center gap-3">
                                 <Loader2 className="animate-spin h-5 w-5" />
                                 <span>ПОДКЛЮЧЕНИЕ...</span>
                               </div>
                            ) : isPolling ? (
                               <div className="flex items-center gap-3">
                                 <Wifi className="animate-pulse h-5 w-5 text-primary" />
                                 <span>ОЖИДАНИЕ КОДА...</span>
                               </div>
                            ) : (
                              <><Key className="h-5 w-5" /> ПОЛУЧИТЬ КОД</>
                            )}
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="w-full md:w-[240px] bg-black/10 rounded-2xl p-6 space-y-3 border border-white/5">
                      <div className="flex justify-between items-center border-b border-white/5 pb-2">
                        <label className="text-[9px] font-black uppercase opacity-40 flex items-center gap-1.5"><Info className="h-3 w-3" /> Сессия</label>
                        <button onClick={() => {
                          const next = new Set(revealedIds);
                          if(next.has(item.id)) next.delete(item.id); else next.add(item.id);
                          setRevealedIds(next);
                        }} className="text-primary">
                          {isRevealed ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                      <div className={cn("text-[8px] font-mono break-all max-h-[100px] overflow-auto scrollbar-hide", !isRevealed && "blur-xl select-none opacity-10")}>
                        {item.details || "Нет данных"}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="py-24 text-center rounded-[2.5rem] border-2 border-dashed border-white/5 bg-card/50">
              <Sparkles className="h-16 w-16 text-primary/10 mx-auto mb-6" />
              <p className="text-muted-foreground font-bold mb-8">У вас пока нет покупок.</p>
              <Link to="/store">
                <Button className="rounded-full px-12 h-16 text-lg font-black bg-telegram shadow-2xl">В МАГАЗИН</Button>
              </Link>
            </div>
          )}
        </div>
      </div>
      <Dialog open={showTopUpDialog} onOpenChange={setShowTopUpDialog}>
        <DialogContent className="rounded-[2.5rem] border-white/5 bg-card/95 p-8 zen-shadow sm:max-w-[400px]">
          <DialogHeader className="mb-6 text-center">
            <DialogTitle className="text-2xl font-black">Crypto Pay</DialogTitle>
            <DialogDescription className="text-xs font-medium text-muted-foreground mt-2">
              Введите сумму в USD. Пополнение через Telegram @CryptoBot.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 mb-8">
             <div className="relative group">
                <Input
                  type="number"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  min={APP_CONFIG.minDeposit}
                  className="h-16 rounded-xl bg-black/10 border-none text-3xl font-black text-center"
                />
             </div>
          </div>
          <DialogFooter className="gap-3">
            <Button variant="ghost" onClick={() => setShowTopUpDialog(false)} className="rounded-xl h-12 font-bold hover:text-destructive">Отмена</Button>
            <Button onClick={handleDepositInitiate} className="rounded-xl h-12 flex-1 font-black bg-telegram shadow-lg" disabled={depositing}>
                {depositing ? <Loader2 className="animate-spin" /> : <>Оплатить <ExternalLink className="ml-2 h-4 w-4" /></>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
export function AuthPage() {
  const navigate = useNavigate();
  const [identifier, setIdentifier] = useState('');
  const [loading, setLoading] = useState(false);
  const setUser = useUserStore((s) => s.setUser);
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (identifier.trim().length < 3) { 
      toast.error("Никнейм должен быть не короче 3 символов"); 
      return; 
    }
    setLoading(true);
    try {
      const user = await api<User>('/auth/login', { method: 'POST', body: JSON.stringify({ identifier: identifier.trim() }) });
      setUser(user);
      toast.success('Успешный вход');
      navigate('/profile');
    } catch (err: any) {
      toast.error('Ошибка: ' + err.message);
    } finally {
      setLoading(false);
    }
  };
  return (
    <AppLayout container={false}>
      <div className="min-h-[80vh] flex items-center justify-center p-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-sm">
          <Card className="border-white/5 bg-card/30 glass-effect rounded-[3rem] p-8">
            <div className="text-center space-y-6 pt-6 pb-4">
              <motion.div whileHover={{ rotate: 360 }} transition={{ duration: 0.8 }} className="mx-auto flex h-20 w-20 items-center justify-center rounded-[2rem] bg-telegram shadow-2xl">
                <Lock className="h-8 w-8 text-white" />
              </motion.div>
              <h2 className="text-3xl font-black">Milfa Sell</h2>
              <p className="text-xs font-bold text-muted-foreground/60 uppercase tracking-widest">Вход по никнейму или Email</p>
            </div>
            <form onSubmit={handleLogin} className="space-y-6 pb-6">
              <Input placeholder="Никнейм или Email" required className="h-16 rounded-2xl bg-black/10 text-center text-lg font-bold border-none" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
              <Button type="submit" className="w-full h-16 rounded-2xl text-xl font-black bg-telegram shadow-2xl" disabled={loading}>
                {loading ? <Loader2 className="h-6 w-6 animate-spin" /> : "ВОЙТИ"}
              </Button>
            </form>
          </Card>
        </motion.div>
      </div>
    </AppLayout>
  );
}