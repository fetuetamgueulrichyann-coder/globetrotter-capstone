export interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  preferences: string[];
  bio: string;
  avatarUrl: string;
  city: string;
  country: string;
  messagingPrivacy: 'everyone' | 'nobody';
  notificationsEnabled: boolean;
  themePreference: 'light' | 'dark';
}

/** Identité minimale affichée pour l'auteur d'une publication/commentaire/vote — pas un profil consultable. */
export interface AuthorIdentity {
  id: string;
  name: string;
  avatarUrl: string;
}

export interface PlaceSuggestion {
  id: string;
  userId: string;
  author?: AuthorIdentity;
  name: string;
  city: string;
  description: string;
  photoUrl: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote: string;
  createdAt: string;
}

export interface PointOfInterest {
  name: string;
  type: string;
  description: string;
  imageUrl: string;
  images?: string[];
  sourceUrl?: string;
  lat: number;
  lng: number;
  /** Budget indicatif à prévoir pour visiter ce lieu (ex. "Entrée : 2 000 FCFA adulte") */
  priceInfo?: string;
  phone?: string;
  address?: string;
}

export interface Destination {
  id: string;
  name: string;
  country: string;
  region: string;
  tags: string[];
  popularity: number;
  imageUrl: string;
  description: string;
  pricePerDay: number;
  lat: number;
  lng: number;
  matchScore?: number;
  pointsOfInterest?: PointOfInterest[];
}

export interface Itinerary {
  id: string;
  userId: string;
  title: string;
  destinationId: string;
  startDate: string;
  endDate: string;
  notes: string;
  sharedWith: string[];
  isPublic: boolean;
  createdAt: string;
}

export interface Post {
  id: string;
  userId: string;
  author: AuthorIdentity;
  city: 'Bandjoun' | 'Bafoussam' | 'Douala' | 'Kribi' | 'Yaoundé';
  locationName: string;
  caption: string;
  visitDate: string | null;
  images: string[];
  createdAt: string;
  commentsCount: number;
  isFavorited: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  content: string;
  createdAt: string;
  author: AuthorIdentity;
  helpfulCount: number;
  unhelpfulCount: number;
  myVote: 'helpful' | 'unhelpful' | null;
}

export interface ApiError {
  message: string;
  details?: { field: string; message: string }[];
}
