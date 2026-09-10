/**
 * Liens affiliés Booking.com / Agoda. Tant que VITE_BOOKING_AID /
 * VITE_AGODA_CID ne sont pas renseignés, les liens fonctionnent normalement
 * (juste sans tracking de commission) — dès qu'ils sont configurés, chaque
 * clic depuis MboaTrip devient traçable pour toucher une commission sur les
 * réservations abouties, sans rien changer côté utilisateur.
 */
const BOOKING_AID = import.meta.env.VITE_BOOKING_AID || '';
const AGODA_CID = import.meta.env.VITE_AGODA_CID || '';

function appendParam(url: string, key: string, value: string) {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}${key}=${encodeURIComponent(value)}`;
}

export function withBookingAffiliate(url: string): string {
  return BOOKING_AID ? appendParam(url, 'aid', BOOKING_AID) : url;
}

export function withAgodaAffiliate(url: string): string {
  return AGODA_CID ? appendParam(url, 'cid', AGODA_CID) : url;
}
