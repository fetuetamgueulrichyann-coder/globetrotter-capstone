interface Props {
  /** Lien Facebook (vidéo ou reel) */
  url: string;
  caption?: string;
  /** Ratio hauteur/largeur de l'iframe (les reels sont verticaux) */
  aspect?: 'video' | 'reel';
}

/**
 * Intègre une vidéo/reel Facebook via le lecteur officiel "Facebook Video
 * Plugin" (iframe facebook.com/plugins/video.php). Se charge automatiquement
 * avec la connexion internet de l'utilisateur, sans action requise. On ne
 * copie ni n'héberge aucune vidéo : c'est le lecteur officiel Facebook.
 */
export default function FacebookVideoEmbed({ url, caption, aspect = 'video' }: Props) {
  const src = `https://www.facebook.com/plugins/video.php?height=${aspect === 'reel' ? 700 : 314}&href=${encodeURIComponent(url)}&show_text=false&width=${aspect === 'reel' ? 400 : 560}&t=0`;

  return (
    <div className="rounded-2xl overflow-hidden bg-black/5">
      {caption && <p className="text-xs text-elegant/50 px-1 py-2">{caption}</p>}
      <div className="w-full flex justify-center bg-black">
        <iframe
          src={src}
          style={{ border: 'none', overflow: 'hidden', width: '100%', maxWidth: aspect === 'reel' ? 400 : 560 }}
          height={aspect === 'reel' ? 700 : 314}
          scrolling="no"
          frameBorder="0"
          allowFullScreen
          allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; web-share"
          loading="lazy"
          title={caption || 'Vidéo Facebook'}
        />
      </div>
    </div>
  );
}
