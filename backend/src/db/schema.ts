import { 
  pgTable, 
  serial, 
  varchar, 
  text, 
  integer, 
  boolean, 
  timestamp, 
  jsonb, 
  index,
  uuid
} from "drizzle-orm/pg-core";
import { relations, type InferSelectModel, type InferInsertModel } from "drizzle-orm";

// -----------------------------------------------------------------------------
// 1. PRODUCT CATEGORIES TABLE
// -----------------------------------------------------------------------------
export const productCategories = pgTable("product_categories", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  slug: varchar("slug", { length: 255 }).notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

// -----------------------------------------------------------------------------
// 2. PRODUCTS TABLE
// -----------------------------------------------------------------------------
export const products = pgTable("products", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => productCategories.id, { onDelete: "set null" }),
  providerServiceId: varchar("provider_service_id", { length: 100 }).notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  productType: varchar("product_type", { length: 100 }),
  providerPrice: integer("provider_price"),
  marginValue: integer("margin_value").notNull().default(0),
  price: integer("price").notNull(),
  originalPrice: integer("original_price"),
  stockStatus: varchar("stock_status", { length: 50 }).notNull().default("available"),
  stockCount: integer("stock_count").notNull().default(0),
  imageUrl: text("image_url"),
  isActive: boolean("is_active").notNull().default(true),
  lastSyncedAt: timestamp("last_synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("products_category_id_idx").on(table.categoryId),
  index("products_provider_service_id_idx").on(table.providerServiceId),
  index("products_is_active_idx").on(table.isActive),
]);

// -----------------------------------------------------------------------------
// 3. ORDERS TABLE
// -----------------------------------------------------------------------------
export const orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  orderNumber: varchar("order_number", { length: 100 }).notNull().unique(),
  refId: varchar("ref_id", { length: 100 }).notNull().unique(),
  customerPhone: varchar("customer_phone", { length: 50 }).notNull(),
  customerEmail: varchar("customer_email", { length: 255 }),
  status: varchar("status", { length: 50 }).notNull().default("waiting_payment"),
  totalAmount: integer("total_amount").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  paidAt: timestamp("paid_at", { withTimezone: true }),
  completedAt: timestamp("completed_at", { withTimezone: true }),
}, (table) => [
  index("orders_order_number_idx").on(table.orderNumber),
  index("orders_ref_id_idx").on(table.refId),
  index("orders_customer_phone_idx").on(table.customerPhone),
  index("orders_status_idx").on(table.status),
]);

// -----------------------------------------------------------------------------
// 4. ORDER ITEMS TABLE
// -----------------------------------------------------------------------------
export const orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: varchar("product_name", { length: 255 }).notNull(),
  price: integer("price").notNull(),
  quantity: integer("quantity").notNull().default(1),
  subtotal: integer("subtotal").notNull(),
}, (table) => [
  index("order_items_order_id_idx").on(table.orderId),
  index("order_items_product_id_idx").on(table.productId),
]);

// -----------------------------------------------------------------------------
// 5. PAYMENTS TABLE
// -----------------------------------------------------------------------------
export const payments = pgTable("payments", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  transactionId: varchar("transaction_id", { length: 255 }),
  paymentMethod: varchar("payment_method", { length: 50 }).notNull().default("qris"),
  qrCodeUrl: text("qr_code_url"),
  status: varchar("status", { length: 50 }).notNull().default("pending"),
  rawCallback: jsonb("raw_callback"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  settledAt: timestamp("settled_at", { withTimezone: true }),
}, (table) => [
  index("payments_order_id_idx").on(table.orderId),
  index("payments_transaction_id_idx").on(table.transactionId),
  index("payments_status_idx").on(table.status),
]);

// -----------------------------------------------------------------------------
// 6. DELIVERIES TABLE
// -----------------------------------------------------------------------------
export const deliveries = pgTable("deliveries", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().references(() => orders.id, { onDelete: "cascade" }),
  productName: varchar("product_name", { length: 255 }).notNull(),
  content: text("content").notNull(),
  status: varchar("status", { length: 50 }).notNull().default("delivered"),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("deliveries_order_id_idx").on(table.orderId),
]);

// -----------------------------------------------------------------------------
// 7. USERS TABLE (Admin & Customer RBAC synced with Supabase Auth)
// -----------------------------------------------------------------------------
export const users = pgTable("users", {
  id: uuid("id").primaryKey(),
  email: varchar("email", { length: 255 }).notNull().unique(),
  role: varchar("role", { length: 50 }).notNull().default("customer"),
  fullName: varchar("full_name", { length: 255 }),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("users_email_idx").on(table.email),
  index("users_role_idx").on(table.role),
]);

// -----------------------------------------------------------------------------
// RELATIONS
// -----------------------------------------------------------------------------
export const productCategoriesRelations = relations(productCategories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(productCategories, {
    fields: [products.categoryId],
    references: [productCategories.id],
  }),
  orderItems: many(orderItems),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
  payments: many(payments),
  deliveries: many(deliveries),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
  product: one(products, {
    fields: [orderItems.productId],
    references: [products.id],
  }),
}));

export const paymentsRelations = relations(payments, ({ one }) => ({
  order: one(orders, {
    fields: [payments.orderId],
    references: [orders.id],
  }),
}));

export const deliveriesRelations = relations(deliveries, ({ one }) => ({
  order: one(orders, {
    fields: [deliveries.orderId],
    references: [orders.id],
  }),
}));

// -----------------------------------------------------------------------------
// TYPE DEFINITIONS
// -----------------------------------------------------------------------------
export type ProductCategory = InferSelectModel<typeof productCategories>;
export type NewProductCategory = InferInsertModel<typeof productCategories>;

export type Product = InferSelectModel<typeof products>;
export type NewProduct = InferInsertModel<typeof products>;

export type Order = InferSelectModel<typeof orders>;
export type NewOrder = InferInsertModel<typeof orders>;

export type OrderItem = InferSelectModel<typeof orderItems>;
export type NewOrderItem = InferInsertModel<typeof orderItems>;

export type Payment = InferSelectModel<typeof payments>;
export type NewPayment = InferInsertModel<typeof payments>;

export type Delivery = InferSelectModel<typeof deliveries>;
export type NewDelivery = InferInsertModel<typeof deliveries>;

export type User = InferSelectModel<typeof users>;
export type NewUser = InferInsertModel<typeof users>;
