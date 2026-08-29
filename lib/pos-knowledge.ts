// Shared knowledge base for the in-app help assistant and onboarding tour.
// Kept in one place so both features describe the app consistently.

// One-line blurbs shown by the sidebar guided tour, keyed by nav href.
export const NAV_DESCRIPTIONS: Record<string, string> = {
  '/dashboard': "Your daily summary — today's sales, profit, and low stock at a glance.",
  '/dashboard/sell': 'Where every sale happens — search products, build a cart, and take payment.',
  '/dashboard/shift': 'Open your shift when you start work, close it when you\'re done.',
  '/dashboard/products': 'Manage what you sell — prices, units, and the full catalog.',
  '/dashboard/stock-history': 'Track stock movements, receive new deliveries, and run stock counts.',
  '/dashboard/suppliers': 'Keep a list of who you buy stock from.',
  '/dashboard/sales': 'Look up any past sale and reopen its receipt.',
  '/dashboard/shift/history': 'Review past shifts across all staff.',
  '/dashboard/reports': 'Revenue and profit trends over time.',
  '/dashboard/users': "Create staff accounts and set who's an admin vs cashier.",
  '/dashboard/settings': 'Store name, logo, and what shows on printed receipts.',
}

export type FaqEntry = {
  question: string
  keywords: string[]
  answer: string
  adminOnly?: boolean
}

export const POS_FAQ: FaqEntry[] = [
  {
    question: 'How do I make a sale?',
    keywords: ['sale', 'sell', 'checkout', 'cart', 'ring up', 'payment'],
    answer:
      'Go to Sell, search or scan for a product to add it to the cart, then adjust quantities with +/-. Enter how much was paid in Cash, Card, and/or Transfer (you can split across all three), then tap "Complete Sale". Attaching a customer is optional.',
  },
  {
    question: 'What happens if I lose internet during a sale?',
    keywords: ['offline', 'internet', 'connection', 'no network', 'wifi'],
    answer:
      'The app keeps working. If you\'re offline when you complete a sale, it\'s saved on this device and shows "Pending sync" on the receipt. A banner at the top tracks unsynced sales and submits them automatically once you\'re back online — you can also tap "Retry now" in that banner.',
  },
  {
    question: 'How do I add or edit a product?',
    keywords: ['product', 'add product', 'edit product', 'price', 'new item'],
    answer:
      'Go to Products (admin only) and use "New Product" to add one, or tap an existing product to edit its name, price, or units. Each product needs at least one unit (e.g. "piece", "carton") with a price and a conversion to the base unit.',
  },
  {
    question: 'How do I receive new stock / restock inventory?',
    keywords: ['receive', 'restock', 'stock in', 'delivery', 'supplier delivery', 'add stock'],
    answer:
      'Go to Stock History → Receive Stock (admin only). Pick the product and supplier, enter the quantity received and cost, and save — this increases stock_quantity and logs the movement in stock history.',
  },
  {
    question: 'What is a stock take / stock count?',
    keywords: ['stock take', 'stocktake', 'count', 'audit', 'reconcile stock'],
    answer:
      'Stock Take (under Stock History) lets you physically count what\'s on the shelf and correct the system\'s recorded quantity if they don\'t match — useful for catching shrinkage or counting errors.',
  },
  {
    question: 'How do suppliers work?',
    keywords: ['supplier', 'vendor', 'distributor'],
    answer:
      'Suppliers (admin only) is where you keep a list of who you buy stock from. You pick a supplier whenever you receive stock, so stock history can tell you where each batch came from.',
  },
  {
    question: 'How do shifts work?',
    keywords: ['shift', 'clock in', 'clock out', 'open shift', 'close shift', 'cash drawer'],
    answer:
      'Shift lets a cashier open a shift at the start of their workday and close it at the end. Closing totals up the sales made during that shift so cash can be reconciled. Shift History (admin only) shows past shifts across all staff.',
  },
  {
    question: 'Where do I see past sales?',
    keywords: ['sales history', 'past sale', 'receipt lookup', 'transaction history'],
    answer:
      'Sales History (admin only) lists every completed sale — tap one to see its full receipt, items, and payment breakdown.',
  },
  {
    question: 'Where do I see reports or business performance?',
    keywords: ['report', 'analytics', 'revenue', 'profit', 'trend', 'performance'],
    answer:
      'Reports (admin only) shows revenue and profit trends over time. The Overview page also shows today\'s totals, profit, and low-stock count at a glance.',
  },
  {
    question: 'What does "low stock" mean and what should I do about it?',
    keywords: ['low stock', 'out of stock', 'reorder', 'inventory low'],
    answer:
      'A product is flagged low-stock when its quantity drops below its reorder threshold. Tap the "Low stock" card on the Overview page (admin) to see the full list, then use Stock History → Receive Stock to top it up.',
  },
  {
    question: 'How do I add a cashier or another user?',
    keywords: ['user', 'cashier account', 'add staff', 'new user', 'permission', 'role'],
    answer:
      'Users (admin only) is where you create accounts for staff and set their role. Admins can see everything; cashiers only see Overview, Sell, and Shift.',
  },
  {
    question: 'How do I change the store name, logo, or receipt footer?',
    keywords: ['settings', 'store name', 'logo', 'receipt footer', 'return policy'],
    answer:
      'Settings (admin only) controls store name, logo, address, phone, receipt footer message, and return policy — these appear on printed/shared receipts.',
  },
  {
    question: 'What\'s the difference between admin and cashier roles?',
    keywords: ['admin', 'cashier', 'role difference', 'permission'],
    answer:
      'Cashiers can sell and manage their own shift. Admins can additionally manage products, stock, suppliers, sales history, shift history, reports, users, and settings.',
  },
]

export const APP_OVERVIEW = `This is a point-of-sale (POS) system for a retail store, priced in Naira (₦). Main areas:
- Overview: today's sales, profit, and low-stock count (admin), or a quick link to start selling (cashier).
- Sell: the checkout screen — search/scan products, build a cart, split payment across cash/card/transfer, optionally attach a customer, complete the sale. Works offline and syncs automatically later.
- Shift: cashiers open/close their work shift; Shift History (admin) reviews past shifts.
- Products (admin): manage the product catalog, prices, and units.
- Stock History (admin): view stock movements, receive new stock from a supplier, and run stock takes/counts.
- Suppliers (admin): manage the list of vendors stock is received from.
- Sales History (admin): browse and reopen past sale receipts.
- Reports (admin): revenue/profit trends over time.
- Users (admin): create staff accounts and assign admin/cashier roles.
- Settings (admin): store name, logo, address, and receipt text.`

// Very small local keyword matcher — used as a zero-cost fallback (and the
// only mode when no AI API key is configured) so the help widget is always
// useful even with no external service wired up.
export function findLocalAnswer(query: string): string | null {
  const q = query.toLowerCase()
  let best: { entry: FaqEntry; score: number } | null = null

  for (const entry of POS_FAQ) {
    let score = 0
    for (const kw of entry.keywords) {
      if (q.includes(kw)) score += kw.split(' ').length
    }
    if (score > 0 && (!best || score > best.score)) {
      best = { entry, score }
    }
  }

  return best ? best.entry.answer : null
}
