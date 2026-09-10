import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Filet de sécurité global : si un composant plante pendant le rendu (ex.
 * données API incomplètes), React démonte toute l'appli et laisse un écran
 * blanc. Cet ErrorBoundary intercepte l'erreur et affiche un message avec un
 * bouton "Recharger" au lieu de rendre l'appli totalement inutilisable.
 * C'est ce qui causait le plantage de l'onglet Favoris.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary] Erreur interceptée :', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-center px-6">
          <p className="text-4xl mb-3">😕</p>
          <h1 className="font-display text-xl font-bold text-elegant mb-2">Une erreur est survenue</h1>
          <p className="text-sm text-elegant/50 max-w-sm mb-6">
            Cette page a rencontré un problème inattendu. Le reste de l'application reste utilisable.
          </p>
          <button
            onClick={() => { this.setState({ hasError: false }); window.location.href = '/'; }}
            className="px-5 py-2.5 rounded-xl bg-forest-600 text-white text-sm font-semibold hover:bg-forest-700 transition"
          >
            Retour à l'accueil
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
