interface Props {
  src: string;
  caption?: string;
  poster?: string;
}

/**
 * Vidéo hébergée directement par MboaTrip (fichier .mp4 fourni par
 * l'utilisateur), lue avec les contrôles natifs du navigateur. Se charge
 * automatiquement avec la connexion internet de l'utilisateur (preload
 * "metadata" pour ne pas gaspiller de données tant que la personne n'a pas
 * lancé la lecture). Remplace les anciens embeds TikTok/Facebook pour ces
 * vidéos précises, qu'on héberge maintenant nous-mêmes.
 */
export default function LocalVideo({ src, caption, poster }: Props) {
  return (
    <div className="rounded-2xl overflow-hidden bg-black/5">
      {caption && <p className="text-xs text-elegant/50 px-1 py-2">{caption}</p>}
      <video
        src={src}
        poster={poster}
        controls
        preload="metadata"
        playsInline
        className="w-full max-h-[480px] bg-black"
      >
        Ton navigateur ne prend pas en charge la lecture vidéo.
      </video>
    </div>
  );
}
