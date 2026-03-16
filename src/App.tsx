import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AuthProvider } from "./contexts/AuthContext";
import { FilterProvider } from "./contexts/FilterContext";
import GlobalHeader from "./components/GlobalHeader";
import Sidebar from "./components/Sidebar";
import FilterBar from "./components/FilterBar";
import Dashboard from "./pages/Dashboard";
import HeatmapPage from "./pages/HeatmapPage";
import NetworkPage from "./pages/NetworkPage";
import TrendsPage from "./pages/TrendsPage";
import ModelsPage from "./pages/ModelsPage";
import FairnessPage from "./pages/FairnessPage";
import ReportsPage from "./pages/ReportsPage";
import ChatPage from "./pages/ChatPage";
import BlockDetailPage from "./pages/BlockDetailPage";
import SettingsPage from "./pages/SettingsPage";
import AuditPage from "./pages/AuditPage";
import NotFound from "./pages/NotFound";

const App = () => (
  <AuthProvider>
    <FilterProvider>
      <BrowserRouter>
        <Toaster />
        <GlobalHeader />
        <Sidebar />
        <div className="ml-60 pt-14">
          <FilterBar />
          <main className="p-6">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/heatmap" element={<HeatmapPage />} />
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
      </BrowserRouter>
    </FilterProvider>
  </AuthProvider>
);

export default App;
