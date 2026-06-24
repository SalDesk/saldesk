# CLAUDE.md — SalDesk Website (saldesk.cv)

## Referência visual PRINCIPAL

**https://gosaas-html.vercel.app** — estudar e inspirar directamente neste template.

Características a replicar do GoSaaS:
- Hero com imagem de produto/dashboard à direita, texto à esquerda
- Floating UI cards sobre a imagem principal (KPIs, gráficos pequenos)
- Section "Core Features" com ícone SVG + título + descrição + link "Learn More"
- Brand strip com logos de integrações em scroll ou flex
- Section dividida 50/50: imagem esquerda + lista de benefícios direita
- Testimonials em carousel ou grid com avatar foto/iniciais + nome + cargo + citação
- Pricing com toggle mensal/anual, badge "Most Popular", lista de features com checkmarks
- FAQ accordion limpo
- CTA final com fundo colorido, headline grande, 2 botões, bullet points de garantia
- Footer 4 colunas com logo, descrição, links, contacto, redes sociais
- Nav com dropdown suave, botões CTA distintos (outline + filled)

O GoSaaS usa um estilo moderno, limpo, com muito espaço branco, gradientes subtis,
elementos flutuantes sobre imagens, e uma hierarquia visual muito clara.
Adaptar exactamente esta linguagem para o SalDesk.

---

## O que é o SalDesk

Plataforma SaaS de gestão turística para operadores da Ilha do Sal, Cabo Verde.
- Hotéis, actividades/tours, rent-a-car, restaurantes
- Reservas directas sem comissão OTA
- CRM, financeiro, channel manager, automações

**App:** https://app.saldesk.cv
**Website:** https://saldesk.cv

---

## Stack

- HTML5 + CSS puro + JavaScript vanilla
- Google Fonts apenas
- SVG inline para ícones (estilo Lucide — stroke, não fill)
- Sem frameworks CSS ou JS
- Bilingue PT/EN via `data-lang`
- Mobile-first

---

## Design Tokens

```css
:root {
  /* Ocean — cor primária */
  --ocean-900: #062A38;
  --ocean-800: #0A3F55;
  --ocean-700: #0D5470;
  --ocean-600: #10698C;
  --ocean-500: #1480A8;
  --ocean-400: #3A9BBF;
  --ocean-300: #71BDD4;
  --ocean-100: #D6EEF5;
  --ocean-50:  #EBF7FB;

  /* Sand — acento/CTAs */
  --sand-600: #BE941C;
  --sand-500: #D4A82A;
  --sand-400: #E0BF5A;
  --sand-100: #F8F0D8;
  --sand-50:  #FDF8EE;

  /* Neutros */
  --n900: #1A2332;
  --n800: #1F2937;
  --n700: #374151;
  --n600: #4B5563;
  --n500: #6B7280;
  --n400: #9CA3AF;
  --n300: #D1D5DB;
  --n200: #E5E8EC;
  --n100: #F3F4F6;
  --n50:  #F9FAFB;

  /* Tipografia */
  --font-display: 'Sora', sans-serif;
  --font-body: 'DM Sans', sans-serif;

  /* Forma */
  --radius-sm: 8px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;
  --radius-2xl: 32px;

  /* Sombras */
  --shadow-sm: 0 1px 4px rgba(6,42,56,.08);
  --shadow-md: 0 4px 16px rgba(6,42,56,.12);
  --shadow-lg: 0 12px 40px rgba(6,42,56,.16);
  --shadow-xl: 0 24px 64px rgba(6,42,56,.20);
}
```

### Tipografia
```
Google Fonts: Sora (300,400,500,600,700,800) + DM Sans (400,500,600)

Hero H1:      clamp(2.4rem, 5vw, 3.8rem), Sora, weight 800, letter-spacing -0.03em
Section H2:   clamp(1.8rem, 3vw, 2.8rem), Sora, weight 800, letter-spacing -0.02em
Card H3:      1.1rem, Sora, weight 700
Body large:   1.05rem, DM Sans, line-height 1.75
Body normal:  0.9rem, DM Sans, line-height 1.65
Label:        0.72rem, Sora, weight 700, uppercase, letter-spacing 0.1em, color ocean-600
```

---

## Bilinguismo

```html
<html lang="pt" data-lang="pt">

<style>
  [data-lang="pt"] .en { display: none }
  [data-lang="en"] .pt { display: none }
</style>

<!-- Uso -->
<h2 class="pt">Título em português</h2>
<h2 class="en">Title in English</h2>
```

Toggle salvo em `localStorage('sd-lang')`.
Ao mudar idioma, re-renderizar secções dinâmicas (pricing, testimonials, faqs).

---

## API CMS Público

```
GET https://api.saldesk.cv/api/v1/public/cms
```

Resposta:
```json
{
  "data": {
    "pricing": [
      {
        "plan": "starter", "price_eur": 29, "highlighted": false,
        "name_pt": "Starter", "name_en": "Starter",
        "description_pt": "Para começar", "description_en": "To get started",
        "features": ["1 utilizador", "Até 50 reservas/mês", "CRM básico", "Landing page pública", "Suporte por email"]
      },
      {
        "plan": "pro", "price_eur": 79, "highlighted": true,
        "name_pt": "Pro", "name_en": "Pro",
        "description_pt": "Para crescer — o mais popular", "description_en": "To grow — most popular",
        "features": ["3 utilizadores", "Reservas ilimitadas", "CRM completo", "Financeiro", "Channel manager", "Automações", "Suporte prioritário"]
      },
      {
        "plan": "business", "price_eur": 69, "highlighted": false,
        "name_pt": "Business", "name_en": "Business",
        "description_pt": "Para escalar", "description_en": "To scale",
        "features": ["Utilizadores ilimitados", "Multi-propriedade", "API access", "Manager dedicado", "SLA 99.9%", "Onboarding presencial"]
      }
    ],
    "testimonials": [
      {
        "name": "Carlos Monteiro", "role": "Proprietário", "company": "Hotel Morabeza",
        "text_pt": "Desde que adoptamos o SalDesk, as reservas directas aumentaram 40%. Já não dependemos do Booking.com para tudo.",
        "text_en": "Since we adopted SalDesk, direct bookings increased 40%. We no longer depend on Booking.com for everything.",
        "rating": 5
      },
      {
        "name": "Ana Ferreira", "role": "Gestora", "company": "Zy Tours",
        "text_pt": "A plataforma é intuitiva e o suporte é excelente. O módulo financeiro poupou-nos horas de trabalho por semana.",
        "text_en": "The platform is intuitive and the support is excellent. The financial module saved us hours of work per week.",
        "rating": 5
      },
      {
        "name": "Miguel Santos", "role": "Director", "company": "Sal Rent-a-Car",
        "text_pt": "O channel manager sincroniza com a Viator automaticamente. Antes perdia reservas por overbooking, agora não acontece.",
        "text_en": "The channel manager syncs with Viator automatically. I used to lose bookings due to overbooking, now it does not happen.",
        "rating": 5
      }
    ],
    "faqs": [
      {
        "question_pt": "Quanto tempo demora a configurar?", "question_en": "How long does setup take?",
        "answer_pt": "A maioria dos operadores está operacional em menos de 30 minutos. O nosso onboarding guia-o passo a passo.",
        "answer_en": "Most operators are up and running in less than 30 minutes. Our onboarding guides you step by step.",
        "order_index": 1
      },
      {
        "question_pt": "Posso cancelar a qualquer momento?", "question_en": "Can I cancel at any time?",
        "answer_pt": "Sim, sem contratos nem penalizações. Pode cancelar directamente no painel a qualquer momento.",
        "answer_en": "Yes, no contracts or penalties. You can cancel directly from the dashboard at any time.",
        "order_index": 2
      },
      {
        "question_pt": "O SalDesk funciona com o meu site actual?", "question_en": "Does SalDesk work with my current website?",
        "answer_pt": "Sim. Cada operador recebe uma landing page pública gratuita. Pode também integrar o motor de reservas via widget.",
        "answer_en": "Yes. Each operator gets a free public landing page. You can also embed the booking engine via widget.",
        "order_index": 3
      },
      {
        "question_pt": "Que métodos de pagamento aceita?", "question_en": "What payment methods are accepted?",
        "answer_pt": "SISP Vinti4 para cartões cabo-verdianos, PayPal para cartões internacionais, e transferência bancária.",
        "answer_en": "SISP Vinti4 for Cape Verdean cards, PayPal for international cards, and bank transfer.",
        "order_index": 4
      }
    ]
  }
}
```

Fallback: se fetch falhar, usar os dados acima directamente como constante JS.

---

## Estrutura de secções

### 1. Nav
Inspiração: GoSaaS nav — logo esquerda, links centro, CTA direita.
- Fixo, transparente inicialmente, fundo branco + sombra ao scroll
- Logo: SVG pequeno + "SalDesk" em Sora bold
- Links: Funcionalidades / Preços / FAQ / Directório
- Direita: toggle PT/EN (pill) + "Entrar" (outline) + "Registar grátis" (filled ocean)
- Mobile: hamburger → menu full-width overlay

### 2. Hero
Inspiração: GoSaaS hero — texto esquerda, imagem produto direita com floating cards.
- Fundo: gradiente subtil de ocean-50 para branco, ou imagem de fundo (bg1.jpg) com overlay leve
- Esquerda: badge pill → H1 grande → parágrafo → 2 CTAs → social proof ("Já usado por X operadores")
- Direita: screenshot/mockup do dashboard com 2-3 floating cards animados (KPIs)
- H1: "Gestão turística sem comissões OTA" com "comissões OTA" em ocean-700 ou sublinhado decorativo
- CTAs: "Começar grátis — 30 dias" (sand, grande) + "Ver demonstração" (outline)
- Social proof: avatares + "Já confiam em nós X operadores na Ilha do Sal"

### 3. Brand/Integrações strip
Inspiração: GoSaaS "Already Join 15K+ Business".
- Texto: "Integrado com as principais plataformas"
- Logos textuais ou SVG: Viator · GetYourGuide · Booking.com · Airbnb · SISP Vinti4 · PayPal · WhatsApp
- Fundo cinza muito claro (n50), border top e bottom

### 4. Features principais (cards)
Inspiração: GoSaaS "Core Features" — grid de cards com ícone, título, descrição, link.
- Label + H2 + sub centrados
- Grid 3 colunas (desktop) / 1 coluna (mobile)
- Cada card: ícone SVG numa box colorida + título + descrição 2 linhas + "Saber mais →"
- Features: Motor de Reservas / CRM / Financeiro / Channel Manager / Analytics / Automações
- Hover: card eleva com sombra

### 5. Feature destaque — split section
Inspiração: GoSaaS "Upgrade Your Business" e "Automate tasks" — imagem + lista benefícios.
- Fundo ligeiramente colorido (ocean-50 ou n50)
- 2 colunas: mockup/screenshot esquerda + texto direita
- Título + parágrafo + 3 bullet points com ícone check + CTA "Saber mais"
- Alternar esquerda/direita em 2 blocos

### 6. Pricing
Inspiração: GoSaaS pricing — toggle mensal/anual, 3 cards, badge "Most Popular".
- Toggle PT: "Mensal / Anual (Poupe 20%)" — EN: "Monthly / Annual (Save 20%)"
- 3 cards lado a lado, card Pro highlighted (fundo ocean-700, texto branco)
- Cada card: nome do plano + preço + descrição + lista features + CTA
- Nota: "30 dias gratuitos. Sem cartão de crédito."
- Carregar do CMS, fallback estático

### 7. Testimonials
Inspiração: GoSaaS "Customer Reviews" — cards com avatar, nome, cargo, citação.
- Grid 3 colunas
- Cada card: 5 estrelas + citação em itálico + separador + avatar (iniciais) + nome + cargo + empresa
- Carregar do CMS

### 8. FAQ
Inspiração: GoSaaS FAQ — accordion limpo, pergunta + ícone +/×.
- Max-width 800px centrado
- Cada item: pergunta bold + ícone toggle + resposta com animação height
- Carregar do CMS

### 9. CTA final
Inspiração: GoSaaS "Ready to enhance your sales" — fundo colorido, headline, botões, bullets garantia.
- Fundo: gradiente ocean-700 → ocean-800
- H2 branco grande
- 2 CTAs: "Começar grátis" (sand) + "Falar com a equipa" (ghost)
- Bullets: "Sem cartão de crédito" / "Trial de 30 dias" / "Cancelar a qualquer momento"

### 10. Footer
Inspiração: GoSaaS footer — 4 colunas, logo, descrição, links, contacto, redes.
- Fundo n900
- Col 1: logo + descrição curta
- Col 2: Plataforma (links)
- Col 3: Empresa (links)
- Col 4: Contacto (email, WhatsApp, Instagram)
- Bottom: copyright + badge "Sistema operacional" com dot verde pulsante

---

## Assets disponíveis no servidor

```
/var/www/saldesk/website/
  bg1.jpg   — praia Cabo Verde
  bg2.jpg   — actividade turística
  bg3.jpg   — vista aérea ilha
  logo.png  — logo SalDesk PNG
```

Usar caminhos relativos: `bg1.jpg`, `logo.png`.

---

## URLs e links

```
Login:           https://app.saldesk.cv
Registo:         https://app.saldesk.cv/register
Directório:      discover/
Para operadores: operadores.html
Impacto:         impacto.html
Email:           hello@saldesk.cv
WhatsApp:        https://wa.me/238XXXXXXX
Instagram:       https://instagram.com/saldesk
```

---

## Regras absolutas

1. Sem emojis em nenhuma parte do ficheiro
2. Apenas SVG inline para ícones — sem Font Awesome, Heroicons CDN ou imagens de ícones
3. Sem Bootstrap, Tailwind ou qualquer CSS framework
4. Sem jQuery ou bibliotecas JS externas
5. CSS organizado em blocos comentados por secção
6. JS no final do body, organizado por função com comentários
7. Fallback estático para todas as secções CMS (fetch pode falhar)
8. Responsivo: 375px / 768px / 1280px
9. Sem `console.error` exposto ao utilizador
10. O resultado final deve parecer um produto SaaS profissional — não um template genérico