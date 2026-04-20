import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import ScrollToTop from './components/ScrollToTop'
import ProtectedRoute from './components/ProtectedRoute'

import Home from './pages/Home'
import Marketplace from './pages/Marketplace'
import HowItWorks from './pages/HowItWorks'
import Vendors from './pages/Vendors'
import SignIn from './pages/SignIn'
import SignUp from './pages/SignUp'
import CustomerDashboard from './pages/dashboard/CustomerDashboard'
import VendorDashboard from './pages/dashboard/VendorDashboard'
import AdminDashboard from './pages/dashboard/AdminDashboard'
import Payment from './pages/Payment'
import SellStatus from './pages/SellStatus'

const HIDE_CHROME = ['/signin', '/signup', '/dashboard', '/payment', '/sell-status']

function Layout() {
  const { pathname } = useLocation()
  const hideChrome = HIDE_CHROME.some((p) => pathname.startsWith(p))

  return (
    <div className="min-h-screen" style={{ background: 'var(--bg-primary)' }}>
      <div className="noise-overlay" />
      {!hideChrome && <Navbar />}
      <Routes>
        {/* Public routes */}
        <Route path="/" element={<Home />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/how-it-works" element={<HowItWorks />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/signin" element={<SignIn />} />
        <Route path="/signup" element={<SignUp />} />

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
      </Routes>
      {!hideChrome && <Footer />}
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ScrollToTop />
        <Layout />
      </AuthProvider>
    </BrowserRouter>
  )
}
