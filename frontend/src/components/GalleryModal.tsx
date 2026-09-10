import { useState, useEffect, type ReactNode } from 'react';
import PlaceReviews from './PlaceReviews';

export interface GalleryItem {
  name: string;
  description: string;
  imageUrl: string;
  images?: string[];
  sourceUrl?: string;
  /** Budget indicatif à prévoir (ex. "Entrée : 2 000 FCFA adulte, 500 FCFA enfant") */
  priceInfo?: string;
  phone?: string;
  address?: string;
}

interface Props {
  item: GalleryItem;
  onClose: () => void;
  /** Contenu additionnel affiché sous la description (notes, avis, boutons d'action...) */
  extra?: ReactNode;
}

/**
 * Modal galerie photo plein écran, réutilisable pour tout élément avec
 * nom + description + une ou plusieurs images (sites touristiques, plats,
 * hôtels, restaurants). Le slot `extra` permet d'ajouter du contenu
 * spécifique (étoiles, avis, boutons d'appel...) sans dupliquer ce composant.
 */
export default function GalleryModal({ item, onClose, extra }: Props) {
  const images = item.images?.length ? item.images : [item.imageUrl];
  const [index, setIndex] = useState(0);
  const [failed, setFailed] = useState<Record<number, boolean>>({});

  useEffect(() => { setIndex(0); setFailed({}); }, [item]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setIndex((i) => (i + 1) % images.length);
      if (e.key === 'ArrowLeft') setIndex((i) => (i - 1 + images.length) % images.length);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [images.length, onClose]);

  return (
    <div className="fixed inset-0 z-[2000] bg-elegant/60 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl max-w-2xl w-full max-h-[88vh] overflow-y-auto shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="relative">
          {failed[index] ? (
            <div className="w-full h-80 rounded-t-2xl bg-graylight flex flex-col items-center justify-center text-center px-6 gap-2">
              <span className="text-3xl">🖼️</span>
              <p className="text-xs text-elegant/50 break-all">
                Image {index + 1}/{images.length} indisponible (échec de chargement)
              </p>
            </div>
          ) : (
            <img
              src={images[index]}
              alt={item.name}
              className="w-full h-80 object-cover rounded-t-2xl"
              onError={() => setFailed((f) => ({ ...f, [index]: true }))}
            />
          )}
          <button
            onClick={onClose}
            aria-label="Fermer"
            className="absolute top-3 right-3 w-8 h-8 rounded-full bg-white shadow flex items-center justify-center text-elegant font-bold hover:bg-graylight"
          >
            ✕
          </button>
          {images.length > 1 && (
            <>
              <button
                onClick={() => setIndex((i) => (i - 1 + images.length) % images.length)}
                aria-label="Image précédente"
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-elegant"
              >
                ‹
              </button>
              <button
                onClick={() => setIndex((i) => (i + 1) % images.length)}
                aria-label="Image suivante"
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-white shadow flex items-center justify-center text-elegant"
              >
                ›
              </button>
              <div className="absolute bottom-3 right-3 bg-elegant/70 text-white text-xs px-2 py-1 rounded-full font-mono">
                {index + 1}/{images.length}
              </div>
            </>
          )}
        </div>

        {images.length > 1 && (
          <div className="flex gap-2 px-5 pt-4 overflow-x-auto">
            {images.map((img, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`w-16 h-16 rounded-lg overflow-hidden flex-shrink-0 border-2 transition ${
                  i === index ? 'border-forest-600' : 'border-transparent opacity-70 hover:opacity-100'
                }`}
              >
                <img src={img} alt={`${item.name} ${i + 1}`} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        <div className="p-5">
          <h2 className="font-display text-xl font-semibold text-elegant mb-2">{item.name}</h2>
          <p className="text-sm text-elegant/70 leading-relaxed">{item.description}</p>
          {(item.priceInfo || item.address || item.phone) && (
            <div className="mt-3 flex flex-col gap-1.5 text-sm">
              {item.priceInfo && (
                <p className="inline-flex items-start gap-1.5 text-gold-700 font-medium">
                  <span aria-hidden>💰</span> {item.priceInfo}
                </p>
              )}
              {item.address && (
                <p className="inline-flex items-start gap-1.5 text-elegant/55">
                  <span aria-hidden>📍</span> {item.address}
                </p>
              )}
              {item.phone && (
                <a href={`tel:${item.phone}`} className="inline-flex items-center gap-1.5 text-forest-600 font-semibold w-fit">
                  <span aria-hidden>📞</span> {item.phone}
                </a>
              )}
            </div>
          )}
          {item.sourceUrl && (
            <a
              href={item.sourceUrl} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 mt-3 text-sm font-semibold text-forest-600 hover:underline"
            >
              En savoir plus (source) ↗
            </a>
          )}
          {extra}
          <PlaceReviews placeName={item.name} />
        </div>
      </div>
    </div>
  );
}
