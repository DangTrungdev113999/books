// Danh sách theme cho switcher (port từ js/themes.js). Token màu nằm trong css/themes/*.css.
export interface Theme {
  id: string;
  label: string;
  mood: 'light' | 'dark';
  swatches: string[];
}

export const THEMES: Theme[] = [
  { id: 'salon', label: 'Salon', mood: 'light', swatches: ['#f5f4ed', '#c96442', '#141413'] },
  { id: 'airbnb', label: 'Airbnb', mood: 'light', swatches: ['#ffffff', '#ff385c', '#222222'] },
  { id: 'apple', label: 'Apple', mood: 'light', swatches: ['#f5f5f7', '#0071e3', '#1d1d1f'] },
  { id: 'binance', label: 'Binance', mood: 'dark', swatches: ['#222126', '#F0B90B', '#fafafa'] },
  { id: 'claude', label: 'Claude', mood: 'light', swatches: ['#f5f4ed', '#c96442', '#141413'] },
  { id: 'cursor', label: 'Cursor', mood: 'light', swatches: ['#f2f1ed', '#f54e00', '#26251e'] },
  { id: 'figma', label: 'Figma', mood: 'light', swatches: ['#ffffff', '#6d4dea', '#000000'] },
  { id: 'framer', label: 'Framer', mood: 'dark', swatches: ['#000000', '#0099ff', '#ffffff'] },
  { id: 'linear', label: 'Linear', mood: 'dark', swatches: ['#08090a', '#5e6ad2', '#f7f8f8'] },
  { id: 'meta', label: 'Meta', mood: 'light', swatches: ['#ffffff', '#0064E0', '#1C2B33'] },
  { id: 'mintlify', label: 'Mintlify', mood: 'light', swatches: ['#ffffff', '#18E299', '#0d0d0d'] },
  { id: 'nike', label: 'Nike', mood: 'light', swatches: ['#ffffff', '#111111', '#111111'] },
  { id: 'notion', label: 'Notion', mood: 'light', swatches: ['#f6f5f4', '#0075de', '#141413'] },
  { id: 'nvidia', label: 'Nvidia', mood: 'dark', swatches: ['#000000', '#76b900', '#ffffff'] },
  { id: 'playstation', label: 'PlayStation', mood: 'dark', swatches: ['#000000', '#0070cc', '#ffffff'] },
  { id: 'raycast', label: 'Raycast', mood: 'dark', swatches: ['#07080a', '#ff6363', '#f9f9f9'] },
  { id: 'resend', label: 'Resend', mood: 'dark', swatches: ['#000000', '#ffffff', '#f0f0f0'] },
  { id: 'sanity', label: 'Sanity', mood: 'dark', swatches: ['#0b0b0b', '#f36458', '#ffffff'] },
  { id: 'sentry', label: 'Sentry', mood: 'dark', swatches: ['#1f1633', '#6a5fc1', '#ffffff'] },
  { id: 'shopify', label: 'Shopify', mood: 'dark', swatches: ['#000000', '#36F4A4', '#ffffff'] },
  { id: 'spotify', label: 'Spotify', mood: 'dark', swatches: ['#121212', '#1ed760', '#ffffff'] },
  { id: 'stripe', label: 'Stripe', mood: 'light', swatches: ['#ffffff', '#533afd', '#061b31'] },
  { id: 'superhuman', label: 'Superhuman', mood: 'light', swatches: ['#ffffff', '#714cb6', '#292827'] },
  { id: 'supabase', label: 'Supabase', mood: 'dark', swatches: ['#171717', '#3ecf8e', '#fafafa'] },
  { id: 'tesla', label: 'Tesla', mood: 'light', swatches: ['#ffffff', '#3E6AE1', '#171A20'] },
  { id: 'uber', label: 'Uber', mood: 'light', swatches: ['#ffffff', '#000000', '#000000'] },
  { id: 'vercel', label: 'Vercel', mood: 'light', swatches: ['#ffffff', '#171717', '#0a72ef'] },
];

export const DEFAULT_THEME = 'salon';
