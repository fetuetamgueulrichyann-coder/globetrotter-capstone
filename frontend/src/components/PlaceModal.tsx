import type { PointOfInterest } from '../types';
import GalleryModal from './GalleryModal';

interface Props {
  poi: PointOfInterest;
  onClose: () => void;
}

/** Modal galerie photo pour un site touristique — délègue à GalleryModal
 * (qui affiche automatiquement le lien "En savoir plus" si sourceUrl existe). */
export default function PlaceModal({ poi, onClose }: Props) {
  return <GalleryModal item={poi} onClose={onClose} />;
}
