export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  detail?: string;
}
export interface User {
  id: string;
  email: string;
  balance: number;
  purchasedAccountIds: string[];
}
export interface TelegramAccount {
  id: string;
  category: 'New' | 'Aged' | 'Premium' | 'Verified';
  price: number;
  country: string;
  countryCode: string;
  age: string;
  status: 'available' | 'sold';
  description?: string;
  details?: string;
  phoneNumber?: string;
  lastCode?: string;
  codeStatus?: 'ready' | 'waiting' | 'error' | 'bridge_not_configured';
  codeUpdatedAt?: number;
}
export interface Transaction {
  id: string;
  userId: string;
  amount: number;
  type: 'deposit' | 'purchase';
  timestamp: number;
  accountId?: string;
}
export interface CreateInvoiceResponse {
  payUrl: string;
  pay_url?: string;
  miniAppInvoiceUrl?: string;
  webAppInvoiceUrl?: string;
  mini_app_invoice_url?: string;
  web_app_invoice_url?: string;
  invoiceId?: number;
  invoice_id?: number;
}
export interface GetCodeResponse {
  code: string;
  phoneNumber?: string;
  message?: string;
  timestamp: number;
  status?: 'ready' | 'waiting' | 'error' | 'bridge_not_configured';
}