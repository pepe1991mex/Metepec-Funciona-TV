/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        metepec: {
          navy: '#2D4F9F',
          yellow: '#F5D623',
          pink: '#EF9FC5',
          teal: '#5BC0C4',
          orange: '#F08A2E',
          purple: '#9B6BAE',
          lime: '#ACCA14',
          sky: '#92D3F3',
          gold: '#E9AF25',
          dark: '#2A3240',
          mid: '#5A6577',
          light: '#8D96A5',
        }
      }
    },
  },
  plugins: [],
}