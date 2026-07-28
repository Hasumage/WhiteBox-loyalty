export type TransactionType = "earn" | "spend";
export type TransactionStatus = "active" | "expired";

export interface Transaction {
  id: string;
  type: TransactionType;
  companyId: string;
  companyName: string;
  amount: number;
  date: string;
  status: TransactionStatus;
  description?: string;
}

export type CategoryId = string;

export interface Category {
  id: CategoryId;
  name: string;
  slug: string;
  icon?: string;
}

export const categories: Category[] = [
  { id: "coffee", name: "Coffee", slug: "coffee", icon: "Coffee" },
  { id: "barber", name: "Barber", slug: "barber", icon: "Scissors" },
  { id: "food", name: "Food", slug: "food", icon: "UtensilsCrossed" },
  { id: "gaming", name: "Gaming", slug: "gaming", icon: "Gamepad2" },
  { id: "fitness", name: "Fitness", slug: "fitness", icon: "Dumbbell" },
  { id: "healthy-food", name: "Healthy Food", slug: "healthy-food", icon: "Salad" },
  { id: "beauty", name: "Beauty", slug: "beauty", icon: "Sparkles" },
  { id: "pharmacy", name: "Pharmacy", slug: "pharmacy", icon: "Pill" },
  { id: "retail", name: "Retail", slug: "retail", icon: "ShoppingBag" },
  { id: "other", name: "Other", slug: "other", icon: "Grid2x2" },
];

export interface MapLocation {
  lat: number;
  lng: number;
  address?: string;
}

export interface Company {
  id: string;
  name: string;
  categoryId: CategoryId;
  balance: number;
  pointsToNextReward: number;
  pointsPerReward: number;
  expiringPoints?: number;
  expiringDate?: string;
  location?: MapLocation;
  subscriptionIds?: string[];
}

export interface Subscription {
  id: string;
  name: string;
  description: string;
  price: number; // in currency or points
  priceLabel: string;
  renewalPeriod: "day" | "week" | "month";
  renewalLabel: string;
  benefits: string[];
  companyId?: string; // if partner-specific
  categoryId?: CategoryId;
  image?: string;
}

export const companies: Company[] = [
  {
    id: "coffee-shop",
    name: "Coffee Shop",
    categoryId: "coffee",
    balance: 340,
    pointsToNextReward: 60,
    pointsPerReward: 100,
    expiringPoints: 50,
    expiringDate: "2025-06-15",
    location: { lat: 50.4501, lng: 30.5234, address: "Khreshchatyk 1" },
    subscriptionIds: ["sub-coffee-daily"],
  },
  {
    id: "gym",
    name: "Power Gym",
    categoryId: "fitness",
    balance: 1250,
    pointsToNextReward: 250,
    pointsPerReward: 500,
    location: { lat: 50.4512, lng: 30.5245, address: "Baseina 5" },
    subscriptionIds: ["sub-gym-monthly"],
  },
  {
    id: "barber",
    name: "Classic Barber",
    categoryId: "barber",
    balance: 45,
    pointsToNextReward: 55,
    pointsPerReward: 100,
    expiringPoints: 45,
    expiringDate: "2025-03-20",
    location: { lat: 50.4489, lng: 30.5210, address: "Volodymyrska 42" },
  },
  {
    id: "pharmacy",
    name: "Green Pharmacy",
    categoryId: "pharmacy",
    balance: 890,
    pointsToNextReward: 110,
    pointsPerReward: 200,
    location: { lat: 50.4520, lng: 30.5260, address: "Besarabska 10" },
  },
  {
    id: "bakery",
    name: "Morning Bakery",
    categoryId: "food",
    balance: 72,
    pointsToNextReward: 28,
    pointsPerReward: 50,
    location: { lat: 50.4470, lng: 30.5190, address: "Lva Tolstoho 15" },
  },
  {
    id: "espresso-bar",
    name: "Espresso Bar",
    categoryId: "coffee",
    balance: 120,
    pointsToNextReward: 80,
    pointsPerReward: 100,
    location: { lat: 50.4530, lng: 30.5280, address: "Pushkinska 20" },
    subscriptionIds: ["sub-coffee-daily"],
  },
  {
    id: "yoga-studio",
    name: "Zen Yoga",
    categoryId: "fitness",
    balance: 200,
    pointsToNextReward: 100,
    pointsPerReward: 100,
    location: { lat: 50.4495, lng: 30.5220, address: "Saksahanskoho 30" },
  },
  {
    id: "nail-salon",
    name: "Nail Art Studio",
    categoryId: "beauty",
    balance: 55,
    pointsToNextReward: 45,
    pointsPerReward: 50,
    location: { lat: 50.4460, lng: 30.5170, address: "Antonovycha 70" },
  },
  {
    id: "pizza-place",
    name: "Pizza & Pasta",
    categoryId: "food",
    balance: 180,
    pointsToNextReward: 70,
    pointsPerReward: 100,
    location: { lat: 50.4540, lng: 30.5300, address: "Bohdana Khmelnytskoho 25" },
  },
  {
    id: "hair-salon",
    name: "Hair & Style",
    categoryId: "beauty",
    balance: 90,
    pointsToNextReward: 60,
    pointsPerReward: 75,
    location: { lat: 50.4480, lng: 30.5200, address: "Velyka Vasylkivska 72" },
  },
  {
    id: "smoothie-bar",
    name: "Smoothie Bar",
    categoryId: "food",
    balance: 40,
    pointsToNextReward: 60,
    pointsPerReward: 50,
    location: { lat: 50.4550, lng: 30.5320, address: "Shota Rustaveli 25" },
  },
  {
    id: "crossfit-box",
    name: "CrossFit Box",
    categoryId: "fitness",
    balance: 310,
    pointsToNextReward: 90,
    pointsPerReward: 200,
    location: { lat: 50.4475, lng: 30.5180, address: "Dorohozhytska 3" },
  },
  {
    id: "roastery",
    name: "Specialty Roastery",
    categoryId: "coffee",
    balance: 250,
    pointsToNextReward: 50,
    pointsPerReward: 100,
    location: { lat: 50.4510, lng: 30.5250, address: "Kostiantynivska 15" },
    subscriptionIds: ["sub-coffee-daily", "sub-coffee-weekly"],
  },
  {
    id: "pharmacy-2",
    name: "Vita Pharmacy",
    categoryId: "pharmacy",
    balance: 0,
    pointsToNextReward: 100,
    pointsPerReward: 100,
    location: { lat: 50.4465, lng: 30.5160, address: "Nyzhnyi Val 15" },
  },
  {
    id: "barber-2",
    name: "Gentleman's Cut",
    categoryId: "barber",
    balance: 140,
    pointsToNextReward: 60,
    pointsPerReward: 100,
    location: { lat: 50.4490, lng: 30.5215, address: "Arkhytekta Horodetskoho 15" },
  },
  {
    id: "spa",
    name: "Urban Spa",
    categoryId: "beauty",
    balance: 75,
    pointsToNextReward: 25,
    pointsPerReward: 50,
    location: { lat: 50.4525, lng: 30.5270, address: "Instytutska 15" },
  },
  {
    id: "burger-joint",
    name: "Burger House",
    categoryId: "food",
    balance: 95,
    pointsToNextReward: 55,
    pointsPerReward: 75,
    location: { lat: 50.4535, lng: 30.5290, address: "Khoryva 1" },
  },
  {
    id: "running-store",
    name: "Run Lab",
    categoryId: "retail",
    balance: 0,
    pointsToNextReward: 150,
    pointsPerReward: 150,
    location: { lat: 50.4505, lng: 30.5240, address: "Spaska 10" },
  },
  {
    id: "tea-house",
    name: "Tea House",
    categoryId: "coffee",
    balance: 60,
    pointsToNextReward: 40,
    pointsPerReward: 50,
    location: { lat: 50.4485, lng: 30.5195, address: "Vozdvyzhenska 35" },
  },
  {
    id: "pilates-studio",
    name: "Pilates Studio",
    categoryId: "fitness",
    balance: 110,
    pointsToNextReward: 90,
    pointsPerReward: 100,
    location: { lat: 50.4515, lng: 30.5230, address: "Sichovykh Striltsiv 37" },
  },
];

export const subscriptions: Subscription[] = [
  {
    id: "sub-coffee-daily",
    name: "Coffee Every Day",
    description: "One free coffee per day at participating locations.",
    price: 299,
    priceLabel: "299 pts/month",
    renewalPeriod: "month",
    renewalLabel: "Monthly",
    benefits: ["1 free coffee daily", "10% off pastries", "Double points on Fridays"],
    categoryId: "coffee",
  },
  {
    id: "sub-coffee-weekly",
    name: "Weekly Brew",
    description: "Five barista drinks per week.",
    price: 149,
    priceLabel: "149 pts/week",
    renewalPeriod: "week",
    renewalLabel: "Weekly",
    benefits: ["5 drinks per week", "Free extra shot"],
    categoryId: "coffee",
  },
  {
    id: "sub-gym-monthly",
    name: "Gym Unlimited",
    description: "Unlimited access to all group classes.",
    price: 499,
    priceLabel: "499 pts/month",
    renewalPeriod: "month",
    renewalLabel: "Monthly",
    benefits: ["Unlimited classes", "Locker included", "Guest pass once/month"],
    companyId: "gym",
    categoryId: "fitness",
  },
  {
    id: "sub-beauty-pack",
    name: "Beauty Pack",
    description: "One treatment per month from selected beauty partners.",
    price: 399,
    priceLabel: "399 pts/month",
    renewalPeriod: "month",
    renewalLabel: "Monthly",
    benefits: ["1 treatment/month", "Nail, hair or spa", "Rotating partners"],
    categoryId: "beauty",
  },
  {
    id: "sub-food-lunch",
    name: "Lunch Deal",
    description: "Fixed-price lunch at selected food partners.",
    price: 199,
    priceLabel: "199 pts/month",
    renewalPeriod: "month",
    renewalLabel: "Monthly",
    benefits: ["1 lunch/day", "Participating restaurants", "Excludes drinks"],
    categoryId: "food",
  },
  {
    id: "sub-barber-trim",
    name: "Trim Club",
    description: "Monthly haircut at any partner barber.",
    price: 249,
    priceLabel: "249 pts/month",
    renewalPeriod: "month",
    renewalLabel: "Monthly",
    benefits: ["1 haircut/month", "Any partner", "Beard trim included"],
    categoryId: "barber",
  },
];

export const activeSubscriptions = [
  {
    subscriptionId: "sub-coffee-daily",
    activatedAt: "2026-02-01T00:00:00Z",
    expiresAt: "2026-02-02T00:00:00Z",
    renewPeriodDays: 1,
    willAutoRenew: true,
    status: "active",
    companyIds: ["coffee-shop", "espresso-bar", "roastery"],
  },
  {
    subscriptionId: "sub-gym-monthly",
    activatedAt: "2026-01-15T00:00:00Z",
    expiresAt: "2026-02-15T00:00:00Z",
    renewPeriodDays: 30,
    willAutoRenew: true,
    status: "active",
    companyIds: ["gym"],
  },
];

export const transactions: Transaction[] = [
  { id: "t1", type: "earn", companyId: "coffee-shop", companyName: "Coffee Shop", amount: 50, date: "2025-01-28T10:30:00Z", status: "active", description: "Purchase" },
  { id: "t2", type: "spend", companyId: "gym", companyName: "Power Gym", amount: 100, date: "2025-01-27T14:00:00Z", status: "active", description: "Reward redemption" },
  { id: "t3", type: "earn", companyId: "barber", companyName: "Classic Barber", amount: 25, date: "2025-01-25T11:15:00Z", status: "active" },
  { id: "t4", type: "earn", companyId: "pharmacy", companyName: "Green Pharmacy", amount: 120, date: "2025-01-24T09:00:00Z", status: "active" },
  { id: "t5", type: "spend", companyId: "coffee-shop", companyName: "Coffee Shop", amount: 100, date: "2025-01-20T08:45:00Z", status: "active", description: "Free drink" },
  { id: "t6", type: "earn", companyId: "bakery", companyName: "Morning Bakery", amount: 15, date: "2025-01-18T12:30:00Z", status: "active" },
  { id: "t7", type: "earn", companyId: "gym", companyName: "Power Gym", amount: 200, date: "2024-12-01T07:00:00Z", status: "expired" },
  { id: "t8", type: "spend", companyId: "pharmacy", companyName: "Green Pharmacy", amount: 50, date: "2025-01-10T16:20:00Z", status: "active" },
  { id: "t9", type: "earn", companyId: "coffee-shop", companyName: "Coffee Shop", amount: 75, date: "2025-01-05T10:00:00Z", status: "active" },
  { id: "t10", type: "earn", companyId: "barber", companyName: "Classic Barber", amount: 30, date: "2024-11-01T10:00:00Z", status: "expired" },
];

export function getTotalBalance(): number {
  return companies.reduce((sum, c) => sum + c.balance, 0);
}

export function getCompanyById(id: string): Company | undefined {
  return companies.find((c) => c.id === id);
}

export function getCompaniesByCategory(categoryId: CategoryId | null): Company[] {
  if (!categoryId) return companies;
  return companies.filter((c) => c.categoryId === categoryId);
}

export function getCompaniesBySearch(query: string, categoryId: CategoryId | null): Company[] {
  const filtered = categoryId
    ? companies.filter((c) => c.categoryId === categoryId)
    : companies;
  if (!query.trim()) return filtered;
  const q = query.toLowerCase();
  return filtered.filter((c) => c.name.toLowerCase().includes(q));
}

export function getTransactionsByCompany(companyId: string): Transaction[] {
  return transactions.filter((t) => t.companyId === companyId);
}

export function getSubscriptionById(id: string): Subscription | undefined {
  return subscriptions.find((s) => s.id === id);
}

export function getSubscriptionsByCompany(companyId: string): Subscription[] {
  return subscriptions.filter((s) => s.companyId === companyId || (s.categoryId && companies.find((c) => c.id === companyId)?.categoryId === s.categoryId));
}

export function getSubscriptionsForMarketplace(categoryId: CategoryId | null): Subscription[] {
  if (!categoryId) return subscriptions;
  return subscriptions.filter((s) => s.categoryId === categoryId || !s.companyId);
}

export function isExpiringSoon(expiringDate?: string): boolean {
  if (!expiringDate) return false;
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  return new Date(expiringDate) <= oneYearFromNow;
}

export function getCategoryById(id: CategoryId): Category | undefined {
  return categories.find((c) => c.id === id);
}
