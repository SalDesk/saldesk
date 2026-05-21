/* ═══════════════════════════════════════════════════════════
   _lugares.js — SalDesk Connect · Páginas de Pontos Turísticos
   Requer: window.PLACE_SLUG definido antes de carregar
═══════════════════════════════════════════════════════════ */
'use strict';

const API = 'https://api.saldesk.cv/api/v1/public';
const APP = 'https://app.saldesk.cv';
const UNS = 'https://images.unsplash.com/';

/* ── Place data ─────────────────────────────────────────── */
const PLACES = {
  'santa-maria': {
    namePt:'Santa Maria', nameEn:'Santa Maria',
    tagPt:'Vila · Praia', tagEn:'Village · Beach',
    lat:16.5993, lng:-22.9052,
    mapsUrl:'https://maps.google.com/?q=16.5993,-22.9052',
    distancePt:'Ponto de referência da ilha', distanceEn:'Island reference point',
    distKm:0, bestTimePt:'Todo o ano', bestTimeEn:'Year-round',
    typePt:'Vila costeira', typeEn:'Coastal village',
    actsPt:'Kitesurf, Mergulho, Passeios de barco', actsEn:'Kitesurfing, Diving, Boat tours',
    heroImgs:['1507525428034-b723cf961d3e','519046904884-53103b34b206','506929562872-bb421503ef21','471922694854-ff1b63b20054','500375592092-40eb2168fd21'],
    galleryImgs:['1507525428034-b723cf961d3e','519046904884-53103b34b206','506929562872-bb421503ef21','471922694854-ff1b63b20054','500375592092-40eb2168fd21','544551763-46a013bb70d5'],
    descPt:'Santa Maria é a principal vila turística da Ilha do Sal e um dos destinos mais procurados de Cabo Verde. Com a sua icónica praia de 8 quilómetros de areia branca e águas turquesa, a vila combina a beleza natural do Atlântico com toda a comodidade turística.\n\nO centro da vila oferece uma ampla variedade de restaurantes com gastronomia local e internacional, bares animados, lojas de artesanato e actividades aquáticas. A marina é ponto de partida para passeios de barco, pesca desportiva e mergulho em sítios privilegiados.\n\nConhecida mundialmente como um dos melhores spots de kitesurf do planeta, Santa Maria recebe anualmente atletas e entusiastas de todo o mundo. As condições de vento constante e mar calmo na baía tornam-na perfeita para iniciantes e profissionais.',
    descEn:'Santa Maria is the main tourist village in Ilha do Sal and one of Cape Verde\'s most visited destinations. With its iconic 8-kilometre beach of white sand and turquoise waters, the village combines the natural beauty of the Atlantic with full tourist amenities.\n\nThe village centre offers a wide range of restaurants serving local and international cuisine, lively bars, craft shops and water sports activities. The marina is the departure point for boat trips, sport fishing and diving at privileged sites.\n\nWorld-renowned as one of the best kitesurfing spots on the planet, Santa Maria annually attracts athletes and enthusiasts from around the world. The constant wind conditions and calm bay waters make it perfect for beginners and professionals alike.',
    curiosities:[
      {icon:'flag', pt:'A Praia de Santa Maria ostenta a Bandeira Azul, distinção internacional de qualidade e limpeza das praias.', en:'Santa Maria Beach holds the Blue Flag award, the international quality and cleanliness distinction for beaches.'},
      {icon:'wind', pt:'Considerado um dos 5 melhores spots de kitesurf do mundo, com ventos alísios constantes de 20-30 nós.', en:'Considered one of the world\'s top 5 kitesurfing spots, with constant trade winds of 20-30 knots.'},
      {icon:'thermometer', pt:'A temperatura da água do mar varia apenas entre 22°C e 26°C durante todo o ano — ideal para mergulho.', en:'Sea water temperature varies only between 22°C and 26°C throughout the year — ideal for diving.'},
    ],
    transport:[
      {mode:'taxi', pt:'Táxi', en:'Taxi', detailPt:'€5 do aeroporto (2km). Disponível 24h.', detailEn:'€5 from airport (2km). Available 24h.'},
      {mode:'car', pt:'Carro alugado', en:'Car rental', detailPt:'Aluguer disponível na vila a partir de €25/dia.', detailEn:'Car rental available in the village from €25/day.'},
      {mode:'bike', pt:'Bicicleta', en:'Bicycle', detailPt:'Aluguer de bicicletas na praia. Percurso de 4km ao longo da costa.', detailEn:'Bicycle rental on the beach. 4km coastal route.'},
      {mode:'walk', pt:'A pé', en:'On foot', detailPt:'Todo o centro da vila é percorrível a pé em 20 minutos.', detailEn:'The entire village centre is walkable in 20 minutes.'},
    ],
    nearby:['ponta-preta','murdeira-bay','espargos'],
    apiSearch:'santa+maria',
  },

  'pedra-de-lume': {
    namePt:'Pedra de Lume', nameEn:'Pedra de Lume',
    tagPt:'Natureza · Salinas', tagEn:'Nature · Salt Pans',
    lat:16.7747, lng:-22.8809,
    mapsUrl:'https://maps.google.com/?q=16.7747,-22.8809',
    distancePt:'18km de Santa Maria', distanceEn:'18km from Santa Maria',
    distKm:18, bestTimePt:'Outubro a Abril', bestTimeEn:'October to April',
    typePt:'Cratera vulcânica', typeEn:'Volcanic crater',
    actsPt:'Flutuação nas salinas, Fotografia, Spa natural', actsEn:'Salt pan floating, Photography, Natural spa',
    heroImgs:['559128010-7c1ad6e1b6a5','469474968028-56623f02e42e','471922694854-ff1b63b20054','506929562872-bb421503ef21','519046904884-53103b34b206'],
    galleryImgs:['559128010-7c1ad6e1b6a5','469474968028-56623f02e42e','471922694854-ff1b63b20054','506929562872-bb421503ef21','519046904884-53103b34b206','1507525428034-b723cf961d3e'],
    descPt:'Pedra de Lume é uma das maravilhas naturais mais singulares de Cabo Verde. Localizada no interior de uma cratera vulcânica extinta, as suas salinas naturais oferecem uma experiência única no mundo: é possível flutuar naturalmente na água hipersalina, semelhante ao Mar Morto.\n\nAs salinas foram exploradas comercialmente desde o século XV, quando os portugueses descobriram o seu valor económico. Hoje, parte da produção de sal continua activa e é possível ver os cristais brancos a secar ao sol em contraste com a paisagem árida da cratera.\n\nO acesso é feito por um túnel escavado na rocha vulcânica, criando uma transição dramática entre o exterior árido e o interior surpreendente da cratera. A água saturada de sal tem propriedades terapêuticas reconhecidas para a pele e articulações.',
    descEn:'Pedra de Lume is one of Cape Verde\'s most unique natural wonders. Located inside an extinct volcanic crater, its natural salt pans offer a world-exclusive experience: you can float naturally in the hypersaline water, similar to the Dead Sea.\n\nThe salt pans have been commercially exploited since the 15th century, when the Portuguese discovered their economic value. Today, part of the salt production remains active, and you can see the white crystals drying in the sun against the arid crater landscape.\n\nAccess is via a tunnel carved through volcanic rock, creating a dramatic transition between the arid exterior and the surprising interior of the crater. The salt-saturated water has recognised therapeutic properties for skin and joints.',
    curiosities:[
      {icon:'droplets', pt:'A água das salinas é 10 vezes mais salgada que o oceano, tornando a flutuação natural impossível de evitar.', en:'The salt pan water is 10 times saltier than the ocean, making natural floating impossible to avoid.'},
      {icon:'history', pt:'O sal de Pedra de Lume foi exportado para a Europa e América desde o século XV, sendo parte essencial da economia cabo-verdiana.', en:'Pedra de Lume salt was exported to Europe and America since the 15th century, forming a key part of the Cape Verdean economy.'},
      {icon:'mountain', pt:'A cratera tem vários milhões de anos e foi formada por actividade vulcânica que moldou toda a Ilha do Sal.', en:'The crater is several million years old, formed by volcanic activity that shaped all of Ilha do Sal.'},
    ],
    transport:[
      {mode:'taxi', pt:'Táxi', en:'Taxi', detailPt:'~€20 de Santa Maria (18km, 20 min).', detailEn:'~€20 from Santa Maria (18km, 20 min).'},
      {mode:'car', pt:'Carro alugado', en:'Car rental', detailPt:'Estrada alcatroada em bom estado. Parque de estacionamento no local.', detailEn:'Paved road in good condition. Parking available on site.'},
      {mode:'tour', pt:'Excursão organizada', en:'Organised tour', detailPt:'Várias operadoras oferecem excursões com transporte incluído.', detailEn:'Several operators offer tours with transport included.'},
    ],
    nearby:['espargos','buracona','palmeira'],
    apiSearch:'pedra+de+lume',
  },

  'buracona': {
    namePt:'Buracona — Olho Azul', nameEn:'Buracona — Blue Eye',
    tagPt:'Natureza · Gruta', tagEn:'Nature · Grotto',
    lat:16.7534, lng:-22.9847,
    mapsUrl:'https://maps.google.com/?q=16.7534,-22.9847',
    distancePt:'25km de Santa Maria', distanceEn:'25km from Santa Maria',
    distKm:25, bestTimePt:'Nov a Mar (luz ideal às 12h30)', bestTimeEn:'Nov to Mar (ideal light at 12:30)',
    typePt:'Formação vulcânica · Piscina natural', typeEn:'Volcanic formation · Natural pool',
    actsPt:'Olho Azul, Snorkeling, Fotografia', actsEn:'Blue Eye, Snorkeling, Photography',
    heroImgs:['544551763-46a013bb70d5','506929562872-bb421503ef21','471922694854-ff1b63b20054','500375592092-40eb2168fd21','519046904884-53103b34b206'],
    galleryImgs:['544551763-46a013bb70d5','506929562872-bb421503ef21','471922694854-ff1b63b20054','500375592092-40eb2168fd21','519046904884-53103b34b206','1507525428034-b723cf961d3e'],
    descPt:'Buracona é uma formação rochosa vulcânica na costa noroeste da Ilha do Sal, famosa pelo fenómeno natural conhecido como Olho Azul. Nesta piscina natural escavada nas rochas, às 12h30 em dias de céu limpo, um raio de luz solar penetra pela abertura superior e ilumina o fundo com uma cor azul intensa e hipnótica.\n\nO fenómeno dura apenas 20 a 30 minutos por dia e é considerado um dos espectáculos naturais mais impressionantes de Cabo Verde. A formação vulcânica data de milhões de anos e as paredes de basalto negro criam um contraste dramático com a cor azul cobalto da água.\n\nAlém do Olho Azul, a área oferece excelentes condições para snorkeling nas plataformas rochosas, onde é possível observar peixes coloridos e a vida marinha local. A paisagem selvagem e a ausência de construções tornam Buracona num lugar de silêncio e contemplação.',
    descEn:'Buracona is a volcanic rock formation on the northwest coast of Ilha do Sal, famous for the natural phenomenon known as the Blue Eye. In this natural pool carved into the rocks, at 12:30 on clear days, a ray of sunlight penetrates through the upper opening and illuminates the bottom with an intense, hypnotic blue colour.\n\nThe phenomenon lasts only 20 to 30 minutes per day and is considered one of Cape Verde\'s most impressive natural spectacles. The volcanic formation dates back millions of years, and the black basalt walls create a dramatic contrast with the cobalt blue colour of the water.\n\nBeyond the Blue Eye, the area offers excellent snorkeling conditions on the rocky platforms, where you can observe colourful fish and local marine life. The wild landscape and absence of constructions make Buracona a place of silence and contemplation.',
    curiosities:[
      {icon:'clock', pt:'O efeito azul perfeito acontece apenas ~30 minutos por dia, entre as 12h15 e as 12h45 — não chegue tarde!', en:'The perfect blue effect lasts only ~30 minutes per day, between 12:15 and 12:45 — don\'t be late!'},
      {icon:'zap', pt:'A formação basáltica tem mais de 10.000 anos e foi esculpida pelas erupções vulcânicas que criaram a ilha.', en:'The basalt formation is over 10,000 years old, sculpted by the volcanic eruptions that created the island.'},
      {icon:'fish', pt:'As plataformas rochosas em redor albergam uma grande variedade de peixes tropicais acessíveis em snorkeling.', en:'The surrounding rocky platforms harbour a great variety of tropical fish accessible by snorkeling.'},
    ],
    transport:[
      {mode:'taxi', pt:'Táxi', en:'Taxi', detailPt:'~€25-30 de Santa Maria (25km, 30 min).', detailEn:'~€25-30 from Santa Maria (25km, 30 min).'},
      {mode:'car', pt:'Carro alugado', en:'Car rental', detailPt:'Estrada alcatroada até ao local. Chegue antes das 12h.', detailEn:'Paved road to the site. Arrive before 12:00.'},
      {mode:'tour', pt:'Excursão organizada', en:'Organised tour', detailPt:'Recomendado — guia garante hora certa para o Olho Azul.', detailEn:'Recommended — guide ensures the right time for the Blue Eye.'},
    ],
    nearby:['palmeira','pedra-de-lume','espargos'],
    apiSearch:'buracona',
  },

  'murdeira-bay': {
    namePt:'Murdeira Bay', nameEn:'Murdeira Bay',
    tagPt:'Natureza · Praia', tagEn:'Nature · Beach',
    lat:16.6724, lng:-22.9456,
    mapsUrl:'https://maps.google.com/?q=16.6724,-22.9456',
    distancePt:'15km de Santa Maria', distanceEn:'15km from Santa Maria',
    distKm:15, bestTimePt:'Todo o ano', bestTimeEn:'Year-round',
    typePt:'Baía protegida', typeEn:'Protected bay',
    actsPt:'Snorkeling, Mergulho, Observação de tartarugas', actsEn:'Snorkeling, Diving, Turtle watching',
    heroImgs:['471922694854-ff1b63b20054','500375592092-40eb2168fd21','519046904884-53103b34b206','506929562872-bb421503ef21','1507525428034-b723cf961d3e'],
    galleryImgs:['471922694854-ff1b63b20054','500375592092-40eb2168fd21','519046904884-53103b34b206','506929562872-bb421503ef21','1507525428034-b723cf961d3e','544551763-46a013bb70d5'],
    descPt:'A Baía de Murdeira é uma das joias escondidas da Ilha do Sal, uma enseada natural protegida dos ventos e correntes do oceano. As suas águas cristalinas com visibilidade excepcional tornam-na um dos melhores locais de snorkeling e mergulho da ilha.\n\nA baía é um habitat natural e zona de reprodução protegida de tartarugas marinhas, golfinhos e raias. A presença regular destes animais torna cada visita numa experiência única de contacto com a natureza marinha do Atlântico.\n\nA zona é classificada como reserva natural, e a pesca é condicionada para proteger o ecossistema. O acesso à praia é por um caminho de terra, mantendo o lugar relativamente isolado. Ao entardecer, as cores do pôr do sol reflectidas na baía criam imagens de rara beleza.',
    descEn:'Murdeira Bay is one of Ilha do Sal\'s hidden gems, a natural cove protected from ocean winds and currents. Its crystal-clear waters with exceptional visibility make it one of the island\'s best snorkeling and diving spots.\n\nThe bay is a natural habitat and protected breeding area for sea turtles, dolphins and rays. The regular presence of these animals makes every visit a unique experience of contact with Atlantic marine nature.\n\nThe area is classified as a nature reserve, and fishing is restricted to protect the ecosystem. Access to the beach is via a dirt track, which keeps the place relatively isolated. At dusk, the sunset colours reflected in the bay create images of rare beauty.',
    curiosities:[
      {icon:'turtle', pt:'A baía é uma zona de nidificação protegida de tartarugas-de-couro, que chegam à praia de Junho a Outubro.', en:'The bay is a protected nesting area for leatherback turtles, which arrive at the beach from June to October.'},
      {icon:'eye', pt:'A visibilidade subaquática pode atingir os 30 metros em dias calmos, entre as melhores de todo o arquipélago.', en:'Underwater visibility can reach 30 metres on calm days, among the best in the entire archipelago.'},
      {icon:'shield', pt:'Zona classificada como reserva natural desde 2003, com regulamentação especial de pesca e actividades náuticas.', en:'Classified as a nature reserve since 2003, with special regulations on fishing and nautical activities.'},
    ],
    transport:[
      {mode:'taxi', pt:'Táxi', en:'Taxi', detailPt:'~€15 de Santa Maria (15km, 15 min).', detailEn:'~€15 from Santa Maria (15km, 15 min).'},
      {mode:'car', pt:'Carro alugado', en:'Car rental', detailPt:'Estrada até 2km do local; depois caminho de terra. Recomenda-se SUV.', detailEn:'Road to 2km from site; then dirt track. SUV recommended.'},
      {mode:'tour', pt:'Excursão de snorkeling', en:'Snorkeling tour', detailPt:'Operadores em Santa Maria oferecem excursões com equipamento.', detailEn:'Santa Maria operators offer tours with equipment included.'},
    ],
    nearby:['santa-maria','ponta-preta','espargos'],
    apiSearch:'murdeira',
  },

  'palmeira': {
    namePt:'Palmeira', nameEn:'Palmeira',
    tagPt:'Vila · Porto', tagEn:'Village · Port',
    lat:16.7334, lng:-22.9783,
    mapsUrl:'https://maps.google.com/?q=16.7334,-22.9783',
    distancePt:'12km de Santa Maria', distanceEn:'12km from Santa Maria',
    distKm:12, bestTimePt:'Todo o ano', bestTimeEn:'Year-round',
    typePt:'Vila piscatória', typeEn:'Fishing village',
    actsPt:'Mercado de peixe, Pôr do sol, Gastronomia local', actsEn:'Fish market, Sunset, Local cuisine',
    heroImgs:['500375592092-40eb2168fd21','471922694854-ff1b63b20054','506929562872-bb421503ef21','519046904884-53103b34b206','1507525428034-b723cf961d3e'],
    galleryImgs:['500375592092-40eb2168fd21','471922694854-ff1b63b20054','506929562872-bb421503ef21','519046904884-53103b34b206','1507525428034-b723cf961d3e','469474968028-56623f02e42e'],
    descPt:'Palmeira é o principal porto da Ilha do Sal, uma vila piscatória autêntica que preserva a identidade e o modo de vida tradicional cabo-verdiano. Enquanto Santa Maria se desenvolveu para o turismo, Palmeira mantém uma atmosfera genuína e local que a torna fascinante para quem quer descobrir a vida real da ilha.\n\nO porto movimentado recebe ferries de inter-ilhas, barcos de pesca e embarcações de recreio. De manhã cedo, os pescadores chegam com o peixe fresco vendido directamente no mercado à beira-mar, uma experiência autêntica da cultura cabo-verdiana.\n\nO pôr do sol em Palmeira é considerado um dos mais espectaculares do arquipélago. Com o sol a desaparecer no Atlântico e os barcos coloridos em primeiro plano, é uma experiência fotográfica imperdível.',
    descEn:'Palmeira is the main port of Ilha do Sal, an authentic fishing village that preserves the Cape Verdean identity and traditional way of life. While Santa Maria has developed for tourism, Palmeira maintains a genuine local atmosphere that makes it fascinating for those wanting to discover the island\'s real life.\n\nThe busy port receives inter-island ferries, fishing boats and leisure craft. Early in the morning, fishermen arrive with fresh fish sold directly at the seafront market, an authentic experience of Cape Verdean culture.\n\nThe sunset in Palmeira is considered one of the most spectacular in the archipelago. With the sun disappearing into the Atlantic and colourful boats in the foreground, it is an unmissable photographic experience.',
    curiosities:[
      {icon:'anchor', pt:'Porto principal da ilha em funcionamento contínuo desde 1837, ligando a ilha ao resto do arquipélago.', en:'The island\'s main port in continuous operation since 1837, connecting the island to the rest of the archipelago.'},
      {icon:'sun', pt:'O pôr do sol de Palmeira é um dos mais fotografados de Cabo Verde, com a linha do horizonte completamente livre.', en:'Palmeira\'s sunset is one of the most photographed in Cape Verde, with a completely clear horizon line.'},
      {icon:'fish', pt:'Mercado de peixe fresco todos os dias de manhã — atum, garoupa e lagosta capturados nas últimas horas.', en:'Fresh fish market every morning — tuna, grouper and lobster caught in the last few hours.'},
    ],
    transport:[
      {mode:'taxi', pt:'Táxi', en:'Taxi', detailPt:'~€12 de Santa Maria (12km, 12 min).', detailEn:'~€12 from Santa Maria (12km, 12 min).'},
      {mode:'car', pt:'Carro alugado', en:'Car rental', detailPt:'Estrada principal em excelente estado. Parque de estacionamento junto ao porto.', detailEn:'Main road in excellent condition. Parking near the port.'},
      {mode:'bus', pt:'Hiace público', en:'Public minibus', detailPt:'Hiaces circulam entre Santa Maria, Espargos e Palmeira.', detailEn:'Minibuses run between Santa Maria, Espargos and Palmeira.'},
    ],
    nearby:['espargos','buracona','pedra-de-lume'],
    apiSearch:'palmeira',
  },

  'espargos': {
    namePt:'Espargos', nameEn:'Espargos',
    tagPt:'Cidade · Capital', tagEn:'City · Capital',
    lat:16.7530, lng:-22.9394,
    mapsUrl:'https://maps.google.com/?q=16.7530,-22.9394',
    distancePt:'17km de Santa Maria · junto ao aeroporto', distanceEn:'17km from Santa Maria · near airport',
    distKm:17, bestTimePt:'Todo o ano', bestTimeEn:'Year-round',
    typePt:'Capital administrativa', typeEn:'Administrative capital',
    actsPt:'Mercado local, Gastronomia, Compras', actsEn:'Local market, Cuisine, Shopping',
    heroImgs:['469474968028-56623f02e42e','559128010-7c1ad6e1b6a5','519046904884-53103b34b206','471922694854-ff1b63b20054','500375592092-40eb2168fd21'],
    galleryImgs:['469474968028-56623f02e42e','559128010-7c1ad6e1b6a5','519046904884-53103b34b206','471922694854-ff1b63b20054','500375592092-40eb2168fd21','506929562872-bb421503ef21'],
    descPt:'Espargos é a capital administrativa da Ilha do Sal e a sua maior cidade, localizada no centro da ilha junto ao aeroporto internacional Amílcar Cabral. Menos turística que Santa Maria, Espargos oferece uma visão autêntica da vida quotidiana cabo-verdiana.\n\nA cidade tem mercados coloridos com produtos locais, artesanato, roupas e especiarias. O mercado central é o coração social da cidade, especialmente animado nas manhãs de sábado. Os restaurantes locais servem pratos tradicionais como cachupa, moamba e grogue a preços muito mais acessíveis.\n\nA proximidade com o aeroporto torna Espargos o primeiro contacto de muitos visitantes com a ilha. A altitude ligeiramente mais elevada dá à cidade um microclima com brisas frescas ao fim do dia.',
    descEn:'Espargos is the administrative capital of Ilha do Sal and its largest city, located in the centre of the island near Amílcar Cabral international airport. Less touristy than Santa Maria, Espargos offers an authentic view of everyday Cape Verdean life.\n\nThe city has colourful markets with local products, crafts, clothing and spices. The central market is the social heart of the city, especially lively on Saturday mornings. Local restaurants serve traditional dishes such as cachupa, moamba and grogue at much more affordable prices.\n\nThe proximity to the airport makes Espargos the first contact many visitors have with the island. The slightly higher altitude gives the city a microclimate with cool breezes at the end of the day.',
    curiosities:[
      {icon:'plane', pt:'O aeroporto internacional Amílcar Cabral (SID) fica a 2km do centro da cidade, com voos directos para Europa.', en:'Amílcar Cabral international airport (SID) is 2km from the city centre, with direct flights to Europe.'},
      {icon:'market', pt:'O mercado central é o maior da ilha e o melhor lugar para encontrar artesanato local, tecidos e produtos típicos.', en:'The central market is the largest on the island and the best place to find local crafts, fabrics and typical products.'},
      {icon:'mountain', pt:'Espargos é o ponto mais elevado da Ilha do Sal, com microclima ligeiramente mais fresco que a zona costeira.', en:'Espargos is the highest point of Ilha do Sal, with a slightly cooler microclimate than the coastal zone.'},
    ],
    transport:[
      {mode:'taxi', pt:'Táxi', en:'Taxi', detailPt:'~€15 de Santa Maria (17km, 18 min).', detailEn:'~€15 from Santa Maria (17km, 18 min).'},
      {mode:'car', pt:'Carro alugado', en:'Car rental', detailPt:'Estrada nacional em excelente estado. Parques de estacionamento no centro.', detailEn:'National road in excellent condition. Car parks in the centre.'},
      {mode:'bus', pt:'Hiace público', en:'Public minibus', detailPt:'Hiaces frequentes entre Santa Maria, Espargos e Palmeira (€1-2).', detailEn:'Frequent minibuses between Santa Maria, Espargos and Palmeira (€1-2).'},
    ],
    nearby:['pedra-de-lume','palmeira','santa-maria'],
    apiSearch:'espargos',
  },

  'ponta-preta': {
    namePt:'Ponta Preta', nameEn:'Ponta Preta',
    tagPt:'Praia · Surf', tagEn:'Beach · Surf',
    lat:16.5756, lng:-22.9267,
    mapsUrl:'https://maps.google.com/?q=16.5756,-22.9267',
    distancePt:'4km de Santa Maria', distanceEn:'4km from Santa Maria',
    distKm:4, bestTimePt:'Nov a Mar (ondas), Abr a Out (tranquilo)', bestTimeEn:'Nov to Mar (waves), Apr to Oct (calm)',
    typePt:'Praia selvagem', typeEn:'Wild beach',
    actsPt:'Surf, Fotografia, Caminhadas, Pôr do sol', actsEn:'Surfing, Photography, Hiking, Sunset',
    heroImgs:['544551763-46a013bb70d5','500375592092-40eb2168fd21','471922694854-ff1b63b20054','506929562872-bb421503ef21','519046904884-53103b34b206'],
    galleryImgs:['544551763-46a013bb70d5','500375592092-40eb2168fd21','471922694854-ff1b63b20054','506929562872-bb421503ef21','519046904884-53103b34b206','1507525428034-b723cf961d3e'],
    descPt:'Ponta Preta é uma das praias mais selvagens e emocionantes da Ilha do Sal, localizada a poucos quilómetros a oeste de Santa Maria. Conhecida pelos surfistas como um dos melhores pontos de ondas do arquipélago, a praia oferece ondas perfeitas durante os meses de inverno.\n\nAo contrário da zona turística de Santa Maria, Ponta Preta é uma praia deserta sem infra-estruturas, preservando toda a sua beleza natural. A paisagem árida e rochosa contrasta com o azul intenso do oceano, criando um cenário dramático e fotogénico.\n\nAo pôr do sol, a praia oferece vistas panorâmicas sobre o Atlântico sem obstáculos. O silêncio, quebrado apenas pelo som das ondas e do vento, cria uma experiência meditativa única. A praia é também habitat de aves marinhas.',
    descEn:'Ponta Preta is one of the wildest and most exciting beaches in Ilha do Sal, located just a few kilometres west of Santa Maria. Known to surfers as one of the best wave spots in the archipelago, the beach offers perfect waves during the winter months.\n\nUnlike the tourist zone of Santa Maria, Ponta Preta is a deserted beach without infrastructure, preserving all its natural beauty. The arid, rocky landscape contrasts with the intense blue of the ocean, creating a dramatic and photogenic setting.\n\nAt sunset, the beach offers panoramic views over the Atlantic without obstacles. The silence, broken only by the sound of waves and wind, creates a unique meditative experience. The beach is also a habitat for seabirds.',
    curiosities:[
      {icon:'waves', pt:'As ondas atingem 3 metros nos meses de inverno, atraindo surfistas profissionais de todo o mundo.', en:'Waves reach 3 metres during winter months, attracting professional surfers from around the world.'},
      {icon:'camera', pt:'Um dos pontos de fotografia mais procurados da ilha ao pôr do sol, com horizonte completamente livre.', en:'One of the island\'s most sought-after photography spots at sunset, with a completely clear horizon.'},
      {icon:'bird', pt:'Habitat de aves marinhas raras, incluindo o pássaro-do-cabo (phaethon aethereus), que nidifica nas falésias.', en:'Habitat of rare seabirds, including the red-billed tropicbird (phaethon aethereus), which nests in the cliffs.'},
    ],
    transport:[
      {mode:'walk', pt:'A pé', en:'On foot', detailPt:'45 minutos de caminhada desde Santa Maria ao longo da costa.', detailEn:'45-minute walk from Santa Maria along the coast.'},
      {mode:'bike', pt:'Bicicleta', en:'Bicycle', detailPt:'20 minutos de bicicleta desde Santa Maria. Percurso plano.', detailEn:'20-minute bicycle ride from Santa Maria. Flat route.'},
      {mode:'taxi', pt:'Táxi', en:'Taxi', detailPt:'~€5 de Santa Maria (4km, 5 min).', detailEn:'~€5 from Santa Maria (4km, 5 min).'},
    ],
    nearby:['santa-maria','terra-boa','murdeira-bay'],
    apiSearch:'ponta+preta',
  },

  'terra-boa': {
    namePt:'Terra Boa', nameEn:'Terra Boa',
    tagPt:'Natureza · Deserto', tagEn:'Nature · Desert',
    lat:16.6234, lng:-22.8456,
    mapsUrl:'https://maps.google.com/?q=16.6234,-22.8456',
    distancePt:'20km de Santa Maria', distanceEn:'20km from Santa Maria',
    distKm:20, bestTimePt:'Out a Mai (luz suave)', bestTimeEn:'Oct to May (soft light)',
    typePt:'Deserto de dunas', typeEn:'Dune desert',
    actsPt:'Caminhadas, Fotografia, 4x4, Pôr do sol', actsEn:'Hiking, Photography, 4x4, Sunset',
    heroImgs:['559128010-7c1ad6e1b6a5','469474968028-56623f02e42e','471922694854-ff1b63b20054','500375592092-40eb2168fd21','519046904884-53103b34b206'],
    galleryImgs:['559128010-7c1ad6e1b6a5','469474968028-56623f02e42e','471922694854-ff1b63b20054','500375592092-40eb2168fd21','519046904884-53103b34b206','544551763-46a013bb70d5'],
    descPt:'Terra Boa é um dos lugares mais fascinantes e menos conhecidos da Ilha do Sal, um extenso deserto de dunas de areia branca que parece ter saído de outro planeta. O silêncio absoluto, a ausência de qualquer construção e a paisagem lunar tornam esta zona numa experiência verdadeiramente única.\n\nAs dunas encontram-se em constante movimento, remodeladas pelos ventos alísios que varrem a ilha de nordeste. A areia branca e fina cria padrões e formas em constante evolução. Ao pôr do sol, as sombras das dunas criam um jogo de luz e sombra de rara beleza fotográfica.\n\nO microclima de Terra Boa é diferente do resto da ilha, com menos humidade e temperatura ligeiramente mais elevada. No verão, as miragens são frequentes, criando ilusões de água e vegetação no horizonte. O acesso requer veículo 4x4.',
    descEn:'Terra Boa is one of the most fascinating and least-known places on Ilha do Sal, an extensive desert of white sand dunes that seems to have come from another planet. The absolute silence, the absence of any construction and the lunar landscape make this area a truly unique experience.\n\nThe dunes are in constant movement, reshaped by the trade winds that sweep the island from the northeast. The fine white sand creates patterns and shapes in constant evolution. At sunset, the shadows of the dunes create a play of light and shadow of rare photographic beauty.\n\nTerra Boa\'s microclimate differs from the rest of the island, with less humidity and a slightly higher temperature. In summer, mirages are frequent, creating illusions of water and vegetation on the horizon. Access requires a 4x4 vehicle.',
    curiosities:[
      {icon:'wind', pt:'As dunas movem-se vários metros por ano, empurradas pelos ventos alísios constantes de nordeste.', en:'The dunes move several metres per year, pushed by the constant northeast trade winds.'},
      {icon:'eye', pt:'As miragens de água são frequentes no verão — ilusões ópticas causadas pelo calor extremo sobre a areia.', en:'Water mirages are common in summer — optical illusions caused by extreme heat over the sand.'},
      {icon:'silence', pt:'Zero poluição sonora — Terra Boa é reconhecida como um dos lugares mais silenciosos de todo o arquipélago.', en:'Zero noise pollution — Terra Boa is recognised as one of the quietest places in the entire archipelago.'},
    ],
    transport:[
      {mode:'car', pt:'Carro 4x4', en:'4x4 vehicle', detailPt:'Indispensável. Pista de terra não alcatroada (20km de Santa Maria).', detailEn:'Essential. Unpaved dirt track (20km from Santa Maria).'},
      {mode:'tour', pt:'Excursão 4x4', en:'4x4 tour', detailPt:'Vários operadores oferecem safaris de 4x4 pela ilha com paragem em Terra Boa.', detailEn:'Several operators offer 4x4 island safaris with a stop at Terra Boa.'},
      {mode:'taxi', pt:'Táxi 4x4', en:'4x4 taxi', detailPt:'~€20-25 de Santa Maria. Solicitar táxi de todo-o-terreno.', detailEn:'~€20-25 from Santa Maria. Request an off-road taxi.'},
    ],
    nearby:['ponta-preta','espargos','murdeira-bay'],
    apiSearch:'terra+boa',
  },
};

/* ── Helpers ─────────────────────────────────────────────── */
function L()   { return document.documentElement.dataset.lang || 'pt'; }
function esc(s){ return String(s??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }
function img(id,w){ return `${UNS}${id}?w=${w||600}&q=80`; }
function renderStars(r){ if(!r) return ''; return '★'.repeat(Math.floor(r))+'☆'.repeat(5-Math.floor(r)); }

/* ── Icon SVG strings ────────────────────────────────────── */
const ICONS = {
  flag:      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
  wind:      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M9.59 4.59A2 2 0 1 1 11 8H2m10.59 11.41A2 2 0 1 0 14 16H2m15.73-8.27A2.5 2.5 0 1 1 19.5 12H2"/></svg>',
  thermometer:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M14 14.76V3.5a2.5 2.5 0 0 0-5 0v11.26a4.5 4.5 0 1 0 5 0z"/></svg>',
  droplets:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M7 16.3c2.2 0 4-1.83 4-4.05 0-1.16-.57-2.26-1.71-3.19S7.29 6.75 7 5.3c-.29 1.45-1.14 2.84-2.29 3.76S3 11.1 3 12.25c0 2.22 1.8 4.05 4 4.05z"/><path d="M12.56 6.6A10.97 10.97 0 0 0 14 3.02c.5 2.5 2 4.9 4 6.5s3 3.5 3 5.5a6.98 6.98 0 0 1-11.91 4.97"/></svg>',
  history:   '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polyline points="12 8 12 12 14 14"/><path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5"/></svg>',
  mountain:  '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 20 9 4 15 14 19 10 22 20"/><line x1="3" y1="20" x2="22" y2="20"/></svg>',
  turtle:    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2a4 4 0 0 1 4 4 4 4 0 0 1-4 4 4 4 0 0 1-4-4 4 4 0 0 1 4-4z" opacity=".3"/><path d="M6.5 17.5c-.83.83-2 1.17-3 1"/><path d="M17.5 17.5c.83.83 2 1.17 3 1"/><path d="M6.5 6.5 5 5"/><path d="M17.5 6.5 19 5"/></svg>',
  eye:       '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  shield:    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>',
  anchor:    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="3"/><line x1="12" y1="22" x2="12" y2="8"/><path d="M5 12H2a10 10 0 0 0 20 0h-3"/></svg>',
  sun:       '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>',
  fish:      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M6.5 12c.94-3.46 4.94-6 8.5-6 3.56 0 6.06 2.54 7 6-.94 3.47-3.44 6-7 6-3.56 0-7.56-2.53-8.5-6z"/><path d="M18 12v.01"/><path d="m6.5 12-3-3m3 3-3 3"/></svg>',
  clock:     '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  zap:       '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>',
  plane:     '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21 4 19 4c-2 0-3 1-3.5 2L10.8 8.5l-7.5 2.3a.5.5 0 0 0 0 .9l5.6 3.4 1 4.4a.5.5 0 0 0 .8.3l4.1-4.1a.5.5 0 0 0 .5-.2z"/></svg>',
  market:    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  waves:     '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2v2c-2.5 0-2.5 2-5 2-2.6 0-2.4-2-5-2-2.5 0-2.5 2-5 2C3.2 9 2.6 8.5 2 8"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2v2c-2.5 0-2.5 2-5 2-2.6 0-2.4-2-5-2-2.5 0-2.5 2-5 2-1.3 0-1.9-.5-2.5-1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2v2c-2.5 0-2.5 2-5 2-2.6 0-2.4-2-5-2-2.5 0-2.5 2-5 2-1.3 0-1.9-.5-2.5-1"/></svg>',
  camera:    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>',
  bird:      '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M16 7h.01"/><path d="M3.4 18H12a8 8 0 0 0 8-8V7a4 4 0 0 0-7.28-2.3L2 20"/><path d="m20 7 2 .5-2 .5"/><path d="M10 18v3"/><path d="M14 17.75V21"/><path d="M7 18a6 6 0 0 0 3.84-10.61"/></svg>',
  silence:   '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>',
  car:       '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="22" height="13" rx="2"/><path d="M16 16v3a1 1 0 0 1-1 1h-2a1 1 0 0 1-1-1v-3"/><path d="M8 16v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3"/><line x1="1" y1="11" x2="23" y2="11"/></svg>',
  taxi:      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v9a2 2 0 0 1-2 2h-2"/><circle cx="8" cy="17" r="2"/><circle cx="16" cy="17" r="2"/></svg>',
  walk:      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="4" r="1"/><path d="m6.9 8.7 2.1 2.1 2.5 5.1"/><path d="m9 8.7 5.1 1.5-2.1 5.1"/><path d="M8.1 14.3 6 21"/><path d="m13.8 17.7 2.2 3.3"/></svg>',
  bike:      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="18.5" cy="17.5" r="3.5"/><path d="M15 6a1 1 0 0 0-1-1h-1l-5 9"/><path d="M12 6h5l-3 5.5"/><path d="M7 11.5 5.5 14"/></svg>',
  bus:       '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><path d="M8 6v6"/><path d="M15 6v6"/><path d="M2 12h19.6"/><path d="M18 18h3s.5-1.7.8-2.8c.1-.4.2-.8.2-1.2 0-.4-.1-.8-.2-1.2l-1.4-5C20.1 6.8 19.1 6 18 6H4a2 2 0 0 0-2 2v10h3"/><circle cx="7" cy="18" r="2"/><path d="M9 18h5"/><circle cx="16" cy="18" r="2"/></svg>',
  tour:      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76"/></svg>',
  pin:       '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>',
  heart:     '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>',
  user:      '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
  chevL:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>',
  chevR:     '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>',
  x:         '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>',
  map:       '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>',
  extlink:   '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
};

/* ── CSS ─────────────────────────────────────────────────── */
const CSS = `
:root{--oc9:#062A38;--oc8:#0A3F55;--oc7:#0D5470;--oc6:#10698C;--oc5:#1480A8;--oc4:#3A9BBF;--oc3:#71BDD4;--oc1:#D6EEF5;--oc0:#EBF7FB;--sa6:#BE941C;--sa5:#D4A82A;--sa4:#E0BF5A;--n9:#1A2332;--n7:#374151;--n6:#4B5563;--n5:#6B7280;--n4:#9CA3AF;--n3:#D1D5DB;--n2:#E5E8EC;--n1:#F3F4F6;--n0:#F9FAFB;--ok:#1A7A4A;--okl:#DCFCE7;--err:#B91C1C;--errl:#FEE2E2;--fd:'Sora',sans-serif;--fb:'DM Sans',sans-serif;--sh1:0 1px 4px rgba(6,42,56,.07);--sh2:0 4px 16px rgba(6,42,56,.10);--sh3:0 12px 40px rgba(6,42,56,.14)}
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
html{scroll-behavior:smooth;-webkit-font-smoothing:antialiased}
body{font-family:var(--fb);color:var(--n9);background:#fff;line-height:1.6}
h1,h2,h3,h4{font-family:var(--fd);line-height:1.2}
a{color:inherit;text-decoration:none}
img{max-width:100%;display:block}
.container{max-width:1120px;margin:0 auto;padding:0 24px}
.section{padding:64px 0}
[data-lang="pt"] .en{display:none}
[data-lang="en"] .pt{display:none}

nav{position:sticky;top:0;z-index:300;background:#fff;border-bottom:1px solid var(--n2);box-shadow:var(--sh1)}
.nav-inner{display:flex;align-items:center;gap:16px;height:60px}
.nav-logo img{height:30px;width:auto}
.breadcrumb{display:flex;align-items:center;gap:8px;font-size:.8125rem;color:var(--n5);flex:1}
.breadcrumb a{color:var(--oc7);transition:color .2s}.breadcrumb a:hover{color:var(--oc5)}
.bc-sep{color:var(--n3)}
.bc-cur{font-weight:600;color:var(--n7)}
.nav-acts{display:flex;align-items:center;gap:8px;margin-left:auto}
.nav-icon{background:none;border:1px solid var(--n2);border-radius:100px;width:38px;height:38px;display:flex;align-items:center;justify-content:center;cursor:pointer;position:relative;color:var(--n7);transition:all .2s}
.nav-icon:hover{border-color:var(--oc7);color:var(--oc7)}
.wb{position:absolute;top:-4px;right:-4px;background:var(--err);color:#fff;border-radius:100px;min-width:16px;height:16px;font-size:.6rem;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 3px;border:2px solid #fff}
.lang-btn{background:var(--n1);border:none;border-radius:100px;padding:2px;display:flex;gap:2px;cursor:pointer}
.lang-btn span{font-size:.7rem;font-weight:700;padding:4px 8px;border-radius:100px;text-transform:uppercase;color:var(--n5);transition:all .2s}
.lang-btn span.active{background:#fff;color:var(--oc7);box-shadow:var(--sh1)}
.nav-profile{display:flex;align-items:center;gap:6px;border:1px solid var(--n2);border-radius:100px;padding:5px 12px 5px 5px;font-size:.8125rem;font-weight:500;color:var(--n7);transition:all .2s}
.nav-profile:hover{border-color:var(--oc7);color:var(--oc7)}
.nav-profile-icon{width:26px;height:26px;background:var(--n1);border-radius:50%;display:flex;align-items:center;justify-content:center}

.lp-hero{position:relative;min-height:520px;display:flex;align-items:center;overflow:hidden}
.hc-wrap{position:absolute;inset:0}
.hc-slide{position:absolute;inset:0;background-size:cover;background-position:center;opacity:0;transition:opacity 1.2s ease}
.hc-slide.active{opacity:1}
.hero-overlay{position:absolute;inset:0;background:linear-gradient(to bottom,rgba(6,42,56,.55) 0%,rgba(6,42,56,.35) 60%,rgba(6,42,56,.65) 100%)}
.hero-content{position:relative;z-index:2;color:#fff;max-width:680px;padding:80px 0 60px}
.hero-tag{display:inline-block;background:rgba(255,255,255,.18);border:1px solid rgba(255,255,255,.3);border-radius:100px;padding:4px 14px;font-size:.75rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--sa4);margin-bottom:16px}
.hero-h1{font-size:clamp(2.25rem,5vw,3.5rem);font-weight:800;letter-spacing:-.02em;margin-bottom:10px}
.hero-loc{font-size:1rem;opacity:.75;margin-bottom:28px;display:flex;align-items:center;gap:6px}
.hc-dots{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);z-index:3;display:flex;gap:8px}
.hc-dot{width:8px;height:8px;border-radius:50%;background:rgba(255,255,255,.4);cursor:pointer;transition:all .3s}
.hc-dot.active{background:#fff;width:20px;border-radius:4px}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;font-family:var(--fb);font-weight:600;font-size:.875rem;border-radius:8px;border:none;cursor:pointer;transition:all .2s;text-decoration:none;white-space:nowrap;padding:10px 20px}
.btn-primary{background:var(--oc7);color:#fff}
.btn-primary:hover{background:var(--oc5)}
.btn-sand{background:var(--sa5);color:#fff;padding:12px 24px;font-size:.9375rem}
.btn-sand:hover{background:var(--sa6)}
.btn-white{background:#fff;color:var(--oc7);font-weight:700}
.btn-white:hover{background:var(--oc0)}
.btn-ghost{background:var(--n1);color:var(--n7);border:1px solid var(--n2)}
.btn-ghost:hover{border-color:var(--oc7);color:var(--oc7)}
.btn-outline-w{background:transparent;color:#fff;border:2px solid rgba(255,255,255,.4)}
.btn-outline-w:hover{border-color:#fff;background:rgba(255,255,255,.1)}
.btn-sm{padding:7px 14px;font-size:.8125rem}

.sl{font-size:.7rem;font-weight:700;text-transform:uppercase;letter-spacing:.1em;color:var(--oc7);margin-bottom:6px}
.st{font-size:clamp(1.375rem,2.5vw,1.875rem);font-weight:700;color:var(--n9);margin-bottom:8px}
.ss{font-size:.9375rem;color:var(--n5);line-height:1.65}

.info-grid{display:grid;grid-template-columns:1fr 380px;gap:56px;align-items:start}
.info-desc p{font-size:1.0625rem;color:var(--n7);line-height:1.8;margin-bottom:20px}
.info-desc p:last-child{margin-bottom:0}
.facts-grid{display:grid;grid-template-columns:1fr 1fr;gap:14px}
.fact-card{background:var(--oc0);border:1px solid var(--oc1);border-radius:12px;padding:16px}
.fact-label{font-size:.72rem;font-weight:700;text-transform:uppercase;letter-spacing:.07em;color:var(--oc5);margin-bottom:4px}
.fact-value{font-family:var(--fd);font-size:.9375rem;font-weight:600;color:var(--n9);line-height:1.3}

.cur-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:32px}
.cur-card{background:var(--n0);border:1px solid var(--n2);border-radius:16px;padding:28px 24px;transition:all .25s}
.cur-card:hover{box-shadow:var(--sh2);transform:translateY(-2px)}
.cur-icon{width:48px;height:48px;background:var(--oc0);border-radius:12px;display:flex;align-items:center;justify-content:center;margin-bottom:16px;color:var(--oc7)}
.cur-text{font-size:.9375rem;color:var(--n6);line-height:1.65}

.act-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:20px}
.op-card{background:#fff;border:1px solid var(--n2);border-radius:16px;overflow:hidden;box-shadow:var(--sh1);transition:all .25s;display:flex;flex-direction:column}
.op-card:hover{transform:translateY(-3px);box-shadow:var(--sh2);border-color:var(--oc3)}
.op-img{position:relative;height:180px;overflow:hidden;background:var(--n1)}
.op-img img{width:100%;height:100%;object-fit:cover;transition:transform .35s}
.op-card:hover .op-img img{transform:scale(1.05)}
.op-img-ov{position:absolute;inset:0;background:linear-gradient(to top,rgba(6,42,56,.35) 0%,transparent 45%)}
.op-wish{position:absolute;top:10px;right:10px;width:34px;height:34px;background:rgba(255,255,255,.9);border:none;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);transition:all .2s}
.op-wish:hover{background:#fff}
.op-wish.active svg{fill:#e00;stroke:#e00}
.tb{display:inline-block;font-size:.62rem;font-weight:800;text-transform:uppercase;letter-spacing:.07em;padding:3px 10px;border-radius:100px}
.tb-hotel{background:var(--oc0);color:var(--oc7)}.tb-activity{background:#FEF9EE;color:#B45309}.tb-rentacar{background:var(--okl);color:var(--ok)}.tb-restaurant{background:var(--errl);color:var(--err)}
.op-body{padding:14px;flex:1;display:flex;flex-direction:column}
.op-name{font-family:var(--fd);font-size:.9375rem;font-weight:700;color:var(--n9);margin-bottom:4px}
.op-loc{font-size:.8125rem;color:var(--n5);display:flex;align-items:center;gap:4px;margin-bottom:8px}
.op-rating{display:flex;align-items:center;gap:6px;margin-bottom:10px;font-size:.8125rem}
.stars{color:var(--sa4);font-size:.8rem;letter-spacing:1px}
.op-price{font-size:.8125rem;color:var(--n5);margin-bottom:12px;flex:1}
.op-price strong{font-family:var(--fd);font-size:1rem;font-weight:800;color:var(--oc7)}

.gallery-grid{display:grid;grid-template-columns:repeat(3,1fr);grid-auto-rows:200px;gap:12px;margin-top:28px}
.gallery-grid .g-tall{grid-row:span 2}
.g-item{border-radius:12px;overflow:hidden;cursor:pointer;position:relative}
.g-item img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
.g-item:hover img{transform:scale(1.05)}
.g-item-overlay{position:absolute;inset:0;background:rgba(6,42,56,0);transition:background .25s;display:flex;align-items:center;justify-content:center}
.g-item:hover .g-item-overlay{background:rgba(6,42,56,.25)}

.transport-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:16px;margin-top:28px}
.tr-card{background:var(--n0);border:1px solid var(--n2);border-radius:12px;padding:20px;display:flex;gap:14px}
.tr-icon{width:44px;height:44px;background:#fff;border:1px solid var(--n2);border-radius:10px;display:flex;align-items:center;justify-content:center;flex-shrink:0;color:var(--oc7)}
.tr-mode{font-family:var(--fd);font-size:.9375rem;font-weight:700;color:var(--n9);margin-bottom:3px}
.tr-detail{font-size:.8125rem;color:var(--n5);line-height:1.5}

.map-wrap{background:var(--oc0);border:1px solid var(--oc1);border-radius:20px;overflow:hidden;margin-top:28px;position:relative}
.map-img{width:100%;height:280px;object-fit:cover;opacity:.6}
.map-card{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);background:#fff;border-radius:16px;padding:24px 28px;text-align:center;box-shadow:var(--sh3);min-width:280px}
.map-pin-icon{width:40px;height:40px;background:var(--oc7);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;color:#fff}
.map-name{font-family:var(--fd);font-size:1.0625rem;font-weight:700;color:var(--n9);margin-bottom:4px}
.map-coords{font-family:'DM Mono',monospace;font-size:.8125rem;color:var(--n5);margin-bottom:16px}

.nearby-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:20px;margin-top:28px}
.nb-card{border-radius:14px;overflow:hidden;box-shadow:var(--sh1);transition:all .25s;border:1px solid var(--n2);display:flex;flex-direction:column}
.nb-card:hover{transform:translateY(-3px);box-shadow:var(--sh2);border-color:var(--oc3)}
.nb-img{height:140px;overflow:hidden}
.nb-img img{width:100%;height:100%;object-fit:cover;transition:transform .3s}
.nb-card:hover .nb-img img{transform:scale(1.05)}
.nb-body{padding:14px;flex:1}
.nb-name{font-family:var(--fd);font-size:.9375rem;font-weight:700;color:var(--n9);margin-bottom:4px}
.nb-tag{font-size:.75rem;color:var(--n5)}

.lp-cta{background:linear-gradient(135deg,var(--oc7),var(--oc5));padding:72px 24px;text-align:center;color:#fff}
.lp-cta h2{font-size:clamp(1.5rem,3vw,2.25rem);font-weight:800;margin-bottom:12px}
.lp-cta p{font-size:1.0625rem;opacity:.85;margin-bottom:32px;max-width:500px;margin-left:auto;margin-right:auto}
.cta-btns{display:flex;gap:12px;justify-content:center;flex-wrap:wrap}

.footer-sep{height:3px;background:linear-gradient(90deg,var(--oc7),var(--sa5),var(--oc7))}
footer{background:#062A38;color:rgba(255,255,255,.65);padding:48px 0 28px}
.footer-grid{display:grid;grid-template-columns:2fr 1fr 1fr 1fr;gap:40px;margin-bottom:40px}
.footer-desc{font-size:.8125rem;line-height:1.6;color:rgba(255,255,255,.45);margin-top:12px;max-width:240px}
.footer-col h4{font-family:var(--fd);font-weight:700;font-size:.875rem;color:#fff;margin-bottom:12px}
.footer-links{list-style:none}
.footer-links li{margin-bottom:7px}
.footer-links a{font-size:.8125rem;color:rgba(255,255,255,.45);transition:color .2s}
.footer-links a:hover{color:#fff}
.social-icons{display:flex;gap:8px;margin-top:16px}
.sicon{width:34px;height:34px;border-radius:8px;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,.45);transition:all .2s}
.sicon:hover{background:rgba(255,255,255,.14);color:#fff}
.footer-bottom{display:flex;align-items:center;justify-content:space-between;padding-top:20px;border-top:1px solid rgba(255,255,255,.1);font-size:.8125rem;flex-wrap:wrap;gap:8px}

.lb{position:fixed;inset:0;background:rgba(0,0,0,.92);z-index:900;display:flex;align-items:center;justify-content:center;opacity:0;visibility:hidden;transition:opacity .3s,visibility .3s}
.lb.open{opacity:1;visibility:visible}
.lb-img{max-width:90vw;max-height:85vh;border-radius:8px;object-fit:contain}
.lb-close{position:absolute;top:16px;right:20px;background:rgba(255,255,255,.1);border:none;color:#fff;width:40px;height:40px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s}
.lb-close:hover{background:rgba(255,255,255,.2)}
.lb-prev,.lb-next{position:absolute;top:50%;transform:translateY(-50%);background:rgba(255,255,255,.1);border:none;color:#fff;width:44px;height:44px;border-radius:50%;cursor:pointer;display:flex;align-items:center;justify-content:center;transition:background .2s}
.lb-prev{left:16px}.lb-next{right:16px}
.lb-prev:hover,.lb-next:hover{background:rgba(255,255,255,.2)}
.lb-counter{position:absolute;bottom:16px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,.6);font-size:.8125rem}

.sk{background:linear-gradient(90deg,var(--n1) 25%,var(--n2) 50%,var(--n1) 75%);background-size:300% 100%;animation:shimmer 1.6s infinite;border-radius:6px}
@keyframes shimmer{0%{background-position:-300% 0}100%{background-position:300% 0}}
.sk-card{background:#fff;border:1px solid var(--n2);border-radius:16px;overflow:hidden}
.sk-img{height:180px}.sk-body{padding:14px;display:flex;flex-direction:column;gap:8px}
.sk-line{height:13px}.sk-w{width:75%}.sk-m{width:50%}.sk-s{width:35%}

.empty-state{text-align:center;padding:52px 20px;background:var(--n0);border-radius:16px;border:2px dashed var(--n2)}
.empty-state h3{font-family:var(--fd);font-size:1.0625rem;font-weight:700;color:var(--n7);margin:12px 0 6px}
.empty-state p{font-size:.875rem;color:var(--n5)}

.fade-up{opacity:0;transform:translateY(18px);transition:opacity .55s,transform .55s}
.fade-up.visible{opacity:1;transform:none}

@media(max-width:900px){.info-grid{grid-template-columns:1fr}.cur-grid{grid-template-columns:1fr 1fr}.gallery-grid{grid-template-columns:1fr 1fr;grid-auto-rows:160px}.nearby-grid{grid-template-columns:1fr 1fr}.footer-grid{grid-template-columns:1fr 1fr}}
@media(max-width:600px){.section{padding:44px 0}.act-grid{grid-template-columns:1fr}.transport-grid{grid-template-columns:1fr}.cur-grid{grid-template-columns:1fr}.nearby-grid{grid-template-columns:1fr}.footer-grid{grid-template-columns:1fr}.facts-grid{grid-template-columns:1fr}}
`;

/* ── HTML builders ───────────────────────────────────────── */
function buildNav(p) {
  return `
<nav>
  <div class="container nav-inner">
    <a href="/" class="nav-logo"><img src="/logo.png" alt="SalDesk" /></a>
    <div class="breadcrumb">
      <a href="/discover/">SalDesk Connect</a>
      <span class="bc-sep">›</span>
      <span class="bc-cur pt">${esc(p.namePt)}</span>
      <span class="bc-cur en">${esc(p.nameEn)}</span>
    </div>
    <div class="nav-acts">
      <button class="nav-icon" id="wish-nav-btn" onclick="openWishlist()" aria-label="Wishlist">
        ${ICONS.heart}
        <span id="wish-count" class="wb" style="display:none">0</span>
      </button>
      <button class="lang-btn" id="langToggle">
        <span id="langPt" class="active">PT</span>
        <span id="langEn">EN</span>
      </button>
      <a href="${APP}/login" class="nav-profile">
        <span class="nav-profile-icon">${ICONS.user}</span>
        <span class="pt">Perfil</span><span class="en">Profile</span>
      </a>
    </div>
  </div>
</nav>`;
}

function buildHero(p) {
  const slides = p.heroImgs.map((id,i) =>
    `<div class="hc-slide${i===0?' active':''}" style="background-image:url('${img(id,1600)}')"></div>`
  ).join('');
  const dots = p.heroImgs.map((_,i) =>
    `<button class="hc-dot${i===0?' active':''}" onclick="goSlide(${i})" aria-label="Slide ${i+1}"></button>`
  ).join('');
  return `
<section class="lp-hero">
  <div class="hc-wrap" id="hero-carousel">${slides}</div>
  <div class="hero-overlay"></div>
  <div class="container">
    <div class="hero-content">
      <div class="hero-tag pt">${esc(p.tagPt)}</div>
      <div class="hero-tag en">${esc(p.tagEn)}</div>
      <h1 class="hero-h1 pt">${esc(p.namePt)}</h1>
      <h1 class="hero-h1 en">${esc(p.nameEn)}</h1>
      <p class="hero-loc">${ICONS.pin} Ilha do Sal, Cabo Verde</p>
      <a href="#activities" onclick="document.getElementById('activities').scrollIntoView({behavior:'smooth'});return false" class="btn btn-sand">
        <span class="pt">Ver actividades</span><span class="en">See activities</span>
      </a>
    </div>
  </div>
  <div class="hc-dots">${dots}</div>
</section>`;
}

function buildInfo(p) {
  const paragsPt = p.descPt.split('\n\n').map(t => `<p>${esc(t)}</p>`).join('');
  const paragsEn = p.descEn.split('\n\n').map(t => `<p>${esc(t)}</p>`).join('');
  return `
<section class="section" id="info">
  <div class="container">
    <div class="info-grid fade-up">
      <div class="info-desc">
        <div class="sl"><span class="pt">Sobre o lugar</span><span class="en">About this place</span></div>
        <h2 class="st pt">${esc(p.namePt)}</h2>
        <h2 class="st en">${esc(p.nameEn)}</h2>
        <div class="pt" style="margin-top:20px">${paragsPt}</div>
        <div class="en" style="margin-top:20px">${paragsEn}</div>
      </div>
      <div>
        <div class="sl" style="margin-bottom:14px"><span class="pt">Factos</span><span class="en">Facts</span></div>
        <div class="facts-grid">
          <div class="fact-card"><div class="fact-label pt">Melhor época</div><div class="fact-label en">Best time</div><div class="fact-value pt">${esc(p.bestTimePt)}</div><div class="fact-value en">${esc(p.bestTimeEn)}</div></div>
          <div class="fact-card"><div class="fact-label pt">Distância</div><div class="fact-label en">Distance</div><div class="fact-value pt">${esc(p.distancePt)}</div><div class="fact-value en">${esc(p.distanceEn)}</div></div>
          <div class="fact-card"><div class="fact-label pt">Tipo de lugar</div><div class="fact-label en">Type</div><div class="fact-value pt">${esc(p.typePt)}</div><div class="fact-value en">${esc(p.typeEn)}</div></div>
          <div class="fact-card"><div class="fact-label pt">Actividades</div><div class="fact-label en">Activities</div><div class="fact-value pt">${esc(p.actsPt)}</div><div class="fact-value en">${esc(p.actsEn)}</div></div>
        </div>
      </div>
    </div>
  </div>
</section>`;
}

function buildCuriosities(p) {
  const cards = p.curiosities.map(c => `
    <div class="cur-card fade-up">
      <div class="cur-icon">${ICONS[c.icon] || ICONS.zap}</div>
      <p class="cur-text pt">${esc(c.pt)}</p>
      <p class="cur-text en">${esc(c.en)}</p>
    </div>`).join('');
  return `
<section class="section" id="curiosidades" style="background:var(--n0)">
  <div class="container">
    <div class="fade-up" style="margin-bottom:0">
      <div class="sl"><span class="pt">Curiosidades</span><span class="en">Did you know</span></div>
      <h2 class="st"><span class="pt">Sabia que...</span><span class="en">Did you know...</span></h2>
    </div>
    <div class="cur-grid">${cards}</div>
  </div>
</section>`;
}

function buildActivitiesSection(p) {
  return `
<section class="section" id="activities">
  <div class="container">
    <div class="fade-up" style="margin-bottom:28px">
      <div class="sl"><span class="pt">Operadores</span><span class="en">Operators</span></div>
      <h2 class="st"><span class="pt">Actividades em ${esc(p.namePt)}</span><span class="en">Activities in ${esc(p.nameEn)}</span></h2>
    </div>
    <div class="act-grid" id="act-grid"><div class="sk-card"><div class="sk sk-img"></div><div class="sk-body"><div class="sk sk-line sk-w"></div><div class="sk sk-line sk-m"></div><div class="sk sk-line sk-s"></div></div></div><div class="sk-card"><div class="sk sk-img"></div><div class="sk-body"><div class="sk sk-line sk-w"></div><div class="sk sk-line sk-m"></div><div class="sk sk-line sk-s"></div></div></div></div>
  </div>
</section>`;
}

function buildGallery(p) {
  const items = p.galleryImgs.map((id,i) => `
    <div class="g-item${i===0?' g-tall':''}" onclick="openLb(${i})">
      <img src="${img(id, i===0?800:500)}" alt="Foto ${i+1}" loading="lazy" />
      <div class="g-item-overlay"></div>
    </div>`).join('');
  return `
<section class="section" id="galeria" style="background:var(--n0)">
  <div class="container fade-up">
    <div class="sl"><span class="pt">Galeria</span><span class="en">Gallery</span></div>
    <h2 class="st"><span class="pt">Fotos do lugar</span><span class="en">Photo gallery</span></h2>
    <div class="gallery-grid">${items}</div>
  </div>
</section>`;
}

function buildGettingThere(p) {
  const cards = p.transport.map(t => `
    <div class="tr-card fade-up">
      <div class="tr-icon">${ICONS[t.mode] || ICONS.car}</div>
      <div>
        <div class="tr-mode pt">${esc(t.pt)}</div>
        <div class="tr-mode en">${esc(t.en)}</div>
        <div class="tr-detail pt">${esc(t.detailPt)}</div>
        <div class="tr-detail en">${esc(t.detailEn)}</div>
      </div>
    </div>`).join('');
  return `
<section class="section" id="como-chegar">
  <div class="container">
    <div class="fade-up" style="margin-bottom:0">
      <div class="sl"><span class="pt">Acesso</span><span class="en">Access</span></div>
      <h2 class="st"><span class="pt">Como Chegar</span><span class="en">Getting There</span></h2>
      <p class="ss pt">A partir de Santa Maria, Ilha do Sal.</p>
      <p class="ss en">From Santa Maria, Ilha do Sal.</p>
    </div>
    <div class="transport-grid">${cards}</div>
  </div>
</section>`;
}

function buildMap(p) {
  const lngDisp = Math.abs(p.lng).toFixed(4);
  const latDisp = p.lat.toFixed(4);
  return `
<section class="section" id="mapa" style="background:var(--n0)">
  <div class="container fade-up">
    <div class="sl"><span class="pt">Localização</span><span class="en">Location</span></div>
    <h2 class="st"><span class="pt">Mapa</span><span class="en">Map</span></h2>
    <div class="map-wrap">
      <img src="${img('469474968028-56623f02e42e',1200)}" alt="Mapa" class="map-img" />
      <div class="map-card">
        <div class="map-pin-icon">${ICONS.map}</div>
        <div class="map-name pt">${esc(p.namePt)}</div>
        <div class="map-name en">${esc(p.nameEn)}</div>
        <div class="map-coords">${latDisp}° N, ${lngDisp}° W</div>
        <a href="${esc(p.mapsUrl)}" target="_blank" rel="noopener" class="btn btn-primary">
          ${ICONS.extlink}
          <span class="pt">Abrir no Google Maps</span>
          <span class="en">Open in Google Maps</span>
        </a>
      </div>
    </div>
  </div>
</section>`;
}

function buildNearby(p) {
  const cards = p.nearby.map(slug => {
    const nb = PLACES[slug];
    if (!nb) return '';
    const heroId = nb.heroImgs[0];
    return `
      <a href="/discover/lugares/${esc(slug)}.html" class="nb-card">
        <div class="nb-img"><img src="${img(heroId,400)}" alt="${esc(nb.namePt)}" loading="lazy" /></div>
        <div class="nb-body">
          <div class="nb-name pt">${esc(nb.namePt)}</div>
          <div class="nb-name en">${esc(nb.nameEn)}</div>
          <div class="nb-tag pt">${esc(nb.tagPt)}</div>
          <div class="nb-tag en">${esc(nb.tagEn)}</div>
        </div>
      </a>`;
  }).join('');
  return `
<section class="section" id="nearby">
  <div class="container fade-up">
    <div class="sl"><span class="pt">Descobrir mais</span><span class="en">Discover more</span></div>
    <h2 class="st"><span class="pt">Lugares Próximos</span><span class="en">Nearby Places</span></h2>
    <div class="nearby-grid" style="margin-top:28px">${cards}</div>
  </div>
</section>`;
}

function buildCta(p) {
  return `
<section class="lp-cta">
  <h2 class="pt">Pronto para explorar ${esc(p.namePt)}?</h2>
  <h2 class="en">Ready to explore ${esc(p.nameEn)}?</h2>
  <p class="pt">Encontre e reserve as melhores actividades directamente com os operadores locais.</p>
  <p class="en">Find and book the best activities directly with local operators.</p>
  <div class="cta-btns">
    <a href="/discover/" class="btn btn-white"><span class="pt">Ver todas as actividades</span><span class="en">See all activities</span></a>
    <a href="${APP}/register" class="btn btn-outline-w"><span class="pt">Listar o seu negócio</span><span class="en">List your business</span></a>
  </div>
</section>`;
}

function buildFooter() {
  return `
<div class="footer-sep"></div>
<footer>
  <div class="container">
    <div class="footer-grid">
      <div>
        <img src="/logo.png" alt="SalDesk" style="height:24px;width:auto;filter:brightness(0) invert(1)" />
        <p class="footer-desc pt">SalDesk Connect — Descubra e reserve na Ilha do Sal, Cabo Verde.</p>
        <p class="footer-desc en">SalDesk Connect — Discover and book in Ilha do Sal, Cape Verde.</p>
        <div class="social-icons">
          <a href="#" class="sicon" aria-label="Instagram"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg></a>
          <a href="#" class="sicon" aria-label="Facebook"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg></a>
          <a href="#" class="sicon" aria-label="LinkedIn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></a>
        </div>
      </div>
      <div>
        <h4 class="pt">Lugares</h4><h4 class="en">Places</h4>
        <ul class="footer-links">
          <li><a href="/discover/lugares/santa-maria.html">Santa Maria</a></li>
          <li><a href="/discover/lugares/pedra-de-lume.html">Pedra de Lume</a></li>
          <li><a href="/discover/lugares/buracona.html">Buracona</a></li>
          <li><a href="/discover/lugares/ponta-preta.html">Ponta Preta</a></li>
        </ul>
      </div>
      <div>
        <h4 class="pt">Mais lugares</h4><h4 class="en">More places</h4>
        <ul class="footer-links">
          <li><a href="/discover/lugares/murdeira-bay.html">Murdeira Bay</a></li>
          <li><a href="/discover/lugares/palmeira.html">Palmeira</a></li>
          <li><a href="/discover/lugares/espargos.html">Espargos</a></li>
          <li><a href="/discover/lugares/terra-boa.html">Terra Boa</a></li>
        </ul>
      </div>
      <div>
        <h4 class="pt">SalDesk</h4><h4 class="en">SalDesk</h4>
        <ul class="footer-links">
          <li><a href="/discover/"><span class="pt">Directório</span><span class="en">Directory</span></a></li>
          <li><a href="/"><span class="pt">Início</span><span class="en">Home</span></a></li>
          <li><a href="${APP}/register"><span class="pt">Listar negócio</span><span class="en">List business</span></a></li>
          <li><a href="mailto:hello@saldesk.cv">hello@saldesk.cv</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span style="color:rgba(255,255,255,.4)"><span class="pt">© 2026 SalDesk · Ilha do Sal, Cabo Verde</span><span class="en">© 2026 SalDesk · Ilha do Sal, Cape Verde</span></span>
      <span style="color:rgba(255,255,255,.3);font-size:.75rem"><span class="pt">Desenvolvido por </span><span class="en">Developed by </span><a href="https://wandr.cv" target="_blank" rel="noopener" style="color:rgba(255,255,255,.5);font-weight:600;transition:color .2s" onmouseover="this.style.color='#fff'" onmouseout="this.style.color='rgba(255,255,255,.5)'">WANDR — Travel Technology</a></span>
    </div>
  </div>
</footer>
<div class="lb" id="lightbox">
  <img class="lb-img" id="lb-img" src="" alt="" />
  <button class="lb-close" onclick="closeLb()">${ICONS.x}</button>
  <button class="lb-prev" onclick="moveLb(-1)">${ICONS.chevL}</button>
  <button class="lb-next" onclick="moveLb(1)">${ICONS.chevR}</button>
  <span class="lb-counter" id="lb-counter"></span>
</div>`;
}

/* ── Operator card ───────────────────────────────────────── */
const PLACEHOLDERS = { hotel:'1571003123894-1f0594d2b5d9', activity:'506929562872-bb421503ef21', rentacar:'494976388531-d1058494cdd8', restaurant:'414235077428-338989a2e8c0', default:'1507525428034-b723cf961d3e' };
function imgOp(op) { return op.logo_url || `${UNS}${PLACEHOLDERS[op.operator_type]||PLACEHOLDERS.default}?w=600&q=75`; }
function tLabel(t) { const M={hotel:{pt:'Hotel',en:'Hotel'},activity:{pt:'Actividade',en:'Activity'},rentacar:{pt:'Rent-a-Car',en:'Rent-a-Car'},restaurant:{pt:'Restaurante',en:'Restaurant'}}; return (M[t]||{pt:t,en:t})[L()]; }

function renderOpCard(op) {
  const wished = (JSON.parse(localStorage.getItem('sd-wish')||'[]')).includes(op.slug);
  const heartColor = wished ? '#e00' : 'none';
  const heartStroke = wished ? '#e00' : 'currentColor';
  const heart = `<svg width="16" height="16" viewBox="0 0 24 24" fill="${heartColor}" stroke="${heartStroke}" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
  const priceHtml = op.base_price
    ? `<div class="op-price"><span class="pt">A partir de </span><span class="en">From </span><strong>€${Math.round(op.base_price)}</strong></div>`
    : `<div class="op-price" style="flex:1"></div>`;
  const ratingHtml = op.avg_rating
    ? `<div class="op-rating"><span class="stars">${renderStars(op.avg_rating)}</span><span style="font-weight:600;color:var(--n7)">${op.avg_rating}</span><span style="color:var(--n5)">(${op.review_count})</span></div>`
    : '';
  return `
    <div class="op-card fade-up">
      <div class="op-img">
        <img src="${esc(imgOp(op))}" alt="${esc(op.name)}" loading="lazy" onerror="this.src='${UNS}${PLACEHOLDERS.default}?w=600&q=75'" />
        <div class="op-img-ov"></div>
        <button class="op-wish ${wished?'active':''}" data-wish="${esc(op.slug)}" onclick="toggleWish('${esc(op.slug)}')" aria-label="Wishlist">${heart}</button>
        <span class="tb tb-${op.operator_type}" style="position:absolute;bottom:10px;left:10px">${tLabel(op.operator_type)}</span>
      </div>
      <div class="op-body">
        <div class="op-name">${esc(op.name)}</div>
        <div class="op-loc">${ICONS.pin}${esc(op.address||'Ilha do Sal')}</div>
        ${ratingHtml}
        ${priceHtml}
        <a href="${APP}/book/${esc(op.slug)}" class="btn btn-primary" style="width:100%;justify-content:center;margin-top:auto">
          <span class="pt">Reservar</span><span class="en">Book now</span>
        </a>
      </div>
    </div>`;
}

/* ── API ─────────────────────────────────────────────────── */
async function loadActivities(p) {
  const grid = document.getElementById('act-grid');
  if (!grid) return;
  try {
    const r = await fetch(`${API}/discover?search=${p.apiSearch}`);
    const j = await r.json();
    const ops = j.data || [];
    if (!ops.length) {
      grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3><span class="pt">Sem actividades registadas aqui</span><span class="en">No activities registered here</span></h3><p><span class="pt">Ainda não há operadores registados nesta zona. Em breve!</span><span class="en">No operators registered in this area yet. Coming soon!</span></p></div>`;
    } else {
      grid.innerHTML = ops.map(renderOpCard).join('');
      observeFadeUp(grid);
    }
  } catch {
    grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><h3><span class="pt">Servico indisponivel</span><span class="en">Service unavailable</span></h3><p><span class="pt">Tente novamente mais tarde.</span><span class="en">Please try again later.</span></p></div>`;
  }
  if (L()==='en') fixLang(document.getElementById('act-grid'));
}

/* ── Interactions ────────────────────────────────────────── */
let slideIdx = 0, slideTimer;
function initCarousel() {
  const slides = document.querySelectorAll('.hc-slide');
  const dots   = document.querySelectorAll('.hc-dot');
  if (!slides.length) return;
  slideTimer = setInterval(() => goSlide((slideIdx + 1) % slides.length), 5000);
  window.goSlide = function(i) {
    slides[slideIdx].classList.remove('active');
    dots[slideIdx]?.classList.remove('active');
    slideIdx = i;
    slides[slideIdx].classList.add('active');
    dots[slideIdx]?.classList.add('active');
    clearInterval(slideTimer);
    slideTimer = setInterval(() => goSlide((slideIdx + 1) % slides.length), 5000);
  };
}

let lbImages = [], lbIdx = 0;
function initLightbox(images) {
  lbImages = images;
  window.openLb = function(i) { lbIdx = i; updateLb(); document.getElementById('lightbox').classList.add('open'); document.body.style.overflow='hidden'; };
  window.closeLb = function() { document.getElementById('lightbox').classList.remove('open'); document.body.style.overflow=''; };
  window.moveLb = function(d) { lbIdx = (lbIdx + d + lbImages.length) % lbImages.length; updateLb(); };
  document.addEventListener('keydown', e => { if (e.key==='Escape') closeLb(); if (e.key==='ArrowLeft') moveLb(-1); if (e.key==='ArrowRight') moveLb(1); });
  document.getElementById('lightbox')?.addEventListener('click', e => { if (e.target===e.currentTarget) closeLb(); });
}
function updateLb() {
  const el = document.getElementById('lb-img');
  const ct = document.getElementById('lb-counter');
  if (el) el.src = img(lbImages[lbIdx], 1200);
  if (ct) ct.textContent = `${lbIdx+1} / ${lbImages.length}`;
}

const scrollObs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); scrollObs.unobserve(e.target); } });
}, { threshold: 0.08 });
function observeFadeUp(root) { root.querySelectorAll('.fade-up').forEach(el => scrollObs.observe(el)); }
function fixLang(root) {
  if (!root) return;
  root.querySelectorAll('.en').forEach(e => e.style.display = '');
  root.querySelectorAll('.pt').forEach(e => e.style.display = 'none');
}

function toggleWish(slug) {
  const w = JSON.parse(localStorage.getItem('sd-wish')||'[]');
  const i = w.indexOf(slug);
  if (i >= 0) w.splice(i, 1); else w.push(slug);
  localStorage.setItem('sd-wish', JSON.stringify(w));
  document.querySelectorAll(`[data-wish="${slug}"]`).forEach(btn => {
    btn.classList.toggle('active', w.includes(slug));
    const svg = btn.querySelector('svg');
    if (svg) { svg.setAttribute('fill', w.includes(slug)?'#e00':'none'); svg.setAttribute('stroke', w.includes(slug)?'#e00':'currentColor'); }
  });
  updateWishCount();
}
function updateWishCount() {
  const n = JSON.parse(localStorage.getItem('sd-wish')||'[]').length;
  const el = document.getElementById('wish-count');
  if (el) { el.textContent = n; el.style.display = n > 0 ? '' : 'none'; }
}
function openWishlist() { window.location.href = '/discover/'; }
window.toggleWish = toggleWish;
window.openWishlist = openWishlist;

function setLang(lang) {
  document.documentElement.setAttribute('data-lang', lang);
  document.documentElement.setAttribute('lang', lang);
  document.getElementById('langPt')?.classList.toggle('active', lang==='pt');
  document.getElementById('langEn')?.classList.toggle('active', lang==='en');
  localStorage.setItem('sd-lang', lang);
  if (lang === 'en') fixLang(document.body);
}
document.addEventListener('click', e => {
  if (e.target.closest('#langToggle')) {
    setLang(document.documentElement.dataset.lang === 'pt' ? 'en' : 'pt');
  }
});

/* ── INIT ────────────────────────────────────────────────── */
(async function init() {
  const slug = window.PLACE_SLUG;
  const p = PLACES[slug];
  if (!p) { document.body.innerHTML = '<div style="padding:4rem;text-align:center;font-family:sans-serif"><h2>Página não encontrada</h2><p><a href="/discover/">Voltar ao directório</a></p></div>'; return; }

  // Inject CSS
  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  // Build page
  document.body.innerHTML =
    buildNav(p) + buildHero(p) + buildInfo(p) + buildCuriosities(p) +
    buildActivitiesSection(p) + buildGallery(p) + buildGettingThere(p) +
    buildMap(p) + buildNearby(p) + buildCta(p) + buildFooter();

  // Language
  const savedLang = localStorage.getItem('sd-lang') || 'pt';
  document.documentElement.setAttribute('data-lang', savedLang);
  document.documentElement.setAttribute('lang', savedLang);
  document.getElementById('langPt')?.classList.toggle('active', savedLang==='pt');
  document.getElementById('langEn')?.classList.toggle('active', savedLang!=='pt');
  if (savedLang === 'en') fixLang(document.body);

  updateWishCount();
  initCarousel();
  initLightbox(p.galleryImgs || p.heroImgs);
  document.querySelectorAll('.fade-up').forEach(el => scrollObs.observe(el));
  await loadActivities(p);
})();
