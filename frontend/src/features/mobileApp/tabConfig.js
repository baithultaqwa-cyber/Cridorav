import {
  Home,
  ShoppingBag,
  Info,
  Store,
  User,
  BarChart2,
  Clock,
  Settings,
  MoreHorizontal,
  Zap,
  Package,
  Layers,
  Shield,
  TrendingUp,
  Building2,
  Users,
  DollarSign,
  Link2,
  AlertTriangle,
  FileText,
  Bell,
  LogOut,
  FileText as FileTextIcon,
  RefreshCw,
  KeyRound,
  Sliders,
  Warehouse,
  Landmark,
  UserCheck,
} from 'lucide-react'

export const DASHBOARD_ROUTE = {
  admin: '/dashboard/admin',
  vendor: '/dashboard/vendor',
  customer: '/dashboard/customer',
}

export const ROLE_ACCENT = {
  admin: 'var(--gold)',
  vendor: 'var(--silver)',
  customer: 'var(--copper)',
  guest: 'var(--gold)',
}

/** Guest / signed-out public tabs */
export const GUEST_TABS = [
  { id: 'home', label: 'Home', icon: Home, href: '/' },
  { id: 'marketplace', label: 'Market', icon: ShoppingBag, href: '/marketplace' },
  { id: 'how', label: 'How', icon: Info, href: '/how-it-works' },
  { id: 'vendors', label: 'Vendors', icon: Store, href: '/vendors' },
  { id: 'account', label: 'Account', icon: User, href: '/signin' },
]

export const GUEST_MORE = [
  { id: 'why', label: 'Why Cridora', icon: TrendingUp, href: '/why-vendors' },
  { id: 'terms', label: 'Terms', icon: FileTextIcon, href: '/terms' },
]

/** Customer dashboard primary tabs */
export const CUSTOMER_TABS = [
  { id: 'trade', label: 'Trade', icon: ShoppingBag, sectionKey: 'trade' },
  { id: 'portfolio', label: 'Portfolio', icon: BarChart2, sectionKey: 'portfolio' },
  { id: 'marketplace', label: 'Market', icon: Store, href: '/marketplace' },
  { id: 'settings', label: 'Settings', icon: Settings, sectionKey: 'settings' },
  { id: 'more', label: 'More', icon: MoreHorizontal, isMore: true },
]

export const CUSTOMER_MORE = [
  { id: 'signout', label: 'Sign Out', icon: LogOut, action: 'logout' },
]

/**
 * Vendor: 4 primaries + More.
 * Queues hub opens sellback by default; redemptions reachable via segment / more.
 */
export const VENDOR_TABS = [
  { id: 'desk', label: 'Desk', icon: Zap, sectionKey: 'desk' },
  { id: 'portfolio', label: 'Portfolio', icon: BarChart2, sectionKey: 'portfolio' },
  { id: 'queues', label: 'Queues', icon: Layers, sectionKey: 'sellback', queuesHub: true },
  { id: 'catalog', label: 'Catalog', icon: Package, sectionKey: 'catalog' },
  { id: 'more', label: 'More', icon: MoreHorizontal, isMore: true },
]

export const VENDOR_MORE = [
  { id: 'redemptions', label: 'Redemptions', icon: KeyRound, sectionKey: 'redemptions' },
  { id: 'schedule', label: 'Schedule & Hours', icon: Clock, sectionKey: 'schedule' },
  { id: 'pricing', label: 'Pricing', icon: Sliders, sectionKey: 'pricing' },
  { id: 'inventory', label: 'Inventory', icon: Warehouse, sectionKey: 'inventory' },
  { id: 'financials', label: 'Financials', icon: DollarSign, sectionKey: 'financials' },
  { id: 'crosspayments', label: 'Cross payments', icon: Link2, sectionKey: 'crosspayments' },
  { id: 'bank', label: 'Bank & payouts', icon: Landmark, sectionKey: 'bank' },
  { id: 'statements', label: 'Statements', icon: FileText, sectionKey: 'statements' },
  { id: 'team', label: 'Team', icon: Users, sectionKey: 'team' },
  { id: 'customer_kyc', label: 'Customer Verification', icon: UserCheck, sectionKey: 'customer_kyc' },
  { id: 'kyb', label: 'KYB Docs', icon: Shield, sectionKey: 'kyb' },
  { id: 'settings', label: 'Settings', icon: Settings, sectionKey: 'settings' },
  { id: 'signout', label: 'Sign Out', icon: LogOut, action: 'logout' },
]

export const VENDOR_QUEUE_SECTIONS = ['sellback', 'redemptions']

export const ADMIN_TABS = [
  { id: 'overview', label: 'Overview', icon: BarChart2, sectionKey: 'overview' },
  { id: 'kyc', label: 'KYC', icon: Shield, sectionKey: 'kyc' },
  { id: 'transactions', label: 'Txns', icon: TrendingUp, sectionKey: 'transactions' },
  { id: 'vendors', label: 'Vendors', icon: Building2, sectionKey: 'vendors' },
  { id: 'more', label: 'More', icon: MoreHorizontal, isMore: true },
]

export const ADMIN_MORE = [
  { id: 'users', label: 'Users', icon: Users, sectionKey: 'users' },
  { id: 'otp', label: 'OTP', icon: KeyRound, sectionKey: 'otp' },
  { id: 'crosspayments', label: 'Cross payments', icon: Link2, sectionKey: 'crosspayments' },
  { id: 'settlement', label: 'Settlement', icon: DollarSign, sectionKey: 'settlement' },
  { id: 'config', label: 'Fees & Config', icon: Settings, sectionKey: 'config' },
  { id: 'risk', label: 'Risk & Disputes', icon: AlertTriangle, sectionKey: 'risk' },
  { id: 'audit', label: 'Audit Logs', icon: FileText, sectionKey: 'audit' },
  { id: 'notifications', label: 'Notifications', icon: Bell, sectionKey: 'notifications' },
  { id: 'settings', label: 'Settings', icon: Settings, sectionKey: 'settings' },
  { id: 'signout', label: 'Sign Out', icon: LogOut, action: 'logout' },
]

/**
 * Resolve tab + more lists for the current auth / surface.
 * @param {'guest'|'customer'|'vendor'|'admin'} role
 */
export function getTabSets(role) {
  switch (role) {
    case 'customer':
      return { tabs: CUSTOMER_TABS, more: CUSTOMER_MORE, accent: ROLE_ACCENT.customer }
    case 'vendor':
      return { tabs: VENDOR_TABS, more: VENDOR_MORE, accent: ROLE_ACCENT.vendor }
    case 'admin':
      return { tabs: ADMIN_TABS, more: ADMIN_MORE, accent: ROLE_ACCENT.admin }
    default:
      return { tabs: GUEST_TABS, more: GUEST_MORE, accent: ROLE_ACCENT.guest }
  }
}

/** Title for AppTopBar from active section / path. */
export function titleForSection(role, sectionKey, pathname) {
  if (!sectionKey && pathname) {
    if (pathname === '/') return 'Cridora'
    if (pathname.startsWith('/marketplace')) return 'Marketplace'
    if (pathname.startsWith('/how-it-works')) return 'How It Works'
    if (pathname.startsWith('/why-vendors')) return 'Why Cridora'
    if (pathname.startsWith('/vendors')) return 'Vendors'
    if (pathname.startsWith('/demos')) return 'Landing demos'
    if (pathname.startsWith('/tools')) return 'Tools'
    if (pathname.startsWith('/terms')) return 'Terms'
    if (pathname.startsWith('/signin')) return 'Sign In'
    if (pathname.startsWith('/signup')) return 'Sign Up'
    if (pathname.startsWith('/payment')) return 'Payment'
    if (pathname.startsWith('/sell-status')) return 'Sell Status'
    return 'Cridora'
  }
  const map = {
    trade: 'Buy / Sell',
    portfolio: 'Portfolio',
    orders: 'Orders',
    account: 'Account',
    settings: 'Settings',
    desk: 'Sales Desk',
    sellback: 'Sell-back',
    redemptions: 'Redemptions',
    catalog: 'Catalog',
    schedule: 'Schedule',
    pricing: 'Pricing',
    inventory: 'Inventory',
    financials: 'Financials',
    crosspayments: 'Cross payments',
    bank: 'Bank',
    statements: 'Statements',
    team: 'Team',
    customer_kyc: 'Verification',
    kyb: 'KYB',
    overview: 'Overview',
    users: 'Users',
    kyc: 'KYC Queue',
    otp: 'OTP',
    vendors: 'Vendors',
    transactions: 'Transactions',
    settlement: 'Settlement',
    config: 'Fees & Config',
    risk: 'Risk',
    audit: 'Audit',
    notifications: 'Notifications',
  }
  return map[sectionKey] || (role === 'vendor' ? 'Vendor' : role === 'admin' ? 'Admin' : 'Dashboard')
}

/** Whether a tab should show as active given section + path. */
export function isTabActive(tab, { sectionKey, pathname }) {
  if (tab.isMore) {
    return false
  }
  if (tab.queuesHub) {
    return VENDOR_QUEUE_SECTIONS.includes(sectionKey)
  }
  if (tab.href) {
    if (tab.href === '/') return pathname === '/'
    return pathname === tab.href || pathname.startsWith(`${tab.href}/`)
  }
  if (tab.sectionKey) {
    return sectionKey === tab.sectionKey
  }
  return false
}
