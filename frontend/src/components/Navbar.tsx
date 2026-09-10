import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { MapPinned, Menu } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { useMessaging } from '../lib/messagingContext';
import HamburgerMenu from './HamburgerMenu';
import LanguageSwitcher from './LanguageSwitcher';

export default function Navbar() {
  const { user } = useAuth();
  const { unreadCount } = useMessaging();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation();

  const LINKS = [
    { to: '/', label: t('nav.home') },
    { to: '/feed', label: t('nav.feed') },
    { to: '/messages', label: t('nav.messages', 'Messages') },
    { to: '/itineraries', label: t('nav.myTrips') },
  ];

  return (
    <>
    <nav className="sticky top-0 z-40 border-b border-black/5 bg-offwhite/90 backdrop-blur">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 shadow-sm">
            <img src="/images/cameroon-flag-icon.webp" alt="" className="w-full h-full object-cover" />
          </div>
          <span className="font-display font-bold tracking-tight text-lg text-elegant">
            Mboa<span className="text-gold-500">Trip</span>
          </span>
        </Link>

        <div className="hidden sm:flex items-center gap-1">
          <Link
            to="/explorer"
            className={`px-3.5 py-2 rounded-md text-sm font-medium transition flex items-center gap-1 ${
              location.pathname === '/explorer' ? 'text-forest-600' : 'text-elegant/60 hover:text-elegant'
            }`}
          >
            <MapPinned size={15} /> {t('nav.explore')}
          </Link>

          {LINKS.slice(1).map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={`relative px-3.5 py-2 rounded-md text-sm font-medium transition ${
                location.pathname === l.to ? 'text-forest-600' : 'text-elegant/60 hover:text-elegant'
              }`}
            >
              {l.label}
              {l.to === '/messages' && unreadCount > 0 && (
                <span className="absolute -top-0.5 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-gold-500 text-elegant text-[10px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {!user && (
            <Link
              to="/login"
              className="hidden sm:block px-4 py-1.5 rounded-md text-sm font-medium bg-forest-600 text-white hover:bg-forest-700 transition"
            >
              {t('nav.login')}
            </Link>
          )}
          {/* Espace réservé : le vrai bouton menu est fixe (voir plus bas), pour rester
              cliquable même si un style ailleurs sur la page perturbe le "sticky". */}
          <div className="w-24 h-10" aria-hidden="true" />
        </div>
      </div>
      </nav>

      <div className="fixed top-3 right-4 z-50 flex items-center gap-2">
        <LanguageSwitcher />
        <button
          onClick={() => setMenuOpen(true)}
          aria-label="Menu"
          className="relative w-11 h-11 rounded-full bg-white shadow-md border border-black/5 hover:bg-graylight flex items-center justify-center transition text-elegant"
        >
          <Menu size={20} />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-gold-500 text-elegant text-[10px] font-bold flex items-center justify-center border-2 border-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>
      </div>

      {menuOpen && <HamburgerMenu onClose={() => setMenuOpen(false)} />}
    </>
  );
}
