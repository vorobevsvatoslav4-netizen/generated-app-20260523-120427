/**
 * Application Constants 2026 Production Edition
 */
export const CRYPTO_BOT_USERNAME = "CryptoBot";
// Official Crypto Pay Token provided by client
export const OFFICIAL_CRYPTO_PAY_TOKEN = "584768:AApkLrn1qTZOZVEj7rK98kdWRReVL5Gy4Sx";
export const APP_CONFIG = {
  name: "Milfa Sell",
  supportLink: "https://t.me/milfa72",
  cryptoBotLink: "https://t.me/CryptoBot",
  minDeposit: 1,
  maxDeposit: 1000,
  adminPassword: "milfa_admin_2026",
  copyrightYear: 2026,
};
export const COUNTRY_CODES: Record<string, string> = {
  'США': 'US',
  'Великобритания': 'GB',
  'Германия': 'DE',
  'Россия': 'RU',
  'Нидерланды': 'NL',
  'Казахстан': 'KZ',
  'Украина': 'UA',
  'Беларусь': 'BY',
  'Индонезия': 'ID',
  'Франция': 'FR',
  'Польша': 'PL',
  'Канада': 'CA'
};
export const CATEGORIES_RUS = {
  'All': 'Все',
  'New': 'Новые',
  'Aged': 'Отработка',
  'Premium': 'ДВ',
  'Verified': 'Другие страны'
} as const;