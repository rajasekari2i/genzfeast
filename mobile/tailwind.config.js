/** @type {import('tailwindcss').Config} */
//
// Values below MUST stay in sync with src/theme/tokens.ts (the source of
// truth used by component logic, e.g. StatusBadge's runtime color lookups)
// — duplicated here rather than required at build time because this file is
// loaded directly by Node/PostCSS without a TypeScript loader.
// See specs/013-blue-theme-visual-design/contracts/design-tokens.md.
module.exports = {
  content: ['./App.tsx', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: '#1565C0',
        'primary-variant': '#0D47A1',
        accent: '#29B6F6',
        surface: '#FFFFFF',
        background: '#F5F8FC',
        'text-primary': '#12202E',
        'text-secondary': '#5B6B7A',
        border: '#E2E8F0',
      },
      fontSize: {
        h1: ['24px', { lineHeight: '32px', fontWeight: '700' }],
        h2: ['18px', { lineHeight: '24px', fontWeight: '700' }],
        body: ['14px', { lineHeight: '20px', fontWeight: '400' }],
        'body-bold': ['14px', { lineHeight: '20px', fontWeight: '600' }],
        price: ['16px', { lineHeight: '22px', fontWeight: '700' }],
        caption: ['12px', { lineHeight: '16px', fontWeight: '400' }],
        button: ['15px', { lineHeight: '20px', fontWeight: '600' }],
      },
      spacing: {
        xs: '4px',
        sm: '8px',
        md: '16px',
        lg: '24px',
        xl: '32px',
      },
      borderRadius: {
        sm: '4px',
        md: '12px',
        lg: '20px',
        pill: '999px',
      },
    },
  },
  plugins: [],
};
