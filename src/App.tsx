import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { FilterProvider } from "./contexts/FilterContext";
import GlobalHeader from "./components/GlobalHeader";
import Sidebar from "./components/Sidebar";
import FilterBar from "./components/FilterBar";
import Dashboard from "./pages/Dashboard";
import TrendsPage from "./pages/TrendsPage";
import ReportsPage from "./pages/ReportsPage";
import ChatPage from "./pages/ChatPage";
import SummaryMapsPage from "./pages/SummaryMapsPage";
import CrimesPage from "./pages/CrimesPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";

// Pages that should NOT show the global FilterBar
const PAGES_WITHOUT_FILTERBAR = ["/Summarymaps", "/crimes", "/chat"];

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const location = useLocation();
  const showFilterBar = !PAGES_WITHOUT_FILTERBAR.includes(location.pathname);

  return (
    <Routes>
      <Route path="/login" element={<AuthRoute><LoginPage /></AuthRoute>} />
      <Route path="/signup" element={<AuthRoute><SignupPage /></AuthRoute>} />
      <Route path="/*" element={
        <ProtectedRoute>
          <GlobalHeader />
          <Sidebar />
          <div className="ml-60 pt-14">
            {showFilterBar && <FilterBar />}
            <main className="p-6">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/Summarymaps" element={<SummaryMapsPage />} />
                <Route path="/crimes" element={<CrimesPage />} />
                <Route path="/trends" element={<TrendsPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        </ProtectedRoute>
      } />
    </Routes>
  );
}

const App = () => (
  <AuthProvider>
    <BrowserRouter>
      <FilterProvider>
        <Toaster />
        <AppRoutes />
      </FilterProvider>
    </BrowserRouter>
  </AuthProvider>
);

export default App;
