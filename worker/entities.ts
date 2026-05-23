import { IndexedEntity } from "./core-utils";
import type { User, TelegramAccount, Transaction } from "@shared/types";
export interface InvoiceRecord {
  id: string; // invoice_id from Crypto Pay
  userEmail: string;
  amount: number;
  status: 'active' | 'pending' | 'paid' | 'expired';
  timestamp: number;
  creditedAt?: number;
}
export class UserEntity extends IndexedEntity<User> {
  static readonly entityName = "user";
  static readonly indexName = "users";
  static readonly initialState: User = {
    id: "",
    email: "",
    balance: 0,
    purchasedAccountIds: []
  };
}
export class AccountEntity extends IndexedEntity<TelegramAccount> {
  static readonly entityName = "tg_account";
  static readonly indexName = "tg_accounts";
  static readonly initialState: TelegramAccount = {
    id: "",
    category: 'New',
    price: 0,
    country: "Россия",
    countryCode: "RU",
    age: "1 месяц",
    status: 'available',
    description: "",
    details: "",
    phoneNumber: "",
    codeStatus: "waiting"
  };
  static seedData: TelegramAccount[] = [
    {
      id: "acc_seed_1",
      category: 'Aged',
      price: 2.5,
      country: "США",
      countryCode: "US",
      age: "2 года",
      status: 'available',
      description: "Premium US account, aged and verified.",
      details: "MTProtoSessionV2: [AES256-GCM-ENCRYPTED-SESSION-PAYLOAD]. LoginCode: 48291. Status: Authenticated. DC: 1. Port: 443.",
      phoneNumber: "+15550102030",
      codeStatus: "waiting"
    },
    {
      id: "acc_seed_2",
      category: 'New',
      price: 1.2,
      country: "Россия",
      countryCode: "RU",
      age: "1 день",
      status: 'available',
      description: "Freshly created RU session.",
      details: "MTProtoSessionV2: [RAW_SESSION_DATA_PLACEHOLDER]. SystemInfo: Android 12. AppVersion: 9.3.2. NewCode: 120934. DC: 2.",
      phoneNumber: "+79001234567",
      codeStatus: "waiting"
    }
  ];
}
export class TransactionEntity extends IndexedEntity<Transaction> {
  static readonly entityName = "transaction";
  static readonly indexName = "transactions";
  static readonly initialState: Transaction = {
    id: "",
    userId: "",
    amount: 0,
    type: 'deposit',
    timestamp: 0
  };
}
export class InvoiceEntity extends IndexedEntity<InvoiceRecord> {
  static readonly entityName = "invoice";
  static readonly indexName = "invoices";
  static readonly initialState: InvoiceRecord = {
    id: "",
    userEmail: "",
    amount: 0,
    status: 'active',
    timestamp: 0
  };
}