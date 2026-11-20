# Estrelas por actividade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:executing-plans.

**Goal:** the experience cards show that activity's own rating.
**Spec:** `docs/superpowers/specs/2026-11-20-estrelas-por-actividade-design.md`

## Review Focus
- A review without `reservation_id` (or with a deleted booking) does not count toward any unit and does not break the calculation. Test in Task 1: `avaliacao_sem_reserva_nao_conta`.
- A rating outside 1–5 or null is ignored. Test in Task 1: `notas_invalidas_ignoradas`.

### Task 1: Rating per unit (server)
- Create `backend/src/helpers/classificacaoUnidade.js`:
  - `classificacaoPorUnidade(reviews, reservas) -> { [unitId]: { avg, count } }`;
  - `reviews` is `[{rating, reservation_id}]`;
  - `reservas` is `[{id, unit_id}]`;
  - `avg` is rounded to 1 decimal place.
- In `discoverCatalogService.js`:
  - the reviews query also returns `reservation_id`;
  - fetch `reservations(id, unit_id)` for those ids;
  - add `unit_avg_rating` (null when the unit has no reviews) and `unit_review_count` (0 when it has none) to each unit.
- Tests in `backend/src/__tests__/classificacaoUnidade.test.js`:
  - `media_e_contagem_por_unidade`;
  - `avaliacao_sem_reserva_nao_conta`;
  - `notas_invalidas_ignoradas`;
  - `sem_avaliacoes_devolve_vazio`.
- Commit: `feat: catalogo devolve a classificacao propria de cada experiencia`.

### Task 2: Cards use the activity's rating (site)
- In `_cartao.js`, add `classificacaoCartao(item) -> {media, total}|null`. It reads only the unit fields, never `avg_rating`.
- In `index.html` `renderActCard` and `ponto.html` `renderXp`, call `ratingBadge` with that result.
- Bump the version to `?v=20261120d`.
- Test in `tests/website/cartao.test.js`: `estrelas_so_da_propria_experiencia`.
- Browser check with the fixture.
- Commit: `feat: cartoes mostram as estrelas da propria experiencia`.
