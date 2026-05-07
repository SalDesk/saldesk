export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50:  '#e8f0f9',
          100: '#c6d9f0',
          500: '#0F4C81',
          600: '#0d4272',
          700: '#0a3360'
        },
        accent: '#F5A623'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
};
