// Shared knowledge base for the in-app help assistant and onboarding tour.
// Kept in one place so both features describe the app consistently.
//
// Profit and margin are deliberately absent from everything here. The owner
// asked for margins to stay off the screen, and an assistant that cheerfully
// explains where to find the profit figure would undo that.

// One-line blurbs shown by the sidebar guided tour, keyed by nav href.
// Every entry in the sidebar needs one — a missing key shows a blank tooltip.
export const NAV_DESCRIPTIONS: Record<string, string> = {
  '/dashboard': "Your daily summary — today's takings and low stock at a glance.",
  '/dashboard/sell': 'Where every sale happens — search or scan products, build a cart, and take payment.',
  '/dashboard/shift': "Clock in when you start work, clock out when you're done and count the drawer.",
  '/dashboard/sales': 'Look up a past sale and reopen its receipt. Cashiers see their own sales here.',
  '/dashboard/stock-count': 'Count what is actually on the shelf and send it to the owner. Changes nothing on the system.',
  '/dashboard/products': 'Manage what you sell — retail and wholesale prices, stock, and the full catalogue.',
  '/dashboard/stock-history': 'Track stock movements, receive deliveries, and correct recorded stock.',
  '/dashboard/suppliers': 'The manufacturers and vendors you buy stock from.',
  '/dashboard/customers': 'Your regulars — and every visit each one has made.',
  '/dashboard/shift/history': 'Review past shifts across all staff, and how each drawer balanced.',
  '/dashboard/reports': 'Sales trends, best sellers, and what your stock is worth.',
  '/dashboard/vat': 'VAT charged over a period, for filing.',
  '/dashboard/users': "Create staff accounts and set who's an admin vs cashier.",
  '/dashboard/settings': 'Store name, logo, VAT rate, and what shows on receipts.',
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
      'Go to Sell, search or scan a product to add it to the cart, then adjust quantities with +/-. Enter how much was paid in Cash, Card, and/or Transfer (you can split across all three), then tap "Complete Sale". Attaching a customer is optional.',
  },
  {
    question: 'How do I charge the wholesale price instead of retail?',
    keywords: ['wholesale', 'retail', 'unit', 'bulk price', 'trade price', 'two prices', 'price switch'],
    answer:
      'Every product carries both prices. Add the item to the cart and you will see two small buttons on that line — "Retail" and "Wholesale". Tap Wholesale and the line reprices immediately. It still takes one item off the shelf either way; only the price changes. You can mix them in one sale.',
  },
  {
    question: 'How do I work out a customer’s change?',
    keywords: ['change', 'balance', 'give change', 'cash given', 'how much change'],
    answer:
      'On the Sell screen, under Payment, type what the customer handed you into "Cash given by customer". The change due appears in a green box above the Complete Sale button. It is only a calculator — it does not affect what gets recorded.',
  },
  {
    question: 'How do I scan a barcode?',
    keywords: ['scan', 'barcode', 'camera', 'scanner', 'sku'],
    answer:
      'Tap the camera icon in the search box on the Sell screen and point your phone at the barcode — no scanner hardware needed. Allow camera access the first time. If a code will not read, just type the SKU or product name into the search box instead; it matches as you type.',
  },
  {
    question: 'What happens if I lose internet during a sale?',
    keywords: ['offline', 'internet', 'connection', 'no network', 'wifi'],
    answer:
      'The app keeps working. If you are offline when you complete a sale, it is saved on this device and shows "Pending sync" on the receipt. A banner at the top tracks unsynced sales and submits them automatically once you are back online — you can also tap "Retry now" in that banner.',
  },
  {
    question: 'How do I hold a sale to attend to another customer?',
    keywords: ['hold sale', 'park sale', 'another customer', 'pause sale', 'switch customer', 'multiple customer'],
    answer:
      'On Sell, tap "Hold" above the cart to park the current cart and start fresh. Held sales show as chips above the cart — tap one to bring it back. If you have something else in progress, that gets parked too, so nothing is lost.',
  },
  {
    question: 'Will I lose my cart if I refresh or leave the Sell page?',
    keywords: ['refresh', 'lose cart', 'reload', 'navigate away', 'leave page'],
    answer:
      'No — whatever is in your cart, including the customer and payment amounts, is saved automatically and restored if you refresh the page or come back to Sell later.',
  },
  {
    question: 'How do I refund a customer or take goods back?',
    keywords: ['refund', 'return', 'take back', 'money back', 'giving back', 'reverse sale', 'wrong item'],
    answer:
      'Only an admin can refund. Open the sale from Sales History and choose Return. Set how many of each item are coming back, say how the money is being handed back (cash, card, or transfer — it must add up to the refund due), and add a reason. If the goods are resaleable, leave "restock" ticked and they go back into stock automatically.',
    adminOnly: true,
  },
  {
    question: 'Why can’t I process a refund as a cashier?',
    keywords: ['cannot refund', 'refund blocked', 'only admin', 'permission refund', 'not allowed refund'],
    answer:
      'Refunds are admin-only by design, so money never leaves the till without the owner approving it. Ask an admin to sign in and process the return. A cashier can still look up the sale to show them.',
  },
  {
    question: 'Does a refund affect my drawer at clock-out?',
    keywords: ['refund drawer', 'refund shift', 'cash short', 'variance refund', 'drawer refund'],
    answer:
      'Yes, and it is handled for you. A cash refund is taken off the cash the system expects in your drawer, so handing money back does not make you look short at clock-out. Card and transfer refunds do not touch your cash.',
  },
  {
    question: 'How do shifts work?',
    keywords: ['shift', 'clock in', 'clock out', 'open shift', 'close shift', 'cash drawer', 'float'],
    answer:
      'At the start of work, go to Shift and Clock In with the cash you are starting with (the float). At the end, count the drawer and Clock Out with what you actually have. The system compares that against float + cash sales - cash refunds and records any difference. Shift History (admin) shows past shifts for all staff.',
  },
  {
    question: 'What is a stock count, and does it change my stock?',
    keywords: ['stock count', 'count stock', 'shelf count', 'cashier count', 'physical count'],
    answer:
      'Stock Count is for writing down what is physically on the shelf. It changes nothing on the system — it simply reports to the owner where the shelf and the records disagree. You will not see the expected number while counting, on purpose, so the count stays honest. Use the category filter to do one section at a time rather than the whole shop.',
  },
  {
    question: 'What is the difference between a stock count and a stock take?',
    keywords: ['stock take', 'stocktake', 'difference count take', 'adjust stock', 'correct stock'],
    answer:
      'A Stock Count (any staff) records what is on the shelf and changes nothing. A Stock Take (admin only, under Stock History) actually overwrites the recorded stock with what was counted. The usual flow is: a cashier submits a count, the owner reviews the differences, then does a stock take to correct the records.',
  },
  {
    question: 'How do I add or edit a product?',
    keywords: ['product', 'add product', 'edit product', 'price', 'new item', 'change price'],
    answer:
      'Products (admin only) — use "+ Add Product" for a new one, or tap the pencil on an existing one to change its name, cost, stock, category, or manufacturer. Prices live under Selling Units on the edit screen: change the Retail or Wholesale price there and it saves immediately.',
    adminOnly: true,
  },
  {
    question: 'How do I add many products at once?',
    keywords: ['import', 'bulk', 'csv import', 'many products', 'upload products', 'spreadsheet import'],
    answer:
      'Products → Import CSV (admin only). Download the template first so the column names match, fill it in, then upload. It shows you what it parsed and flags bad rows before anything is created.',
    adminOnly: true,
  },
  {
    question: 'How do I download my product list?',
    keywords: ['download products', 'export products', 'product list', 'stock list', 'csv'],
    answer:
      'Products → Download CSV (admin only). It gives you SKU, name, category, manufacturer, cost, retail and wholesale price, quantity and stock value, with a totals row — ready to open in Excel.',
    adminOnly: true,
  },
  {
    question: 'How do I export sales or stock records?',
    keywords: ['export', 'csv', 'download', 'spreadsheet', 'excel'],
    answer:
      'Sales History, Stock History and Products each have a CSV download (admin only) so you can open your records in Excel or Google Sheets.',
  },
  {
    question: 'How do I receive new stock / restock inventory?',
    keywords: ['receive', 'restock', 'stock in', 'delivery', 'supplier delivery', 'add stock'],
    answer:
      'Stock History → Receive Stock (admin only). Pick the product and supplier, enter the quantity received and what it cost, and save. Stock goes up and the delivery is logged in stock history.',
    adminOnly: true,
  },
  {
    question: 'How does VAT work here?',
    keywords: ['vat', 'tax', 'tax rate', 'add vat', 'charge vat'],
    answer:
      'VAT is added on top of your prices, not taken out of them — so a product marked ₦1,000 at 7.5% comes to ₦1,075. Only an admin can set the rate, under Settings. Leave it blank and no VAT is charged at all. The VAT Report page totals what was charged over a period, for filing.',
  },
  {
    question: 'How do customers work?',
    keywords: ['customer', 'regular', 'customer history', 'who bought', 'customer record'],
    answer:
      'Attaching a customer to a sale is optional — search for them on the Sell screen or add a new one there in a few seconds. Customers (admin only) then lists everyone, and opening one shows every visit they have made and what they bought, so you can see a regular’s whole history.',
  },
  {
    question: 'How do suppliers and manufacturers work?',
    keywords: ['supplier', 'vendor', 'distributor', 'manufacturer', 'who makes'],
    answer:
      'Suppliers (admin only) is the list of who you buy from. Each product can be linked to its manufacturer on the product edit screen, and it shows under the product name in the catalogue — handy when working out what to reorder from whom. You also pick a supplier when receiving stock.',
    adminOnly: true,
  },
  {
    question: 'Where do I see past sales?',
    keywords: ['sales history', 'past sale', 'receipt lookup', 'transaction history'],
    answer:
      'Sales History — tap any sale to see its full receipt, items and payment breakdown. A cashier sees only the sales they rang up themselves; an admin sees everything.',
  },
  {
    question: 'Whose name appears on a receipt?',
    keywords: ['receipt name', 'who sold', 'cashier name', 'served by', 'receipt customer'],
    answer:
      'Every receipt shows the shop name and details at the top, the cashier who served it ("Served by"), and the customer if one was attached. You can share a receipt as an image or print it.',
  },
  {
    question: 'Where do I see reports or business performance?',
    keywords: ['report', 'analytics', 'revenue', 'trend', 'performance', 'best seller'],
    answer:
      'Reports (admin only) shows sales over time, your best-selling products, how customers are paying, and what your stock is currently worth. The Overview page shows today’s takings and low stock at a glance.',
    adminOnly: true,
  },
  {
    question: 'What does "low stock" mean and what should I do about it?',
    keywords: ['low stock', 'out of stock', 'reorder', 'inventory low', 'finished'],
    answer:
      'A product is flagged low-stock when its quantity drops to or below its reorder threshold. Tap the "Low stock" card on the Overview page (admin) to see the list, then use Stock History → Receive Stock to top it up. Out-of-stock items appear greyed out on the Sell screen and cannot be added to a cart.',
  },
  {
    question: 'How do I add a cashier or another user?',
    keywords: ['user', 'cashier account', 'add staff', 'new user', 'permission', 'role', 'deactivate'],
    answer:
      'Users (admin only) is where you create accounts for staff and set their role. You can also deactivate someone — they are locked out at the login screen immediately, without losing any of their past sales.',
    adminOnly: true,
  },
  {
    question: 'What’s the difference between admin and cashier roles?',
    keywords: ['admin', 'cashier', 'role difference', 'what can cashier do'],
    answer:
      'A cashier can sell, run their own shift, look up their own past sales, and submit a stock count. They cannot refund, void, change stock or prices, or see other staff’s sales. An admin can do everything, including products, stock, suppliers, customers, refunds, reports, users and settings.',
  },
  {
    question: 'How do I change the store name, logo, VAT rate, or receipt footer?',
    keywords: ['settings', 'store name', 'logo', 'receipt footer', 'return policy'],
    answer:
      'Settings (admin only) controls store name, logo, address, phone, VAT rate, receipt footer message, and return policy — these appear on printed and shared receipts.',
    adminOnly: true,
  },
  {
    question: 'How do I search for a product?',
    keywords: ['search product', 'find product', 'search item'],
    answer:
      'On the Sell screen, type into the search box at the top — it matches product name or SKU as you type. Until you search, the screen shows 30 products with the in-stock ones first, so what you can actually sell is in front of you.',
  },
  {
    question: 'How do I print barcode labels?',
    keywords: ['label', 'print label', 'barcode label', 'price tag', 'sticker'],
    answer:
      'Products → Print Labels (admin only). Pick the products and how many of each, and it lays out printable labels with the product name, price and a scannable barcode of its SKU.',
    adminOnly: true,
  },
  {
    question: 'How do I delete or deactivate a product?',
    keywords: ['delete product', 'remove product', 'deactivate product'],
    answer:
      'Open the product from Products (admin only) — there is a delete/deactivate option there. Deactivating hides it from the Sell screen without losing its sales history.',
    adminOnly: true,
  },
  {
    question: 'How do I restart the guided tour?',
    keywords: ['tour', 'guided tour', 'walkthrough', 'onboarding'],
    answer:
      'Tap the small "?" icon next to Sign Out in the top-right header — it restarts the sidebar tour any time.',
  },
  {
    question: 'Can I move this help button?',
    keywords: ['move button', 'drag', 'in the way', 'reposition', 'help button'],
    answer:
      'Yes — press and drag it anywhere on the screen. It stays where you put it, so it never has to sit over something you are trying to tap.',
  },
  {
    question: 'Does this app support dark mode?',
    keywords: ['dark mode', 'light mode', 'theme', 'night mode'],
    answer:
      "Yes — it automatically follows your device or browser's dark/light setting. There is no in-app toggle; change it in your system settings and this app will match.",
  },
  {
    question: 'What currency does this use?',
    keywords: ['currency', 'naira', 'dollar'],
    answer: 'Everything is priced in Nigerian Naira (₦).',
  },
  {
    question: 'What can this assistant help with?',
    keywords: ['hello', 'hi', 'hey', 'help', 'what can you do', 'what do you do'],
    answer:
      'I can answer questions about using this app — selling, retail vs wholesale prices, refunds, shifts, stock counts, VAT, customers and settings. Try one of the suggested questions, or ask about a specific screen.',
  },
  {
    question: 'Thanks',
    keywords: ['thank you', 'thanks', 'appreciate'],
    answer: "You're welcome! Anything else you'd like to know about the app?",
  },
]

export const APP_OVERVIEW = `This is a point-of-sale (POS) system for a retail store, priced in Naira (₦). Main areas:
- Overview: today's takings and low-stock count (admin), or a quick link to start selling (cashier).
- Sell: the checkout screen — search or scan products with the phone camera, build a cart, switch any line between its Retail and Wholesale price, split payment across cash/card/transfer, work out change, optionally attach a customer, complete the sale. Works offline and syncs later. The cart survives a refresh, and can be "held" to serve another customer and resumed afterwards.
- Shift: clock in with an opening float, clock out by counting the drawer. Expected cash is the float plus cash sales minus cash refunds. Shift History (admin) reviews past shifts.
- Sales History: past sales and their receipts. Cashiers see only their own; admins see all.
- Stock Count: records what is physically on the shelf and reports the difference to the owner. It never changes recorded stock, and the counter cannot see the expected number.
- Products (admin): the catalogue — cost, retail and wholesale prices, stock, category, manufacturer. Bulk CSV import, CSV download, and printable barcode labels.
- Stock History (admin): stock movements, receiving deliveries from a supplier, and stock takes that correct recorded stock.
- Suppliers (admin): the manufacturers and vendors stock comes from.
- Customers (admin): every customer and their full visit history.
- Returns (admin only): refund a sale from Sales History, with the money split across cash/card/transfer and an option to put the goods back into stock. Cashiers cannot refund.
- Reports (admin): sales trends, best sellers, payment mix, and what stock is worth.
- VAT Report (admin): VAT charged over a period. VAT is added on top of prices, and the rate is set in Settings; blank means no VAT.
- Users (admin): staff accounts, roles, and deactivating someone.
- Settings (admin): store name, logo, address, VAT rate, and receipt text.

Do not discuss profit or margin figures; the owner has asked for those to stay off the screen.`

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
