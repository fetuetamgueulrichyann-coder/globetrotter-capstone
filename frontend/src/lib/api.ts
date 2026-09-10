/**
 * Client API unique : toutes les requêtes réseau de l'app passent par ici.
 * Le frontend ne parle qu'au Gateway (VITE_API_URL) — jamais directement
 * aux microservices, exactement comme prévu par l'architecture Phase 2.
 *
 * Authentification : le JWT est transporté via un cookie httpOnly (jamais
 * lu ni stocké en JavaScript, donc protégé contre le vol par une faille
 * XSS) — `credentials: 'include'` sur chaque requête pour que le navigateur
 * envoie/reçoive automatiquement ce cookie.
 */
import type { ApiError, AuthorIdentity, Comment, Destination, Itinerary, PlaceSuggestion, Post, User } from '../types';

export interface Conversation {
  id: string;
  type: 'direct' | 'group';
  title: string | null;
  ownerId?: string | null;
  userAId: string | null;
  userBId: string | null;
  otherUserId: string | null;
  otherUser: AuthorIdentity | null;
  memberCount?: number | null;
  lastMessage: ChatMessage | null;
  unreadCount: number;
  createdAt: string;
  lastMessageAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  sender?: AuthorIdentity;
  type: 'text' | 'voice' | 'call';
  content: string;
  audioUrl?: string | null;
  durationSeconds?: number | null;
  callKind?: 'audio' | 'video' | null;
  callStatus?: 'completed' | 'missed' | 'declined' | null;
  deleted?: boolean;
  createdAt: string;
  readAt: string | null;
}

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

/** Les images de posts sont renvoyées en chemin relatif ("/uploads/xxx.jpg") par le Social Service — préfixe avec le Gateway pour obtenir une URL affichable. */
export function resolveImageUrl(path: string) {
  return path.startsWith('http') ? path : `${API_URL}${path}`;
}

// Debug: affiche la valeur utilisée côté client pour faciliter le diagnostic
try {
  // eslint-disable-next-line no-console
  console.debug('[api] API_URL=', API_URL);
} catch (e) {}

class ApiRequestError extends Error {
  details?: ApiError['details'];
  status: number;
  constructor(message: string, status: number, details?: ApiError['details']) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const isFormData = options.body instanceof FormData;
  const headers: Record<string, string> = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(options.headers as Record<string, string>),
  };

  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: 'include', // envoie/reçoit le cookie httpOnly d'authentification
  });
  const body = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new ApiRequestError(
      body?.error?.message || 'Une erreur est survenue',
      res.status,
      body?.error?.details
    );
  }
  return body as T;
}

export const api = {
  register: (data: { name: string; email: string; password: string; preferences?: string[] }) =>
    request<{ success: true; data: { user: any } }>('/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  login: (data: { email: string; password: string }) =>
    request<{ success: true; data: { user: any } }>('/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  googleLogin: (credential: string) =>
    request<{ success: true; data: { user: User } }>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ credential }),
    }),

  me: () => request<{ success: true; data: { user: any } }>('/me'),

  logout: () => request<{ success: true }>('/logout', { method: 'POST' }),

  forgotPassword: (email: string) =>
    request<{ success: true; message: string; devResetToken?: string; devNote?: string }>('/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ success: true; message: string }>('/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    }),

  getDestinations: (params: Record<string, string> = {}) => {
    const qs = new URLSearchParams(params).toString();
    return request<{ success: true; data: any[]; pagination: any }>(`/destinations${qs ? `?${qs}` : ''}`);
  },

  getDestination: (id: string) =>
    request<{ success: true; data: Destination }>(`/destinations/${id}`),

  getRecommendations: () =>
    request<{ success: true; data: any[]; meta: any }>('/recommendations'),

  createItinerary: (data: { title: string; destinationId: string; startDate: string; endDate: string; notes?: string }) =>
    request<{ success: true; data: any }>('/itineraries', { method: 'POST', body: JSON.stringify(data) }),

  getItineraries: () => request<{ success: true; data: any[] }>('/itineraries'),

  shareItinerary: (id: string, email: string) =>
    request<{ success: true; data: any }>(`/itineraries/${id}/share`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  enableItineraryShareLink: (id: string) =>
    request<{ success: true; data: Itinerary }>(`/itineraries/${id}/share-link`, { method: 'POST' }),

  disableItineraryShareLink: (id: string) =>
    request<{ success: true; data: Itinerary }>(`/itineraries/${id}/share-link`, { method: 'DELETE' }),

  getPublicItinerary: (id: string) =>
    request<{ success: true; data: { title: string; destination: Destination | null; startDate: string; endDate: string; notes: string } }>(
      `/itineraries/${id}/public`
    ),

  deleteItinerary: (id: string) =>
    request<{ success: true; message: string }>(`/itineraries/${id}`, { method: 'DELETE' }),

  // ---- Suggestions de lieu (utilisateur -> admin) ----
  submitPlaceSuggestion: (data: { name: string; city: string; description: string; photo?: File | null }) => {
    const form = new FormData();
    form.append('name', data.name);
    form.append('city', data.city);
    form.append('description', data.description);
    if (data.photo) form.append('photo', data.photo);
    return request<{ success: true; data: PlaceSuggestion }>('/place-suggestions', { method: 'POST', body: form });
  },

  getMyPlaceSuggestions: () => request<{ success: true; data: PlaceSuggestion[] }>('/place-suggestions/mine'),

  getAdminPlaceSuggestions: (status?: string) =>
    request<{ success: true; data: PlaceSuggestion[] }>(`/place-suggestions/admin${status ? `?status=${status}` : ''}`),

  reviewPlaceSuggestion: (id: string, status: 'approved' | 'rejected', adminNote?: string) =>
    request<{ success: true; data: PlaceSuggestion }>(`/place-suggestions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status, adminNote }),
    }),

  // ---- Identité minimale (nom + avatar affichés sur posts/commentaires) & mon compte ----
  getUserIdentity: (userId: string) =>
    request<{ success: true; data: AuthorIdentity }>(`/users/${userId}`),

  updateMyProfile: (data: Partial<Pick<User, 'name' | 'bio' | 'avatarUrl' | 'city' | 'country' | 'messagingPrivacy' | 'notificationsEnabled' | 'themePreference'>>) =>
    request<{ success: true; data: { user: User } }>('/users/me', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  changeMyPassword: (currentPassword: string, newPassword: string) =>
    request<{ success: true; message: string }>('/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  deleteMyAccount: () =>
    request<{ success: true; message: string }>('/users/me', { method: 'DELETE' }),

  uploadMyAvatar: (file: File) => {
    const form = new FormData();
    form.append('avatar', file);
    return request<{ success: true; data: { user: User } }>('/users/me/avatar', {
      method: 'POST',
      body: form,
    });
  },

  // ---- Publications & photos (Phase 2 social) ----
  createPost: (data: { city: string; locationName: string; caption: string; visitDate: string; images: File[] }) => {
    const form = new FormData();
    form.append('city', data.city);
    form.append('locationName', data.locationName);
    form.append('caption', data.caption);
    if (data.visitDate) form.append('visitDate', data.visitDate);
    data.images.forEach((file) => form.append('images', file));
    return request<{ success: true; data: Post }>('/posts', { method: 'POST', body: form });
  },

  getFeed: (params?: { userId?: string; city?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.userId) qs.set('userId', params.userId);
    if (params?.city) qs.set('city', params.city);
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return request<{ success: true; data: Post[]; pagination: { total: number; limit: number; offset: number; hasMore: boolean } }>(
      `/posts${suffix}`
    );
  },

  getPost: (id: string) => request<{ success: true; data: Post }>(`/posts/${id}`),

  deletePost: (id: string) =>
    request<{ success: true; message: string }>(`/posts/${id}`, { method: 'DELETE' }),

  // ---- Commentaires ----
  getComments: (postId: string) =>
    request<{ success: true; data: Comment[] }>(`/posts/${postId}/comments`),

  addComment: (postId: string, content: string) =>
    request<{ success: true; data: Comment }>(`/posts/${postId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  deleteComment: (commentId: string) =>
    request<{ success: true; message: string }>(`/comments/${commentId}`, { method: 'DELETE' }),

  reportComment: (commentId: string, reason?: string) =>
    request<{ success: true; data: { alreadyReported: boolean } }>(`/comments/${commentId}/report`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || '' }),
    }),

  // ---- Votes "utile / pas utile" 👍🏽👎🏽 sur un commentaire ----
  voteOnComment: (commentId: string, value: 'helpful' | 'unhelpful') =>
    request<{ success: true; data: { helpfulCount: number; unhelpfulCount: number; myVote: string | null } }>(
      `/comments/${commentId}/vote`,
      { method: 'POST', body: JSON.stringify({ value }) }
    ),

  removeVote: (commentId: string) =>
    request<{ success: true; data: { helpfulCount: number; unhelpfulCount: number; myVote: string | null } }>(
      `/comments/${commentId}/vote`,
      { method: 'DELETE' }
    ),

  getCommentVoters: (commentId: string) =>
    request<{ success: true; data: { helpful: AuthorIdentity[]; unhelpful: AuthorIdentity[] } }>(
      `/comments/${commentId}/votes`
    ),

  // ---- Favoris (étoile sur une publication) ----
  addFavorite: (postId: string) =>
    request<{ success: true; data: { isFavorited: boolean } }>(`/posts/${postId}/favorite`, { method: 'POST' }),

  removeFavorite: (postId: string) =>
    request<{ success: true; data: { isFavorited: boolean } }>(`/posts/${postId}/favorite`, { method: 'DELETE' }),

  getMyFavorites: () => request<{ success: true; data: Post[] }>('/favorites'),

  // ---- Messagerie ----
  searchUsers: (q: string) =>
    request<{ success: true; data: AuthorIdentity[] }>(`/users/search?q=${encodeURIComponent(q)}`),

  getConversations: () =>
    request<{ success: true; data: Conversation[] }>('/conversations'),

  startConversation: (targetUserId: string) =>
    request<{ success: true; data: Conversation }>('/conversations', {
      method: 'POST',
      body: JSON.stringify({ targetUserId }),
    }),

  getConversationMessages: (conversationId: string, before?: string) =>
    request<{ success: true; data: ChatMessage[] }>(
      `/conversations/${conversationId}/messages${before ? `?before=${encodeURIComponent(before)}` : ''}`
    ),

  sendMessage: (conversationId: string, content: string) =>
    request<{ success: true; data: ChatMessage }>(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    }),

  sendVoiceMessage: (conversationId: string, audioBlob: Blob, durationSeconds: number, extension = 'webm') => {
    const form = new FormData();
    form.append('audio', audioBlob, `voice.${extension}`);
    form.append('durationSeconds', String(Math.round(durationSeconds)));
    return request<{ success: true; data: ChatMessage }>(`/conversations/${conversationId}/voice-messages`, {
      method: 'POST',
      body: form,
    });
  },

  deleteConversation: (conversationId: string) =>
    request<{ success: true }>(`/conversations/${conversationId}`, { method: 'DELETE' }),

  deleteMessage: (conversationId: string, messageId: string) =>
    request<{ success: true; data: ChatMessage }>(`/conversations/${conversationId}/messages/${messageId}`, {
      method: 'DELETE',
    }),

  createGroup: (title: string, memberIds: string[]) =>
    request<{ success: true; data: Conversation }>('/conversations/groups', {
      method: 'POST',
      body: JSON.stringify({ title, memberIds }),
    }),

  getGroupMembers: (conversationId: string) =>
    request<{ success: true; data: { members: AuthorIdentity[]; ownerId: string } }>(`/conversations/${conversationId}/members`),

  addGroupMember: (conversationId: string, userId: string) =>
    request<{ success: true }>(`/conversations/${conversationId}/members`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    }),

  leaveGroup: (conversationId: string) =>
    request<{ success: true }>(`/conversations/${conversationId}/leave`, { method: 'POST' }),

  // ---- Admin ----
  getAdminUserStats: () =>
    request<{ success: true; data: { usersCount: number; legacyUsersCount: number } }>('/users/admin/stats'),

  setAdminLegacyUsersCount: (count: number) =>
    request<{ success: true; data: { legacyUsersCount: number } }>('/users/admin/settings/legacy-users-count', {
      method: 'PATCH',
      body: JSON.stringify({ count }),
    }),

  getAdminSocialStats: () =>
    request<{ success: true; data: { postsCount: number; commentsCount: number } }>('/posts/admin/stats'),

  getAdminAllComments: () =>
    request<{
      success: true;
      data: (Comment & { author: AuthorIdentity; postCaption: string | null; postId: string; reportCount: number })[];
    }>('/comments/admin/all'),

  adminDeleteComment: (commentId: string) =>
    request<{ success: true; message: string }>(`/comments/${commentId}`, { method: 'DELETE' }),

  adminUpdatePoiPhotos: (destId: string, poiIndex: number, payload: { imageUrl?: string; images?: string[] }) =>
    request<{ success: true; data: Destination }>(`/destinations/${destId}/admin/pois/${poiIndex}/photos`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),

  adminAddPoi: (destId: string, poi: { name: string; type?: string; description?: string; imageUrl?: string; images?: string[]; lat?: number; lng?: number }) =>
    request<{ success: true; data: Destination }>(`/destinations/${destId}/admin/pois`, {
      method: 'POST',
      body: JSON.stringify(poi),
    }),

  // ---- Avis & notes sur les lieux (sites, hôtels, restaurants, spas...) ----
  getPlaceReviews: (placeId: string) =>
    request<{
      success: true;
      data: { id: string; placeId: string; userId: string; stars: number; comment: string; createdAt: string; author: AuthorIdentity }[];
      summary: { placeId: string; averageStars: number; reviewCount: number };
    }>(`/places/${encodeURIComponent(placeId)}/reviews`),

  submitPlaceReview: (placeId: string, placeName: string, stars: number, comment: string) =>
    request<{ success: true; data: any }>(`/places/${encodeURIComponent(placeId)}/reviews`, {
      method: 'POST',
      body: JSON.stringify({ placeName, stars, comment }),
    }),

  deletePlaceReview: (reviewId: string) =>
    request<{ success: true; message: string }>(`/places/reviews/${reviewId}`, { method: 'DELETE' }),

  // ---- Demandes de réservation d'hôtel ----
  createBookingRequest: (data: { hotelName: string; city?: string; checkIn: string; checkOut: string; guests?: number; contactPhone?: string; notes?: string }) =>
    request<{ success: true; data: any }>('/itineraries/bookings', { method: 'POST', body: JSON.stringify(data) }),

  getMyBookings: () =>
    request<{ success: true; data: any[] }>('/itineraries/bookings'),

  getAdminAllBookings: () =>
    request<{ success: true; data: any[] }>('/itineraries/bookings/admin/all'),

  adminUpdateBookingStatus: (bookingId: string, status: 'pending' | 'confirmed' | 'cancelled') =>
    request<{ success: true; data: any }>(`/itineraries/bookings/${bookingId}/admin/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  payBookingFee: (bookingId: string, phone: string) =>
    request<{ success: true; data: any }>(`/itineraries/bookings/${bookingId}/pay`, {
      method: 'POST',
      body: JSON.stringify({ phone }),
    }),

  getBookingPaymentStatus: (bookingId: string) =>
    request<{ success: true; data: any }>(`/itineraries/bookings/${bookingId}/payment-status`),

  // ---- Alertes communautaires ----
  getAlerts: (city: string) =>
    request<{ success: true; data: any[] }>(`/alerts?city=${encodeURIComponent(city)}`),

  createAlert: (data: { city: string; placeName?: string; type: 'route' | 'price' | 'closed' | 'other'; message: string }) =>
    request<{ success: true; data: any }>('/alerts', { method: 'POST', body: JSON.stringify(data) }),

  deleteAlert: (alertId: string) =>
    request<{ success: true; message: string }>(`/alerts/${alertId}`, { method: 'DELETE' }),

  // ---- Guides locaux vérifiés ----
  getGuides: (city: string) =>
    request<{ success: true; data: any[] }>(`/guides?city=${encodeURIComponent(city)}`),

  adminCreateGuide: (data: { name: string; phone: string; city: string; specialty?: string; bio?: string; photoUrl?: string }) =>
    request<{ success: true; data: any }>('/guides/admin', { method: 'POST', body: JSON.stringify(data) }),

  adminDeleteGuide: (guideId: string) =>
    request<{ success: true; message: string }>(`/guides/admin/${guideId}`, { method: 'DELETE' }),

  // ---- Dépenses partagées (itinéraires) ----
  getExpenses: (itineraryId: string) =>
    request<{ success: true; data: { expenses: any[]; balances: any[] } }>(`/itineraries/${itineraryId}/expenses`),

  addExpense: (itineraryId: string, data: { description: string; amountFcfa: number; paidByUserId?: string }) =>
    request<{ success: true; data: any }>(`/itineraries/${itineraryId}/expenses`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  deleteExpense: (expenseId: string) =>
    request<{ success: true; message: string }>(`/itineraries/expenses/${expenseId}`, { method: 'DELETE' }),
};

export { ApiRequestError };
