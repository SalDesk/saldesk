import plugin from 'tailwindcss/plugin';

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
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
        /* Tokens Mare (ver styles/tokens.css): fundo da app, bordas de cartao/campo, cabecalho de tabela */
        mare: {
          ground: 'var(--surface-app)',
          card:   'var(--card-border)',
          field:  'var(--field-border)',
          head:   'var(--table-head)',
        },
        /* Cor da marca do operador na pagina publica (/book/*): variaveis --brand-<tom>-rgb definidas por
           utils/brandPalette.js; sem elas, os valores por omissao sao os do ocean (aspecto de sempre) */
        brand: {
          900: 'rgb(var(--brand-900-rgb, 6 42 56) / <alpha-value>)',
          800: 'rgb(var(--brand-800-rgb, 10 63 85) / <alpha-value>)',
          700: 'rgb(var(--brand-700-rgb, 13 84 112) / <alpha-value>)',
          600: 'rgb(var(--brand-600-rgb, 16 105 140) / <alpha-value>)',
          500: 'rgb(var(--brand-500-rgb, 20 128 168) / <alpha-value>)',
          400: 'rgb(var(--brand-400-rgb, 58 155 191) / <alpha-value>)',
          300: 'rgb(var(--brand-300-rgb, 113 189 212) / <alpha-value>)',
          200: 'rgb(var(--brand-200-rgb, 168 217 232) / <alpha-value>)',
          100: 'rgb(var(--brand-100-rgb, 214 238 245) / <alpha-value>)',
          50: 'rgb(var(--brand-50-rgb, 235 247 251) / <alpha-value>)',
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
        },
        error: '#DC2626',
        success: {
          DEFAULT: '#16A34A',
          light: '#DCFCE7',
        },
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
        'app-sm': '0 1px 2px rgba(6,42,56,0.06)',
      }
    }
  },
  plugins: [
    /* Variante app: -- so se aplica dentro do contentor data-ui="app" (ou no proprio),
       para o redesenho da app do operador nao afectar os outros portais. */
    plugin(({ addVariant }) => addVariant('app', '&:is([data-ui="app"], [data-ui="app"] *)')),
  ]
};
