import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { isStandaloneDisplay } from './features/pwa/isStandaloneDisplay'
import { PwaUpdatePrompt } from './features/pwa/PwaUpdatePrompt'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import ProtectedRoute from './components/ProtectedRoute'
import AmbientParticles from './components/AmbientParticles'
import InvestNowBar from './components/InvestNowBar'

import Home from './pages/Home'
import Marketplace from './pages/Marketplace'
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

const HIDE_CHROME = ['/signin', '/signup', '/reset-password', '/dashboard', '/payment', '/sell-status']

function Layout() {
  const { pathname } = useLocation()
  const hideChrome = HIDE_CHROME.some((p) => pathname.startsWith(p))
  // Home docks/pins its own copy of the bar as part of the hero scroll behavior.
  const showInvestBar = !hideChrome && pathname !== '/'

  return (
    <div className="relative min-h-screen min-w-0 overflow-x-hidden bg-transparent">
      <div className="app-bg-ambient" aria-hidden="true">
        <AmbientParticles />
      </div>
      <div className="noise-overlay" />
      <div className="relative z-10 min-w-0">
      {!hideChrome && <Navbar />}
      {showInvestBar && (
        <>
          <InvestNowBar pinned />
          <div style={{ height: 'var(--invest-bar-h)' }} aria-hidden="true" />
        </>
      )}
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/why-vendors" element={<WhyVendors />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route
          path="/tools/uae-digital-gold-comparison"
          element={<UaeDigitalGoldComparison />}
        />
        <Route path="/terms" element={<Terms />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />
        <Route path="/reset-password" element={<ResetPassword />} />

        {/* Protected dashboards */}
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

        {/* /dashboard → redirect based on role (handled by ProtectedRoute) */}
        <Route path="/dashboard" element={
          <ProtectedRoute allowedRoles={['admin', 'vendor', 'customer']}>
            <Navigate to="/dashboard/customer" replace />
          </ProtectedRoute>
        } />

        <Route path="*" element={<NotFound />} />
      </Routes>
      {!hideChrome && <Footer />}
      </div>
    </div>
  )
}

export default function App() {
  useEffect(() => {
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
        <PwaUpdatePrompt />
        <ScrollToTop />
        <Layout />
      </AuthProvider>
    </BrowserRouter>
  )
}
