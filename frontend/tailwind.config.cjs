// frontend/tailwind.config.cjs
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'primary': '#2D9CDB', // Azul para ações principais (botões)
        'secondary': '#219653', // Verde para sucesso ou destaque
        'neutral': '#F2F2F2', // Cinza claro para fundos
        'accent': '#EB5757', // Vermelho para erros ou perigo
        'text-light': '#828282', // Cinza para textos secundários
        'text-dark': '#333333', // Preto para textos principais
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'], // Define uma fonte principal, se precisar
      },
    },
  },
  plugins: [],
}