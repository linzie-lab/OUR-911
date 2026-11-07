import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import AppShell from "./components/AppShell.jsx";
import { Loading } from "./components/Ui.jsx";
import { AuthProvider } from "./context/AuthContext.jsx";
import AuthPage from "./pages/AuthPage.jsx";
import ActivityPage from "./pages/ActivityPage.jsx";
import AdminConsole from "./pages/AdminConsole.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import DamuConnect from "./pages/DamuConnect.jsx";
import EmergencyContacts from "./pages/EmergencyContacts.jsx";
import FacilityDirectory from "./pages/FacilityDirectory.jsx";
import FirstAidCompanion from "./pages/FirstAidCompanion.jsx";
import ForgotPasswordPage from "./pages/ForgotPasswordPage.jsx";
import IncidentReporting from "./pages/IncidentReporting.jsx";
import PrivacyPage from "./pages/PrivacyPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import WelcomePage from "./pages/WelcomePage.jsx";
import { useAuth } from "./context/AuthContext.jsx";

const IntelligenceDashboard = lazy(
  () => import("./pages/IntelligenceDashboard.jsx"),
);

function HomePage() {
  const { user, guest, loading } = useAuth();
  if (loading) return <Loading label="Loading your portal…" />;
  return user || guest ? <Dashboard /> : <WelcomePage />;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/welcome" element={<WelcomePage />} />
          <Route path="/login" element={<AuthPage />} />
          <Route path="/register" element={<AuthPage />} />
          <Route path="/forgot-password" element={<ForgotPasswordPage />} />
          <Route path="/incidents" element={<IncidentReporting />} />
          <Route path="/activity" element={<ActivityPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/settings" element={<ProfilePage settings />} />
          <Route path="/admin" element={<AdminConsole />} />
          <Route path="/emergency-contacts" element={<EmergencyContacts />} />
          <Route path="/privacy" element={<PrivacyPage />} />
          <Route
            path="/intelligence"
            element={
              <Suspense fallback={<Loading label="Loading Health Intelligence…" />}>
                <IntelligenceDashboard />
              </Suspense>
            }
          />
          <Route path="/damuconnect" element={<DamuConnect />} />
          <Route path="/facilities" element={<FacilityDirectory />} />
          <Route path="*" element={<Navigate replace to="/" />} />
        </Route>
        <Route path="/first-aid" element={<FirstAidCompanion />} />
      </Routes>
    </AuthProvider>
  );
}
