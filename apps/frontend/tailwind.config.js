/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        kahoot: {
          red: '#e21b3c',
          blue: '#1368ce',
          yellow: '#d89e00',
          green: '#26890c',
          purple: '#46178f',
          darkPurple: '#250850'
        }
      }
    },
  },
  plugins: [],
}
