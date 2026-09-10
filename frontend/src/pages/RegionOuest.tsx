import { useState, useEffect, useMemo, useRef, type FormEvent, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Search, MapPin, CalendarDays, Map as MapIcon, ArrowRight, Star, Phone, Navigation, CalendarCheck,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { Destination } from '../types';
import GalleryModal, { type GalleryItem } from '../components/GalleryModal';
import { placeIdFromName } from '../components/PlaceReviews';
import { withBookingAffiliate, withAgodaAffiliate } from '../lib/affiliate';
import LocalVideo from '../components/LocalVideo';
import LocalAlerts from '../components/LocalAlerts';
import LocalGuides from '../components/LocalGuides';
import { HOTELS, RESTAURANTS, type Hotel } from '../data/places';

// ============ DONNÉES CURATÉES — OUEST CAMEROUN ============

const DISHES: GalleryItem[] = [
  {
    name: 'Nkui', description: "Sauce épaisse et gluante à base d'écorce spéciale râpée, servie exclusivement avec du couscous de maïs — souvent accompagnée de légumes sautés. Traditionnellement recommandée aux jeunes mères.",
    imageUrl: '/images/dish-nkui.jpg',
    images: ['/images/dish-nkui.jpg'],
  },
  {
    name: 'Kondrè', description: 'Ragoût de plantain vert épicé, mijoté avec du bœuf, du porc ou de la chèvre — plat de fête par excellence des grandes tablées familiales.',
    imageUrl: '/images/dish-kondre.jpg',
    images: ['/images/dish-kondre.jpg'],
  },
  {
    sourceUrl: 'https://fr.wikipedia.org/wiki/Vin_de_palme',
    name: 'Vin de raphia', description: "Sève de raphia récoltée et fermentée naturellement — boisson traditionnelle bamiléké par excellence, omniprésente lors des cérémonies et rassemblements de l'Ouest Cameroun.",
    imageUrl: '/images/dish-vin-raphia-1.jpg',
    images: ['/images/dish-vin-raphia-1.jpg', '/images/dish-vin-raphia-2.jpg'],
  },
  {
    name: 'Pommes pilées', description: "Purée de pommes de terre et haricots pilés à l'huile de palme rouge — plat originaire spécifiquement de la région de l'Ouest, traditionnellement consommé au petit-déjeuner dans les villages.",
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Pommes%20pil%C3%A9es%20du%20Cameroun.jpg',
    images: ['https://commons.wikimedia.org/wiki/Special:FilePath/Pommes%20pil%C3%A9es%20du%20Cameroun.jpg'],
  },
];

const ARTISANAT: GalleryItem[] = [
  {
    name: 'Sculpture sur bois', description: 'Masques et statues cérémoniels, sculptés à la main pour orner les cases royales.',
    imageUrl: '/images/artisanat-sculpture-1.jpg',
    images: ['/images/artisanat-sculpture-1.jpg', '/images/artisanat-sculpture-2.webp', '/images/artisanat-sculpture-3.jpg'],
  },
  {
    sourceUrl: 'https://fr.wikipedia.org/wiki/Ndop_(tissu)',
    name: 'Tissu Ndop', description: "Étoffe de coton teinte à l'indigo par une technique de réserve au raphia (ligature), réservée aux rituels royaux. Motifs géométriques blancs sur fond bleu indigo profond, symboles de fertilité, de pouvoir et de protection.",
    imageUrl: 'https://commons.wikimedia.org/wiki/Special:FilePath/Tissu%20ndop%20de%20Bati%C3%A9%20(d%C3%A9tail).jpg',
    images: [
      'https://commons.wikimedia.org/wiki/Special:FilePath/Tissu%20ndop%20de%20Bati%C3%A9%20(d%C3%A9tail).jpg',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Tissus%20Camerounais%20Toghu%20et%20Ndop.jpg',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Vetement%20avec%20du%20Ndop%20camerounais.jpg',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Le%20Ndop%2C%20tissu%20de%20paix%20et%20l%27amour.jpg',
    ],
  },
  {
    name: 'Vannerie & raphia', description: 'Paniers, chapeaux, sièges et objets tressés ou façonnés à partir des palmes de raphia, omniprésents dans la vie quotidienne et le mobilier cérémoniel bamiléké.',
    imageUrl: '/images/artisanat-vannerie-1.webp',
    images: ['/images/artisanat-vannerie-1.webp'],
  },
];

// Établissement ajouté à la demande de l'utilisateur, avec sa vidéo Facebook officielle.
const PETPENLUN_RESORT: Hotel = {
  name: 'Petpenlun Resort', city: 'Ouest Cameroun (Bandjoun / Bafoussam)', stars: 4,
  ratingNote: 'Resort de la région Ouest',
  address: 'Ouest Cameroun',
  description: "Resort situé dans la région de l'Ouest Cameroun, entre Bandjoun et Bafoussam — cadre nature et détente.",
  reviewSummary: "Établissement ajouté récemment à MboaTrip — les avis détaillés seront enrichis prochainement.",
  imageUrl: '/images/hotel-tagidor-1.jpg',
  images: ['/images/hotel-tagidor-1.jpg'],
};

const HOTELS_OUEST = HOTELS.filter((h) => !h.city.includes('Douala'));

// ============ LEXIQUE CULTUREL — BAMILÉKÉ (OUEST) ============
const LEXICON_OUEST = [
  { local: 'Kweeh !', meaning: 'Bonjour / salutation (interjection de bienvenue)' },
  { local: 'Á lèh ?', meaning: 'Comment ça va ?' },
  { local: 'Mbap', meaning: 'Merci' },
  { local: 'Nda', meaning: 'Maison / concession familiale' },
  { local: 'Fo', meaning: 'Chef traditionnel (roi de la chefferie)' },
];

// ============ SPORT & ACTIVITÉS (Ouest) ============
interface SportSpot extends GalleryItem { category: string; }

const SPORTS_OUEST: SportSpot[] = [
  {
    name: 'Stade Omnisports de Bafoussam (Kouekong)', category: 'Stade (20 000 places)',
    description: "Le plus grand stade de la région, utilisé pour la CAN — pelouse naturelle et piste d'athlétisme. Terrain annexe d'entraînement juste à côté.",
    priceInfo: 'Entrée match : 1 000–3 000 FCFA · Matchs internationaux : 2 000–10 000 FCFA · Location pelouse sur devis via l\'ONIES.',
    address: 'Quartier Kouékong, Bafoussam',
    imageUrl: '/images/sport/stade-kouekong-1.webp',
    images: ['/images/sport/stade-kouekong-1.webp', '/images/sport/stade-kouekong-2.webp', '/images/sport/stade-kouekong-3.webp'],
  },
  {
    name: 'Stade Municipal de Bamendzi', category: 'Stade (Elite One)',
    description: "Stade historique modernisé au cœur de Bafoussam, pelouse en gazon synthétique, accueille régulièrement les matchs du championnat national.",
    priceInfo: 'Entrée générale : 1 000 FCFA · Tribune couverte : 2 000–3 000 FCFA.',
    address: 'Quartier Bamendzi, Bafoussam',
    imageUrl: '/images/sport/stade-bamendzi-2.webp',
    images: ['/images/sport/stade-bamendzi-2.webp', '/images/sport/stade-bamendzi-3.webp'],
  },
  {
    name: 'Stade Municipal Fotso Victor', category: 'Complexe omnisports',
    description: "Complexe moderne offert à la commune de Bandjoun, pelouse aux normes et piste d'athlétisme, site officiel d'entraînement pour la CAN.",
    priceInfo: 'Accès gratuit pour regarder les entraînements. Utilisation de groupe : autorisation via la mairie de Bandjoun.',
    address: "Entrée de Bandjoun",
    imageUrl: '/images/sport/stade-fotsovictor-1.webp',
    images: ['/images/sport/stade-fotsovictor-1.webp', '/images/sport/stade-fotsovictor-3.webp'],
  },
  {
    name: 'Terrain de Basket de la Pelouse', category: 'Streetball (gratuit)',
    description: "Le point de rencontre extérieur le plus populaire de Bafoussam pour le basket-ball de rue — ambiance conviviale en fin d'après-midi et le week-end.",
    priceInfo: '100% gratuit, accès libre, aucun abonnement requis.',
    address: 'Avenue de la Pelouse, Bafoussam',
    imageUrl: '/images/sport/basket-pelouse-1.webp',
    images: ['/images/sport/basket-pelouse-1.webp', '/images/sport/basket-pelouse-2.webp', '/images/sport/basket-pelouse-3.webp'],
  },
];

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

interface SearchableSite {
  id: string; name: string; category: string; city: string; thumbnail: string;
}

export default function RegionOuest() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLFormElement>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [galleryItem, setGalleryItem] = useState<GalleryItem | null>(null);
  const [galleryExtra, setGalleryExtra] = useState<ReactNode>(null);
  const [restoCity, setRestoCity] = useState<'Bafoussam' | 'Bandjoun'>('Bafoussam');

  useEffect(() => {
    api.getDestinations({ limit: '10' }).then((res) =>
      setDestinations(res.data.filter((d) => d.name === 'Bandjoun' || d.name === 'Bafoussam'))
    );
  }, []);

  const searchIndex = useMemo<(SearchableSite & { open: () => void })[]>(() => {
    const sites: (SearchableSite & { open: () => void })[] = [];
    destinations.forEach((d) => {
      d.pointsOfInterest?.forEach((poi, i) => {
        sites.push({
          id: `poi-${d.id}-${i}`, name: poi.name, category: t('explore.categoryPOI'), city: d.name, thumbnail: poi.imageUrl,
          open: () => openDish({ name: poi.name, description: poi.description, imageUrl: poi.imageUrl, images: poi.images, sourceUrl: poi.sourceUrl, priceInfo: poi.priceInfo, phone: poi.phone, address: poi.address }),
        });
      });
    });
    HOTELS_OUEST.forEach((h) => {
      sites.push({ id: `hotel-${h.name}`, name: h.name, category: t('explore.categoryHotel'), city: h.city, thumbnail: h.imageUrl, open: () => openHotel(h) });
    });
    RESTAURANTS.filter((r) => r.city === 'Bafoussam' || r.city === 'Bandjoun').forEach((r) => {
      sites.push({
        id: `resto-${r.name}`, name: r.name, category: t('explore.categoryRestaurant'), city: r.city, thumbnail: r.images?.[0] || '',
        open: () => openDish({ name: r.name, description: r.description, imageUrl: r.images?.[0] || '', images: r.images }),
      });
    });
    return sites;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [destinations]);

  const searchResults = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return searchIndex;
    return searchIndex.filter((s) => normalize(s.name).includes(q) || normalize(s.city).includes(q));
  }, [query, searchIndex]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function selectSearchResult(site: SearchableSite & { open: () => void }) {
    site.open(); setQuery(''); setSearchOpen(false);
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (query.trim() && searchResults.length > 0) selectSearchResult(searchResults[0]);
    else setSearchOpen(true);
  }

  function openDish(dish: GalleryItem) {
    setGalleryExtra(null);
    setGalleryItem(dish);
  }

  function openHotel(hotel: Hotel) {
    setGalleryItem(hotel);
    setGalleryExtra(
      <div className="mt-4 pt-4 border-t border-black/5 space-y-3">
        <div className="flex items-center gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Star key={i} size={16} className={i < hotel.stars ? 'fill-gold-500 text-gold-500' : 'text-black/15'} />
          ))}
          <span className="text-xs text-elegant/50">{hotel.ratingNote}</span>
        </div>
        <div>
          <p className="text-xs font-mono text-forest-600 tracking-wide mb-1.5">{t('home.travelerReviews')}</p>
          <p className="text-sm text-elegant/60 leading-relaxed">{hotel.reviewSummary}</p>
        </div>
        <p className="text-xs text-elegant/50 flex items-center gap-1.5"><MapPin size={12} /> {hotel.address}</p>
        <div className="flex gap-2 pt-1 flex-wrap">
          {hotel.phone && (
            <a href={`tel:${hotel.phone}`} className="flex-1 min-w-[100px] text-center px-3 py-2 rounded-xl bg-forest-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5">
              <Phone size={13} /> {t('home.call')}
            </a>
          )}
          {hotel.bookingUrl && (
            <a href={withBookingAffiliate(hotel.bookingUrl)} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[100px] text-center px-3 py-2 rounded-xl bg-[#003580] text-white text-xs font-semibold flex items-center justify-center gap-1.5">
              Booking.com ↗
            </a>
          )}
          {hotel.agodaUrl && (
            <a href={withAgodaAffiliate(hotel.agodaUrl)} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[100px] text-center px-3 py-2 rounded-xl bg-[#5392F9] text-white text-xs font-semibold flex items-center justify-center gap-1.5">
              Agoda ↗
            </a>
          )}
          {hotel.website && (
            <a href={hotel.website} target="_blank" rel="noopener noreferrer" className="flex-1 min-w-[100px] text-center px-3 py-2 rounded-xl border border-black/10 text-xs font-semibold flex items-center justify-center gap-1.5">
              {t('home.morePhotos')} ↗
            </a>
          )}
        </div>
        <Link
          to={`/reserver/${placeIdFromName(hotel.name)}`}
          className="mt-3 w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-gold-500 hover:bg-gold-600 text-elegant text-xs font-bold transition"
        >
          <CalendarCheck size={14} /> {t('booking.requestButton', 'Demander une réservation')}
        </Link>
      </div>
    );
  }

  const bandjoun = destinations.find((d) => d.name === 'Bandjoun');
  const bafoussam = destinations.find((d) => d.name === 'Bafoussam');

  // Se détendre à l'Ouest = les lacs/chutes déjà couverts par l'app, pas de
  // nouveaux établissements — voir les POI "Lac Baleng" / "Chutes de la Métché".
  const relaxSpots = (bafoussam?.pointsOfInterest || []).filter(
    (p) => p.name === 'Lac Baleng' || p.name === 'Chutes de la Métché'
  );

  const poiImageLists = destinations.flatMap((d) =>
    (d.pointsOfInterest || []).map((p) => ({ name: p.name, queue: [...(p.images || [])] }))
  );
  const seenGalleryUrls = new Set<string>();
  const gallery: { img: string; name: string }[] = [];
  let stillHasImages = true;
  while (gallery.length < 8 && stillHasImages) {
    stillHasImages = false;
    for (const poi of poiImageLists) {
      if (gallery.length >= 8) break;
      while (poi.queue.length > 0) {
        const img = poi.queue.shift()!;
        if (seenGalleryUrls.has(img)) continue;
        seenGalleryUrls.add(img);
        gallery.push({ img, name: poi.name });
        stillHasImages = true;
        break;
      }
    }
  }

  const galleryUrls = new Set(gallery.map((g) => g.img));
  const patrimoineExtra = destinations
    .flatMap((d) => d.pointsOfInterest?.flatMap((p) => p.images?.map((img) => ({ img, name: p.name })) || []) || [])
    .filter((item, i, arr) => arr.findIndex((x) => x.img === item.img) === i && !galleryUrls.has(item.img))
    .slice(0, 2);

  const filteredRestaurants = RESTAURANTS.filter((r) => r.city === restoCity);

  return (
    <div>
      {/* ---------- HERO ---------- */}
      <section className="relative h-[420px] flex items-center justify-center text-center overflow-hidden">
        <img src="/images/hero-mountains.jpg" alt="Paysage de l'Ouest Cameroun" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-elegant/60 via-elegant/40 to-elegant/70" />
        <div className="relative z-10 px-6 max-w-2xl">
          <p className="text-gold-400 text-xs font-mono tracking-widest mb-3">RÉGION DE L'OUEST</p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
            <span className="text-forest-400">Bandjoun</span> &amp; <span className="text-gold-400">Bafoussam</span>
          </h1>
          <p className="text-white/80 text-sm mb-8">{t('home.heroSubtitle')}</p>
          <form onSubmit={handleSearch} className="max-w-lg mx-auto relative" ref={searchWrapRef}>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-elegant/40" />
                <input
                  value={query}
                  onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
                  onFocus={() => setSearchOpen(true)}
                  placeholder={t('home.searchPlaceholder')}
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-white/95 backdrop-blur text-sm outline-none"
                />
              </div>
              <button type="submit" className="px-5 py-3 rounded-xl bg-forest-600 hover:bg-forest-700 text-white text-sm font-semibold transition">
                {t('home.searchButton')}
              </button>
            </div>
            {searchOpen && (
              <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl overflow-hidden text-left z-20">
                {searchResults.length === 0 ? (
                  <p className="px-4 py-6 text-sm text-elegant/50 text-center">{t('home.noResults', { query })}</p>
                ) : (
                  <div className="max-h-80 overflow-y-auto py-1.5">
                    {searchResults.map((site) => (
                      <button key={site.id} type="button" onMouseDown={(e) => { e.preventDefault(); selectSearchResult(site); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-graylight transition text-left">
                        {site.thumbnail ? (
                          <img src={site.thumbnail} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                        ) : (
                          <div className="w-10 h-10 rounded-lg bg-graylight shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-elegant truncate">{site.name}</p>
                          <p className="text-xs text-elegant/45">{site.category} · {site.city}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </form>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6">
        <LocalAlerts city="Ouest" />

        {/* ---------- BANDJOUN / BAFOUSSAM ---------- */}
        <section className="py-16 grid grid-cols-1 md:grid-cols-2 gap-6">
          {[{ d: bandjoun, key: 'bandjoun' }, { d: bafoussam, key: 'bafoussam' }].map(({ d, key }) =>
            d ? (
              <Link key={key} to={`/explorer?city=${key}`} className="group relative rounded-2xl overflow-hidden h-72 shadow-lg hover:shadow-2xl transition-shadow">
                <img src={d.imageUrl} alt={d.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-elegant/85 via-elegant/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                  <p className="text-gold-400 text-xs font-mono mb-1">{t('home.westRegion')}</p>
                  <h3 className="font-display text-2xl font-bold mb-2">{d.name}</h3>
                  <p className="text-white/75 text-sm mb-4 line-clamp-2">{d.description}</p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 group-hover:gap-2.5 transition-all">
                    {t('home.seeSitesToVisit', { count: d.pointsOfInterest?.length || 0 })} <ArrowRight size={15} />
                  </span>
                </div>
              </Link>
            ) : null
          )}
        </section>

        {gallery.length > 0 && (
          <section className="py-10">
            <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">{t('home.galleryEyebrow')}</p>
            <h2 className="font-display text-2xl font-bold text-elegant mb-6">{t('home.galleryTitle')}</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {gallery.map((g, i) => (
                <button key={i} onClick={() => openDish({ name: g.name, description: '', imageUrl: g.img })} className="relative rounded-xl overflow-hidden h-40 group text-left">
                  <img src={g.img} alt={g.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  <div className="absolute inset-0 bg-elegant/0 group-hover:bg-elegant/30 transition flex items-end p-2 opacity-0 group-hover:opacity-100">
                    <span className="text-white text-[11px] font-medium">{g.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---------- CULTURE ---------- */}
        <section className="py-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">{t('home.cultureEyebrow')}</p>
            <h2 className="font-display text-2xl font-bold text-elegant mb-4">{t('home.cultureTitle')}</h2>
            <p className="text-elegant/70 text-sm leading-relaxed mb-4">{t('home.cultureText1')}</p>
            <p className="text-elegant/70 text-sm leading-relaxed">{t('home.cultureText2')}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 h-72">
            <div className="rounded-2xl overflow-hidden shadow-lg row-span-2">
              <img src="/images/patrimoine-lion-bandjoun.webp" alt={t('home.lionAlt')} className="w-full h-full object-cover" />
            </div>
            {patrimoineExtra.map((item, i) => (
              <button key={i} onClick={() => openDish({ name: item.name, description: '', imageUrl: item.img })} className="rounded-2xl overflow-hidden shadow-lg">
                <img src={item.img} alt={item.name} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        </section>

        {/* ---------- GASTRONOMIE LOCALE ---------- */}
        <section className="py-16" id="gastronomie-locale">
          <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">{t('home.gastronomyEyebrow')}</p>
          <h2 className="font-display text-2xl font-bold text-elegant mb-2">{t('home.gastronomyTitle')}</h2>
          <p className="text-elegant/60 text-sm max-w-2xl mb-8">{t('home.gastronomySubtitle')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {DISHES.map((plat) => (
              <button key={plat.name} onClick={() => openDish(plat)} className="text-left rounded-2xl overflow-hidden bg-white border border-black/5 shadow-sm hover:shadow-md transition">
                <div className="relative">
                  <img src={plat.imageUrl} alt={plat.name} className="w-full h-40 object-cover" loading="lazy" />
                  {plat.images && plat.images.length > 1 && (
                    <span className="absolute bottom-2 right-2 bg-elegant/70 text-white text-[10px] font-mono px-2 py-0.5 rounded-full">
                      {t('home.photosCount', { count: plat.images.length })}
                    </span>
                  )}
                </div>
                <div className="p-5">
                  <h3 className="font-display font-bold text-elegant mb-1.5">{plat.name}</h3>
                  <p className="text-elegant/60 text-sm leading-relaxed">{plat.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ---------- ARTISANAT ---------- */}
        <section className="py-16">
          <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">{t('home.craftsEyebrow')}</p>
          <h2 className="font-display text-2xl font-bold text-elegant mb-2">{t('home.craftsTitle')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {ARTISANAT.map((item) => (
              <button key={item.name} onClick={() => openDish(item)} className="text-left rounded-2xl overflow-hidden bg-white border border-black/5 shadow-sm hover:shadow-md transition">
                <img src={item.imageUrl} alt={item.name} className="w-full h-36 object-cover" loading="lazy" />
                <div className="p-4">
                  <h3 className="font-display font-bold text-elegant text-sm mb-1">{item.name}</h3>
                  <p className="text-elegant/60 text-xs leading-relaxed">{item.description}</p>
                </div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-elegant/35 mt-4">{t('home.craftsFootnote')}</p>
        </section>

        {/* ---------- HÔTELS & RESORTS ---------- */}
        <section className="py-16">
          <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">{t('home.hotelsEyebrow')}</p>
          <h2 className="font-display text-2xl font-bold text-elegant mb-2">{t('home.hotelsTitle')}</h2>
          <p className="text-elegant/60 text-sm max-w-2xl mb-8">{t('home.hotelsSubtitle')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[...HOTELS_OUEST, PETPENLUN_RESORT].map((hotel) => (
              <button key={hotel.name} onClick={() => openHotel(hotel)} className="text-left rounded-2xl overflow-hidden bg-white border border-black/5 shadow-sm hover:shadow-md transition">
                <div className="relative">
                  <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-36 object-cover" loading="lazy" />
                  <span className="absolute top-2 right-2 bg-white/90 text-elegant text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-0.5">
                    {hotel.stars}<Star size={10} className="fill-gold-500 text-gold-500" />
                  </span>
                </div>
                <div className="p-4">
                  <h3 className="font-display font-bold text-elegant text-sm mb-0.5">{hotel.name}</h3>
                  <p className="text-elegant/50 text-xs flex items-center gap-1"><MapPin size={11} /> {hotel.city}</p>
                </div>
              </button>
            ))}
          </div>
          <p className="text-[11px] text-elegant/35 mt-4">{t('home.hotelsFootnote')}</p>

          {/* Vidéo Petpenlun Resort fournie par l'utilisateur */}
          <div className="mt-8 max-w-sm">
            <p className="text-xs font-mono text-forest-600 tracking-wide mb-2">Petpenlun Resort en vidéo</p>
            <LocalVideo src="/videos/petpenlun-resort.mp4" />
          </div>
        </section>

        {/* ---------- RESTAURANTS ---------- */}
        <section className="py-16">
          <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">{t('home.restaurantsEyebrow')}</p>
          <h2 className="font-display text-2xl font-bold text-elegant mb-4">{t('home.restaurantsTitle')}</h2>
          <div className="flex gap-3 mb-6">
            {(['Bafoussam', 'Bandjoun'] as const).map((city) => (
              <button key={city} onClick={() => setRestoCity(city)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                  restoCity === city ? 'bg-forest-600 text-white border-forest-600' : 'border-black/10 text-elegant/60 hover:border-forest-400'
                }`}>
                {city}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {filteredRestaurants.map((r) => (
              <div key={r.name} className="rounded-2xl overflow-hidden bg-white border border-black/5 shadow-sm">
                {r.images && r.images.length > 0 && (
                  <button onClick={() => openDish({ name: r.name, description: r.description, imageUrl: r.images![0], images: r.images })} className="relative w-full h-36 block group">
                    <img src={r.images[0]} alt={r.name} className="w-full h-full object-cover" loading="lazy" />
                    <span className="absolute bottom-2 right-2 bg-elegant/70 text-white text-[10px] font-mono px-2 py-0.5 rounded-full">
                      {t('home.photosCount', { count: r.images.length })}
                    </span>
                    <span className="absolute inset-0 bg-elegant/0 group-hover:bg-elegant/20 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                      <span className="text-white text-xs font-medium bg-elegant/60 px-3 py-1.5 rounded-full">{t('explore.viewGallery')}</span>
                    </span>
                  </button>
                )}
                <div className="p-5">
                  <div className="flex items-start justify-between mb-1.5">
                    <h3 className="font-display font-bold text-elegant">{r.name}</h3>
                    <span className="text-xs font-mono text-forest-600 flex items-center gap-1 flex-shrink-0">
                      <Star size={12} className="fill-gold-500 text-gold-500" /> {r.rating} ({r.reviewCount})
                    </span>
                  </div>
                  <p className="text-xs text-elegant/40 mb-2">{r.category} · {r.address}</p>
                  {(r.phone || r.hours) && (
                    <p className="text-xs text-elegant/40 mb-2">
                      {r.phone && <a href={`tel:${r.phone}`} className="text-forest-600 font-medium">{r.phone}</a>}
                      {r.phone && r.hours && ' · '}{r.hours}
                    </p>
                  )}
                  <p className="text-sm text-elegant/60 leading-relaxed mb-3">{r.description}</p>
                  <div className="flex gap-2">
                    <a href={r.mapsUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-forest-600 inline-flex items-center gap-1 hover:gap-1.5 transition-all">
                      <Navigation size={12} /> {t('explore.itinerary')}
                    </a>
                    {r.website && (
                      <a href={r.website} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold text-elegant/50 inline-flex items-center gap-1">
                        {t('home.website')} ↗
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-elegant/35 mt-4">{t('home.restaurantsFootnote')}</p>
        </section>

        {/* ---------- SE DÉTENDRE ---------- */}
        {relaxSpots.length > 0 && (
          <section className="py-16">
            <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">SE RESSOURCER</p>
            <h2 className="font-display text-2xl font-bold text-elegant mb-2">Se détendre à l'Ouest</h2>
            <p className="text-elegant/60 text-sm max-w-2xl mb-8">
              Ici, la détente passe par la nature — lacs et chutes au calme — et par les espaces bien-être/spa
              disponibles directement dans certains hôtels, comme au Zingana Hôtel ou à l'Hôtel Foham Oasis.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              {relaxSpots.map((spot) => (
                <button key={spot.name} onClick={() => openDish({ name: spot.name, description: spot.description, imageUrl: spot.imageUrl, images: spot.images, priceInfo: spot.priceInfo })}
                  className="text-left rounded-2xl overflow-hidden bg-white border border-black/5 shadow-sm hover:shadow-md transition">
                  <img src={spot.imageUrl} alt={spot.name} className="w-full h-36 object-cover" loading="lazy" />
                  <div className="p-4">
                    <h3 className="font-display font-bold text-elegant text-sm mb-1.5">{spot.name}</h3>
                    <p className="text-elegant/60 text-xs leading-relaxed line-clamp-2">{spot.description}</p>
                  </div>
                </button>
              ))}
            </div>
          </section>
        )}

        {/* ---------- SPORT & ACTIVITÉS ---------- */}
        <section className="py-16">
          <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">BOUGER</p>
          <h2 className="font-display text-2xl font-bold text-elegant mb-2">Sport & activités</h2>
          <p className="text-elegant/60 text-sm max-w-2xl mb-8">Stades et terrains pour voir un match ou jouer soi-même dans l'Ouest.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SPORTS_OUEST.map((spot) => (
              <button key={spot.name} onClick={() => openDish(spot)} className="text-left rounded-2xl overflow-hidden bg-white border border-black/5 shadow-sm hover:shadow-md transition">
                <img src={spot.imageUrl} alt={spot.name} className="w-full h-28 object-cover" loading="lazy" />
                <div className="p-4">
                  <p className="text-[10px] font-mono text-forest-600 uppercase tracking-wide mb-1">{spot.category}</p>
                  <h3 className="font-display font-bold text-elegant text-sm mb-1.5">{spot.name}</h3>
                  <p className="text-elegant/60 text-xs leading-relaxed line-clamp-2">{spot.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ---------- LEXIQUE CULTUREL ---------- */}
        <section className="py-16">
          <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">SE FAIRE COMPRENDRE</p>
          <h2 className="font-display text-2xl font-bold text-elegant mb-6">Quelques mots en bamiléké</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {LEXICON_OUEST.map((w) => (
              <div key={w.local} className="p-4 rounded-xl bg-graylight">
                <p className="font-display font-bold text-forest-700">{w.local}</p>
                <p className="text-xs text-elegant/55 mt-1">{w.meaning}</p>
              </div>
            ))}
          </div>
        </section>

        <LocalGuides city="Ouest" />

        {/* ---------- ÉVÉNEMENTS ---------- */}
        <section className="pb-16">
          <div className="p-6 rounded-2xl bg-graylight border border-black/5 max-w-md">
            <CalendarDays className="text-elegant/40 mb-3" size={26} />
            <h3 className="font-display font-bold text-elegant mb-1.5">{t('home.eventsTitle')}</h3>
            <p className="text-elegant/50 text-sm">{t('home.eventsText')}</p>
          </div>
        </section>

        {/* ---------- CARTE ---------- */}
        <section className="py-16">
          <div className="relative rounded-2xl overflow-hidden text-white p-10 text-center">
            <img src="/images/route-dschang.jpg" alt={t('home.roadAlt')} className="absolute inset-0 w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-b from-elegant/70 via-elegant/60 to-elegant/85" />
            <div className="relative z-10">
              <MapIcon className="mx-auto text-gold-400 mb-4" size={32} />
              <h2 className="font-display text-2xl font-bold mb-2">{t('home.mapCtaTitle')}</h2>
              <p className="text-white/80 text-sm max-w-lg mx-auto mb-6">{t('home.mapCtaText')}</p>
              <Link to="/explorer" className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gold-500 hover:bg-gold-600 text-elegant font-semibold text-sm transition">
                <MapPin size={16} /> {t('home.openMap')}
              </Link>
            </div>
          </div>
        </section>
      </div>

      {galleryItem && <GalleryModal item={galleryItem} onClose={() => setGalleryItem(null)} extra={galleryExtra} />}
    </div>
  );
}
