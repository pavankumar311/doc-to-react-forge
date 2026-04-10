import { BrowserRouter, Route, Routes, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { FilterProvider } from "./contexts/FilterContext";
import GlobalHeader from "./components/GlobalHeader";
import Sidebar from "./components/Sidebar";
import FilterBar from "./components/FilterBar";
import Dashboard from "./pages/Dashboard";
import HeatmapPage from "./pages/HeatmapPage";
import MapPage from "./pages/MapPage";
import NetworkPage from "./pages/NetworkPage";
import TrendsPage from "./pages/TrendsPage";
import ModelsPage from "./pages/ModelsPage";
import FairnessPage from "./pages/FairnessPage";
import ReportsPage from "./pages/ReportsPage";
import ChatPage from "./pages/ChatPage";
import SummaryMapsPage from "./pages/SummaryMapsPage";
import CrimesPage from "./pages/CrimesPage";
import BlockDetailPage from "./pages/BlockDetailPage";
import SettingsPage from "./pages/SettingsPage";
import AuditPage from "./pages/AuditPage";
import LoginPage from "./pages/LoginPage";
import SignupPage from "./pages/SignupPage";
import NotFound from "./pages/NotFound";

// Pages that should NOT show the global FilterBar
const PAGES_WITHOUT_FILTERBAR = ["/Summarymaps", "/crimes"];

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
                <Route path="/heatmap" element={<HeatmapPage />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/network" element={<NetworkPage />} />
                <Route path="/trends" element={<TrendsPage />} />
                <Route path="/models" element={<ModelsPage />} />
                <Route path="/models/fairness" element={<FairnessPage />} />
                <Route path="/reports" element={<ReportsPage />} />
                <Route path="/chat" element={<ChatPage />} />
                <Route path="/blocks/:blockId" element={<BlockDetailPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/audit" element={<AuditPage />} />
                <Route path="*" element={<NotFound />} />
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
