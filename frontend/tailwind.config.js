/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#000000',
        surface: '#111111',
        primary: '#0A4454',
        accent: '#F9E06B',
        highlight: '#F5C53B',
      },
      borderRadius: {
        none: '0px',
      },
    },
  },
  plugins: [],
}
