/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./pages/**/*.{js,jsx}",
    "./components/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        polair: {
          blue: "#0b5ed7",
          dark: "#0a3d7a",
          light: "#e8f1fd",
        },
      },
    },
  },
  plugins: [],
};
