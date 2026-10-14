export interface Product {
  // Product Identification
  sku: string;
  description: string;
  collection: string;
  location: string;

  // Physical Specifications
  length: number;
  width: number;
  height: number;
  weight: number;

  // Packaging
  unit: string;
  cartonQty: number;
  innerQty: number;
  cartonL: number;
  cartonW: number;
  cartonH: number;

  // Categorization
  category: string;
  subcategory: string;

  // Other
  fobPrice: number;
  note: string;
  imageUrl: string;
  keyword: string;
}

export interface Buyer {
  id: string;
  name: string;
  company: string;
  email: string;
  phone: string;
  nationality: string;
  website: string;
  notes: string;
}

export interface OrderItem {
  sku: string;
  description: string;
  quantity: number;
  unitPrice: number;
  imageUrl: string;
  cartonQty: number;
  // Additional product fields for quotation
  collection: string;
  weight: number;
  cartonL: number;
  cartonW: number;
  cartonH: number;
  innerQty: number;
  category: string;
  subcategory: string;
}

export interface Order {
  id: string;
  buyer: Buyer | null;
  items: OrderItem[];
  status: 'draft' | 'saved' | 'sent';
  subtotal: number;
  totalItems: number;
  totalCartons: number;
  createdAt: string;
  updatedAt: string;
  notes: string;
}
