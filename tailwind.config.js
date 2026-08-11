/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#2D6A4F',
          light: '#52B788',
          lighter: '#95D5B2',
          dark: '#1B4332',
          container: '#B7DFCA',
        },
        secondary: {
          DEFAULT: '#52B788',
          container: '#D8F3E3',
        },
        'app-bg': '#F4FCF5',
        surface: '#FFFFFF',
        'surface-variant': '#DCE5DC',
      },
    },
  },
  plugins: [],
};
