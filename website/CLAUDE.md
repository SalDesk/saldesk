# CLAUDE.md — SalDesk Website (saldesk.cv)

## O que é este projecto

O ficheiro `index-full.html` é o website de marketing de saldesk.cv — a landing page pública
que converte visitantes em operadores registados. É a "montra" do produto.

O produto em si (app.saldesk.cv) é um SaaS de gestão turística para a Ilha do Sal, Cabo Verde.
Operadores: hotéis, actividades/tours, rent-a-car, restaurantes.

---

## Referência de design OBRIGATÓRIA

Antes de escrever uma linha de CSS, estudar estas referências:
- https://stripe.com — estrutura, tipografia, hero, pricing
- https://linear.app — paleta escura, features section, cards
- https://vercel.com — minimalismo, espaçamento, CTAs

O website deve ter o mesmo nível de acabamento. Não é um site de agência de viagens.
É um produto SaaS enterprise dirigido a pequenos operadores turísticos.

### O que NÃO fazer
- Sem gradientes coloridos agressivos no hero
- Sem stock photos de pessoas sorridentes com laptop
- Sem cards com sombras exageradas tipo Bootstrap
- Sem fontes a mais de 3 tamanhos diferentes por secção
- Sem emojis em absolutamente nenhum contexto
- Sem ícones bitmap — apenas SVG inline
- Sem animações que distraiam do conteúdo
- Sem padding inconsistente entre secções

### O que fazer
- Hero com imagem de fundo real da Ilha do Sal (bg1.jpg, bg2.jpg, bg3.jpg)
- Overlay escuro controlado sobre as imagens
- Tipografia grande, bold, com letra-spacing negativo nos headings
- Muito espaço em branco
- Grid limpo e consistente
- Hierarquia visual clara: título → subtítulo → CTA → prova social
- Cores primárias apenas onde têm impacto (CTAs, highlights)

---

## Tokens de design

### Cores
```
Ocean (primária):
  --ocean-900: #062A38
  --ocean-800: #0A3F55
  --ocean-700: #0D5470  ← cor principal
  --ocean-600: #10698C
  --ocean-500: #1480A8
  --ocean-400: #3A9BBF
  --ocean-300: #71BDD4
  --ocean-100: #D6EEF5
  --ocean-50:  #EBF7FB

Sand (acento/CTAs):
  --sand-600: #BE941C
  --sand-500: #D4A82A  ← CTAs principais
  --sand-400: #E0BF5A

Neutros:
  --n900: #1A2332  ← texto principal
  --n800: #1F2937
  --n700: #374151
  --n600: #4B5563
  --n500: #6B7280  ← texto secundário
  --n400: #9CA3AF
  --n300: #D1D5DB
  --n200: #E5E8EC  ← bordas
  --n100: #F3F4F6
  --n50:  #F9FAFB  ← backgrounds alternados
```

### Tipografia
```
Google Fonts — carregar ambas:
  Sora: 400, 600, 700, 800  → headings, nav, labels, botões
  DM Sans: 400, 500, 600    → body text, descrições

Escala de tipo:
  Hero h1:     clamp(2.4rem, 5vw, 3.8rem), weight 800, letter-spacing -0.03em
  Section h2:  clamp(1.8rem, 3vw, 2.8rem), weight 800, letter-spacing -0.02em
  Card h3:     1.05rem, weight 700
  Body large:  1.1rem, line-height 1.75
  Body normal: 0.9rem, line-height 1.65
  Label:       0.72rem, weight 700, uppercase, letter-spacing 0.1em
```

### Espaçamento e forma
```
Sections:    padding 96px 0 (desktop), 64px 0 (mobile)
Container:   max-width 1120px, padding 0 24px
Radius:      cards 20px, buttons 50px (pill), badges 50px
Sombras:     subtis — 0 1px 4px rgba(6,42,56,.08) a 0 12px 40px rgba(6,42,56,.14)
```

---

## Stack técnico

- HTML5 semântico
- CSS puro com custom properties (sem Tailwind, sem Bootstrap)
- JavaScript vanilla (sem React, sem jQuery)
- Google Fonts via link
- Ícones: SVG inline (Lucide-style — stroke, não fill)
- Sem dependências externas além de Google Fonts

---

## Bilinguismo PT/EN

```html
<html lang="pt" data-lang="pt">

<!-- CSS obrigatório -->
[data-lang="pt"] .en { display: none }
[data-lang="en"] .pt { display: none }

<!-- Uso no HTML -->
<h2 class="pt">Título português</h2>
<h2 class="en">English title</h2>

<!-- Toggle -->
function toggleLang() {
  const nl = document.documentElement.getAttribute('data-lang') === 'pt' ? 'en' : 'pt';
  document.documentElement.setAttribute('data-lang', nl);
  localStorage.setItem('sd-lang', nl);
  // re-render secções CMS se necessário
}
// Inicializar com localStorage
```

---

## API CMS — endpoint público

```
GET https://api.saldesk.cv/api/v1/public/cms
```

Resposta:
```json
{
  "data": {
    "pricing": [
      { "plan": "starter", "price_eur": 29, "name_pt": "Starter", "name_en": "Starter",
        "description_pt": "Para começar", "description_en": "To get started",
        "features": ["1 utilizador", "Até 50 reservas/mês", "CRM básico", "Landing page pública"],
        "highlighted": false },
      { "plan": "pro", "price_eur": 79, "name_pt": "Pro", "name_en": "Pro",
        "description_pt": "Para crescer — o mais popular", "description_en": "To grow — most popular",
        "features": ["3 utilizadores", "Reservas ilimitadas", "CRM completo", "Financeiro", "Channel manager", "Automações"],
        "highlighted": true },
      { "plan": "business", "price_eur": 69, "name_pt": "Business", "name_en": "Business",
        "description_pt": "Para escalar", "description_en": "To scale",
        "features": ["Utilizadores ilimitados", "Multi-propriedade", "API access", "Manager dedicado"],
        "highlighted": false }
    ],
    "testimonials": [
      { "name": "Carlos Monteiro", "role": "Proprietário", "company": "Hotel Morabeza",
        "text_pt": "Desde que adoptamos o SalDesk, as reservas directas aumentaram 40%.",
        "text_en": "Since we adopted SalDesk, direct bookings increased 40%.", "rating": 5 },
      { "name": "Ana Ferreira", "role": "Gestora", "company": "Zy Tours",
        "text_pt": "A plataforma é intuitiva e o suporte é excelente.",
        "text_en": "The platform is intuitive and the support is excellent.", "rating": 5 },
      { "name": "Miguel Santos", "role": "Director", "company": "Sal Rent-a-Car",
        "text_pt": "O channel manager sincroniza com a Viator automaticamente.",
        "text_en": "The channel manager syncs with Viator automatically.", "rating": 5 }
    ],
    "faqs": [
      { "question_pt": "Quanto tempo demora a configurar?", "question_en": "How long does setup take?",
        "answer_pt": "A maioria dos operadores está operacional em menos de 30 minutos.",
        "answer_en": "Most operators are up and running in less than 30 minutes.", "order_index": 1 },
      { "question_pt": "Posso cancelar a qualquer momento?", "question_en": "Can I cancel at any time?",
        "answer_pt": "Sim, sem contratos nem penalizações.",
        "answer_en": "Yes, no contracts or penalties.", "order_index": 2 },
      { "question_pt": "O SalDesk funciona com o meu site actual?", "question_en": "Does SalDesk work with my current website?",
        "answer_pt": "Sim. Cada operador recebe uma landing page pública gratuita.",
        "answer_en": "Yes. Each operator gets a free public landing page.", "order_index": 3 },
      { "question_pt": "Que métodos de pagamento aceita?", "question_en": "What payment methods are accepted?",
        "answer_pt": "SISP Vinti4 para cartões cabo-verdianos, PayPal para cartões internacionais.",
        "answer_en": "SISP Vinti4 for Cape Verdean cards, PayPal for international cards.", "order_index": 4 }
    ]
  }
}
```

Carregar via fetch no DOMContentLoaded. Se falhar, usar dados hardcoded como fallback.
Ao mudar idioma, re-render as secções dinâmicas (testimonials, faqs).

---

## Estrutura de secções

### 1. Nav
- Fixo, z-index alto
- Transparente sobre o hero (texto branco)
- Fundo branco com border-bottom ao scroll (usar IntersectionObserver ou scroll event)
- Esquerda: logo SVG + "SalDesk" (texto)
- Centro: links Funcionalidades / Preços / FAQ / Directório
- Direita: toggle PT/EN + botão "Entrar" (ghost) + botão "Registar" (sand, pill)
- Mobile: hamburger → menu overlay

### 2. Hero
- min-height: 100vh
- Carousel de 3 imagens: bg1.jpg, bg2.jpg, bg3.jpg (transition opacity 1.2s)
- Overlay: `linear-gradient(135deg, rgba(6,42,56,.85) 0%, rgba(6,42,56,.6) 60%, rgba(10,63,85,.5) 100%)`
- Layout: 2 colunas no desktop (texto esquerda, mockup direita)
- Badge pill topo: "Primeira plataforma SaaS da Ilha do Sal"
- H1 bold com span sand no destaque
- Parágrafo descritivo
- 2 CTAs: "Começar grátis — 30 dias" (sand, grande) + "Ver directório" (ghost)
- 3 stats: 0% comissão / 4 tipos de operador / 30 dias trial
- Mockup dashboard direita (ver secção mockup abaixo)

### 3. Social proof strip
- Fundo branco, border top e bottom n100
- "Integrações:" + logos textuais: Viator · GetYourGuide · Booking.com · Airbnb · SISP Vinti4 · PayPal · WhatsApp
- Scroll horizontal no mobile

### 4. Problema
- Fundo branco
- Label + H2 + sub
- 4 cards em grid 2x2 (desktop) / 1 coluna (mobile)
- Cada card: ícone SVG colorido + título + descrição
- Problemas: comissão OTA / sem financeiro / overbooking / sem presença digital

### 5. Features
- Fundo ocean-900 (escuro)
- Label + H2 + sub (texto branco/claro)
- Grid 3x2 de feature items com linha divisória sutil
- Cada item: ícone SVG + título branco + descrição cinza claro
- Features: Motor de Reservas / CRM / Financeiro / Analytics / Channel Manager / Automações

### 6. Pricing
- Fundo branco
- Label + H2 + sub centrados
- 3 cards: starter / pro (highlighted, escuro) / business
- Card highlighted tem badge "Mais popular" / "Most popular"
- Cada card: nome do plano + preço EUR/mês + descrição + lista de features + CTA
- Nota abaixo: "30 dias gratuitos. Sem cartão de crédito."
- Carregar do CMS, fallback estático

### 7. Testimonials
- Fundo n50 (cinza muito claro)
- Label + H2 centrados
- 3 cards lado a lado (desktop) / empilhados (mobile)
- Cada card: 5 estrelas SVG + citação em itálico + avatar inicial + nome + cargo + empresa
- Carregar do CMS, fallback estático

### 8. FAQ
- Fundo branco
- Label + H2 centrados
- Lista accordion max-width 720px centrada
- Item: pergunta + ícone + / ×  + resposta (animação height)
- Carregar do CMS, fallback estático

### 9. CTA final
- Fundo ocean-700 com padrão SVG subtil no background
- H2 branco + parágrafo + 2 botões
- "Começar grátis" (sand) + "Falar com a equipa" (ghost)

### 10. Footer
- Fundo n900 (quase preto)
- 4 colunas: brand+desc / Plataforma / Empresa / Contacto
- Copyright + badge "Sistema operacional" com dot verde pulsante
- Links: app.saldesk.cv, /register, discover/, operadores.html, impacto.html
- Email: hello@saldesk.cv

---

## Mockup Dashboard (hero direito)

```
Container: rounded-2xl, background rgba(255,255,255,0.07), backdrop-filter blur(16px),
           border 1px rgba(255,255,255,0.12), box-shadow 0 24px 64px rgba(0,0,0,0.35)

Estrutura interna:
1. Barra título: 3 dots coloridos (vermelho/amarelo/verde) + URL "app.saldesk.cv"
2. Sidebar simulada: items activo em ocean-700/30%
3. KPIs: 3 cards — "€4.2k Receita" / "87% Ocupação" / "24 Reservas"
4. Gráfico de barras: 7 barras, alturas variadas, gradiente ocean
5. Linha separadora
6. Tags pill: Hotel · Actividade · Rent-a-Car · Restaurante

Animação subtil: barra activa no gráfico pulsa suavemente
Aspecto final: parece um dashboard SaaS real, não um wireframe
```

---

## Assets na pasta /var/www/saldesk/website/

```
bg1.jpg    — imagem de fundo hero (praia Cabo Verde)
bg2.jpg    — imagem de fundo hero (actividade/tour)
bg3.jpg    — imagem de fundo hero (vista aérea ilha)
logo.png   — logo SalDesk
```

---

## Links e URLs

```
App (login):    https://app.saldesk.cv
Registo:        https://app.saldesk.cv/register
Directório:     discover/
Para operadores: operadores.html
Impacto:        impacto.html
Email:          hello@saldesk.cv
WhatsApp:       https://wa.me/238XXXXXXX
Instagram:      https://instagram.com/saldesk
```

---

## SEO e meta tags

```html
<title>SalDesk — Gestão Turística · Ilha do Sal, Cabo Verde</title>
<meta name="description" content="A primeira plataforma SaaS de gestão turística para operadores da Ilha do Sal. Reservas directas sem comissão, CRM, financeiro e channel manager." />
<meta property="og:title" content="SalDesk — Gestão Turística · Ilha do Sal" />
<meta property="og:description" content="Reservas directas sem comissão OTA. CRM, financeiro e channel manager para hotéis, actividades, rent-a-car e restaurantes." />
<meta property="og:image" content="https://saldesk.cv/logo.png" />
<meta property="og:url" content="https://saldesk.cv" />
<meta property="og:type" content="website" />
<meta name="twitter:card" content="summary_large_image" />
```

---

## Regras absolutas — sem excepções

1. Sem emojis em qualquer parte do ficheiro
2. Sem ícones externos (sem Font Awesome, sem Heroicons CDN) — apenas SVG inline
3. Sem Bootstrap, Tailwind, ou qualquer CSS framework
4. Sem jQuery ou bibliotecas JS externas
5. Sem imagens de stock externas — usar apenas bg1/2/3.jpg locais
6. CSS organizado em blocos comentados por secção
7. JS no final do body, organizado por função com comentários
8. Testar responsividade: 375px (iPhone SE), 768px (tablet), 1280px (desktop)
9. Fallback estático para todas as secções dinâmicas (CMS pode falhar)
10. Nenhum `console.error` exposto ao utilizador
