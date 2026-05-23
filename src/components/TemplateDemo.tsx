import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';
import type { User } from '@shared/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';
export function TemplateDemo() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    const fetchUsers = async () => {
      setLoading(true);
      try {
        // This is a demo endpoint, adjust if your API differs
        const res = await api<{ items: User[] }>('/api/users');
        setUsers(res.items || []);
      } catch (err) {
        console.error('Demo error:', err);
      } finally {
        setLoading(false);
      }
    };
    // Disabled by default for the new app structure
    // fetchUsers();
  }, []);
  if (loading) return <Loader2 className="animate-spin" />;
  return (
    <div className="p-4 space-y-4">
      {users.map(u => (
        <Card key={u.id}>
          <CardHeader>
            <CardTitle>{u.email || u.id}</CardTitle>
          </CardHeader>
          <CardContent>
            Balance: ${u.balance}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}