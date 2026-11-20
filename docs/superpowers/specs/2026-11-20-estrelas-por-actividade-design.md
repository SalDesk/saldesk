# Estrelas por actividade (short design)

Date: 2026-11-20. The owner delegated the decision ("decide tu e avanca").

- **Intent:** each experience card on the Discover and on the tourist-attraction pages shows that activity's own rating. Today every card from an operator repeats the operator's average.
- **Decision (option a):** show stars only on experiences with public reviews of their own. An experience with none shows nothing, even when its operator has reviews. This matches the JSON-LD (`unit_rating`).
- **Rejected (b):** the operator's rating labelled "operador" on the card. It puts two numbers side by side, and both would need explaining.
- **How:**
  - `getDiscoverCatalog` adds `unit_avg_rating` (1 decimal place) and `unit_review_count` to each unit, calculated from the public reviews of that unit's bookings (review.reservation_id -> reservations.unit_id).
  - `avg_rating` and `review_count` (operator) stay as they are. The operator section of the Discover keeps using them.
  - The site cards (`renderActCard` in index.html, `renderXp` in ponto.html) use the unit fields through `C.classificacaoCartao(item)`.
- **Non-goals:**
  - stars on the service page (it already has its own list);
  - changing how the "Recomendados" order is sorted.
- **Anti-goal:** an experience never shows another's rating, nor its operator's.
- **Data today:** 4 public reviews, from 1 operator, across 3 experiences.
