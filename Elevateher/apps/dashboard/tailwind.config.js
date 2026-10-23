/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        elevate: {
          purple: '#7C3AED',
          pink: '#EC4899',
          dark: '#0F172A',
          darker: '#0B1120',
        },
      },
    },
  },
  plugins: [],
};
