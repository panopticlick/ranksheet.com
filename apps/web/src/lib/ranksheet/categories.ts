export type CategoryKey =
  | 'electronics'
  | 'home'
  | 'sports'
  | 'health'
  | 'toys'
  | 'automotive'
  | 'office'
  | 'other'

export const CATEGORIES: { key: CategoryKey; label: string; description: string }[] = [
  { key: 'electronics', label: 'Electronics', description: 'Audio, gadgets, and everyday tech.' },
  { key: 'home', label: 'Home & Kitchen', description: 'Small appliances and home essentials.' },
  { key: 'sports', label: 'Sports & Outdoors', description: 'Fitness, training, and outdoor gear.' },
  { key: 'health', label: 'Health & Beauty', description: 'Supplements, wellness, and self-care.' },
  { key: 'toys', label: 'Toys & Games', description: 'Family favorites and giftable picks.' },
  { key: 'automotive', label: 'Automotive', description: 'Car accessories and maintenance helpers.' },
  { key: 'office', label: 'Office', description: 'Productivity and desk upgrades.' },
  { key: 'other', label: 'Other', description: 'Everything else.' },
]

export function getCategoryLabel(key: string | null | undefined): string {
  const found = CATEGORIES.find((c) => c.key === key)
  return found?.label ?? 'Category'
}

