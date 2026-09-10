import { useState, useRef, useEffect, useMemo, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { LocateFixed, Search, X, Footprints, Car, Bike, Plane, Navigation2, ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { api } from '../lib/api';
import type { Destination, PointOfInterest } from '../types';
import { HOTELS, RESTAURANTS } from '../data/places';
import PlaceModal from '../components/PlaceModal';

// ============================================================
// CARTE — MapLibre GL JS (vectoriel, gratuit, sans clé)
// Style OpenFreeMap : hébergement 100% gratuit, aucune inscription,
// zoom très poussé (quartiers, rues, pistes visibles bien au-delà de nos
// marqueurs). Alternative libre à Google Maps/Mapbox, comme demandé.
// ============================================================
const MAP_STYLE = 'https://tiles.openfreemap.org/styles/positron';

// Vue par défaut : tout le Cameroun (l'utilisateur prévoit d'ajouter d'autres
// villes hors de l'Ouest). Facile à resserrer plus tard si besoin.
const CAMEROON_CENTER: [number, number] = [12.3547, 7.3697]; // MapLibre attend [lng, lat]
const DEFAULT_ZOOM = 6;
const CITY_ZOOM = 14;
const PLACE_ZOOM = 16;

type PoiType = 'hotel' | 'restaurant' | 'tourist_attraction' | 'hospital';
type RouteMode = 'walking' | 'driving' | 'cycling' | 'flight';

interface LivePoi {
  id: number;
  name: string;
  lat: number;
  lng: number;
  type: PoiType;
}

interface Place {
  id: string;
  name: string;
  description: string;
  imageUrl: string;
  images?: string[];
  sourceUrl?: string;
  lat: number;
  lng: number;
  category: string;
}

// Correspondance avec les tags OpenStreetMap (Overpass API, gratuit, sans clé)
const POI_CONFIG: Record<PoiType, { label: string; color: string; osmKey: string; osmValue: string }> = {
  tourist_attraction: { label: 'Sites touristiques (en direct)', color: '#1E6B3E', osmKey: 'tourism', osmValue: 'attraction' },
  hotel: { label: 'Hôtels (en direct)', color: '#8B5CF6', osmKey: 'tourism', osmValue: 'hotel' },
  restaurant: { label: 'Restaurants (en direct)', color: '#E0645B', osmKey: 'amenity', osmValue: 'restaurant' },
  hospital: { label: 'Hôpitaux', color: '#22C55E', osmKey: 'amenity', osmValue: 'hospital' },
};

// Instances OSRM gratuites et sans clé (FOSSGIS), une par mode terrestre.
// Le mode "avion" n'utilise pas OSRM (qui ne route que sur le réseau routier) :
// voir computeRoute() plus bas, calcul en ligne directe (great-circle).
const OSRM_BASE: Record<Exclude<RouteMode, 'flight'>, string> = {
  driving: 'https://routing.openstreetmap.de/routed-car/route/v1/driving',
  cycling: 'https://routing.openstreetmap.de/routed-bike/route/v1/cycling',
  walking: 'https://routing.openstreetmap.de/routed-foot/route/v1/foot',
};

const ROUTE_MODES: { mode: RouteMode; labelKey: string; icon: typeof Footprints }[] = [
  { mode: 'walking', labelKey: 'explore.modeWalking', icon: Footprints },
  { mode: 'driving', labelKey: 'explore.modeDriving', icon: Car },
  { mode: 'cycling', labelKey: 'explore.modeCycling', icon: Bike },
  { mode: 'flight', labelKey: 'explore.modeFlight', icon: Plane },
];

// Vitesse de croisière moyenne + marge fixe (roulage, décollage/atterrissage,
// embarquement) pour estimer une durée de vol — utile pour les longs trajets
// entre villes éloignées (ex. Yaoundé → Douala) où il n'existe aucune API
// d'horaires de vols réels gratuite et sans clé.
const FLIGHT_SPEED_KMH = 750;
const FLIGHT_OVERHEAD_MIN = 45;

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function formatDuration(minutes: number) {
  const total = Math.round(minutes);
  if (total < 60) return `${total} min`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

function normalize(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

async function searchOverpass(lat: number, lng: number, type: PoiType, radius = 6000): Promise<LivePoi[]> {
  const { osmKey, osmValue } = POI_CONFIG[type];
  const query = `[out:json][timeout:25];(node["${osmKey}"="${osmValue}"](around:${radius},${lat},${lng});way["${osmKey}"="${osmValue}"](around:${radius},${lat},${lng}););out center 25;`;
  const res = await fetch('https://overpass-api.de/api/interpreter?data=' + encodeURIComponent(query));
  if (!res.ok) throw new Error('Overpass indisponible');
  const data = await res.json();
  return data.elements
    .map((el: any) => ({
      id: el.id,
      name: el.tags?.name || el.tags?.['name:fr'] || 'Sans nom',
      lat: el.lat ?? el.center?.lat,
      lng: el.lon ?? el.center?.lon,
      type,
    }))
    .filter((p: LivePoi) => p.lat && p.lng);
}

// Recherche universelle de lieux au Cameroun (villes, quartiers, régions...)
// via Nominatim (OpenStreetMap, gratuit, sans clé) — couvre tout ce qui n'est
// pas déjà dans notre base curatée (ex: "Bastos", "Akwa", "Mvan"...).
async function searchNominatim(q: string): Promise<Place[]> {
  if (!q.trim() || q.trim().length < 3) return [];
  const url = `https://nominatim.openstreetmap.org/search?format=json&countrycodes=cm&addressdetails=1&limit=6&accept-language=fr&q=${encodeURIComponent(q)}`;
  const res = await fetch(url);
  if (!res.ok) return [];
  const data = await res.json();
  return data.map((d: any) => ({
    id: `osm-${d.place_id}`,
    name: d.display_name.split(',')[0],
    description: d.display_name,
    imageUrl: '',
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    category: 'Lieu (OpenStreetMap)',
  }));
}

async function fetchRoute(mode: Exclude<RouteMode, 'flight'>, from: { lat: number; lng: number }, to: { lat: number; lng: number }) {
  const url = `${OSRM_BASE[mode]}/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('Service d\'itinéraire indisponible');
  const data = await res.json();
  if (data.code !== 'Ok' || !data.routes?.[0]) throw new Error('Aucun itinéraire trouvé entre ces deux points');
  const route = data.routes[0];
  return {
    geometry: route.geometry as any,
    distanceKm: route.distance / 1000,
    durationMin: route.duration / 60,
  };
}

function markerEl(color: string, size = 16) {
  const el = document.createElement('div');
  el.style.width = `${size}px`;
  el.style.height = `${size}px`;
  el.style.borderRadius = '50%';
  el.style.background = color;
  el.style.border = '2px solid white';
  el.style.boxShadow = '0 1px 5px rgba(0,0,0,0.35)';
  el.style.cursor = 'pointer';
  return el;
}

function popupHTML(place: Place, labels: { officialSite: string; viewPhotos: string; itinerary: string }) {
  const img = place.imageUrl
    ? `<img src="${place.imageUrl}" alt="" style="width:100%;height:96px;object-fit:cover;border-radius:8px;margin-bottom:8px" />`
    : '';
  const link = place.sourceUrl
    ? `<a href="${place.sourceUrl}" target="_blank" rel="noopener noreferrer" style="font-size:11px;color:#1E6B3E;font-weight:600;text-decoration:none;display:inline-flex;align-items:center;gap:4px;margin-top:6px">${labels.officialSite} ↗</a>`
    : '';
  return `
    <div style="max-width:220px;font-family:inherit">
      ${img}
      <p style="font-weight:600;font-size:13px;margin:0 0 4px;color:#141613">${place.name}</p>
      <p style="font-size:11px;color:#5c6773;margin:0 0 8px;line-height:1.4">${place.description.slice(0, 110)}${place.description.length > 110 ? '…' : ''}</p>
      <div style="display:flex;gap:6px;flex-wrap:wrap">
        <button data-action="gallery" data-id="${place.id}" style="font-size:11px;font-weight:600;color:white;background:#1E6B3E;border:none;padding:6px 10px;border-radius:999px;cursor:pointer">${labels.viewPhotos}</button>
        <button data-action="route" data-id="${place.id}" style="font-size:11px;font-weight:600;color:#1E6B3E;background:#EAF3EC;border:none;padding:6px 10px;border-radius:999px;cursor:pointer">${labels.itinerary}</button>
      </div>
      ${link}
    </div>
  `;
}

export default function ExploreMap() {
  const { t, i18n } = useTranslation();
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const placesById = useRef<Map<string, Place>>(new Map());

  const [mapReady, setMapReady] = useState(false);
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [activeCity, setActiveCity] = useState<Destination | null>(null);
  const [galleryPoi, setGalleryPoi] = useState<PointOfInterest | null>(null);

  const [livePois, setLivePois] = useState<LivePoi[]>([]);
  const [activePoiTypes, setActivePoiTypes] = useState<Set<PoiType>>(new Set());
  const [loadingPois, setLoadingPois] = useState(false);

  const [query, setQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchWrapRef = useRef<HTMLFormElement>(null);
  const [liveResults, setLiveResults] = useState<Place[]>([]);
  const [liveSearching, setLiveSearching] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [locateError, setLocateError] = useState<string | null>(null);

  const [routeTarget, setRouteTarget] = useState<Place | null>(null);
  const [routeMode, setRouteMode] = useState<RouteMode>('walking');
  const [routeInfo, setRouteInfo] = useState<{ distanceKm: number; durationMin: number } | null>(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);

  const [searchParams] = useSearchParams();

  // ---- Index de recherche unifié : sites touristiques + hôtels + restaurants ----
  const popupLabels = {
    officialSite: t('explore.officialSite'),
    viewPhotos: t('explore.viewPhotos'),
    itinerary: t('explore.itinerary'),
  };

  const searchIndex = useMemo<Place[]>(() => {
    const places: Place[] = [];
    destinations.forEach((d) => {
      d.pointsOfInterest?.forEach((poi, i) => {
        places.push({
          id: `poi-${d.id}-${i}`, name: poi.name, description: poi.description,
          imageUrl: poi.imageUrl, images: poi.images, sourceUrl: poi.sourceUrl,
          lat: poi.lat, lng: poi.lng, category: t('explore.categoryPOI'),
        });
      });
    });
    HOTELS.forEach((h) => {
      if (h.lat && h.lng) {
        places.push({
          id: `hotel-${h.name}`, name: h.name, description: h.description,
          imageUrl: h.imageUrl, images: h.images, sourceUrl: h.website,
          lat: h.lat, lng: h.lng, category: t('explore.categoryHotel'),
        });
      }
    });
    RESTAURANTS.forEach((r) => {
      if (r.lat && r.lng) {
        places.push({
          id: `resto-${r.name}`, name: r.name, description: r.description,
          imageUrl: r.images?.[0] || '', images: r.images, sourceUrl: r.website,
          lat: r.lat, lng: r.lng, category: t('explore.categoryRestaurant'),
        });
      }
    });
    return places;
  }, [destinations]);

  const searchResults = useMemo(() => {
    const q = normalize(query.trim());
    if (!q) return searchIndex;
    return searchIndex.filter((p) => normalize(p.name).includes(q));
  }, [query, searchIndex]);

  // Recherche Nominatim en direct (débattue à 450ms), pour couvrir n'importe
  // quel lieu du Cameroun au-delà de notre base curatée (Bandjoun/Bafoussam).
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = query.trim();
    if (q.length < 3) {
      setLiveResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLiveSearching(true);
      try {
        const results = await searchNominatim(q);
        // Écarte les résultats trop proches d'une entrée déjà curatée (évite les doublons visuels)
        const curatedNames = new Set(searchResults.map((p) => normalize(p.name)));
        setLiveResults(results.filter((r) => !curatedNames.has(normalize(r.name))));
      } catch {
        setLiveResults([]);
      } finally {
        setLiveSearching(false);
      }
    }, 450);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  // ---- Initialisation de la carte (une seule fois) ----
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    map.current = new maplibregl.Map({
      container: mapContainer.current,
      style: MAP_STYLE,
      center: CAMEROON_CENTER,
      zoom: DEFAULT_ZOOM,
      maxZoom: 19,
    });

    map.current.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');

    map.current.on('load', () => {
      // Source + couches pour le tracé d'itinéraire (vide au départ)
      map.current!.addSource('route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });
      map.current!.addLayer({
        id: 'route-line', type: 'line', source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': '#1E6B3E', 'line-width': 5, 'line-opacity': 0.85 },
      });

      // Source + couches pour les résultats OpenStreetMap en direct (avec clustering natif)
      map.current!.addSource('live-pois', {
        type: 'geojson', data: { type: 'FeatureCollection', features: [] },
        cluster: true, clusterMaxZoom: 14, clusterRadius: 45,
      });
      map.current!.addLayer({
        id: 'live-clusters', type: 'circle', source: 'live-pois', filter: ['has', 'point_count'],
        paint: {
          'circle-color': '#1E6B3E', 'circle-opacity': 0.85,
          'circle-radius': ['step', ['get', 'point_count'], 14, 10, 18, 25, 22],
        },
      });
      map.current!.addLayer({
        id: 'live-cluster-count', type: 'symbol', source: 'live-pois', filter: ['has', 'point_count'],
        layout: { 'text-field': ['get', 'point_count_abbreviated'], 'text-size': 11 },
        paint: { 'text-color': '#ffffff' },
      });
      map.current!.addLayer({
        id: 'live-points', type: 'circle', source: 'live-pois', filter: ['!', ['has', 'point_count']],
        paint: {
          'circle-color': ['get', 'color'], 'circle-radius': 6,
          'circle-stroke-width': 2, 'circle-stroke-color': '#ffffff',
        },
      });

      map.current!.on('click', 'live-points', (e: any) => {
        const f = e.features?.[0];
        if (!f) return;
        const coords = (f.geometry as any).coordinates as [number, number];
        new maplibregl.Popup({ closeButton: false }).setLngLat(coords).setHTML(
          `<p style="font-size:12px;font-weight:600;margin:0">${f.properties?.name}</p>`
        ).addTo(map.current!);
      });
      map.current!.on('click', 'live-clusters', (e: any) => {
        const f = e.features?.[0];
        if (!f) return;
        const source = map.current!.getSource('live-pois') as any;
        source.getClusterExpansionZoom(f.properties!.cluster_id).then((zoom: any) => {
          map.current!.easeTo({ center: (f.geometry as any).coordinates as [number, number], zoom });
        });
      });

      setMapReady(true);
    });

    // Délégation d'événements pour les boutons custom à l'intérieur des popups
    // (voir/plus de photos, calculer un itinéraire) — un seul listener, pas
    // besoin de le rebrancher à chaque ouverture/fermeture de popup.
    const container = mapContainer.current;
    const handleClick = (e: Event) => {
      const target = (e.target as HTMLElement).closest('[data-action]') as HTMLElement | null;
      if (!target) return;
      const id = target.dataset.id;
      const place = id ? placesById.current.get(id) : null;
      if (!place) return;
      if (target.dataset.action === 'gallery') {
        setGalleryPoi({
          name: place.name, type: place.category, description: place.description,
          imageUrl: place.imageUrl, images: place.images, sourceUrl: place.sourceUrl,
          lat: place.lat, lng: place.lng,
        });
      } else if (target.dataset.action === 'route') {
        openRoutePanel(place);
      }
    };
    container?.addEventListener('click', handleClick);

    return () => {
      container?.removeEventListener('click', handleClick);
      map.current?.remove();
      map.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Chargement des destinations + gestion des paramètres d'URL (?city=, ?q=) ----
  useEffect(() => {
    api.getDestinations({ limit: '100' }).then((res) => {
      setDestinations(res.data);
      const cityParam = searchParams.get('city')?.toLowerCase();
      if (cityParam) {
        const match = res.data.find((d: Destination) => d.name.toLowerCase() === cityParam);
        if (match) selectCity(match);
      }
      const qParam = searchParams.get('q');
      if (qParam) setQuery(qParam);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ---- Marqueurs : villes + POI curatés + hôtels + restaurants ----
  useEffect(() => {
    if (!mapReady || !map.current) return;

    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];
    placesById.current.clear();

    // Villes
    destinations.forEach((d) => {
      const el = markerEl('#1E6B3E', activeCity?.id === d.id ? 22 : 16);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([d.lng, d.lat])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(`<strong style="font-size:13px">${d.name}</strong>`))
        .addTo(map.current!);
      el.addEventListener('click', () => selectCity(d));
      markersRef.current.push(marker);
    });

    // Sites touristiques de la ville active
    activeCity?.pointsOfInterest?.forEach((poi, i) => {
      const place: Place = {
        id: `poi-${activeCity.id}-${i}`, name: poi.name, description: poi.description,
        imageUrl: poi.imageUrl, images: poi.images, sourceUrl: poi.sourceUrl,
        lat: poi.lat, lng: poi.lng, category: t('explore.categoryPOI'),
      };
      placesById.current.set(place.id, place);
      const el = markerEl('#1E6B3E', 13);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([poi.lng, poi.lat])
        .setPopup(new maplibregl.Popup({ offset: 12, maxWidth: '240px' }).setHTML(popupHTML(place, popupLabels)))
        .addTo(map.current!);
      markersRef.current.push(marker);
    });

    // Hôtels (toujours visibles — peu nombreux, utile de les voir même sans ville sélectionnée)
    HOTELS.forEach((h) => {
      if (!h.lat || !h.lng) return;
      const place: Place = {
        id: `hotel-${h.name}`, name: h.name, description: h.description,
        imageUrl: h.imageUrl, images: h.images, sourceUrl: h.website,
        lat: h.lat, lng: h.lng, category: t('explore.categoryHotel'),
      };
      placesById.current.set(place.id, place);
      const el = markerEl('#8B5CF6', 13);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([h.lng, h.lat])
        .setPopup(new maplibregl.Popup({ offset: 12, maxWidth: '240px' }).setHTML(popupHTML(place, popupLabels)))
        .addTo(map.current!);
      markersRef.current.push(marker);
    });

    // Restaurants
    RESTAURANTS.forEach((r) => {
      if (!r.lat || !r.lng) return;
      const place: Place = {
        id: `resto-${r.name}`, name: r.name, description: r.description,
        imageUrl: r.images?.[0] || '', images: r.images, sourceUrl: r.website,
        lat: r.lat, lng: r.lng, category: t('explore.categoryRestaurant'),
      };
      placesById.current.set(place.id, place);
      const el = markerEl('#E0645B', 13);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([r.lng, r.lat])
        .setPopup(new maplibregl.Popup({ offset: 12, maxWidth: '240px' }).setHTML(popupHTML(place, popupLabels)))
        .addTo(map.current!);
      markersRef.current.push(marker);
    });

    // Position de l'utilisateur
    if (userLocation) {
      const el = markerEl('#3B82F6', 16);
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([userLocation.lng, userLocation.lat])
        .setPopup(new maplibregl.Popup({ offset: 12 }).setHTML(`<span style="font-size:12px">${t('explore.youAreHere')}</span>`))
        .addTo(map.current!);
      markersRef.current.push(marker);
    }

    // Point d'arrivée d'un itinéraire en cours : icône "pin" drapeau du
    // Cameroun, pour le distinguer visuellement des autres marqueurs.
    if (routeTarget) {
      const el = document.createElement('div');
      el.style.width = '34px';
      el.style.height = '34px';
      el.style.backgroundImage = "url('/images/cameroon-pin-icon.png')";
      el.style.backgroundSize = 'contain';
      el.style.backgroundRepeat = 'no-repeat';
      el.style.filter = 'drop-shadow(0 2px 3px rgba(0,0,0,0.35))';
      const marker = new maplibregl.Marker({ element: el, anchor: 'bottom' })
        .setLngLat([routeTarget.lng, routeTarget.lat])
        .setPopup(new maplibregl.Popup({ offset: 24 }).setHTML(`<span style="font-size:12px;font-weight:600">${routeTarget.name}</span>`))
        .addTo(map.current!);
      markersRef.current.push(marker);
    }
  }, [mapReady, destinations, activeCity, userLocation, routeTarget, i18n.language]);

  // ---- Résultats OpenStreetMap en direct (source GeoJSON clusterisée) ----
  useEffect(() => {
    if (!mapReady || !map.current) return;
    const source = map.current.getSource('live-pois') as any;
    if (!source) return;
    source.setData({
      type: 'FeatureCollection',
      features: livePois.map((p) => ({
        type: 'Feature',
        geometry: { type: 'Point', coordinates: [p.lng, p.lat] },
        properties: { name: p.name, color: POI_CONFIG[p.type].color },
      })),
    });
  }, [mapReady, livePois]);

  // ---- Tracé de l'itinéraire sur la carte ----
  useEffect(() => {
    if (!mapReady || !map.current) return;
    const source = map.current.getSource('route') as any;
    if (!source) return;
    if (!routeInfo) {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [mapReady, routeInfo]);

  // Ferme le menu déroulant de recherche au clic en dehors
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) setSearchOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  function flyTo(lat: number, lng: number, zoom = CITY_ZOOM) {
    map.current?.flyTo({ center: [lng, lat], zoom, duration: 800 });
  }

  function selectCity(d: Destination) {
    setActiveCity(d);
    setLivePois([]);
    setActivePoiTypes(new Set());
    flyTo(d.lat, d.lng);
  }

  async function togglePoiType(type: PoiType) {
    if (!activeCity) return;
    if (activePoiTypes.has(type)) {
      setLivePois((prev) => prev.filter((p) => p.type !== type));
      setActivePoiTypes((prev) => { const n = new Set(prev); n.delete(type); return n; });
      return;
    }
    setLoadingPois(true);
    try {
      const found = await searchOverpass(activeCity.lat, activeCity.lng, type);
      setLivePois((prev) => [...prev.filter((p) => p.type !== type), ...found]);
      setActivePoiTypes((prev) => new Set(prev).add(type));
    } catch {
      // Overpass peut être temporairement surchargé (service public gratuit) — échoue silencieusement
    } finally {
      setLoadingPois(false);
    }
  }

  function handleGeolocate() {
    if (!navigator.geolocation) {
      setLocateError(t('explore.geoNotSupported'));
      return;
    }
    setLocating(true);
    setLocateError(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(coords);
        flyTo(coords.lat, coords.lng, 15);
        setLocating(false);
      },
      () => {
        setLocateError(t('explore.geoDenied'));
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  function openRoutePanel(place: Place) {
    setRouteTarget(place);
    setRouteInfo(null);
    setRouteError(null);
    flyTo(place.lat, place.lng, PLACE_ZOOM);
    if (!userLocation) handleGeolocate();
  }

  function selectSearchResult(place: Place) {
    setQuery('');
    setSearchOpen(false);
    flyTo(place.lat, place.lng, PLACE_ZOOM);
    openRoutePanel(place);
  }

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (!query.trim()) { setSearchOpen(true); return; }
    if (searchResults.length > 0) selectSearchResult(searchResults[0]);
    else if (liveResults.length > 0) selectSearchResult(liveResults[0]);
    else setSearchOpen(true);
  }

  async function computeRoute(mode: RouteMode) {
    setRouteMode(mode);
    if (!userLocation || !routeTarget) return;
    setRouteLoading(true);
    setRouteError(null);
    try {
      let geometry: any;
      let distanceKm: number;
      let durationMin: number;

      if (mode === 'flight') {
        // Pas d'OSRM pour l'avion (routage routier uniquement) : ligne directe
        // (great-circle) + estimation basée sur une vitesse de croisière moyenne.
        // Utile pour les longs trajets entre villes éloignées (ex. Yaoundé → Douala).
        distanceKm = haversineKm(userLocation, routeTarget);
        durationMin = (distanceKm / FLIGHT_SPEED_KMH) * 60 + FLIGHT_OVERHEAD_MIN;
        geometry = {
          type: 'LineString',
          coordinates: [[userLocation.lng, userLocation.lat], [routeTarget.lng, routeTarget.lat]],
        };
      } else {
        const result = await fetchRoute(mode, userLocation, routeTarget);
        geometry = result.geometry;
        distanceKm = result.distanceKm;
        durationMin = result.durationMin;
      }

      setRouteInfo({ distanceKm, durationMin });
      const source = map.current?.getSource('route') as any;
      source?.setData({ type: 'Feature', geometry, properties: {} });
      // Trait pointillé pour l'avion (ligne directe, ne suit pas les routes),
      // plein pour les modes terrestres.
      map.current?.setPaintProperty('route-line', 'line-dasharray', mode === 'flight' ? [2, 2] : [1, 0]);
      map.current?.fitBounds(
        geometry.coordinates.reduce(
          (b: any, c: [number, number]) => b.extend(c),
          new maplibregl.LngLatBounds()
        ),
        { padding: 60, duration: 800 }
      );
    } catch (err) {
      setRouteError(err instanceof Error ? err.message : "Impossible de calculer l'itinéraire");
    } finally {
      setRouteLoading(false);
    }
  }

  function closeRoutePanel() {
    setRouteTarget(null);
    setRouteInfo(null);
    setRouteError(null);
    const source = map.current?.getSource('route') as any;
    source?.setData({ type: 'FeatureCollection', features: [] });
  }

  return (
    <div>
      <div className="relative h-40 overflow-hidden">
        <img src="/images/route-dschang.jpg" alt="Route de l'Ouest Cameroun" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-b from-elegant/30 via-elegant/10 to-offwhite" />
      </div>
      <div className="max-w-7xl mx-auto px-6 py-8 -mt-16 relative z-10">
        {/* Hero */}
        <div className="mb-6">
          <p className="text-xs font-mono text-bronze-400 tracking-wider mb-2">{t('explore.eyebrow')}</p>
          <h1 className="font-display text-3xl font-semibold mb-1">{t('explore.title', 'Explorer le Cameroun')}</h1>
          <p className="text-ivory/60 text-sm max-w-2xl">
            {t('explore.heroSubtitle')}
          </p>
        </div>

        {/* Sélecteur de ville */}
        <div className="flex gap-3 mb-6">
          {destinations.map((d) => (
            <button
              key={d.id}
              onClick={() => selectCity(d)}
              className={`px-5 py-2.5 rounded-lg text-sm font-medium border transition ${
                activeCity?.id === d.id
                  ? 'bg-bronze-500 text-ink border-bronze-500'
                  : 'bg-ndop-800/60 border-ndop-700 hover:border-bronze-500/60'
              }`}
            >
              {d.name}
            </button>
          ))}
        </div>

        {/* Barre de recherche unifiée : sites, hôtels, restaurants — avec suggestions */}
        <form onSubmit={handleSearch} className="mb-2 relative max-w-xl" ref={searchWrapRef}>
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ivory/40" />
              <input
                type="text"
                value={query}
                onChange={(e) => { setQuery(e.target.value); setSearchOpen(true); }}
                onFocus={() => setSearchOpen(true)}
                placeholder={t('explore.searchPlaceholder')}
                className="w-full pl-10 pr-4 py-2.5 rounded-lg bg-ndop-800 border border-ndop-700 focus:border-bronze-500 outline-none text-sm placeholder:text-ivory/40"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2.5 rounded-lg bg-bronze-500 text-ink text-sm font-medium"
            >
              {t('explore.searchButton')}
            </button>
            <button
              type="button"
              onClick={handleGeolocate}
              disabled={locating}
              title={t('explore.locateMe')}
              className="px-3.5 py-2.5 rounded-lg border border-ndop-700 hover:border-bronze-500/60 text-sm flex items-center gap-1.5 disabled:opacity-50"
            >
              <LocateFixed size={16} className={locating ? 'animate-pulse' : ''} />
            </button>
          </div>

          {searchOpen && (
            <div className="absolute top-full left-0 right-16 mt-2 bg-white rounded-xl shadow-2xl overflow-hidden z-20">
              {searchResults.length === 0 && liveResults.length === 0 && !liveSearching ? (
                <p className="px-4 py-6 text-sm text-elegant/50 text-center">
                  {query.trim().length < 3 ? t('explore.typeAtLeast3') : t('explore.noResults', { query })}
                </p>
              ) : (
                <div className="max-h-80 overflow-y-auto py-1.5">
                  {searchResults.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onMouseDown={(e) => { e.preventDefault(); selectSearchResult(p); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-graylight transition text-left"
                    >
                      {p.imageUrl ? (
                        <img src={p.imageUrl} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-graylight shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-elegant truncate">{p.name}</p>
                        <p className="text-xs text-elegant/45">{p.category}</p>
                      </div>
                    </button>
                  ))}

                  {(liveResults.length > 0 || liveSearching) && (
                    <>
                      <p className="px-4 pt-2 pb-1 text-[10px] font-mono uppercase tracking-wide text-elegant/35">
                        {liveSearching ? t('explore.searchingCameroon') : t('explore.elsewhereInCameroon')}
                      </p>
                      {liveResults.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={(e) => { e.preventDefault(); selectSearchResult(p); }}
                          className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-graylight transition text-left"
                        >
                          <div className="w-10 h-10 rounded-lg bg-forest-50 flex items-center justify-center shrink-0">
                            <Search size={14} className="text-forest-400" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-elegant truncate">{p.name}</p>
                            <p className="text-xs text-elegant/45 truncate">{p.description}</p>
                          </div>
                        </button>
                      ))}
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </form>
        {locateError && <p className="text-xs text-red-500 mb-4">{locateError}</p>}
        {!locateError && <div className="mb-6" />}

        <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 mb-10">
          {/* Galerie des sites curatés */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {!activeCity && (
              <p className="text-sm text-ivory/50 italic">{t('explore.chooseCityPrompt')}</p>
            )}
            {activeCity?.pointsOfInterest?.map((poi, i) => (
              <div key={poi.name} className="w-full text-left rounded-lg overflow-hidden border border-ndop-700 hover:border-bronze-600/50 transition">
                <button onClick={() => setGalleryPoi(poi)} className="relative w-full h-32 block group" title={t('explore.viewGallery')}>
                  <img src={poi.imageUrl} alt={poi.name} className="w-full h-full object-cover" loading="lazy" />
                  {poi.images && poi.images.length > 1 && (
                    <span className="absolute bottom-2 right-2 bg-ink/70 text-white text-[10px] font-mono px-2 py-0.5 rounded-full">
                      {poi.images.length} photos
                    </span>
                  )}
                  <span className="absolute inset-0 bg-ink/0 group-hover:bg-ink/20 transition flex items-center justify-center opacity-0 group-hover:opacity-100">
                    <span className="text-white text-xs font-medium bg-ink/60 px-3 py-1.5 rounded-full">{t('explore.viewGallery')}</span>
                  </span>
                </button>
                <div className="flex">
                  <button
                    onClick={() => flyTo(poi.lat, poi.lng, PLACE_ZOOM)}
                    className="flex-1 text-left p-3 bg-ndop-800/50 hover:bg-ndop-800 transition"
                  >
                    <p className="font-medium text-sm mb-1">{poi.name}</p>
                    <p className="text-xs text-ivory/50 line-clamp-2">{poi.description}</p>
                  </button>
                  <button
                    onClick={() => openRoutePanel({
                      id: `poi-${activeCity.id}-${i}`, name: poi.name, description: poi.description,
                      imageUrl: poi.imageUrl, images: poi.images, sourceUrl: poi.sourceUrl,
                      lat: poi.lat, lng: poi.lng, category: t('explore.categoryPOI'),
                    })}
                    title="Itinéraire"
                    className="px-3 bg-ndop-800/50 hover:bg-ndop-800 transition text-bronze-400"
                  >
                    <Navigation2 size={15} />
                  </button>
                </div>
              </div>
            ))}

            {activeCity && (
              <div className="pt-3 border-t border-ndop-700">
                <p className="text-xs font-mono text-bronze-400 mb-2">{t('explore.findNearby')}</p>
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(POI_CONFIG) as PoiType[]).map((type) => (
                    <button
                      key={type}
                      onClick={() => togglePoiType(type)}
                      className={`text-xs px-2.5 py-1.5 rounded-md border transition ${
                        activePoiTypes.has(type) ? 'text-white border-transparent' : 'border-ndop-700 text-ivory/70 hover:border-bronze-600/50'
                      }`}
                      style={activePoiTypes.has(type) ? { backgroundColor: POI_CONFIG[type].color } : {}}
                    >
                      {POI_CONFIG[type].label}
                    </button>
                  ))}
                </div>
                {loadingPois && <p className="text-[11px] text-ivory/40 mt-2 font-mono">{t('explore.searching')}</p>}
                <p className="text-[10px] text-ivory/30 mt-2 leading-relaxed">
                  {t('explore.osmDataNote')}
                </p>
              </div>
            )}
          </div>

          {/* Carte */}
          <div className="rounded-2xl overflow-hidden border border-black/5 shadow-sm relative" style={{ height: 600 }}>
            <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

            {galleryPoi && (
              <PlaceModal poi={galleryPoi} onClose={() => setGalleryPoi(null)} />
            )}

            {/* Légende */}
            <div className="absolute bottom-3 left-3 z-10 bg-white/95 backdrop-blur rounded-lg px-3 py-2 text-[11px] space-y-1 border border-ndop-700 shadow">
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#1E6B3E' }} /> {t('explore.legendCityOrSite')}</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#8B5CF6' }} /> {t('explore.categoryHotel')}</div>
              <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#E0645B' }} /> {t('explore.categoryRestaurant')}</div>
              {[...activePoiTypes].map((t) => (
                <div key={t} className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full" style={{ backgroundColor: POI_CONFIG[t].color }} />
                  {POI_CONFIG[t].label}
                </div>
              ))}
              {userLocation && (
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: '#3B82F6' }} /> {t('explore.legendYou')}</div>
              )}
              {routeTarget && (
                <div className="flex items-center gap-1.5">
                  <img src="/images/cameroon-pin-icon.png" alt="" className="w-3 h-3" /> {t('explore.legendArrivalPoint')}
                </div>
              )}
            </div>

            {/* Panneau d'itinéraire */}
            {routeTarget && (
              <div className="absolute top-3 left-3 right-3 sm:right-auto sm:w-80 z-10 bg-white rounded-xl shadow-xl border border-black/5 p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="min-w-0">
                    <p className="text-xs text-elegant/40 font-mono uppercase tracking-wide">{t('explore.itineraryTo')}</p>
                    <p className="text-sm font-semibold text-elegant truncate">{routeTarget.name}</p>
                  </div>
                  <button onClick={closeRoutePanel} className="text-elegant/40 hover:text-elegant transition shrink-0">
                    <X size={16} />
                  </button>
                </div>

                {!userLocation ? (
                  <p className="text-xs text-elegant/50">
                    {locating ? t('explore.locatingYou') : t('explore.enableLocation')}
                  </p>
                ) : (
                  <>
                    <div className="flex gap-1.5 mb-3">
                      {ROUTE_MODES.map(({ mode, labelKey, icon: Icon }) => (
                        <button
                          key={mode}
                          onClick={() => computeRoute(mode)}
                          className={`flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs transition ${
                            routeMode === mode && routeInfo
                              ? 'bg-forest-600 text-white border-forest-600'
                              : 'border-black/10 text-elegant/60 hover:border-forest-400'
                          }`}
                        >
                          <Icon size={15} /> {t(labelKey)}
                        </button>
                      ))}
                    </div>

                    {routeLoading && <p className="text-xs text-elegant/50">{t('explore.calculatingRoute')}</p>}
                    {routeError && <p className="text-xs text-red-500">{routeError}</p>}
                    {routeInfo && !routeLoading && (
                      <>
                        <p className="text-sm text-elegant/70">
                          <span className="font-semibold text-forest-600">{routeInfo.distanceKm.toFixed(1)} km</span>
                          {' · '}
                          <span className="font-semibold text-forest-600">{formatDuration(routeInfo.durationMin)}</span>
                        </p>
                        {routeMode === 'flight' && (
                          <p className="text-[11px] text-elegant/40 mt-1">
                            {t('explore.flightEstimateNote')}
                          </p>
                        )}
                      </>
                    )}
                  </>
                )}

                {routeTarget.sourceUrl && (
                  <a
                    href={routeTarget.sourceUrl} target="_blank" rel="noopener noreferrer"
                    className="mt-3 flex items-center gap-1.5 text-xs font-medium text-forest-600 hover:underline"
                  >
                    Site officiel <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
