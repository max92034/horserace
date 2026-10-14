import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { Product, Order, OrderItem, Buyer } from '../types';
import { calculateSubtotal, calculateTotalItems, calculateTotalCartons, generateId } from '../utils/formatters';
import { createLegacyJsonStorage } from '../utils/legacyStorage';

interface OrderState {
  currentOrder: Order;
  savedOrders: Order[];
  isDrawerOpen: boolean;
  addItem: (product: Product, qty?: number) => void;
  removeItem: (sku: string) => void;
  setBuyer: (buyer: Partial<Buyer>) => void;
  saveOrder: () => void;
  loadOrder: (id: string) => void;
  deleteOrder: (id: string) => void;
  newOrder: () => void;
  toggleDrawer: (open?: boolean) => void;
  recalcTotals: () => void;
}

function createEmptyOrder(): Order {
  return {
    id: generateId(),
    buyer: null,
    items: [],
    status: 'draft',
    subtotal: 0,
    totalItems: 0,
    totalCartons: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    notes: '',
  };
}

function migrateOrderItem(item: Partial<OrderItem>): OrderItem {
  return {
    sku: item.sku || '',
    description: item.description || '',
    quantity: item.quantity || 0,
    unitPrice: item.unitPrice || 0,
    imageUrl: item.imageUrl || '',
    cartonQty: item.cartonQty || 0,
    collection: item.collection || '',
    weight: item.weight || 0,
    cartonL: item.cartonL || 0,
    cartonW: item.cartonW || 0,
    cartonH: item.cartonH || 0,
    innerQty: item.innerQty || 0,
    category: item.category || '',
    subcategory: item.subcategory || '',
  };
}

function migrateOrders(orders: unknown): Order[] {
  if (!Array.isArray(orders)) return [];
  return orders
    .filter((order): order is Order => order != null && typeof order === 'object')
    .map(order => {
      const items = Array.isArray(order.items) ? order.items : [];
      return {
        id: order.id || generateId(),
        items: items.map(item => migrateOrderItem(item)),
        subtotal: typeof order.subtotal === 'number' ? order.subtotal : 0,
        totalItems: typeof order.totalItems === 'number' ? order.totalItems : 0,
        totalCartons: typeof order.totalCartons === 'number' ? order.totalCartons : 0,
        buyer: order.buyer || null,
        status: (order.status as Order['status']) || 'saved',
        notes: order.notes || '',
        createdAt: order.createdAt || new Date().toISOString(),
        updatedAt: order.updatedAt || new Date().toISOString(),
      };
    });
}

export const useOrderStore = create<OrderState>()(
  persist(
    (set, get) => ({
  currentOrder: createEmptyOrder(),
  savedOrders: [],
  isDrawerOpen: false,
  addItem: (product: Product, qty = 1) => {
    const order = { ...get().currentOrder };
    const existing = order.items.find(i => i.sku === product.sku);
    
    if (existing) {
      order.items = order.items.map(i => 
        i.sku === product.sku ? { ...i, quantity: i.quantity + qty } : i
      );
    } else {
      const newItem: OrderItem = {
        sku: product.sku,
        description: product.description,
        quantity: qty,
        unitPrice: product.fobPrice,
        imageUrl: product.imageUrl,
        cartonQty: product.cartonQty,
        collection: product.collection || '',
        weight: product.weight || 0,
        cartonL: product.cartonL || 0,
        cartonW: product.cartonW || 0,
        cartonH: product.cartonH || 0,
        innerQty: product.innerQty || 0,
        category: product.category || '',
        subcategory: product.subcategory || '',
      };
      order.items = [...order.items, newItem];
    }
    
    order.subtotal = calculateSubtotal(order.items);
    order.totalItems = calculateTotalItems(order.items);
    order.totalCartons = calculateTotalCartons(order.items);
    order.updatedAt = new Date().toISOString();
    
    set({ currentOrder: order });
  },
  
  removeItem: (sku: string) => {
    const order = { ...get().currentOrder };
    order.items = order.items.filter(i => i.sku !== sku);
    order.subtotal = calculateSubtotal(order.items);
    order.totalItems = calculateTotalItems(order.items);
    order.totalCartons = calculateTotalCartons(order.items);
    order.updatedAt = new Date().toISOString();
    set({ currentOrder: order });
  },
  
  setBuyer: (buyer: Partial<Buyer>) => {
    const order = { ...get().currentOrder };
    order.buyer = {
      id: order.buyer?.id || generateId(),
      name: '',
      company: '',
      email: '',
      phone: '',
      nationality: '',
      website: '',
      notes: '',
      ...order.buyer,
      ...buyer,
    };
    order.updatedAt = new Date().toISOString();
    set({ currentOrder: order });
  },
  
  saveOrder: () => {
    const orderToSave = { ...get().currentOrder };
    orderToSave.status = 'saved';
    orderToSave.updatedAt = new Date().toISOString();
    
    const saved = [...get().savedOrders];
    const existingIdx = saved.findIndex(o => o.id === orderToSave.id);
    if (existingIdx >= 0) {
      saved[existingIdx] = orderToSave;
    } else {
      saved.unshift(orderToSave);
    }

    set({ savedOrders: saved, currentOrder: orderToSave });
  },
  
  loadOrder: (id: string) => {
    const order = get().savedOrders.find(o => o.id === id);
    if (order) {
      const items = Array.isArray(order.items) ? order.items : [];
      const migrated = {
        ...order,
        items: items.map(item => migrateOrderItem(item)),
        subtotal: typeof order.subtotal === 'number' ? order.subtotal : 0,
        totalItems: typeof order.totalItems === 'number' ? order.totalItems : 0,
        totalCartons: typeof order.totalCartons === 'number' ? order.totalCartons : 0,
        buyer: order.buyer || null,
        status: order.status || 'saved',
        notes: order.notes || '',
        createdAt: order.createdAt || new Date().toISOString(),
        updatedAt: order.updatedAt || new Date().toISOString(),
      };
      set({ currentOrder: migrated, isDrawerOpen: true });
    }
  },
  
  deleteOrder: (id: string) => {
    try {
      const currentSaved = get().savedOrders;
      if (!Array.isArray(currentSaved)) {
        set({ savedOrders: [], currentOrder: createEmptyOrder() });
        return;
      }
      const saved = currentSaved.filter(o => o && o.id !== id);
      set({ savedOrders: saved });

      if (get().currentOrder?.id === id) {
        set({ currentOrder: createEmptyOrder() });
      }
    } catch (e) {
      console.error('Failed to delete order:', e);
      set({ savedOrders: [], currentOrder: createEmptyOrder() });
    }
  },
  
  newOrder: () => {
    set({ currentOrder: createEmptyOrder(), isDrawerOpen: true });
  },
  
  toggleDrawer: (open?: boolean) => {
    set({ isDrawerOpen: open !== undefined ? open : !get().isDrawerOpen });
  },
  
  recalcTotals: () => {
    const order = { ...get().currentOrder };
    order.subtotal = calculateSubtotal(order.items);
    order.totalItems = calculateTotalItems(order.items);
    order.totalCartons = calculateTotalCartons(order.items);
    set({ currentOrder: order });
  },
    }),
    {
      name: 'tradeshow_orders',
      storage: createJSONStorage(() =>
        createLegacyJsonStorage<Order[]>((legacy) => ({
          savedOrders: migrateOrders(legacy),
        }))
      ),
      partialize: (state) => ({ savedOrders: state.savedOrders }),
    }
  )
);
