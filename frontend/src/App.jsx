import { Routes, Route, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";

const Home = lazy(() => import("./pages/Home"));
const Login = lazy(() => import("./pages/Login"));
const Signup = lazy(() => import("./pages/Signup"));
const About = lazy(() => import("./pages/About"));

const StudentDashboard = lazy(() => import("./pages/student/StudentDashboard"));
import ErrorBoundary from "./components/ErrorBoundary";
const StaffDashboard = lazy(() => import("./pages/staff/StaffDashboard"));
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const Profile = lazy(() => import("./pages/Profile"));

const GuestJoin = lazy(() => import("./pages/guest/GuestJoin"));
const GuestTicket = lazy(() => import("./pages/guest/GuestTicket"));
const GuestEntry = lazy(() => import("./pages/guest/GuestEntry"));



import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import ProtectedRoute from "./components/ProtectedRoute";
import SmoothScroll from "./components/SmoothScroll";
import Chatbot from "./components/Chatbot";
import FeedbackPrompt from "./components/student/FeedbackPrompt";
import { Toaster } from "react-hot-toast";
import ThemeToggle from "./components/ThemeToggle";
import VideoCallModal from "./components/VideoCallModal";


/* ==============================
   Layout Wrapper
================================ */
function Layout({ children }) {
  const location = useLocation();

  /* =========================
     ✅ HASH ROUTER SAFE CHECKS
  ========================= */
  /* =========================
     ✅ HASH ROUTER SAFE CHECKS
  ========================= */
  const path = location.pathname || "/";

  const isGuestRoute =
    path.startsWith("/guest/join") ||
    path.startsWith("/guest/ticket") ||
    path.startsWith("/guest/entry");

  const isAuthRoute =
    path.startsWith("/login") ||
    path.startsWith("/signup");
    
  const isDashboardRoute = 
    path.startsWith("/student") ||
    path.startsWith("/staff") ||
    path.startsWith("/admin") ||
    path.startsWith("/profile");

  const hideLayout = isGuestRoute || isAuthRoute || isDashboardRoute;

  const showFooter = path === "/";

  const isStaffRoute = path.startsWith("/staff");
  const isAdminRoute = path.startsWith("/admin");

  return (
    <div className="relative min-h-screen overflow-hidden transition-colors duration-300 text-[var(--text-primary)]">

      {/* ===== LAYOUT UI ===== */}
      <SmoothScroll />
      {!hideLayout && <Navbar />}
      {(isAuthRoute || isGuestRoute) && <ThemeToggle className="fixed right-4 top-4 z-[60]" />}
      {children}
      <VideoCallModal />
      {isDashboardRoute && <FeedbackPrompt />}
      {!isStaffRoute && !isAdminRoute && !isAuthRoute && !isGuestRoute && <Chatbot />}
      <Toaster 
        position="top-right"
        toastOptions={{
          style: {
            background: 'var(--bg-secondary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--glass-border)',
            backdropFilter: 'blur(10px)',
          },
        }}
      />
      {!hideLayout && showFooter && <Footer />}
    </div>
  );
}

/* ==============================
   App Routes
================================ */
export default function App() {
  return (
    <Layout>
      <Suspense fallback={<div className="min-h-[60vh] flex items-center justify-center text-[var(--text-secondary)]" role="status">Loading KIET Smart Queue…</div>}>
      <Routes>
        {/* =======================
            Public Routes
        ======================== */}
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<About />} />

        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />


        {/* =======================
            Guest Routes
        ======================== */}
        <Route path="/guest/join" element={<GuestJoin />} />
        <Route path="/guest/ticket" element={<GuestTicket />} />
        <Route path="/guest/entry/:qrId" element={<GuestEntry />} />
        <Route path="/guest/join/:sessionToken" element={<GuestJoin />} />



        {/* =======================
            Protected Routes
        ======================== */}
        <Route
          path="/student"
          element={
            <ProtectedRoute allowedRoles={["student"]}>
              <ErrorBoundary>
                <StudentDashboard />
              </ErrorBoundary>
            </ProtectedRoute>
          }
        />

        <Route
          path="/staff"
          element={
            <ProtectedRoute allowedRoles={["staff"]}>
              <StaffDashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/staff/qr-scanner"
          element={
            <ProtectedRoute allowedRoles={["staff"]}>
              <StaffDashboard initialTab="qr" />
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/profile"
          element={
            <ProtectedRoute allowedRoles={["student", "staff", "admin"]}>
              <Profile />
            </ProtectedRoute>
          }
        />
      </Routes>
      </Suspense>
    </Layout>
  );
}
