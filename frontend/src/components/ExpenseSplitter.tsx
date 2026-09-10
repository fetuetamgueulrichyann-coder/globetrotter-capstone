import { useState, useEffect } from 'react';
import { Wallet, Plus, Trash2, Loader2 } from 'lucide-react';
import { api, ApiRequestError } from '../lib/api';
import { useAuth } from '../lib/auth';

interface Expense {
  id: string; description: string; amountFcfa: number; paidByUserId: string;
  paidBy: { id: string; name: string } | null;
}
interface Balance { userId: string; amountFcfa: number; user: { id: string; name: string } | null }

/**
 * Répartition des frais entre amis pour un voyage de groupe — chaque
 * dépense est partagée à parts égales entre le créateur de l'itinéraire et
 * les personnes avec qui il est partagé. Le solde (qui doit combien) est
 * recalculé à la volée, jamais stocké.
 */
export default function ExpenseSplitter({ itineraryId }: { itineraryId: string }) {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [balances, setBalances] = useState<Balance[]>([]);
  const [loading, setLoading] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setLoading(true);
    api.getExpenses(itineraryId)
      .then((res) => { setExpenses(res.data.expenses); setBalances(res.data.balances); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }

  useEffect(() => { if (open) load(); }, [open]);

  async function handleAdd() {
    const amt = parseInt(amount, 10);
    if (!description.trim() || !amt || amt <= 0) return;
    setSaving(true);
    setError(null);
    try {
      await api.addExpense(itineraryId, { description: description.trim(), amountFcfa: amt });
      setDescription(''); setAmount('');
      load();
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.message : "Échec de l'ajout.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    await api.deleteExpense(id).catch(() => {});
    load();
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-forest-600 hover:text-forest-700 transition">
        <Wallet size={13} /> Répartir les frais
      </button>
    );
  }

  return (
    <div className="mt-3 pt-3 border-t border-black/5">
      {loading ? (
        <p className="text-xs text-elegant/40">Chargement…</p>
      ) : (
        <>
          {balances.length > 0 && (
            <div className="mb-3 space-y-1">
              {balances.map((b) => (
                <p key={b.userId} className="text-xs flex justify-between">
                  <span className="text-elegant/60">{b.user?.name || 'Utilisateur'}{b.userId === user?.id ? ' (toi)' : ''}</span>
                  <span className={`font-semibold ${b.amountFcfa >= 0 ? 'text-forest-600' : 'text-red-500'}`}>
                    {b.amountFcfa >= 0 ? `on lui doit ${b.amountFcfa}` : `doit ${-b.amountFcfa}`} FCFA
                  </span>
                </p>
              ))}
            </div>
          )}

          {expenses.length > 0 && (
            <div className="mb-3 space-y-1.5">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center justify-between text-xs">
                  <span className="text-elegant/70">{e.description} <span className="text-elegant/40">({e.paidBy?.name})</span></span>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-elegant">{e.amountFcfa} FCFA</span>
                    <button onClick={() => handleDelete(e.id)} className="text-elegant/25 hover:text-red-500">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-1.5">
            <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Ex: essence, resto…"
              className="flex-1 px-2.5 py-1.5 rounded-lg bg-graylight text-xs outline-none" />
            <input value={amount} onChange={(e) => setAmount(e.target.value)} type="number" placeholder="FCFA"
              className="w-20 px-2.5 py-1.5 rounded-lg bg-graylight text-xs outline-none" />
            <button onClick={handleAdd} disabled={saving} className="px-2.5 py-1.5 rounded-lg bg-forest-600 text-white text-xs font-semibold disabled:opacity-40 flex items-center gap-1">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Plus size={12} />}
            </button>
          </div>
          {error && <p className="text-xs text-red-600 mt-1.5">{error}</p>}
        </>
      )}
    </div>
  );
}
