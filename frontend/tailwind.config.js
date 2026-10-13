/** Design tokens from DESIGN.md (SmartResume Design System v1.0). */
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: '#171717', soft: '#3F3F46', muted: '#71717A' },
        canvas: '#FAFAF9',
        surface: { DEFAULT: '#FFFFFF', soft: '#F4F4F2' },
        line: { DEFAULT: '#E4E4E7', strong: '#D4D4D8' },
        accent: { DEFAULT: '#2563EB', dark: '#1D4ED8', soft: '#EFF6FF' },
        success: { DEFAULT: '#15803D', soft: '#F0FDF4' },
        warning: { DEFAULT: '#A16207', soft: '#FEFCE8' },
        danger: { DEFAULT: '#B91C1C', soft: '#FEF2F2' },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'sans-serif'],
        mono: ['"IBM Plex Mono"', '"SFMono-Regular"', 'Consolas', 'monospace'],
      },
      borderRadius: { xs: '2px', sm: '4px', DEFAULT: '6px', md: '6px', lg: '8px', xl: '12px' },
      maxWidth: { marketing: '1200px', app: '1280px', analysis: '1200px', prose: '720px' },
      boxShadow: {
        menu: '0 8px 24px rgba(0,0,0,0.08)',
        modal: '0 20px 50px rgba(0,0,0,0.12)',
      },
      transitionTimingFunction: { out: 'cubic-bezier(0.16, 1, 0.3, 1)' },
      keyframes: {
        reveal: { from: { opacity: 0, transform: 'translateY(6px)' }, to: { opacity: 1, transform: 'none' } },
      },
      animation: { reveal: 'reveal 220ms cubic-bezier(0.16,1,0.3,1) both' },
    },
  },
  plugins: [],
}
