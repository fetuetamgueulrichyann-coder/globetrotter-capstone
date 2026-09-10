import type { GalleryItem } from '../components/GalleryModal';

export interface Hotel extends GalleryItem {
  city: string;
  stars: number;
  ratingNote: string;
  address: string;
  phone?: string;
  website?: string;
  bookingUrl?: string;
  agodaUrl?: string;
  reviewSummary: string;
  lat?: number;
  lng?: number;
}

// Données réelles (Tripadvisor / Booking.com / Trip.com / Agoda — consultées août 2026).
// Photos de Tagidor, La Vallée de Bana et Hotel Altitel fournies directement par
// l'utilisateur (vraies photos de ces établissements). Zingana, Nefar Palace,
// Cergy Pontoise et Foham Oasis : photos réelles également fournies par l'utilisateur.
export const HOTELS: Hotel[] = [
  {
    name: 'Tagidor Garden Resort & Spa', city: 'Bangou (6 km de Bafoussam)', stars: 5,
    ratingNote: 'Très bien noté sur Tripadvisor (238+ avis)',
    address: 'Carrefour, Bangou, Région de l\'Ouest', phone: '+237336057156',
    website: 'https://tagidorresort.com/',
    description: "Resort haut de gamme de 58 chambres dans un grand parc paysager : piscine, spa, billard, ping-pong, location de vélos et voitures. Réception ouverte 24h/24, français et anglais parlés.",
    priceInfo: 'Dès 151 000 FCFA/nuit (bungalow standard) · Suite bungalow ~346 000 FCFA/nuit.',
    reviewSummary: "Les visiteurs saluent unanimement des jardins magnifiques, un accueil chaleureux et un cadre paisible — plusieurs avis mentionnent des visites guidées appréciées (parc, cases traditionnelles, pont de la paix).",
    imageUrl: '/images/hotel-tagidor-1.jpg',
    images: ['/images/hotel-tagidor-1.jpg', '/images/hotel-tagidor-2.jpg'],
  },
  {
    name: 'La Vallée de Bana', city: 'Bana (près de Bafang, Ouest)', stars: 4,
    ratingNote: 'Noté 3 à 4★ selon les plateformes (avis mitigés)',
    address: 'Carrefour Kadji, Bana', website: 'https://maligah.com/entreprise/la-vallee-de-bana/',
    description: 'Complexe hôtelier et touristique de 2 hectares avec piscine, court de tennis, sauna et restaurant franco-africain. Chambres climatisées avec coffre-fort et salle de bain privative.',
    reviewSummary: "Avis partagés : chambres spacieuses et personnel apprécié pour certains visiteurs, mais d'autres rapportent une restauration lente et une disponibilité d'eau chaude irrégulière — à vérifier lors de la réservation.",
    imageUrl: '/images/hotel-bana-1.jpg',
    images: ['/images/hotel-bana-1.jpg', '/images/hotel-bana-2.jpg'],
  },
  {
    name: 'Hotel Altitel', city: 'Bafoussam (centre-ville)', stars: 2,
    ratingNote: 'Hôtel économique bien situé (2★, ~6.7/10 sur les agrégateurs)',
    address: 'Route de Bamenda, face au Collège Tankou, BP 870, Bafoussam',
    phone: '+237233445111',
    website: 'http://www.facebook.com/hotelaltitel',
    bookingUrl: 'https://www.booking.com/hotel/cm/ha-tel-altitel.html',
    agodaUrl: 'https://www.agoda.com/hotel-altitel/hotel/bafoussam-cm.html',
    description: "Hôtel de centre-ville avec restaurant sur place (petit-déjeuner gratuit), wifi et parking gratuits, chambres climatisées. Accepte les animaux, navette aéroport disponible.",
    priceInfo: 'Dès 22 600 FCFA/nuit · Petit-déjeuner continental inclus/en supplément selon formule (~4 000–5 000 FCFA).',
    reviewSummary: "Jugé accessible, calme, sécurisé et bien situé pour une étape improvisée. Quelques avis récents signalent des soucis de propreté dans les sanitaires et un manque de flexibilité sur les prix.",
    imageUrl: '/images/hotel-altitel-1.jpg',
    images: ['/images/hotel-altitel-1.jpg', '/images/hotel-altitel-2.jpg', '/images/hotel-altitel-3.jpg'],
  },
  {
    name: 'Zingana Hôtel', city: 'Bafoussam (centre-ville)', stars: 4,
    ratingNote: '4.4/5 sur Google (480 avis) — l\'un des plus prestigieux de la ville',
    address: 'Tamdja, Entrée Stade, derrière l\'Avenue Pachong Adolf, Bafoussam Ier (BP 101 Bafoussam)',
    phone: '+237233445052',
    website: 'https://www.hotelzingana.com',
    description: 'Hôtel 4 étoiles de 45 chambres et suites au cœur de Bafoussam : restaurant gastronomique, bar-terrasse panoramique (rooftop), espace bien-être/spa sur place, parking souterrain privé sécurisé, salles de séminaire (10 à 150 personnes). Petit-déjeuner buffet et wifi inclus. Réception 24h/24.',
    priceInfo: 'Chambre standard : 69 000–69 500 FCFA/nuit · Suite confort : ~99 200 FCFA/nuit. Buffet petit-déjeuner inclus.',
    reviewSummary: "Chambres spacieuses et impeccablement propres, bonne pression d'eau chaude, restaurant rooftop très apprécié. Quelques avis mentionnent un accueil inégal selon le personnel de service.",
    lat: 5.47071, lng: 10.42248,
    imageUrl: '/images/hotel-zingana-1.jpg',
    images: [
      '/images/hotel-zingana-1.jpg',
      '/images/hotel-zingana-2.jpg',
      '/images/hotel-zingana-3.jpg',
      '/images/hotel-zingana-4.jpg',
      '/images/hotel-zingana-5.jpg',
    ],
  },
  {
    name: 'Nefar Palace Hotel', city: 'Bafoussam (centre-ville)', stars: 3,
    ratingNote: '4.2/5 sur Google (12 avis)',
    address: 'Quartier Cami Toyota, Bafoussam (à 2,9 km du centre-ville, 13 km de l\'aéroport)',
    phone: '+237640105897',
    website: 'https://www.tripadvisor.com/Hotel_Review-g2369838-d34173215-Reviews-NEFAR_PALACE_HOTEL_Plc-Bafoussam_Southwest_Region.html',
    description: 'Hôtel 3 étoiles au quartier Cami Toyota : chambres climatisées avec balcon et coffre-fort, restaurant, bar, espace karaoké, wifi et parking gratuits.',
    reviewSummary: "Peu d'avis disponibles pour l'instant — consulte les photos et retours détaillés sur la fiche Tripadvisor liée.",
    lat: 5.47882, lng: 10.44731,
    imageUrl: '/images/hotel-nefar-1.jpg',
    images: ['/images/hotel-nefar-1.jpg', '/images/hotel-nefar-2.jpg', '/images/hotel-nefar-3.jpg'],
  },
  {
    name: 'Cergy Pontoise Hotel', city: 'Bafoussam (Entrée Groupe III)', stars: 3,
    ratingNote: '4.2/5 sur Google (24 avis)',
    address: 'Entrée Groupe III, 1ère Rue, Carrefour Total (en face du marché Bipmop), Bafoussam',
    phone: '+237651450242',
    website: 'https://www.tripadvisor.com/Hotel_Review-g2369838-d33424163-Reviews-Cergy_Pontoise_Hotel_Bafoussam-Bafoussam_Southwest_Region.html',
    description: 'Hôtel 3 étoiles de 21 chambres climatisées avec restaurant et bar/lounge, wifi et parking gratuits, réception 24h/24.',
    reviewSummary: "Bien noté (8/10 sur les agrégateurs internationaux) — consulte les photos et retours détaillés sur la fiche Tripadvisor liée.",
    lat: 5.4836, lng: 10.4336,
    imageUrl: '/images/hotel-cergy-1.jpg',
    images: ['/images/hotel-cergy-1.jpg', '/images/hotel-cergy-2.jpg', '/images/hotel-cergy-3.jpg'],
  },
  {
    name: 'Hôtel Foham Oasis', city: 'Bandjoun (juste à côté de Bafoussam)', stars: 3,
    ratingNote: '4.4/5 sur Google (111 avis)',
    address: '182 Rue OU0002pet, face à la mairie, Pete, Bandjoun (23 km de l\'aéroport de Bafoussam)',
    phone: '+237670610066',
    website: 'https://www.tripadvisor.com/Hotels-g2369838-c3-zff22-Bafoussam_Southwest_Region-Hotels.html',
    description: "Hôtel bien noté directement à Bandjoun, à deux pas de la Chefferie — pratique pour visiter Bandjoun sans repartir vers Bafoussam le soir. Chambres climatisées et insonorisées avec TV écran plat, restaurant, bar, espace bien-être, terrasse, wifi et parking gratuits.",
    priceInfo: 'Dès 20 000 à 30 000 FCFA/nuit — bon rapport qualité-prix.',
    reviewSummary: "Bonne note générale (4.4/5, 111 avis) — consulte les photos et retours détaillés sur la fiche Tripadvisor liée.",
    lat: 5.3686, lng: 10.4131,
    imageUrl: '/images/hotel-foham-1.webp',
    images: ['/images/hotel-foham-1.webp', '/images/hotel-foham-2.webp', '/images/hotel-foham-3.webp', '/images/hotel-foham-4.webp'],
  },
  // ---- Douala (Littoral) ----
  {
    name: 'K Hotel Douala', city: 'Bonanjo, Douala', stars: 4,
    ratingNote: "Classé parmi les tout meilleurs établissements de la ville",
    address: '729 Rue Christian Tobie Kuoh, Bonanjo, Douala',
    description: "Établissement de standing international 4 étoiles : chambres modernes, salle de sport, piscine sur le toit et centre d'affaires. Service client irréprochable, sécurité rigoureuse à l'entrée.",
    reviewSummary: "Les clients louent l'excellent service, la propreté et la vue depuis le bar-piscine sur le toit.",
    lat: 4.0423, lng: 9.6872,
    imageUrl: '/images/douala-hotel-khotel-1.jpg',
    images: [
      '/images/douala-hotel-khotel-1.jpg', '/images/douala-hotel-khotel-2.jpg', '/images/douala-hotel-khotel-3.webp', '/images/douala2/k-hotel4.jpg',
    ],
  },
  {
    name: 'Krystal Palace Douala', city: 'Akwa, Douala', stars: 5,
    ratingNote: "Premier hôtel certifié 5 étoiles de la ville",
    address: 'Rue de la Réunification, Akwa, Douala',
    description: 'Prestations de luxe absolu : spa haut de gamme, restaurants gastronomiques, salons VIP et piscine panoramique. Adresse favorite des délégations officielles.',
    reviewSummary: "Salué pour son design ultra-moderne, sa literie exceptionnelle et ses buffets raffinés.",
    lat: 4.0494, lng: 9.7011,
    imageUrl: '/images/douala-hotel-krystal-1.jpg',
    images: [
      '/images/douala-hotel-krystal-1.jpg', '/images/douala-hotel-krystal-2.jpg', '/images/douala-hotel-krystal-3.jpg', '/images/douala2/krystal-palace-hotel.jpg',
      '/images/douala2/krystal-palace-hotel-d.jpg', '/images/douala2/krystal.avif',
    ],
  },
  {
    name: 'Hotel Akwa Palace', city: 'Akwa, Douala', stars: 4,
    ratingNote: 'Hôtel historique et emblématique de Douala',
    address: '920 Boulevard de la Liberté, Akwa, Douala',
    description: "Charme architectural traditionnel et équipements d'affaires modernes (piscine, salles de conférence). Emplacement central, parfait pour le shopping à Akwa.",
    reviewSummary: "Personnel jugé chaleureux ; certains clients estiment que quelques ailes mériteraient une rénovation.",
    lat: 4.0458, lng: 9.6942,
    imageUrl: '/images/douala-hotel-akwapalace-1.jpg',
    images: [
      '/images/douala-hotel-akwapalace-1.jpg', '/images/douala-hotel-akwapalace-2.jpg', '/images/douala-hotel-akwapalace-3.jpg', '/images/douala2/akwapalace.jpg',
    ],
  },
  {
    name: 'Hotel La Falaise Bonapriso', city: 'Bonapriso, Douala', stars: 3,
    ratingNote: 'Excellent rapport qualité-prix',
    address: 'Rue Njo-Njo, Bonapriso, Douala',
    description: 'Établissement moderne de la chaîne locale La Falaise : installations contemporaines et belle piscine.',
    reviewSummary: "Bien coté pour son calme résidentiel, la réactivité du personnel et son copieux buffet de petit-déjeuner.",
    lat: 4.0258, lng: 9.6994,
    imageUrl: '/images/douala-hotel-falaise-1.jpg',
    images: [
      '/images/douala-hotel-falaise-1.jpg', '/images/douala-hotel-falaise-2.jpg', '/images/douala2/la-falaise-bonapriso.jpg',
    ],
  },
  {
    name: 'Star Land Hotel Bonapriso', city: 'Bonapriso, Douala', stars: 4,
    ratingNote: 'Boutique-hôtel au cadre intimiste',
    address: 'Rue Toyota, Bonapriso, Douala',
    description: 'Boutique-hôtel 4 étoiles réputé pour sa tranquillité et son service personnalisé.',
    reviewSummary: "Ambiance cosy, discrétion des lieux et qualité de la table appréciées — idéal pour un séjour professionnel reposant.",
    lat: 4.0289, lng: 9.7019,
    imageUrl: '/images/douala-hotel-starland-1.jpg',
    images: [
      '/images/douala-hotel-starland-1.jpg', '/images/douala-hotel-starland-2.jpg', '/images/douala-hotel-starland-3.jpg', '/images/douala2/starland1.jpg',
    ],
  },
];

export interface Restaurant {
  name: string; city: string; category: string;
  rating: number; reviewCount: number; address: string; website?: string;
  mapsUrl: string; description: string; images?: string[];
  phone?: string; hours?: string; lat?: number; lng?: number;
}

const AYILAA = 'https://ayilaa.s3.eu-west-1.amazonaws.com/attraction/';

// Données réelles (fiches Google Maps + Ayila'a, consultées août 2026).
// Photos réelles trouvées sur Ayila'a (annuaire camerounais, photos hébergées
// sur leur bucket S3 public) pour La Terrasse, ASAT et Happy Land — dont les
// URLs contiennent des espaces, encodés en %20 ci-dessous.
export const RESTAURANTS: Restaurant[] = [
  {
    name: 'La Terrasse', city: 'Bafoussam', category: 'Restaurant', rating: 4.1, reviewCount: 193,
    address: 'Quartier Akwa, face à l\'ancien marché de fruits',
    mapsUrl: 'https://www.google.com/maps/dir//Ancien+march%C3%A9+de+fruits,+face+belgocam,+Bafoussam',
    description: "Restaurant-café branché mêlant street art camerounais, plantes suspendues et mobilier en bois de récupération. Jus frais, plats locaux et cuisine internationale à prix abordables.",
    images: [
      AYILAA + '4475/media/65395277971b4_1698255479_La%20Terrasse%20Bafoussam%20(2).jpg',
      AYILAA + '4475/media/6539527a1d037_1698255482_La%20Terrasse%20Bafoussam%20(3).jpg',
      AYILAA + 'logos/6539536ac2813_1698255722_La%20Terrasse%20Bafoussam%20(1).jpg',
    ],
  },
  {
    name: 'ASAT Restaurant', city: 'Bafoussam', category: 'Restaurant', rating: 4.1, reviewCount: 69,
    address: 'Akwa, derrière la banque BICEC',
    mapsUrl: 'https://www.google.com/maps/dir//Behind+BICEC+Bank,+Bafoussam',
    description: 'Restaurant chaleureux réputé pour le ndolé, le poulet braisé et le poisson grillé. Service de livraison rapide et réservations pour événements.',
    images: [
      AYILAA + '3444/media/6787c738e37dd_1736951608_ASAT%20RESTAURANT%20(1).jpg',
      AYILAA + '3444/media/6787c73984e82_1736951609_ASAT%20RESTAURANT%20(2).jpg',
      AYILAA + '3444/media/6787c73a47035_1736951610_ASAT%20RESTAURANT%20(3).jpg',
      AYILAA + '3444/media/6787c73b381da_1736951611_ASAT%20RESTAURANT%20(4).jpg',
    ],
  },
  {
    name: 'Happy Land (Parc de Loisirs)', city: 'Bafoussam', category: 'Loisirs & Divertissement', rating: 4.7, reviewCount: 15,
    address: 'Face à l\'Hôtel de Ville, Bafoussam',
    mapsUrl: 'https://www.google.com/maps/search/Parc+de+Loisirs+H%C3%B4tel+de+Ville+Bafoussam',
    description: "Complexe de loisirs familial en plein air : manèges pour enfants, trampolines, structures gonflables et stands de jeux. Le rendez-vous des sorties en famille le week-end.",
    images: [
      AYILAA + '10134/media/66fa579d84d5d_1727682461_Parc%20de%20Loisirs%20de%20Bafoussam%20(2).jpg',
      AYILAA + '10134/media/66fa579ed4e26_1727682462_Parc%20de%20Loisirs%20de%20Bafoussam%20(3).jpg',
      AYILAA + '10134/media/66fa579f71510_1727682463_Parc%20de%20Loisirs%20de%20Bafoussam%20(4).jpg',
      AYILAA + '10134/media/66fa57a00bf77_1727682464_Parc%20de%20Loisirs%20de%20Bafoussam%20(5).jpg',
    ],
  },
  {
    name: 'Ets Délice Cuisine', city: 'Bafoussam', category: 'Restaurant', rating: 4.7, reviewCount: 18,
    address: '2ème Carrefour Évêché (Carrefour Madelon), Bafoussam',
    website: 'https://www.facebook.com/profile.php?id=100090437865368',
    phone: '+237687283571',
    hours: 'Lun-Sam 08h00–20h30, Dim 13h00–18h00',
    mapsUrl: 'https://www.google.com/maps/dir//2eme+Carrefour+Eveche,+Bafoussam',
    description: 'Cuisine camerounaise et traditionnelle réputée pour la qualité de son accueil. Plats à la carte, commandes rapides sur WhatsApp, livraison à domicile, service traiteur et location de salle pour événements.',
    lat: 5.4745, lng: 10.4192,
    images: [
      '/images/restaurant-etsdelice-1.webp',
      '/images/restaurant-etsdelice-2.webp',
      '/images/restaurant-etsdelice-3.webp',
      '/images/restaurant-etsdelice-4.webp',
      '/images/restaurant-etsdelice-5.webp',
    ],
  },
  {
    name: "Restaurant Côte d'Azur", city: 'Bandjoun', category: 'Restaurant', rating: 3.8, reviewCount: 8,
    address: 'Bandjoun centre',
    phone: '+237696288965',
    hours: 'Tous les jours 08h00–22h00',
    mapsUrl: 'https://www.google.com/maps/dir//9CF7%2BFX8,+Unnamed+Road,+Bandjoun',
    description: 'Cadre cosy et décontracté, idéal pour les groupes et les touristes : petites assiettes (salades, desserts), bières, vins et café. Paiement en espèces uniquement.',
    images: [
      '/images/restaurant-cotedazur-1.webp',
      '/images/restaurant-cotedazur-2.webp',
      '/images/restaurant-cotedazur-3.webp',
    ],
    lat: 5.371213, lng: 10.410185,
  },
  {
    name: 'Chez Ta Matio', city: 'Bandjoun', category: 'Grillades', rating: 4.1, reviewCount: 9,
    address: 'Route Nationale 4 (N4), Bandjoun',
    mapsUrl: 'https://www.google.com/maps/dir//CC5G%2BG34,+N4,+Bandjoun',
    description: 'Spot local authentique très populaire, réputé pour son poulet et son porc braisé. Service à table ou à emporter, traiteur possible, parking gratuit. Ambiance décontractée, idéale en solo, en famille ou entre voyageurs.',
    images: ['/images/restaurant-tamatio-1.webp', '/images/restaurant-tamatio-2.webp'],
    lat: 5.3500, lng: 10.4000,
  },
  // ---- Douala (Littoral) ----
  {
    name: 'Kotcha Restaurant', city: 'Bonapriso, Douala', category: 'Bistronomie', rating: 4.6, reviewCount: 0,
    address: "Rue de l'Aviation, Bonapriso, Douala",
    mapsUrl: 'https://www.google.com/maps/search/Kotcha+Restaurant+Bonapriso+Douala',
    description: 'Restaurant bistronomique sélect combinant techniques de cuisine française et ingrédients africains authentiques. Plats joliment dressés, cadre tamisé élégant — idéal dîners professionnels ou en amoureux.',
    images: [
      '/images/douala-resto-kotcha-1.jpg', '/images/douala-resto-kotcha-2.jpg', '/images/douala-resto-kotcha-3.jpg', '/images/douala2/lotcha-resto.jpg',
    ],
    lat: 4.0239, lng: 9.6978,
  },
  {
    name: 'The Yard Restaurant', city: 'Bonapriso, Douala', category: 'Grillades & Cocktails', rating: 4.4, reviewCount: 0,
    address: 'Rue Njo-Njo, Bonapriso, Douala',
    mapsUrl: 'https://www.google.com/maps/search/The+Yard+Restaurant+Bonapriso+Douala',
    description: "Espace culinaire à ciel ouvert : grillades, burgers gourmets, cocktails créatifs et ambiance branchée. Très prisé de la jeunesse dorée et des expatriés, cadre très instagrammable.",
    images: [
      '/images/douala-resto-theyard-1.webp', '/images/douala-resto-theyard-2.webp', '/images/douala-resto-theyard-3.webp', '/images/douala2/the-yard3.webp', '/images/douala2/the-yard-4.webp',
    ],
    lat: 4.0271, lng: 9.7005,
  },
  {
    name: 'Le Carino Bistrot', city: 'Bonapriso, Douala', category: 'Bistrot italien', rating: 4.3, reviewCount: 0,
    address: 'Rue Paul Monthé, Bonapriso, Douala',
    mapsUrl: 'https://www.google.com/maps/search/Le+Carino+Bistrot+Bonapriso+Douala',
    description: 'Cuisine de style brasserie/bistrot italien et international : pâtes fraîches, viandes saisies, desserts maison. Régularité de la cuisine et convivialité saluées par les habitués.',
    images: [
      '/images/douala-resto-carino-1.webp', '/images/douala-resto-carino-2.webp',
      '/images/douala2/carino-bidtro.webp', '/images/douala2/le-carino2.webp',
    ],
    lat: 4.0281, lng: 9.7022,
  },
  {
    name: 'Saga Africa', city: 'Akwa, Douala', category: 'Cuisine camerounaise', rating: 4.7, reviewCount: 0,
    address: 'Boulevard de la Liberté, Akwa, Douala',
    mapsUrl: 'https://www.google.com/maps/search/Saga+Africa+Akwa+Douala',
    description: 'Institution gastronomique spécialisée dans les grands classiques camerounais (Ndolé, Ndomba, Poulet DG) revisités haut de gamme. Le Ndolé aux crevettes y est unanimement salué.',
    images: [
      '/images/douala-resto-sagaafrica-1.webp', '/images/douala-resto-sagaafrica-2.webp', '/images/douala2/saga-adeica2.webp',
    ],
    lat: 4.0471, lng: 9.6953,
  },
  {
    name: 'Le Tournebroche', city: 'Akwa, Douala', category: 'Gastronomique français', rating: 4.5, reviewCount: 0,
    address: 'Rue Gallieni, Akwa, Douala',
    mapsUrl: 'https://www.google.com/maps/search/Le+Tournebroche+Akwa+Douala',
    description: 'Restaurant gastronomique de tradition française, célèbre pour ses viandes à la broche, fruits de mer et cave à vin. Accueil feutré, service à la française très professionnel.',
    images: [
      '/images/douala-resto-tournebroche-1.webp', '/images/douala-resto-tournebroche-2.webp', '/images/douala2/a-la-broche.webp',
    ],
    lat: 4.0439, lng: 9.6914,
  },
];
