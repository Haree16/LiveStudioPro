/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        studio: {
          bg: "#0d0f15",
          panel: "#161922",
          card: "#1e2230",
          border: "#2b3244",
          pvw: "#10b981",
          pgm: "#ef4444",
        },
      },
    },
  },
  plugins: [],
}
