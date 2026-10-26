import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { MusicProvider } from './contexts/MusicContext';
import Layout from './components/Layout';
import HomePage from './pages/HomePage';
import PostPage from './pages/PostPage';
import NewPostPage from './pages/NewPostPage';
import EditPostPage from './pages/EditPostPage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import AdminPage from './pages/AdminPage';
import ModPage from './pages/ModPage';
import CategoryPage from './pages/CategoryPage';
import CategoriesPage from './pages/CategoriesPage';
import ProfilePage from './pages/ProfilePage';
import LegalNoticePage from './pages/LegalNoticePage';
import PrivacyPage from './pages/PrivacyPage';
import AboutPage from './pages/AboutPage';
import SupportPage from './pages/SupportPage';
import FriendsPage from './pages/FriendsPage';
import ChatPage from './pages/ChatPage';
import EssaysPage from './pages/EssaysPage';
import NewEssayPage from './pages/NewEssayPage';
import StoriesPage from './pages/StoriesPage';
import NewStoryPage from './pages/NewStoryPage';
import DashboardPage from './pages/DashboardPage';
import UsersPage from './pages/UsersPage';
import MaintenanceGate from './components/MaintenanceGate';
import DonatePage from './pages/DonatePage';
import MusicPage from './pages/MusicPage';
import OasisPage from './pages/OasisPage';

// Inner component so useLocation works inside BrowserRouter
function AppRoutes() {
  const location = useLocation();
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/post/:slug" element={<PostPage />} />
      <Route path="/post/:slug/edit" element={<EditPostPage />} />
      <Route path="/new" element={<NewPostPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/mod" element={<ModPage />} />
      <Route path="/category/:slug" element={<CategoryPage />} />
      <Route path="/categories" element={<CategoriesPage />} />
      {/* key=location.key forces ProfilePage to fully remount on every navigation,
          even when username stays the same (e.g. navigating back from Admin). */}
      <Route path="/profile/:username" element={<ProfilePage key={location.key} />} />
      <Route path="/dashboard" element={<DashboardPage />} />
      <Route path="/legal-notice" element={<LegalNoticePage />} />
      <Route path="/impressum" element={<LegalNoticePage />} />
      <Route path="/privacy" element={<PrivacyPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/support" element={<SupportPage />} />
      <Route path="/friends" element={<FriendsPage />} />
      <Route path="/chat/:userId" element={<ChatPage />} />
      <Route path="/essays" element={<EssaysPage />} />
      <Route path="/essays/new" element={<NewEssayPage />} />
      <Route path="/texts" element={<StoriesPage />} />
      <Route path="/texts/new" element={<NewStoryPage />} />
      {/* Legacy URLs — keep old /stories links working */}
      <Route path="/stories" element={<StoriesPage />} />
      <Route path="/stories/new" element={<NewStoryPage />} />
      <Route path="/users" element={<UsersPage />} />
      <Route path="/donate" element={<DonatePage />} />
      <Route path="/music" element={<MusicPage />} />
      <Route path="/oasis" element={<OasisPage />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MusicProvider>
          <MaintenanceGate>
            <Layout>
              <AppRoutes />
            </Layout>
          </MaintenanceGate>
        </MusicProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
