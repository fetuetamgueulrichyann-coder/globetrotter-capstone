import { useState, useEffect } from 'react';
import { Phone, ShieldCheck } from 'lucide-react';
import { api } from '../lib/api';

interface Guide {
  id: string; name: string; phone: string; city: string; specialty: string; bio: string; photoUrl: string;
}

/** Guides locaux vérifiés (ajoutés uniquement par l'admin) — mise en relation directe par téléphone. */
export default function LocalGuides({ city }: { city: string }) {
  const [guides, setGuides] = useState<Guide[]>([]);

  useEffect(() => {
    api.getGuides(city).then((res) => setGuides(res.data)).catch(() => {});
  }, [city]);

  if (guides.length === 0) return null;

  return (
    <section className="py-16">
      <p className="text-xs font-mono text-forest-600 tracking-wider mb-2">SUR PLACE</p>
      <h2 className="font-display text-2xl font-bold text-elegant mb-2">Guides locaux vérifiés</h2>
      <p className="text-elegant/60 text-sm max-w-2xl mb-8">Mise en relation directe avec de vraies personnes, vérifiées par MboaTrip.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {guides.map((g) => (
          <div key={g.id} className="p-4 rounded-2xl bg-white border border-black/5 shadow-sm flex gap-3">
            {g.photoUrl ? (
              <img src={g.photoUrl} alt={g.name} className="w-14 h-14 rounded-full object-cover shrink-0" />
            ) : (
              <div className="w-14 h-14 rounded-full bg-forest-50 flex items-center justify-center shrink-0 text-forest-600 font-bold">
                {g.name[0]}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="font-display font-bold text-elegant text-sm flex items-center gap-1">
                {g.name} <ShieldCheck size={13} className="text-forest-600" />
              </p>
              {g.specialty && <p className="text-xs text-forest-600 font-medium">{g.specialty}</p>}
              {g.bio && <p className="text-xs text-elegant/55 mt-1 line-clamp-2">{g.bio}</p>}
              <a href={`tel:${g.phone}`} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-forest-600">
                <Phone size={12} /> {g.phone}
              </a>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
