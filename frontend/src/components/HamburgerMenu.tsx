import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  X, UserCircle2, MapPinned, Star, Info, Home, Rss, Map, LogOut, ChevronRight, MessageCircle, Bell, MapPinPlus, Settings,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../lib/auth';
import { useMessaging } from '../lib/messagingContext';
import AccountModal from './AccountModal';

// Régions actives dans l'application. Quand une nouvelle région/ville est
// ajoutée à MboaTrip, elle DOIT être ajoutée ici pour apparaître dans le menu.
const REGIONS = [
  { slug: 'ouest', label: 'Ouest Cameroun', to: '/region/ouest', cities: [
    { slug: 'bandjoun', label: 'Bandjoun' },
    { slug: 'bafoussam', label: 'Bafoussam' },
  ] },
  { slug: 'littoral', label: 'Littoral (Douala)', to: '/region/littoral', cities: [
    { slug: 'douala', label: 'Douala' },
  ] },
];

export default function HamburgerMenu({ onClose }: { onClose: () => void }) {
  const { user, logout } = useAuth();
  const { unreadCount } = useMessaging();
  const location = useLocation();
  const navigate = useNavigate();
  const [accountOpen, setAccountOpen] = useState(false);
  const { t } = useTranslation();

  const NAV_LINKS = [
    { to: '/', label: t('nav.home'), icon: Home },
    { to: '/feed', label: t('nav.feed'), icon: Rss },
    { to: '/messages', label: t('nav.messages', 'Messages'), icon: MessageCircle },
    { to: '/notifications', label: t('nav.notifications', 'Notifications'), icon: Bell },
    { to: '/suggestion-lieu', label: t('nav.suggestPlace', 'Suggérer un lieu'), icon: MapPinPlus },
    { to: '/itineraries', label: t('nav.myTrips'), icon: Map },
    { to: '/parametres', label: t('nav.settings', 'Paramètres'), icon: Settings },
  ];

  function go() {
    onClose();
  }

  function handleAccountClick() {
    if (user) {
      setAccountOpen(true);
    } else {
      onClose();
      navigate('/login');
    }
  }

  return (
    <div className="fixed inset-0 z-[60]">
      <div className="absolute inset-0 bg-elegant/40 backdrop-blur-sm" onClick={onClose} />

      <aside className="absolute top-0 right-0 h-full w-80 max-w-[85vw] bg-white shadow-2xl flex flex-col animate-fadeInUp">
        <div className="flex items-center justify-between px-5 h-16 border-b border-black/5 shrink-0">
          <span className="font-display font-bold text-elegant">{t('menu.title')}</span>
          <button onClick={onClose} className="text-elegant/40 hover:text-elegant transition p-1">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {/* ---- Compte : toujours visible, redirige vers la connexion si besoin ---- */}
          <button
            onClick={handleAccountClick}
            className="w-full flex items-center gap-3 px-5 py-3.5 hover:bg-graylight transition text-left"
          >
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="w-10 h-10 rounded-full object-cover" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-forest-50 flex items-center justify-center">
                <UserCircle2 size={22} className="text-forest-400" />
              </div>
            )}
            <div className="min-w-0">
              <p className="text-sm font-semibold text-elegant truncate">{user ? user.name : t('menu.myAccount')}</p>
              <p className="text-xs text-elegant/50">{user ? t('menu.viewAccount') : t('nav.login')}</p>
            </div>
          </button>

          <div className="h-px bg-black/5 my-2" />

          {/* ---- Régions & villes : toujours visibles, pas besoin de déplier ---- */}
          <p className="flex items-center gap-3 px-5 pt-2 pb-1 text-xs font-mono uppercase tracking-wide text-elegant/40">
            <MapPinned size={14} /> {t('menu.cities')}
          </p>
          <Link to="/explorer" onClick={go} className="flex items-center justify-between pl-11 pr-5 py-2 text-sm text-elegant/70 hover:text-forest-600 hover:bg-graylight transition">
            {t('menu.allCities')} <ChevronRight size={14} className="text-elegant/30" />
          </Link>
          {REGIONS.map((region) => (
            <div key={region.slug}>
              <Link
                to={region.to} onClick={go}
                className="flex items-center justify-between pl-11 pr-5 py-2 text-sm font-semibold text-elegant/85 hover:text-forest-600 hover:bg-graylight transition"
              >
                {region.label} <ChevronRight size={14} className="text-elegant/30" />
              </Link>
              {region.cities.map((c) => (
                <Link
                  key={c.slug} to={`/explorer?city=${c.slug}`} onClick={go}
                  className="flex items-center justify-between pl-16 pr-5 py-1.5 text-sm text-elegant/60 hover:text-forest-600 hover:bg-graylight transition"
                >
                  {c.label} <ChevronRight size={12} className="text-elegant/25" />
                </Link>
              ))}
            </div>
          ))}

          <div className="h-px bg-black/5 my-2" />

          {/* ---- Favoris ---- */}
          {user && (
            <Link
              to="/favoris" onClick={go}
              className="flex items-center gap-3 px-5 py-3 hover:bg-graylight transition text-sm text-elegant/80"
            >
              <Star size={18} className="text-elegant/40" /> {t('menu.myFavorites')}
            </Link>
          )}

          {/* ---- À propos ---- */}
          <Link
            to="/a-propos" onClick={go}
            className="flex items-center gap-3 px-5 py-3 hover:bg-graylight transition text-sm text-elegant/80"
          >
            <Info size={18} className="text-elegant/40" /> {t('menu.about')}
          </Link>

          <div className="h-px bg-black/5 my-2" />

          {/* ---- Navigation générale (utile surtout sur mobile) ---- */}
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to} to={l.to} onClick={go}
              className={`flex items-center gap-3 px-5 py-3 hover:bg-graylight transition text-sm ${
                location.pathname === l.to ? 'text-forest-600 font-medium' : 'text-elegant/70'
              }`}
            >
              <l.icon size={18} className="text-elegant/40" /> {l.label}
              {(l.to === '/messages' || l.to === '/notifications') && unreadCount > 0 && (
                <span className="ml-auto min-w-[20px] h-5 px-1.5 rounded-full bg-gold-500 text-elegant text-[11px] font-bold flex items-center justify-center">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </Link>
          ))}
        </div>

        {user && (
          <div className="border-t border-black/5 p-4 shrink-0">
            <button
              onClick={() => { logout(); onClose(); }}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-graylight hover:bg-black/10 transition text-sm font-medium text-elegant"
            >
              <LogOut size={16} /> {t('menu.logout')}
            </button>
          </div>
        )}
      </aside>

      {accountOpen && <AccountModal onClose={() => setAccountOpen(false)} />}
    </div>
  );
}
