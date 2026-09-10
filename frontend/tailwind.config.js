/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette MboaTrip — identité de marque
        forest: {
          50: '#EAF3EC',
          100: '#CFE4D4',
          400: '#3A8558',
          500: '#1E6B3E',
          600: '#155230',
          700: '#0F3D23',
          900: '#0A2818',
        },
        gold: {
          300: '#F0CB6E',
          400: '#E8B93F',
          500: '#D4A017',
          600: '#B3860F',
        },
        offwhite: '#FBF9F4',
        graylight: '#F2F2F0',
        elegant: '#141613',

        // Anciens tokens (ndop/bronze/ivory/ink) désormais ALIGNÉS sur la palette
        // MboaTrip — toute page qui les utilise encore (Explorer, Itinéraires,
        // Inscription) bascule automatiquement en vert forêt/or, sans édition
        // fichier par fichier.
        ndop: { 950: '#FBF9F4', 900: '#F5F1E7', 800: '#F2F2F0', 700: '#E4E1D9', 600: '#CFE4D4' },
        bronze: { 400: '#155230', 500: '#1E6B3E', 600: '#0F3D23' },
        ivory: '#141613',
        ink: '#141613',
        savanna: '#B6663E',
      },
      fontFamily: {
        display: ['"Fraunces"', 'serif'],
        body: ['"Manrope"', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      },
      backdropBlur: { xs: '2px' },
      keyframes: {
        fadeInUp: { '0%': { opacity: 0, transform: 'translateY(16px)' }, '100%': { opacity: 1, transform: 'translateY(0)' } },
        fadeIn: { '0%': { opacity: 0 }, '100%': { opacity: 1 } },
      },
      animation: {
        fadeInUp: 'fadeInUp 0.7s ease-out both',
        fadeIn: 'fadeIn 1s ease-out both',
      },
    },
  },
  plugins: [],
}
