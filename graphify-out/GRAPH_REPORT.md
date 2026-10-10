# Graph Report - nara apps v2  (2026-10-10)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 752 nodes · 1551 edges · 42 communities (38 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c7c982a7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- handlers.ts
- frontend/package.json
- whatsapp.service.ts
- App.tsx
- orderQueue.ts
- agent/skills/antislop-human/contrast-check.py
- schema.ts
- AdminOrders.tsx
- rateLimiter.ts
- lucide-react
- agent/skills/antislop-human/contrast-mcp.py
- api.ts
- webhook.routes.ts
- admin.routes.ts
- react
- compilerOptions
- premiumku.service.ts
- adminFetch
- scripts
- MyOrders.tsx
- compilerOptions
- db/index.ts
- order.service.ts
- compilerOptions
- compilerOptions
- CatalogStore
- drizzle-orm
- backend/package.json
- useLiveCatalog.ts
- bot/package.json
- dependencies
- ErrorBoundary
- devDependencies
- financialReport.service.ts
- scripts
- .oxlintrc.json
- devDependencies
- dependencies
- postgres
- frontend/tsconfig.json

## God Nodes (most connected - your core abstractions)
1. `react` - 32 edges
2. `lucide-react` - 31 edges
3. `App()` - 24 edges
4. `OrderService` - 22 edges
5. `react-router-dom` - 22 edges
6. `framer-motion` - 18 edges
7. `compilerOptions` - 18 edges
8. `drizzle-orm` - 18 edges
9. `PremiumkuService` - 17 edges
10. `scripts` - 17 edges

## Surprising Connections (you probably didn't know these)
- `OrderInvoiceCardProps` --references--> `InvoiceData`  [EXTRACTED]
  frontend/src/components/OrderInvoiceCard.tsx → frontend/src/lib/invoiceData.ts
- `CatalogStore` --references--> `ServiceProduct`  [EXTRACTED]
  frontend/src/lib/useLiveCatalog.ts → frontend/src/lib/mockData.ts
- `App()` --calls--> `ErrorBoundary`  [EXTRACTED]
  frontend/src/App.tsx → frontend/src/components/ErrorBoundary.tsx
- `HeroOrderSimulatorProps` --references--> `ServiceProduct`  [EXTRACTED]
  frontend/src/components/HeroOrderSimulator.tsx → frontend/src/lib/mockData.ts
- `App()` --calls--> `Payment()`  [EXTRACTED]
  frontend/src/App.tsx → frontend/src/pages/Payment.tsx

## Import Cycles
- None detected.

## Communities (42 total, 4 thin omitted)

### Community 0 - "handlers.ts"
Cohesion: 0.09
Nodes (34): ApiClient, CreateBotOrderResponse, Delivery, Order, OrderItem, Payment, Product, ProductCategory (+26 more)

### Community 1 - "frontend/package.json"
Cohesion: 0.05
Nodes (41): dependencies, clsx, framer-motion, lucide-react, react, react-dom, react-router-dom, @supabase/supabase-js (+33 more)

### Community 2 - "whatsapp.service.ts"
Cohesion: 0.10
Nodes (23): runTest(), OrderService, parseMidtransExpiry(), detectIndonesianOperator(), DUMMY_PHONE_PATTERNS, FonnteSendResult, FonnteValidateResult, formatToWhatsAppJid() (+15 more)

### Community 3 - "App.tsx"
Cohesion: 0.12
Nodes (23): App(), PublicLayout(), AdminGuard(), AdminLayout(), Footer(), InstagramIcon(), Navbar(), ScrollToTop() (+15 more)

### Community 4 - "orderQueue.ts"
Cohesion: 0.15
Nodes (18): startServer(), isRedisConnected(), redisConnection, CheckoutJobPayload, enqueueCheckout(), getTicketStatus(), OrderTicketData, TicketStatus (+10 more)

### Community 5 - "agent/skills/antislop-human/contrast-check.py"
Cohesion: 0.13
Nodes (18): contrast_ratio(), linearize(), luminance(), main(), parse_hex(), parse_pairing(), parse_reference_rows(), reference_doc_path() (+10 more)

### Community 6 - "schema.ts"
Cohesion: 0.08
Nodes (23): deliveriesRelations, Delivery, NewDelivery, NewOrder, NewOrderItem, NewPayment, NewProduct, NewProductCategory (+15 more)

### Community 7 - "AdminOrders.tsx"
Cohesion: 0.11
Nodes (24): API_BASE_URL, detectOperator(), DUMMY_PATTERNS, INDONESIAN_OPERATORS, LocalPhoneValidationResult, normalizeToLocalPhone(), RemotePhoneValidationResult, validatePhoneLocal() (+16 more)

### Community 8 - "rateLimiter.ts"
Cohesion: 0.11
Nodes (13): adminAuthLimiter, createOrderLimiter, globalApiLimiter, isWhitelistedRequest(), paymentStatusLimiter, phoneValidationLimiter, router, CreateQrisChargeParams (+5 more)

### Community 9 - "lucide-react"
Cohesion: 0.18
Nodes (17): AppLogo(), AppLogoProps, CaraOrderSection(), FAQSection(), HeroOrderSimulator(), HeroOrderSimulatorProps, MockStep, STEPS (+9 more)

### Community 10 - "agent/skills/antislop-human/contrast-mcp.py"
Cohesion: 0.15
Nodes (18): _channel(), check_contrast(), contrast_ratio(), _error(), main(), relative_luminance(), _reply(), _send() (+10 more)

### Community 11 - "api.ts"
Cohesion: 0.12
Nodes (18): BackendCategory, BackendOrderDetail, BackendOrderResponse, BackendProduct, checkBackendPaymentStatus(), CreateOrderPayload, getBackendOrder(), GetBackendOrderOptions (+10 more)

### Community 12 - "webhook.routes.ts"
Cohesion: 0.15
Nodes (13): app, apiRouter, ADMIN_PHONE_NUMBER, ADMIN_WHATSAPP_JID, cleanPromoMessage(), containsPromoTag(), isSenderAdmin(), isValidChatOrigin() (+5 more)

### Community 13 - "admin.routes.ts"
Cohesion: 0.17
Nodes (14): productCategories, users, adminAuthMiddleware(), AuthenticatedAdminRequest, CachedAdminUser, tokenCache, router, router (+6 more)

### Community 14 - "react"
Cohesion: 0.20
Nodes (14): OrderGuideModalProps, LiveSalesToast(), MaintenanceTooltip(), MaintenanceTooltipProps, enqueueBackendOrder(), fetchRecentSales(), getQueueTicketStatus(), RecentSale (+6 more)

### Community 15 - "compilerOptions"
Cohesion: 0.10
Nodes (19): compilerOptions, allowArbitraryExtensions, allowImportingTsExtensions, erasableSyntaxOnly, jsx, lib, module, moduleDetection (+11 more)

### Community 16 - "premiumku.service.ts"
Cohesion: 0.12
Nodes (8): PremiumkuOrderParams, PremiumkuOrderResponse, PremiumkuOrderStatusResponse, PremiumkuProductsResponse, PremiumkuProfile, PremiumkuProfileResponse, PremiumkuService, PremiumkuStockResponse

### Community 17 - "adminFetch"
Cohesion: 0.14
Nodes (15): adminFetch(), broadcastCatalogProductUpdate(), AdminAnalytics(), AllTimeMetrics, AvailableMonth, MonthlyAverageMetrics, MonthlyBreakdownItem, PeriodMetrics (+7 more)

### Community 18 - "scripts"
Cohesion: 0.12
Nodes (17): scripts, build, check-saldo, db:clear-transactions, db:generate, db:migrate, db:push, db:studio (+9 more)

### Community 19 - "MyOrders.tsx"
Cohesion: 0.31
Nodes (13): OrderInvoiceCard(), OrderInvoiceCardProps, clearOrderSessionToken(), verifyBackendOrderPhone(), DEFAULT_INVOICES, findInvoice(), findInvoiceAsync(), FindInvoiceOptions (+5 more)

### Community 20 - "compilerOptions"
Cohesion: 0.12
Nodes (16): compilerOptions, allowImportingTsExtensions, erasableSyntaxOnly, lib, module, moduleDetection, noEmit, noFallthroughCasesInSwitch (+8 more)

### Community 21 - "db/index.ts"
Cohesion: 0.22
Nodes (7): sqlClient, clearTransactions(), main(), PremiumkuProduct, categorizeProduct(), DEFAULT_CATEGORIES, SyncService

### Community 22 - "order.service.ts"
Cohesion: 0.20
Nodes (9): checkoutQueue, AttemptRecord, verificationAttempts, generateOrderToken(), maskEmail(), maskPhoneNumber(), midtransCheckThrottle, normalizePhone() (+1 more)

### Community 23 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir, resolveJsonModule (+6 more)

### Community 24 - "compilerOptions"
Cohesion: 0.13
Nodes (14): compilerOptions, esModuleInterop, forceConsistentCasingInFileNames, lib, module, moduleResolution, outDir, resolveJsonModule (+6 more)

### Community 25 - "CatalogStore"
Cohesion: 0.26
Nodes (5): CatalogStore, computeServiceTagline(), createPackageFromRaw(), createServiceForProduct(), detectServiceIdForProduct()

### Community 26 - "drizzle-orm"
Cohesion: 0.23
Nodes (5): db, deliveries, orders, router, drizzle-orm

### Community 27 - "backend/package.json"
Cohesion: 0.17
Nodes (11): description, tsx, main, name, type, version, @types/node, ioredis (+3 more)

### Community 28 - "useLiveCatalog.ts"
Cohesion: 0.23
Nodes (6): fetchLiveProducts(), CATEGORIES, Category, ProductPackage, SERVICES, syncLiveServices()

### Community 29 - "bot/package.json"
Cohesion: 0.18
Nodes (10): description, dotenv, tsx, typescript, main, name, type, version (+2 more)

### Community 30 - "dependencies"
Cohesion: 0.20
Nodes (10): dependencies, bullmq, cors, dotenv, drizzle-orm, exceljs, express, express-rate-limit (+2 more)

### Community 31 - "ErrorBoundary"
Cohesion: 0.22
Nodes (3): ErrorBoundary, Props, State

### Community 32 - "devDependencies"
Cohesion: 0.25
Nodes (8): devDependencies, drizzle-kit, tsx, @types/cors, @types/exceljs, @types/express, @types/node, typescript

### Community 33 - "financialReport.service.ts"
Cohesion: 0.32
Nodes (6): FinancialReportService, formatDateWIB(), formatMonthKeyLabel(), MONTH_NAMES_ID, THEME, exceljs

### Community 34 - "scripts"
Cohesion: 0.33
Nodes (6): scripts, build, deploy-commands, deploy-commands:dev, dev, start

### Community 35 - ".oxlintrc.json"
Cohesion: 0.33
Nodes (5): plugins, rules, react/only-export-components, react/rules-of-hooks, $schema

### Community 36 - "devDependencies"
Cohesion: 0.40
Nodes (5): devDependencies, tsx, @types/node, @types/qrcode, typescript

### Community 37 - "dependencies"
Cohesion: 0.50
Nodes (4): dependencies, discord.js, dotenv, qrcode

## Knowledge Gaps
- **13 isolated node(s):** `autoprefixer`, `oxlint`, `postcss`, `tailwindcss`, `@tailwindcss/postcss` (+8 more)
  These have ≤1 connection - possible missing edges. (Counts symbols only; 339 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@types/node` connect `backend/package.json` to `frontend/package.json`, `bot/package.json`?**
  _High betweenness centrality (0.174) - this node is a cross-community bridge._
- **What connects `autoprefixer`, `oxlint`, `postcss` to the rest of the system?**
  _13 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `handlers.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08531073446327683 - nodes in this community are weakly interconnected._
- **Why does `typescript` connect `bot/package.json` to `frontend/package.json`, `backend/package.json`?**
  _High betweenness centrality (0.174) - this node is a cross-community bridge._
- **Should `frontend/package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.046464646464646465 - nodes in this community are weakly interconnected._
- **Why does `drizzle-orm` connect `drizzle-orm` to `financialReport.service.ts`, `orderQueue.ts`, `schema.ts`, `admin.routes.ts`, `db/index.ts`, `order.service.ts`, `backend/package.json`?**
  _High betweenness centrality (0.145) - this node is a cross-community bridge._
- **Should `whatsapp.service.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.09615384615384616 - nodes in this community are weakly interconnected._