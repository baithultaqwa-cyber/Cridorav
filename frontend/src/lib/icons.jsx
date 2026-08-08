/* eslint-disable no-unused-vars -- lucide props stripped for animated wrappers */
/**
 * Cridora icon barrel — one Lucide family for web + PWA + dashboards.
 * Animated icons from lucide-animated; remaining names from lucide-react.
 * Generated 2026-08-08. Do not edit by hand —
 * run `node scripts/generate-icons-module.mjs` after adding a new Lucide import.
 */
import { forwardRef } from 'react'
import {
  ActivityIcon,
  ArrowDownRightIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  ArrowUpRightIcon,
  BellIcon,
  CartIcon,
  ChartLineIcon,
  ChartPieIcon,
  CheckCheckIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ChevronUpIcon,
  CircleCheckIcon,
  ClockIcon,
  CopyIcon,
  CreditCardIcon,
  DollarSignIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  FileCheck2Icon,
  FileCheckIcon,
  FileTextIcon,
  FingerprintIcon,
  GavelIcon,
  GripVerticalIcon,
  HeartHandshakeIcon,
  HomeIcon,
  HourglassIcon,
  LayersIcon,
  LockIcon,
  LockOpenIcon,
  LogoutIcon,
  MenuIcon,
  PhoneIcon,
  PlusIcon,
  ReceiptIcon,
  RefreshCcwIcon,
  RefreshCwIcon,
  RotateCcwIcon,
  SearchIcon,
  SendIcon,
  SettingsIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  SparklesIcon,
  TimerIcon,
  TrendingDownIcon,
  TrendingUpIcon,
  TruckIcon,
  UploadIcon,
  UserCheckIcon,
  UserIcon,
  UsersIcon,
  WalletIcon,
  XIcon,
  ZapIcon,
} from 'lucide-animated'
import {
  AlertCircle as LucideAlertCircle,
  AlertTriangle as LucideAlertTriangle,
  Award as LucideAward,
  Banknote as LucideBanknote,
  BarChart2 as LucideBarChart2,
  BarChart3 as LucideBarChart3,
  BellRing as LucideBellRing,
  Building2 as LucideBuilding2,
  Calculator as LucideCalculator,
  Calendar as LucideCalendar,
  Camera as LucideCamera,
  Coins as LucideCoins,
  Edit2 as LucideEdit2,
  ExternalLink as LucideExternalLink,
  Filter as LucideFilter,
  Flag as LucideFlag,
  Gem as LucideGem,
  Globe as LucideGlobe,
  Heart as LucideHeart,
  Image as LucideImage,
  Info as LucideInfo,
  KeyRound as LucideKeyRound,
  Landmark as LucideLandmark,
  LayoutDashboard as LucideLayoutDashboard,
  Link2 as LucideLink2,
  Loader2 as LucideLoader2,
  LogIn as LucideLogIn,
  Mail as LucideMail,
  Minus as LucideMinus,
  MoreHorizontal as LucideMoreHorizontal,
  Newspaper as LucideNewspaper,
  Package as LucidePackage,
  Printer as LucidePrinter,
  Save as LucideSave,
  Scale as LucideScale,
  Share2 as LucideShare2,
  Shield as LucideShield,
  ShieldAlert as LucideShieldAlert,
  ShoppingBag as LucideShoppingBag,
  Smartphone as LucideSmartphone,
  Store as LucideStore,
  Table2 as LucideTable2,
  ToggleLeft as LucideToggleLeft,
  ToggleRight as LucideToggleRight,
  Trash as LucideTrash,
  Trash2 as LucideTrash2,
  UserPlus as LucideUserPlus,
  Warehouse as LucideWarehouse,
  WifiOff as LucideWifiOff,
  XCircle as LucideXCircle,
} from '#lucide-react'

function preferHover() {
  if (typeof window === 'undefined' || !window.matchMedia) return true
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches
}

function asAnimated(Icon) {
  const Wrapped = forwardRef(function CridoraIcon(
    { strokeWidth: _strokeWidth, absoluteStrokeWidth: _absoluteStrokeWidth, animateOnHover, color, style, ...rest },
    ref,
  ) {
    return (
      <Icon
        ref={ref}
        animateOnHover={animateOnHover ?? preferHover()}
        style={{ display: 'inline-flex', lineHeight: 0, ...(color ? { color } : null), ...style }}
        {...rest}
      />
    )
  })
  Wrapped.displayName = Icon.displayName || 'CridoraIcon'
  return Wrapped
}

function asLucide(Icon) {
  const Wrapped = forwardRef(function CridoraLucideIcon({ animateOnHover: _animateOnHover, ...rest }, ref) {
    return <Icon ref={ref} {...rest} />
  })
  Wrapped.displayName = Icon.displayName || Icon.name || 'CridoraLucideIcon'
  return Wrapped
}

const _A_Activity = asAnimated(ActivityIcon)
const _A_ArrowDownRight = asAnimated(ArrowDownRightIcon)
const _A_ArrowLeft = asAnimated(ArrowLeftIcon)
const _A_ArrowRight = asAnimated(ArrowRightIcon)
const _A_ArrowUpRight = asAnimated(ArrowUpRightIcon)
const _A_Bell = asAnimated(BellIcon)
const _A_Check = asAnimated(CheckIcon)
const _A_CheckCheck = asAnimated(CheckCheckIcon)
const _A_CircleCheck = asAnimated(CircleCheckIcon)
const _A_ChevronDown = asAnimated(ChevronDownIcon)
const _A_ChevronLeft = asAnimated(ChevronLeftIcon)
const _A_ChevronRight = asAnimated(ChevronRightIcon)
const _A_ChevronUp = asAnimated(ChevronUpIcon)
const _A_Clock = asAnimated(ClockIcon)
const _A_Copy = asAnimated(CopyIcon)
const _A_CreditCard = asAnimated(CreditCardIcon)
const _A_DollarSign = asAnimated(DollarSignIcon)
const _A_Download = asAnimated(DownloadIcon)
const _A_Eye = asAnimated(EyeIcon)
const _A_EyeOff = asAnimated(EyeOffIcon)
const _A_FileCheck = asAnimated(FileCheckIcon)
const _A_FileCheck2 = asAnimated(FileCheck2Icon)
const _A_FileText = asAnimated(FileTextIcon)
const _A_Fingerprint = asAnimated(FingerprintIcon)
const _A_Gavel = asAnimated(GavelIcon)
const _A_GripVertical = asAnimated(GripVerticalIcon)
const _A_HeartHandshake = asAnimated(HeartHandshakeIcon)
const _A_Home = asAnimated(HomeIcon)
const _A_Hourglass = asAnimated(HourglassIcon)
const _A_Layers = asAnimated(LayersIcon)
const _A_ChartLine = asAnimated(ChartLineIcon)
const _A_Lock = asAnimated(LockIcon)
const _A_Logout = asAnimated(LogoutIcon)
const _A_Menu = asAnimated(MenuIcon)
const _A_Phone = asAnimated(PhoneIcon)
const _A_ChartPie = asAnimated(ChartPieIcon)
const _A_Plus = asAnimated(PlusIcon)
const _A_Receipt = asAnimated(ReceiptIcon)
const _A_RefreshCcw = asAnimated(RefreshCcwIcon)
const _A_RefreshCw = asAnimated(RefreshCwIcon)
const _A_RotateCcw = asAnimated(RotateCcwIcon)
const _A_Search = asAnimated(SearchIcon)
const _A_Send = asAnimated(SendIcon)
const _A_Settings = asAnimated(SettingsIcon)
const _A_ShieldCheck = asAnimated(ShieldCheckIcon)
const _A_Cart = asAnimated(CartIcon)
const _A_SlidersHorizontal = asAnimated(SlidersHorizontalIcon)
const _A_Sparkles = asAnimated(SparklesIcon)
const _A_Timer = asAnimated(TimerIcon)
const _A_TrendingDown = asAnimated(TrendingDownIcon)
const _A_TrendingUp = asAnimated(TrendingUpIcon)
const _A_Truck = asAnimated(TruckIcon)
const _A_LockOpen = asAnimated(LockOpenIcon)
const _A_Upload = asAnimated(UploadIcon)
const _A_User = asAnimated(UserIcon)
const _A_UserCheck = asAnimated(UserCheckIcon)
const _A_Users = asAnimated(UsersIcon)
const _A_Wallet = asAnimated(WalletIcon)
const _A_X = asAnimated(XIcon)
const _A_Zap = asAnimated(ZapIcon)

export const Activity = _A_Activity
export const ArrowDownRight = _A_ArrowDownRight
export const ArrowLeft = _A_ArrowLeft
export const ArrowRight = _A_ArrowRight
export const ArrowUpRight = _A_ArrowUpRight
export const Bell = _A_Bell
export const Check = _A_Check
export const CheckCheck = _A_CheckCheck
export const CheckCircle = _A_CircleCheck
export const ChevronDown = _A_ChevronDown
export const ChevronLeft = _A_ChevronLeft
export const ChevronRight = _A_ChevronRight
export const ChevronUp = _A_ChevronUp
export const Clock = _A_Clock
export const Copy = _A_Copy
export const CreditCard = _A_CreditCard
export const DollarSign = _A_DollarSign
export const Download = _A_Download
export const Eye = _A_Eye
export const EyeOff = _A_EyeOff
export const FileCheck = _A_FileCheck
export const FileCheck2 = _A_FileCheck2
export const FileText = _A_FileText
export const Fingerprint = _A_Fingerprint
export const Gavel = _A_Gavel
export const GripVertical = _A_GripVertical
export const HeartHandshake = _A_HeartHandshake
export const Home = _A_Home
export const Hourglass = _A_Hourglass
export const Layers = _A_Layers
export const LineChart = _A_ChartLine
export const Lock = _A_Lock
export const LogOut = _A_Logout
export const Menu = _A_Menu
export const Phone = _A_Phone
export const PieChart = _A_ChartPie
export const Plus = _A_Plus
export const Receipt = _A_Receipt
export const RefreshCcw = _A_RefreshCcw
export const RefreshCw = _A_RefreshCw
export const RotateCcw = _A_RotateCcw
export const Search = _A_Search
export const Send = _A_Send
export const Settings = _A_Settings
export const ShieldCheck = _A_ShieldCheck
export const ShoppingCart = _A_Cart
export const Sliders = _A_SlidersHorizontal
export const SlidersHorizontal = _A_SlidersHorizontal
export const Sparkles = _A_Sparkles
export const Timer = _A_Timer
export const TrendingDown = _A_TrendingDown
export const TrendingUp = _A_TrendingUp
export const Truck = _A_Truck
export const Unlock = _A_LockOpen
export const Upload = _A_Upload
export const User = _A_User
export const UserCheck = _A_UserCheck
export const Users = _A_Users
export const Wallet = _A_Wallet
export const X = _A_X
export const Zap = _A_Zap

export const AlertCircle = asLucide(LucideAlertCircle)
export const AlertTriangle = asLucide(LucideAlertTriangle)
export const Award = asLucide(LucideAward)
export const Banknote = asLucide(LucideBanknote)
export const BarChart2 = asLucide(LucideBarChart2)
export const BarChart3 = asLucide(LucideBarChart3)
export const BellRing = asLucide(LucideBellRing)
export const Building2 = asLucide(LucideBuilding2)
export const Calculator = asLucide(LucideCalculator)
export const Calendar = asLucide(LucideCalendar)
export const Camera = asLucide(LucideCamera)
export const Coins = asLucide(LucideCoins)
export const Edit2 = asLucide(LucideEdit2)
export const ExternalLink = asLucide(LucideExternalLink)
export const Filter = asLucide(LucideFilter)
export const Flag = asLucide(LucideFlag)
export const Gem = asLucide(LucideGem)
export const Globe = asLucide(LucideGlobe)
export const Heart = asLucide(LucideHeart)
export const Image = asLucide(LucideImage)
export const Info = asLucide(LucideInfo)
export const KeyRound = asLucide(LucideKeyRound)
export const Landmark = asLucide(LucideLandmark)
export const LayoutDashboard = asLucide(LucideLayoutDashboard)
export const Link2 = asLucide(LucideLink2)
export const Loader2 = asLucide(LucideLoader2)
export const LogIn = asLucide(LucideLogIn)
export const Mail = asLucide(LucideMail)
export const Minus = asLucide(LucideMinus)
export const MoreHorizontal = asLucide(LucideMoreHorizontal)
export const Newspaper = asLucide(LucideNewspaper)
export const Package = asLucide(LucidePackage)
export const Printer = asLucide(LucidePrinter)
export const Save = asLucide(LucideSave)
export const Scale = asLucide(LucideScale)
export const Share2 = asLucide(LucideShare2)
export const Shield = asLucide(LucideShield)
export const ShieldAlert = asLucide(LucideShieldAlert)
export const ShoppingBag = asLucide(LucideShoppingBag)
export const Smartphone = asLucide(LucideSmartphone)
export const Store = asLucide(LucideStore)
export const Table2 = asLucide(LucideTable2)
export const ToggleLeft = asLucide(LucideToggleLeft)
export const ToggleRight = asLucide(LucideToggleRight)
export const Trash = asLucide(LucideTrash)
export const Trash2 = asLucide(LucideTrash2)
export const UserPlus = asLucide(LucideUserPlus)
export const Warehouse = asLucide(LucideWarehouse)
export const WifiOff = asLucide(LucideWifiOff)
export const XCircle = asLucide(LucideXCircle)

