import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './lib/auth';
import { MessagingProvider } from './lib/messagingContext';
import { CallProvider } from './lib/callContext';
import CallOverlay from './components/CallOverlay';
import Navbar from './components/Navbar';
import ProtectedRoute from './components/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Home from './pages/Home';

// Découpage du code : chaque page (hors Home, chargée tout de suite pour un
// premier affichage rapide) est dans son propre fichier .js, téléchargé
// seulement quand l'utilisateur navigue vers cette page — accélère le tout
// premier chargement de l'app, surtout sur mobile/connexion lente.
const RegionOuest = lazy(() => import('./pages/RegionOuest'));
const RegionLittoral = lazy(() => import('./pages/RegionLittoral'));
const ExploreMap = lazy(() => import('./pages/ExploreMap'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const Itineraries = lazy(() => import('./pages/Itineraries'));
const Feed = lazy(() => import('./pages/Feed'));
const Messages = lazy(() => import('./pages/Messages'));
const BookingPage = lazy(() => import('./pages/BookingPage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const Favorites = lazy(() => import('./pages/Favorites'));
const About = lazy(() => import('./pages/About'));
const SharedItinerary = lazy(() => import('./pages/SharedItinerary'));
const Notifications = lazy(() => import('./pages/Notifications'));
const SuggestPlace = lazy(() => import('./pages/SuggestPlace'));
const SettingsPage = lazy(() => import('./pages/Settings'));

function PageFallback() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <div className="w-8 h-8 rounded-full border-2 border-forest-600 border-t-transparent animate-spin" />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <MessagingProvider>
        <CallProvider>
          <Navbar />
          <ErrorBoundary>
            <CallOverlay />
          </ErrorBoundary>
          <ErrorBoundary>
            <Suspense fallback={<PageFallback />}>
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/region/ouest" element={<RegionOuest />} />
                <Route path="/region/littoral" element={<RegionLittoral />} />
                <Route path="/explorer" element={<ExploreMap />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/mot-de-passe-oublie" element={<ForgotPassword />} />
                <Route path="/feed" element={<Feed />} />
                <Route path="/a-propos" element={<About />} />
                {/* Page publique ouverte via un lien copié/envoyé — pas besoin de compte */}
                <Route path="/itineraries/partages/:id" element={<SharedItinerary />} />
                {/* /admin/login existait en page séparée ; redirige vers la connexion commune */}
                <Route path="/admin/login" element={<Navigate to="/login" replace />} />
                <Route path="/admin" element={<AdminDashboard />} />
                <Route path="/reserver/:hotelSlug" element={<BookingPage />} />
                <Route
                  path="/messages"
                  element={
                    <ProtectedRoute>
                      <Messages />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/favoris"
                  element={
                    <ProtectedRoute>
                      <Favorites />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/itineraries"
                  element={
                    <ProtectedRoute>
                      <Itineraries />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/notifications"
                  element={
                    <ProtectedRoute>
                      <Notifications />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/suggestion-lieu"
                  element={
                    <ProtectedRoute>
                      <SuggestPlace />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="/parametres"
                  element={
                    <ProtectedRoute>
                      <SettingsPage />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </CallProvider>
        </MessagingProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
