import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, MapPin, Map as MapIcon, Mountain, Sparkles } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import GalleryModal, { type GalleryItem } from '../components/GalleryModal';
import LocalVideo from '../components/LocalVideo';

// ============ RÉGIONS ACTIVES ============
// Quand une nouvelle région est ajoutée à MboaTrip, elle DOIT être ajoutée ici
// (et dans HamburgerMenu.tsx) pour apparaître sur la page d'accueil et le menu.
const REGIONS = [
  {
    slug: 'ouest', name: 'Ouest Cameroun', cities: 'Bandjoun & Bafoussam', to: '/region/ouest',
    image: '/images/hero-mountains.jpg',
    tagline: "Chefferies royales bamiléké, musées, artisanat et gastronomie.",
  },
  {
    slug: 'littoral', name: 'Littoral', cities: 'Douala', to: '/region/littoral',
    image: '/images/highlights/douala.png',
    tagline: 'Capitale économique, culture Sawa, bord du fleuve Wouri.',
  },
];

// ============ SITES TOURISTIQUES À METTRE EN VALEUR ============
// Sélection de lieux emblématiques du Cameroun (au-delà des régions déjà
// actives dans l'app) pour donner envie d'explorer le pays. Coordonnées GPS
// approximatives fournies pour repérage. Ces lieux ne sont pas encore reliés
// à la carte interactive — ce sera ajouté au fur et à mesure que MboaTrip
// couvre de nouvelles régions.
interface Highlight extends GalleryItem { region: string; lat: number; lng: number; }

const HIGHLIGHTS: Highlight[] = [
  {
    name: 'Le Mont Cameroun', region: 'Sud-Ouest', lat: 4.2033, lng: 9.1704,
    description: "Le plus haut sommet d'Afrique de l'Ouest et centrale (4 100 m), volcan encore actif. Randonnée sportive et trekking à travers la forêt tropicale au départ de Buea — l'ascension ne se tente jamais seul, toujours via le bureau des guides de Buea.",
    imageUrl: '/images/highlights/cratere-du-mont-cameroun.jpg',
    images: ['/images/highlights/cratere-du-mont-cameroun.jpg', '/images/highlights/mont-cameroun-3.jpeg', '/images/highlights/montcameroun.jpeg'],
  },
  {
    name: 'Les plages de Kribi & Chutes de la Lobé', region: 'Sud', lat: 2.9333, lng: 9.9167,
    description: "Surnommée la « Côte d'Azur camerounaise », Kribi offre des plages de sable blanc paradisiaques, crevettes fraîches et balades sous les cocotiers. À 7 km au sud, les chutes de la Lobé sont uniques au monde : un fleuve qui se jette directement dans la mer par une série de cascades.",
    imageUrl: '/images/highlights/kribi-plage.jpg',
    images: ['/images/highlights/kribi-plage.jpg', '/images/highlights/kribi.jpg', '/images/highlights/kribi2.jpeg', '/images/highlights/kribi3.jpeg', '/images/highlights/kribi4.jpeg'],
  },
  {
    name: 'La Réserve de faune du Dja', region: 'Est / Sud', lat: 3.25, lng: 12.9167,
    description: "Classée au patrimoine mondial de l'UNESCO pour sa forêt tropicale très bien préservée. Randonnée en pleine jungle et observation des gorilles, chimpanzés et éléphants de forêt — guide local ou éco-garde fortement recommandé.",
    imageUrl: '/images/highlights/reserve-de-faune-du-dja.jpeg',
    images: ['/images/highlights/reserve-de-faune-du-dja.jpeg', '/images/highlights/reserve-de-faune-du-dja3.jpeg', '/images/highlights/reserve-du-dja.jpg'],
  },
  {
    name: 'Limbé', region: 'Sud-Ouest', lat: 4.0117, lng: 9.2008,
    description: "Ville côtière charmante connue pour ses plages de sable noir volcanique. Visite du Centre de sauvetage de la faune (Limbe Wildlife Centre) et balade éducative dans le deuxième plus vieux jardin botanique d'Afrique.",
    imageUrl: '/images/highlights/limbe.jpeg',
    images: ['/images/highlights/limbe.jpeg'],
  },
  {
    name: 'Foumban', region: 'Ouest', lat: 5.7291, lng: 10.9001,
    description: "Cœur culturel et artistique du royaume Bamoun. Palais des Sultans, découverte du musée d'art et achat d'objets artisanaux en bronze ou en bois.",
    imageUrl: '/images/highlights/foumban1.jpeg',
    images: ['/images/highlights/foumban1.jpeg', '/images/highlights/foumban3.jpeg', '/images/highlights/foumban4.jpeg', '/images/highlights/main_foumban-joyau-culturel-cameroun-tresors-rois-bamoun_2025-09-16t20_11_54_359z_musee_des_rois_bamouns.webp'],
  },
  {
    name: 'Le Parc national de Waza', region: 'Extrême-Nord', lat: 11.25, lng: 14.7,
    description: "Le parc animalier le plus célèbre du pays pour faire un safari : lions, éléphants, girafes et centaines d'espèces d'oiseaux dans la savane. Guide local fortement recommandé pour pister les animaux.",
    imageUrl: '/images/highlights/parc-waza.jpeg',
    images: ['/images/highlights/parc-waza.jpeg', '/images/highlights/parc-waza0.jpeg', '/images/highlights/parc-waza1.jpeg', '/images/highlights/parc-waza-2.webp'],
  },
  {
    name: 'Le Lac de Bamendjing', region: 'Ouest', lat: 5.75, lng: 10.5,
    description: 'Retenue paisible entourée de collines verdoyantes, balade en bateau et observation des oiseaux migrateurs dans un calme total.',
    imageUrl: '/images/highlights/lac-bamendjing-1.jpeg',
    images: ['/images/highlights/lac-bamendjing-1.jpeg', '/images/highlights/lac-bamendjing-2.jpeg'],
  },
  {
    name: 'Les Monts Mandara', region: 'Extrême-Nord', lat: 10.505, lng: 13.59,
    description: "Paysage lunaire impressionnant fait de pics rocheux et de montagnes abruptes, découverte de villages traditionnels comme Rhumsiki, célèbre pour son sorcier aux crabes.",
    imageUrl: '/images/highlights/monts-mandara-1.jpeg',
    images: ['/images/highlights/monts-mandara-1.jpeg', '/images/highlights/monts-mandara-2.jpeg', '/images/highlights/monts-mandara-3.jpeg'],
  },
  {
    name: 'La Chefferie de Bafut', region: 'Nord-Ouest', lat: 6.0833, lng: 10.1,
    description: "Un des plus puissants royaumes traditionnels des Grassfields : l'Achum (temple sacré en architecture traditionnelle) et découverte des danses rituelles.",
    imageUrl: '/images/highlights/chefferie-bafut-1.jpeg',
    images: ['/images/highlights/chefferie-bafut-1.jpeg', '/images/highlights/chefferie-bafut-2.jpg', '/images/highlights/chefferie-bafut-3.jpeg', '/images/highlights/chefferie-bafut-4.jpeg'],
  },
];

export default function Home() {
  const { t } = useTranslation();
  const [galleryItem, setGalleryItem] = useState<GalleryItem | null>(null);

  // Lieu du jour : choix déterministe basé sur la date du jour (même lieu
  // pour tout le monde toute la journée, change automatiquement le
  // lendemain) — pas besoin de backend, juste un modulo sur la liste des
  // sites déjà mis en avant.
  const dayOfYear = Math.floor(
    (Date.now() - new Date(new Date().getFullYear(), 0, 0).getTime()) / 86_400_000
  );
  const placeOfTheDay = HIGHLIGHTS[dayOfYear % HIGHLIGHTS.length];

  return (
    <div>
      {/* ---------- HERO ---------- */}
      <section className="relative h-[520px] flex items-center justify-center text-center overflow-hidden">
        <img src="/images/highlights/monument-reunification.jpg" alt="Monument de la Réunification, Yaoundé" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-elegant/65 via-elegant/45 to-elegant/75" />
        <div className="relative z-10 px-6 max-w-2xl">
          <p className="text-gold-400 text-xs font-mono tracking-widest mb-3">MBOATRIP</p>
          <h1 className="font-display text-4xl sm:text-5xl font-bold text-white mb-4 leading-tight">
            L'Afrique en <span className="text-gold-400">miniature</span>
          </h1>
          <p className="text-white/85 text-sm sm:text-base leading-relaxed">
            Du sommet volcanique du Mont Cameroun aux plages de Kribi, des chefferies royales bamiléké aux
            quartiers vivants de Douala — le Cameroun rassemble en un seul pays des paysages, des peuples et
            des traditions d'une diversité rare en Afrique.
          </p>
        </div>
      </section>

      <div className="max-w-6xl mx-auto px-6">

        {/* ---------- LIEU DU JOUR ---------- */}
        <section className="py-10">
          <button
            onClick={() => setGalleryItem(placeOfTheDay)}
            className="w-full text-left relative rounded-2xl overflow-hidden h-64 group shadow-lg"
          >
            <img src={placeOfTheDay.imageUrl} alt={placeOfTheDay.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-elegant/90 via-elegant/30 to-transparent" />
            <div className="absolute bottom-0 left-0 right-0 p-6 text-white">
              <p className="inline-flex items-center gap-1.5 text-gold-400 text-xs font-mono tracking-widest mb-2">
                <Sparkles size={13} /> LIEU DU JOUR
              </p>
              <h2 className="font-display text-2xl font-bold mb-1">{placeOfTheDay.name}</h2>
              <p className="text-white/75 text-sm line-clamp-1">{placeOfTheDay.description}</p>
            </div>
          </button>
        </section>

        {/* ---------- INTRODUCTION AU CAMEROUN ---------- */}
        <section className="py-16 grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2">
            <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">DÉCOUVRIR</p>
            <h2 className="font-display text-2xl font-bold text-elegant mb-4">Le Cameroun, un pays-monde</h2>
            <p className="text-elegant/70 text-sm leading-relaxed mb-4">
              Avec plus de 250 groupes ethniques et autant de langues, le Cameroun est l'un des pays les plus
              diversifiés du continent. Chefferies traditionnelles à l'Ouest, culture Sawa du littoral, savanes
              du Grand Nord, forêts équatoriales du Sud et de l'Est : chaque région a son patrimoine, sa
              gastronomie et son artisanat.
            </p>
            <p className="text-elegant/70 text-sm leading-relaxed">
              MboaTrip vous fait découvrir ce patrimoine région par région — cartes interactives, sites
              historiques, gastronomie locale, hébergements et bonnes adresses, avec de nouvelles zones du pays
              ajoutées progressivement.
            </p>
          </div>
          <div className="rounded-2xl overflow-hidden shadow-lg">
            <img src="/images/patrimoine-lion-bandjoun.webp" alt="Patrimoine camerounais" className="w-full h-full object-cover" />
          </div>
        </section>

        {/* ---------- VIDÉOS ---------- */}
        <section className="py-16">
          <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">EN IMAGES</p>
          <h2 className="font-display text-2xl font-bold text-elegant mb-2">Le Cameroun en vidéo</h2>
          <p className="text-elegant/60 text-sm max-w-2xl mb-8">
            Quelques images valent mille mots — un aperçu vidéo des plus beaux sites touristiques du pays.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <LocalVideo src="/videos/tiktok-tour-cameroun.mp4" caption="Tour d'horizon des sites touristiques du Cameroun" />
            <LocalVideo src="/videos/limbe.mp4" caption="Limbé" />
            <LocalVideo src="/videos/travel-cameroun.mp4" caption="Cameroun" />
            <LocalVideo src="/videos/buea.mp4" caption="Buea — porte d'entrée du Mont Cameroun" />
          </div>
        </section>

        {/* ---------- RÉGIONS DISPONIBLES ---------- */}
        <section className="py-16">
          <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">EXPLORER</p>
          <h2 className="font-display text-2xl font-bold text-elegant mb-2">Régions disponibles sur MboaTrip</h2>
          <p className="text-elegant/60 text-sm max-w-2xl mb-8">
            De nouvelles régions rejoignent l'application au fur et à mesure. Voici celles déjà disponibles.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {REGIONS.map((region) => (
              <Link key={region.slug} to={region.to} className="group relative rounded-2xl overflow-hidden h-80 shadow-lg hover:shadow-2xl transition-shadow">
                <img src={region.image} alt={region.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-elegant/90 via-elegant/30 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-7 text-white">
                  <p className="text-gold-400 text-xs font-mono mb-1.5">{region.cities}</p>
                  <h3 className="font-display text-2xl font-bold mb-2">{region.name}</h3>
                  <p className="text-white/75 text-sm mb-4">{region.tagline}</p>
                  <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-gold-400 group-hover:gap-2.5 transition-all">
                    Explorer <ArrowRight size={15} />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* ---------- SITES TOURISTIQUES À DÉCOUVRIR ---------- */}
        <section className="py-16">
          <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">INSPIRATION</p>
          <h2 className="font-display text-2xl font-bold text-elegant mb-2">Sites touristiques incontournables</h2>
          <p className="text-elegant/60 text-sm max-w-2xl mb-8">
            Un aperçu des plus beaux sites du Cameroun, aux quatre coins du pays — au fil des prochaines mises
            à jour, ces régions rejoindront elles aussi les pages d'exploration détaillées.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {HIGHLIGHTS.map((h) => (
              <button key={h.name} onClick={() => setGalleryItem(h)} className="text-left rounded-2xl overflow-hidden bg-white border border-black/5 shadow-sm hover:shadow-md transition">
                <div className="relative">
                  <img src={h.imageUrl} alt={h.name} className="w-full h-40 object-cover" loading="lazy" />
                  <span className="absolute top-2 left-2 bg-elegant/70 text-white text-[10px] font-mono px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Mountain size={10} /> {h.region}
                  </span>
                </div>
                <div className="p-5">
                  <h3 className="font-display font-bold text-elegant mb-1.5">{h.name}</h3>
                  <p className="text-elegant/60 text-sm leading-relaxed line-clamp-3">{h.description}</p>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ---------- CARTE (CTA) ---------- */}
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

      {galleryItem && <GalleryModal item={galleryItem} onClose={() => setGalleryItem(null)} />}
    </div>
  );
}
