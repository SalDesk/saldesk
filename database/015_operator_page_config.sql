-- SalDesk - Configuracao customizavel da pagina publica do operador (/book/:slug)
-- Executar no SQL Editor do Supabase

-- ============================================================
-- ALTERAR: operators — page_config (secoes, parceiros, testemunhos,
-- redes sociais, horario, idiomas falados, coordenadas GPS)
-- ============================================================
alter table operators
  add column if not exists page_config jsonb default '{
    "sections": [
      {"key": "featured",            "enabled": true},
      {"key": "services",            "enabled": true},
      {"key": "about",               "enabled": true},
      {"key": "timeline",            "enabled": true},
      {"key": "gallery",             "enabled": true},
      {"key": "reviews",             "enabled": true},
      {"key": "comparison",          "enabled": true},
      {"key": "availability",        "enabled": true},
      {"key": "contact",             "enabled": true},
      {"key": "faq",                 "enabled": true},
      {"key": "partners",            "enabled": false},
      {"key": "video_testimonials",  "enabled": false},
      {"key": "google_reviews",      "enabled": false},
      {"key": "instagram",           "enabled": false}
    ],
    "partners": [],
    "video_testimonials": [],
    "google_reviews": [],
    "social": {"instagram": "", "facebook": "", "tripadvisor": "", "google_maps": "", "linkedin": ""},
    "opening_hours": {"mon": "", "tue": "", "wed": "", "thu": "", "fri": "", "sat": "", "sun": ""},
    "spoken_languages": [],
    "lat": null,
    "lng": null
  }'::jsonb;

-- Formato de cada item em "partners": { name, logo_url, url }
-- Formato de cada item em "video_testimonials": { url, thumbnail_url }
-- Formato de cada item em "google_reviews": { author_name, author_photo, text }
