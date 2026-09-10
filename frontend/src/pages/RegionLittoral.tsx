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
import LocalAlerts from '../components/LocalAlerts';
import LocalGuides from '../components/LocalGuides';
import { HOTELS, RESTAURANTS, type Hotel } from '../data/places';

// ============ DONNÉES CURATÉES — LITTORAL (DOUALA / SAWA) ============

const SAWA_DISHES: GalleryItem[] = [
  {
    sourceUrl: 'https://fr.wikipedia.org/wiki/Ndol%C3%A9',
    name: 'Ndolé', description: "Le plat roi de Douala. Feuilles de ndolé (plante potagère amère) lavées puis cuites avec une pâte d'arachides fraîches écrasées, ail et épices. Garni au choix de crevettes, bœuf ou poisson fumé, servi avec miondos ou plantains frits.",
    imageUrl: '/images/dish-ndole-douala-1.jpg',
    images: [
      '/images/dish-ndole-douala-1.jpg',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Ndol%C3%A9%20camerounais.JPG',
      'https://commons.wikimedia.org/wiki/Special:FilePath/Le%20ndol%C3%A8%2C%20plat%20mythique%20camerounais..jpg',
    ],
  },
  {
    name: 'Ndomba de poisson', description: "Poisson frais (bar, capitaine ou carpe) mariné aux épices locales (pebe, djansang, piment, ail), enveloppé dans plusieurs couches de feuilles de bananier et cuit lentement à l'étouffée sur la braise ou à la vapeur.",
    imageUrl: '/images/dish-ndomba-1.jpg',
    images: ['/images/dish-ndomba-1.jpg',],
  },
  {
    name: 'Poulet DG', description: "À l'origine réservé aux personnes de haut rang (d'où son nom), ce ragoût de poulet frit est aujourd'hui incontournable des fêtes à Douala : sauce tomate gourmande, légumes croquants et bananes plantains mûres frites en note sucrée-salée.",
    imageUrl: '/images/dish-pouletdg-sawa-1.webp',
    images: ['/images/dish-pouletdg-sawa-1.webp',],
  },
  {
    name: 'Koki', description: "Gâteau salé à base de cornilles (haricots blancs à œil noir) écrasées en pâte fine, battue à la main avec eau, piment et huile de palme rouge pour sa couleur dorée. Cuit à la vapeur en papillote de feuilles de bananier.",
    imageUrl: '/images/dish-koki-sawa-1.jpg',
    images: ['/images/dish-koki-sawa-1.jpg',],
  },
  {
    name: 'Esuba et poisson braisé', description: "Poisson (bar ou maquereau) entaillé, enduit d'un massé (marinade locale épicée) et grillé au charbon de bois — expérience emblématique au bord du Wouri, à Youpwe ou Deido. Servi avec l'esuba (plantain mûr bouilli) ou des frites de manioc.",
    imageUrl: '/images/dish-esuba-poisson-1.jpg',
    images: ['/images/dish-esuba-poisson-1.jpg', '/images/dish-esuba-poisson-2.jpg',],
  },
];

const HOTELS_LITTORAL = HOTELS.filter((h) => h.city.includes('Douala'));

// ============ LEXIQUE CULTUREL — SAWA/DUALA (LITTORAL) ============
const LEXICON_LITTORAL = [
  { local: 'Mbolo', meaning: 'Bonjour / salut' },
  { local: 'Nje weki ?', meaning: 'Comment vas-tu ?' },
  { local: 'Mese', meaning: 'Merci' },
  { local: 'Ndolo', meaning: 'Amour, affection (aussi le nom du plat emblématique)' },
  { local: 'Wonja', meaning: 'Le fleuve (référence au Wouri, cœur de la vie sawa)' },
];

// ============ BIEN-ÊTRE & DÉTENTE (spas, instituts, sport) ============
// Infos et tarifs communiqués par l'utilisateur (relevés août 2026).
interface WellnessSpot extends GalleryItem { category: string; }

const WELLNESS_DOUALA: WellnessSpot[] = [
  {
    name: 'Krystal Spa Douala', category: 'Spa hôtelier haut de gamme',
    description: "Centre de bien-être exclusif au sein de l'hôtel 5★ Krystal Palace : massages signatures, grand hammam, sauna, soins du visage avancés et accès à une somptueuse piscine extérieure.",
    priceInfo: 'Massages : 25 000–55 000 FCFA · Hammam + gommage : ~30 000 FCFA · Abonnement mensuel (fitness+piscine+spa) : 100 000–150 000 FCFA.',
    address: 'Boulevard de la Liberté, Quartier Akwa, Douala', phone: '+237656232993',
    imageUrl: '/images/douala-hotel-krystal-1.jpg', images: ['/images/douala-hotel-krystal-1.jpg'],
  },
  {
    name: 'Palladium Spa', category: 'Institut urbain',
    description: "Institut de beauté et bien-être réputé pour son accueil chaleureux et sa décoration soignée aux lumières tamisées : massages relaxants, gommages corporels, rituels personnalisés, manucure et pédicure.",
    priceInfo: 'Massages dès 15 000 FCFA · Onglerie 2 000–5 000 FCFA · Soins corporels dès 5 000 FCFA · Packs promo jusqu\'à -30%.',
    address: 'Bonamoussadi, à côté de la Sic House, face au lounge Opium, Douala 5ème', phone: '+237694009769',
    imageUrl: '/images/douala2/palais-sawa.jpg', images: ['/images/douala2/palais-sawa.jpg'],
  },
  {
    name: 'Aura Spa Center & Beauty', category: 'Spa moderne & holistique',
    description: "Oasis de bien-être combinant soins esthétiques de pointe et relaxation pure, avec diagnostic complet avant les soins de peau : massages aux pierres chaudes, lipo-cavitation, hammam, coiffure et espace gaming.",
    priceInfo: 'Massages 5 000–25 000 FCFA · Coiffure dès 2 000 FCFA · Onglerie dès 5 000 FCFA · Gaming dès 1 000 FCFA.',
    address: 'Quartier Makepe BM, face au dépôt de gaz, Douala', phone: '+237689374304',
    imageUrl: '/images/wellness/aura-spa-1.webp', images: ['/images/wellness/aura-spa-1.webp', '/images/wellness/aura-spa-2.webp', '/images/wellness/aura-spa-3.webp', '/images/wellness/aura-spa-4.webp'],
  },
  {
    name: "Spa de l'Hôtel La Falaise", category: 'Spa hôtelier (Bonapriso)',
    description: "Hammam oriental traditionnel, massages relaxants et superbe piscine en mezzanine pour nager au calme.",
    priceInfo: 'Nuitée hôtel dès 134 840 FCFA · Massages dès ~20 000 FCFA · Abonnement fitness+piscine ~80 000–120 000 FCFA/mois.',
    address: 'Rue Njo-Njo, Bonapriso, Douala', phone: '+237656006444',
    imageUrl: '/images/douala-hotel-falaise-1.jpg', images: ['/images/douala-hotel-falaise-1.jpg'],
  },
  {
    name: "Espace Bien-Être de l'Hôtel Akwa Palace", category: 'Spa hôtelier (Akwa)',
    description: "Hammam chauffé à 40°C, soins sur mesure et grande piscine extérieure, sur le Boulevard de la Liberté.",
    priceInfo: 'Accès piscine journée (non-résidents) : 5 000–10 000 FCFA · Abonnements combinés à l\'année/trimestre.',
    address: '940 Boulevard de la Liberté, Akwa, Douala', phone: '+237233422601',
    imageUrl: '/images/douala-hotel-akwapalace-1.jpg', images: ['/images/douala-hotel-akwapalace-1.jpg'],
  },
  {
    name: 'Nature Divine Beauty & Spa', category: 'Institut de beauté (petits prix)',
    description: "Formules complètes incluant pédicure spa, soins du corps et massages, idéal dans le nord de la ville.",
    priceInfo: 'Massages et soins à tarifs très abordables (petits prix).',
    address: 'Bonamoussadi, Douala', phone: '+237693426612',
    imageUrl: '/images/wellness/nature-divine-1.webp', images: ['/images/wellness/nature-divine-1.webp', '/images/wellness/nature-divine-2.webp', '/images/wellness/nature-divine-3.webp', '/images/wellness/nature-divine-4.webp', '/images/wellness/nature-divine-5.webp'],
  },
  {
    name: 'Le Discophage', category: 'Bar lounge (ambiance rétro)',
    description: "Bar réputé pour son ambiance feutrée, sa musique douce des années 80-90 et ses excellents mojitos — pour une détente en soirée, verre en main.",
    address: 'Rue des Palmiers, Bonapriso, Douala', phone: '+237699501707',
    imageUrl: '/images/wellness/discophage-1.webp', images: ['/images/wellness/discophage-1.webp', '/images/wellness/discophage-2.webp', '/images/wellness/discophage-3.webp', '/images/wellness/discophage-4.webp'],
  },
  {
    name: 'Kimalé Multisports', category: 'Complexe sportif couvert',
    description: "Grand complexe moderne entièrement couvert (Youpwé, zone portuaire) : futsal, padel, basketball, volleyball, espace gaming FIFA, buvette et parking sécurisé 40 places.",
    priceInfo: 'Location terrain dès 5 000 FCFA/heure · Abonnement équipe trimestriel : 90 000 FCFA · Ouvert 7h–minuit tous les jours.',
    address: 'Route du débarcadère de Youpwé, près de Bocom, Douala', phone: '+237699237237',
    imageUrl: '/images/sport/kimale-1.webp', images: ['/images/sport/kimale-1.webp', '/images/sport/kimale-2.webp', '/images/sport/kimale-3.webp', '/images/sport/kimale-4.webp', '/images/sport/kimale-5.webp'],
  },
  {
    name: "O'Sport Bonapriso", category: 'Salle de sport & fitness',
    description: "Salle de musculation et cardio dernière génération, cours collectifs (Fitness, Zumba), arts martiaux avec ring de boxe, sauna et hammam, coach privé possible.",
    priceInfo: 'Formule Essentiel : 35 000 FCFA/mois · Original : 40 000 FCFA/mois · Ultra : 80 000 FCFA/mois. Lun–sam 6h–22h, dim 7h–22h.',
    address: '806 Rue Philippe, Bonapriso, Douala', phone: '+237699244301',
    imageUrl: '/images/wellness/osport-1.webp', images: ['/images/wellness/osport-1.webp', '/images/wellness/osport-2.webp', '/images/wellness/osport-3.webp', '/images/wellness/osport-4.webp', '/images/wellness/osport-5.webp', '/images/wellness/osport-6.webp'],
  },
];

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

interface SearchableSite {
  id: string; name: string; category: string; city: string; thumbnail: string;
}

export default function RegionLittoral() {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLFormElement>(null);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [galleryItem, setGalleryItem] = useState<GalleryItem | null>(null);
  const [galleryExtra, setGalleryExtra] = useState<ReactNode>(null);
  const [restoArea, setRestoArea] = useState<'Bonapriso' | 'Akwa'>('Bonapriso');

  useEffect(() => {
    api.getDestinations({ limit: '10' }).then((res) =>
      setDestinations(res.data.filter((d) => d.name === 'Douala'))
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
    HOTELS_LITTORAL.forEach((h) => {
      sites.push({ id: `hotel-${h.name}`, name: h.name, category: t('explore.categoryHotel'), city: h.city, thumbnail: h.imageUrl, open: () => openHotel(h) });
    });
    RESTAURANTS.filter((r) => r.city.includes('Douala')).forEach((r) => {
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

  const douala = destinations.find((d) => d.name === 'Douala');

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

  const filteredRestaurants = RESTAURANTS.filter((r) => r.city.includes('Douala') && r.city.includes(restoArea));

  return (
    <div>
      {/* ---------- HERO ---------- */}
      <section className="relative h-[420px] flex items-center justify-center text-center overflow-hidden">
        <img src="/images/highlights/douala.png" alt="Douala" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-elegant/60 via-elegant/40 to-elegant/70" />
        <div className="relative z-10 px-6 max-w-2xl">
          <p className="text-gold-400 text-xs font-mono tracking-widest mb-3">RÉGION DU LITTORAL</p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
            <span className="text-forest-400">Douala</span>
          </h1>
          <p className="text-white/80 text-sm mb-8">Capitale économique du Cameroun, culture Sawa, bord du fleuve Wouri.</p>
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
        <LocalAlerts city="Douala" />

        {/* ---------- DOUALA ---------- */}
        {douala && (
          <section className="py-16">
            <Link to="/explorer?city=douala" className="group relative rounded-2xl overflow-hidden h-72 shadow-lg hover:shadow-2xl transition-shadow block max-w-xl">
              <img src={douala.imageUrl} alt={douala.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-elegant/85 via-elegant/20 to-transparent" />
              <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
                <p className="text-gold-400 text-xs font-mono mb-1">Littoral</p>
                <h3 className="font-display text-2xl font-bold mb-2">{douala.name}</h3>
                <p className="text-white/75 text-sm mb-4 line-clamp-2">{douala.description}</p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 group-hover:gap-2.5 transition-all">
                  {t('home.seeSitesToVisit', { count: douala.pointsOfInterest?.length || 0 })} <ArrowRight size={15} />
                </span>
              </div>
            </Link>
          </section>
        )}

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

        {/* ---------- CULTURE SAWA ---------- */}
        <section className="py-16 grid grid-cols-1 md:grid-cols-2 gap-10 items-center">
          <div>
            <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">{t('home.cultureSawaEyebrow')}</p>
            <h2 className="font-display text-2xl font-bold text-elegant mb-4">{t('home.cultureSawaTitle')}</h2>
            <p className="text-elegant/70 text-sm leading-relaxed mb-4">{t('home.cultureSawaText1')}</p>
            <p className="text-elegant/70 text-sm leading-relaxed">{t('home.cultureSawaText2')}</p>
          </div>
          <div className="rounded-2xl overflow-hidden h-72 shadow-lg">
            <img src="/images/douala-nouvelle-liberte-1.jpg" alt={t('home.newBellAlt')} className="w-full h-full object-cover" />
          </div>
        </section>

        {/* ---------- GASTRONOMIE LOCALE ---------- */}
        <section className="py-16" id="gastronomie-locale">
          <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">{t('home.gastronomySawaEyebrow')}</p>
          <h2 className="font-display text-2xl font-bold text-elegant mb-2">{t('home.gastronomySawaTitle')}</h2>
          <p className="text-elegant/60 text-sm max-w-2xl mb-8">{t('home.gastronomySawaSubtitle')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {SAWA_DISHES.map((plat) => (
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

        {/* ---------- HÔTELS ---------- */}
        <section className="py-16">
          <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">{t('home.hotelsEyebrow')}</p>
          <h2 className="font-display text-2xl font-bold text-elegant mb-2">{t('home.hotelsTitle')}</h2>
          <p className="text-elegant/60 text-sm max-w-2xl mb-8">{t('home.hotelsSubtitle')}</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {HOTELS_LITTORAL.map((hotel) => (
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
        </section>

        {/* ---------- RESTAURANTS ---------- */}
        <section className="py-16">
          <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">{t('home.restaurantsEyebrow')}</p>
          <h2 className="font-display text-2xl font-bold text-elegant mb-4">{t('home.restaurantsTitle')}</h2>
          <div className="flex gap-3 mb-6">
            {(['Bonapriso', 'Akwa'] as const).map((area) => (
              <button key={area} onClick={() => setRestoArea(area)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold border transition ${
                  restoArea === area ? 'bg-forest-600 text-white border-forest-600' : 'border-black/10 text-elegant/60 hover:border-forest-400'
                }`}>
                {area}
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

        {/* ---------- BIEN-ÊTRE & DÉTENTE ---------- */}
        <section className="py-16">
          <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">SE RESSOURCER</p>
          <h2 className="font-display text-2xl font-bold text-elegant mb-2">Bien-être & détente</h2>
          <p className="text-elegant/60 text-sm max-w-2xl mb-8">
            Spas, instituts de beauté, lounges calmes et complexes sportifs pour décompresser à Douala.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {WELLNESS_DOUALA.map((spot) => (
              <button key={spot.name} onClick={() => openDish(spot)} className="text-left rounded-2xl overflow-hidden bg-white border border-black/5 shadow-sm hover:shadow-md transition">
                {spot.imageUrl ? (
                  <img src={spot.imageUrl} alt={spot.name} className="w-full h-32 object-cover" loading="lazy" />
                ) : (
                  <div className="w-full h-32 bg-graylight flex items-center justify-center text-elegant/25 text-xs">Photo à venir</div>
                )}
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
          <h2 className="font-display text-2xl font-bold text-elegant mb-6">Quelques mots en sawa/duala</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            {LEXICON_LITTORAL.map((w) => (
              <div key={w.local} className="p-4 rounded-xl bg-graylight">
                <p className="font-display font-bold text-forest-700">{w.local}</p>
                <p className="text-xs text-elegant/55 mt-1">{w.meaning}</p>
              </div>
            ))}
          </div>
        </section>

        <LocalGuides city="Douala" />

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
            <img src="/images/highlights/douala.png" alt="Douala" className="absolute inset-0 w-full h-full object-cover" />
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
