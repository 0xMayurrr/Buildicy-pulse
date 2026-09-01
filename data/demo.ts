export const COLORS = {
  bg: '#F8F7FC',         // Crisp clean bg with subtle purple tint
  card: '#FFFFFF',       // Pure white card
  card2: '#F3E8FF',      // Soft purple tint card
  cardDark: '#0B0F17',   // Deep obsidian black card
  border: '#0B0F17',     // Heavy brutalist obsidian black border
  borderPurple: '#7C3AED',// Royal electric purple border
  borderSubtle: '#E9D5FF',
  purple: '#7C3AED',     // Primary Royal Electric Purple
  purpleLight: '#8B5CF6',
  purpleDark: '#5B21B6',
  yellow: '#7C3AED',     // Primary brand accent
  green: '#059669',      // Deep emerald green for income
  red: '#DC2626',        // Deep crimson red for expenses
  blue: '#2563EB',       // Crisp modern blue
  orange: '#EA580C',     // Vivid orange
  text: '#0B0F17',       // Deep obsidian text (heavy contrast)
  textLight: '#FFFFFF',
  muted: '#5B21B6',      // Royal purple slate for high contrast readability
  mutedGray: '#64748B',  // Slate gray
  dim: '#E9D5FF',
};

export type Transaction = {
  id: string;
  date: string;
  amount: number;
  type: 'income' | 'expense';
  category: string;
  description: string;
  client?: string | null;
  project?: string | null;
  member?: string | null;
  payment_status?: 'completed' | 'pending';
  notes?: string | null;
  created_at?: string;
};

export type Project = {
  id: string;
  name: string;
  client: string;
  status: 'active' | 'completed' | 'paused';
  budget?: number;
  start_date?: string;
  end_date?: string;
  category?: string;
  created_at?: string;
};

export type Member = {
  id: string;
  name: string;
  role: string;
  avatar?: string;
  hourly_rate?: number;
  created_at?: string;
};

export type Client = {
  id: string;
  name: string;
  company: string;
  email?: string;
  phone?: string;
  created_at?: string;
};

export function formatCurrency(amount: number): string {
  const val = Math.abs(amount || 0);
  const sign = amount < 0 ? '-' : '';
  if (val >= 10000000) {
    return `${sign}₹${(val / 10000000).toFixed(2)}Cr`;
  } else if (val >= 100000) {
    return `${sign}₹${(val / 100000).toFixed(1)}L`;
  } else if (val >= 1000) {
    return `${sign}₹${(val / 1000).toFixed(1)}K`;
  }
  return `${sign}₹${Math.round(val)}`;
}

export function formatFullCurrency(amount: number): string {
  const val = Math.round(amount || 0);
  return `₹${val.toLocaleString('en-IN')}`;
}
