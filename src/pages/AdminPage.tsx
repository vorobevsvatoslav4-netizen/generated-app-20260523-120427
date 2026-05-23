import React, { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Lock, Trash2, Edit2, Loader2, RefreshCw
} from 'lucide-react';
import { api } from '@/lib/api-client';
import { APP_CONFIG, COUNTRY_CODES, CATEGORIES_RUS } from '@/lib/constants';
import type { User, TelegramAccount } from '@shared/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
const getFlagEmoji = (countryCode?: string) => {
  const flags: Record<string, string> = {
    'US': '🇺🇸', 'GB': '🇬🇧', 'DE': '🇩🇪', 'RU': '🇷🇺', 'NL': '🇳🇱',
    'KZ': '🇰🇿', 'UA': '🇺🇦', 'BY': '🇧🇾', 'ID': '🇮🇩', 'FR': '🇫🇷',
    'PL': '🇵🇱', 'CA': '🇨🇦'
  };
  return flags[countryCode || ''] || '🏳️';
};
export function AdminPage() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [accounts, setAccounts] = useState<TelegramAccount[]>([]);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [newBalanceValue, setNewBalanceValue] = useState<string>('');
  const [isUpdatingBalance, setIsUpdatingBalance] = useState(false);
  const initialCountry = Object.keys(COUNTRY_CODES)[0] || 'Россия';
  const [newAccount, setNewAccount] = useState<Partial<TelegramAccount>>({
    category: 'New', country: initialCountry, price: 2, age: '1 месяц', description: '', details: '', phoneNumber: '', lastCode: ''
  });
  const fetchAdminData = useCallback(async () => {
    if (!isAuthenticated) return;
    setLoading(true);
    try {
      const [uRes, aRes] = await Promise.all([
        api<{ items: User[] }>('/api/admin/users'),
        api<{ items: TelegramAccount[] }>('/api/admin/accounts')
      ]);
      setUsers(uRes.items || []);
      setAccounts(aRes.items || []);
    } catch (err: any) {
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);
  useEffect(() => {
    if (localStorage.getItem('milfa_admin_auth') === 'true') setIsAuthenticated(true);
  }, []);
  useEffect(() => {
    if (isAuthenticated) fetchAdminData();
  }, [isAuthenticated, fetchAdminData]);
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === APP_CONFIG.adminPassword) {
      setIsAuthenticated(true);
      localStorage.setItem('milfa_admin_auth', 'true');
      toast.success('Доступ разрешен');
    } else {
      toast.error('Неверный пароль');
    }
  };
  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccount.price || !newAccount.details?.trim()) {
      toast.error('Заполните данные');
      return;
    }
    try {
      const countryName = newAccount.country || initialCountry;
      const countryCode = (COUNTRY_CODES as Record<string, string>)[countryName] || 'RU';
      await api('/api/admin/accounts', {
        method: 'POST',
        body: JSON.stringify({ ...newAccount, price: Number(newAccount.price), countryCode })
      });
      toast.success('Аккаунт создан');
      setNewAccount({ category: 'New', country: initialCountry, price: 2, age: '1 месяц', description: '', details: '', phoneNumber: '', lastCode: '' });
      fetchAdminData();
    } catch (err: any) {
      toast.error('Ошибка: ' + err.message);
    }
  };
  const handleDeleteAccount = async (id: string) => {
    if (!window.confirm('Удалить?')) return;
    try {
      await api(`/api/admin/accounts/${id}`, { method: 'DELETE' });
      fetchAdminData();
    } catch (err: any) {
      toast.error('Ошибка удаления');
    }
  };
  const handleUpdateBalance = async (email: string) => {
    const amount = parseFloat(newBalanceValue);
    if (isNaN(amount)) return;
    setIsUpdatingBalance(true);
    try {
      await api('/api/admin/users/update-balance', { method: 'POST', body: JSON.stringify({ email, amount }) });
      toast.success('Баланс обновлен');
      setEditingUserId(null);
      fetchAdminData();
    } catch (err: any) {
      toast.error('Ошибка');
    } finally {
      setIsUpdatingBalance(false);
    }
  };
  if (!isAuthenticated) {
    return (
      <AppLayout container={false}>
        <div className="min-h-[70vh] flex items-center justify-center p-6">
          <Card className="w-full max-w-md border-white/5 bg-white/[0.01] glass-effect rounded-[3rem] p-10">
            <div className="text-center space-y-6">
              <div className="mx-auto h-20 w-20 rounded-3xl bg-telegram flex items-center justify-center shadow-2xl">
                <Lock className="h-8 w-8 text-white" />
              </div>
              <h1 className="text-3xl font-black">Milfa Admin</h1>
              <form onSubmit={handleLogin} className="space-y-6">
                <Input type="password" placeholder="Admin Password" className="h-16 rounded-2xl bg-white/[0.03] text-center text-xl font-bold" value={password} onChange={(e) => setPassword(e.target.value)} />
                <Button type="submit" className="w-full h-16 rounded-2xl text-lg font-black bg-telegram shadow-lg">Login</Button>
              </form>
            </div>
          </Card>
        </div>
      </AppLayout>
    );
  }
  return (
    <AppLayout>
      <div className="max-w-7xl mx-auto space-y-10 py-6">
        <div className="flex justify-between items-center">
          <h1 className="text-4xl font-display font-black tracking-tight">Console</h1>
          <Button variant="outline" size="icon" onClick={fetchAdminData} className="rounded-xl h-12 w-12"><RefreshCw className={cn("h-5 w-5", loading && "animate-spin")} /></Button>
        </div>
        <Tabs defaultValue="inventory" className="space-y-8">
          <TabsList className="bg-white/[0.02] border-white/5 rounded-2xl h-14">
            <TabsTrigger value="inventory" className="rounded-xl px-8 font-black uppercase text-xs tracking-widest">Stock</TabsTrigger>
            <TabsTrigger value="users" className="rounded-xl px-8 font-black uppercase text-xs tracking-widest">Users</TabsTrigger>
          </TabsList>
          <TabsContent value="inventory" className="space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
              <div className="lg:col-span-5">
                <Card className="glass-effect rounded-[2rem] p-8 border-white/5 bg-card/50">
                  <CardHeader className="px-0 pt-0 mb-6">
                    <CardTitle className="text-xl font-black">Add Account</CardTitle>
                    <p className="text-xs opacity-60">Добавление новой сессии в маркетплейс.</p>
                  </CardHeader>
                  <form onSubmit={handleCreateAccount} className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <select className="h-12 rounded-xl bg-white/[0.03] border-white/5 px-4 text-sm font-bold bg-background" value={newAccount.country} onChange={(e) => setNewAccount({...newAccount, country: e.target.value})}>
                        {Object.keys(COUNTRY_CODES).map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                      <select className="h-12 rounded-xl bg-white/[0.03] border-white/5 px-4 text-sm font-bold bg-background" value={newAccount.category} onChange={(e) => setNewAccount({...newAccount, category: e.target.value as any})}>
                        {['New', 'Aged', 'Premium', 'Verified'].map(cat => <option key={cat} value={cat}>{CATEGORIES_RUS[cat as keyof typeof CATEGORIES_RUS]}</option>)}
                      </select>
                    </div>
                    <Input type="number" step="0.01" className="h-12" placeholder="Price $" value={newAccount.price || ''} onChange={(e) => setNewAccount({...newAccount, price: Number(e.target.value)})} />
                    <textarea className="w-full h-32 rounded-xl bg-white/[0.03] border-white/5 p-4 text-xs font-mono outline-none text-foreground bg-background" placeholder="Session details..." required value={newAccount.details || ''} onChange={(e) => setNewAccount({...newAccount, details: e.target.value})} />
                    <Button type="submit" className="w-full h-14 rounded-xl bg-telegram font-black text-white">Create</Button>
                  </form>
                </Card>
              </div>
              <div className="lg:col-span-7 space-y-4">
                {accounts?.map(acc => (
                  <Card key={acc.id} className="p-6 border-white/5 bg-white/[0.01] glass-effect rounded-3xl flex justify-between items-center bg-card/30">
                    <div className="flex items-center gap-6">
                      <span className="text-3xl">{getFlagEmoji(acc.countryCode)}</span>
                      <div><p className="font-bold">{acc.country}</p><Badge className="text-[8px]">{acc.status}</Badge></div>
                    </div>
                    <div className="flex items-center gap-4">
                      <p className="text-xl font-black text-primary">${acc.price}</p>
                      <Button variant="ghost" size="icon" onClick={() => handleDeleteAccount(acc.id)} className="text-destructive"><Trash2 className="h-5 w-5" /></Button>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          </TabsContent>
          <TabsContent value="users" className="space-y-4">
            {users?.map(u => (
              <Card key={u.id} className="p-6 border-white/5 bg-white/[0.01] glass-effect rounded-3xl flex justify-between items-center bg-card/30">
                <p className="font-black">{u.email}</p>
                <div className="flex items-center gap-4">
                  <p className="text-2xl font-black text-primary">${u.balance.toFixed(2)}</p>
                  <Button variant="ghost" onClick={() => { setEditingUserId(u.id); setNewBalanceValue(String(u.balance)); }}><Edit2 className="h-4 w-4" /></Button>
                </div>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
      <Dialog open={editingUserId !== null} onOpenChange={(open) => !open && setEditingUserId(null)}>
        <DialogContent className="rounded-[2rem] bg-card border-white/5 p-8">
          <DialogHeader>
            <DialogTitle className="text-2xl font-black">Edit Balance</DialogTitle>
            <DialogDescription className="text-sm opacity-60">Изменение баланса пользователя.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input type="number" step="0.01" className="h-14 rounded-xl" value={newBalanceValue} onChange={(e) => setNewBalanceValue(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditingUserId(null)}>Cancel</Button>
            <Button onClick={() => { const u = users.find(u => u.id === editingUserId); if(u) handleUpdateBalance(u.email); }} disabled={isUpdatingBalance}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}