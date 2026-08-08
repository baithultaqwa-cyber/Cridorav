import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { isStandaloneDisplay } from './features/pwa/isStandaloneDisplay'
import { PwaUpdatePrompt } from './features/pwa/PwaUpdatePrompt'
import { IosHomeIconRefreshBanner } from './features/pwa/IosHomeIconRefreshBanner'
import InstallNotifyCta from './features/pwa/InstallNotifyCta'
import PwaBootSplash from './features/pwa/PwaBootSplash'
import { initPwaInstallCapture } from './features/pwa/pwaInstallPrompt'
import { AuthProvider } from './context/AuthContext'
import { BottomDockProvider } from './context/BottomDockContext'
import { PublicMobileChrome, useIsMobileApp } from './features/mobileApp'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import ProtectedRoute from './components/ProtectedRoute'
import AmbientParticles from './components/AmbientParticles'
import InvestNowBar from './components/InvestNowBar'
import SerenePage from './components/SerenePage'

import Home from './pages/Home'
import Marketplace from './pages/Marketplace'
import MarketplaceProduct from './pages/MarketplaceProduct'
import HowItWorks from './pages/HowItWorks'
import WhyVendors from './pages/WhyVendors'
import Vendors from './pages/Vendors'
import UaeDigitalGoldComparison from './pages/UaeDigitalGoldComparison'
import Terms from './pages/Terms'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import ResetPassword from './pages/ResetPassword'
import CustomerDashboard from './pages/dashboard/CustomerDashboard'
import VendorDashboard from './pages/dashboard/VendorDashboard'
import AdminDashboard from './pages/dashboard/AdminDashboard'
import Payment from './pages/Payment'
import SellStatus from './pages/SellStatus'
import NotFound from './pages/NotFound'
import DemoHub from './pages/demo/DemoHub'
import DemoAtelier from './pages/demo/DemoAtelier'
import DemoAtelierTheme from './pages/demo/DemoAtelierTheme'
import DemoHtml from './pages/demo/DemoHtml'

const HIDE_CHROME = ['/signin', '/signup', '/reset-password', '/dashboard', '/payment', '/sell-status', '/demos']

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/marketplace" element={<Marketplace />} />
      <Route path="/marketplace/product/:productId" element={<MarketplaceProduct />} />
      <Route path="/how-it-works" element={<HowItWorks />} />
      <Route path="/why-vendors" element={<WhyVendors />} />
      <Route path="/vendors" element={<Vendors />} />
      <Route path="/demos" element={<DemoHub />} />
      <Route path="/demos/atelier" element={<DemoAtelier />} />
      <Route path="/demos/atelier-theme" element={<DemoAtelierTheme />} />
      <Route path="/demos/canvas-scroll" element={<DemoHtml demoId="canvas-scroll" />} />
      <Route path="/demos/ingot-3d" element={<DemoHtml demoId="ingot-3d" />} />
      <Route
        path="/tools/uae-digital-gold-comparison"
        element={<UaeDigitalGoldComparison />}
      />
      <Route path="/terms" element={<Terms />} />
      <Route path="/signin" element={<SignIn />} />
      <Route path="/signup" element={<SignUp />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="/dashboard/customer" element={
        <ProtectedRoute allowedRoles={['customer']}>
          <CustomerDashboard />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/vendor" element={
        <ProtectedRoute allowedRoles={['vendor']}>
          <VendorDashboard />
        </ProtectedRoute>
      } />
      <Route path="/dashboard/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />

      <Route path="/payment/:orderId" element={
        <ProtectedRoute allowedRoles={['customer']}>
          <Payment />
        </ProtectedRoute>
      } />

      <Route path="/sell-status/:sellOrderId" element={
        <ProtectedRoute allowedRoles={['customer']}>
          <SellStatus />
        </ProtectedRoute>
      } />

      <Route path="/dashboard" element={
        <ProtectedRoute allowedRoles={['admin', 'vendor', 'customer']}>
          <Navigate to="/dashboard/customer" replace />
        </ProtectedRoute>
      } />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

function Layout() {
  const { pathname } = useLocation()
  const isMobile = useIsMobileApp()
  const hideChrome = HIDE_CHROME.some((p) => pathname.startsWith(p))
  const showInvestBar = !hideChrome && pathname !== '/' && !isMobile
  const useMobilePublicShell = isMobile && !hideChrome
  const authLikeMobile =
    isMobile &&
    (pathname.startsWith('/signin') ||
      pathname.startsWith('/signup') ||
      pathname.startsWith('/reset-password') ||
      pathname.startsWith('/payment') ||
      pathname.startsWith('/sell-status'))

  return (
    <div className="relative min-h-screen min-h-[100dvh] min-w-0 overflow-x-hidden bg-transparent">
      <div className="app-bg-ambient" aria-hidden="true">
        <AmbientParticles />
      </div>
      <div className="noise-overlay" />
      <div className="relative z-10 min-w-0">
      <BottomDockProvider initialAtBottom={false}>
      {!hideChrome && !isMobile && <Navbar />}
      {showInvestBar && (
        <>
          <InvestNowBar pinned />
          <div style={{ height: 'var(--invest-bar-h)' }} aria-hidden="true" />
        </>
      )}
      {useMobilePublicShell ? (
        <PublicMobileChrome>
          <SerenePage>
            <AppRoutes />
          </SerenePage>
        </PublicMobileChrome>
      ) : authLikeMobile ? (
        <PublicMobileChrome hideTabs showBack>
          <SerenePage>
            <AppRoutes />
          </SerenePage>
        </PublicMobileChrome>
      ) : (
        <SerenePage>
          <AppRoutes />
        </SerenePage>
      )}
      {!hideChrome && !isMobile && <Footer />}
      <InstallNotifyCta />
      </BottomDockProvider>
      </div>
    </div>
  )
}

export default function App() {
  useEffect(() => {
    initPwaInstallCapture()
    const apply = () => {
      document.documentElement.classList.toggle('cridora-pwa-standalone', isStandaloneDisplay())
    }
    apply()
    const mq1 = window.matchMedia('(display-mode: standalone)')
    const mq2 = window.matchMedia('(display-mode: minimal-ui)')
    mq1.addEventListener('change', apply)
    mq2.addEventListener('change', apply)
    return () => {
      mq1.removeEventListener('change', apply)
      mq2.removeEventListener('change', apply)
    }
  }, [])

  return (
    <BrowserRouter>
      <AuthProvider>
        <PwaBootSplash />
        <PwaUpdatePrompt />
        <IosHomeIconRefreshBanner />
        <ScrollToTop />
        <Layout />
      </AuthProvider>
    </BrowserRouter>
  )
}
