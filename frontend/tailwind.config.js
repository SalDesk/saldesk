export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ocean: {
          900: '#062A38',
          800: '#0A3F55',
          700: '#0D5470',
          600: '#10698C',
          500: '#1480A8',
          400: '#3A9BBF',
          300: '#71BDD4',
          200: '#A8D9E8',
          100: '#D6EEF5',
          50:  '#EBF7FB',
        },
        sand: {
          600: '#BE941C',
          500: '#D4A82A',
          400: '#E0BF5A',
          300: '#EAD08A',
          100: '#F8F0D8',
          50:  '#FDF8EE',
        },
        n: {
          900: '#1A2332',
          800: '#1F2937',
          700: '#374151',
          600: '#4B5563',
          500: '#6B7280',
          400: '#9CA3AF',
          300: '#D1D5DB',
          200: '#E5E8EC',
          100: '#F3F4F6',
          50:  '#F9FAFB',
        },
        turquoise: {
          700: '#0F766E',
          600: '#0D9488',
          500: '#14B8A6',
          400: '#2DD4BF',
          300: '#5EEAD4',
          100: '#CCFBF1',
          50:  '#F0FDFA',
        }
      },
      fontFamily: {
        display: ['Sora', 'sans-serif'],
        body:    ['DM Sans', 'sans-serif'],
        mono:    ['DM Mono', 'monospace'],
        sans:    ['DM Sans', 'sans-serif'],
      },
      borderRadius: {
        xs: '4px',
        sm: '8px',
        md: '12px',
        lg: '16px',
        xl: '24px',
      },
      boxShadow: {
        sm: '0 1px 4px rgba(6,42,56,0.08)',
        md: '0 4px 16px rgba(6,42,56,0.10)',
        lg: '0 12px 40px rgba(6,42,56,0.14)',
      }
    }
  },
  plugins: []
};
