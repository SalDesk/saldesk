#!/usr/bin/env bash
# deploy/migrate.sh
# Corre as migracoes Supabase em ordem pela API REST
# Requer: SUPABASE_URL e SUPABASE_SERVICE_KEY no ambiente ou em backend/.env
# Uso:
#   bash deploy/migrate.sh                # corre todas as migracoes pendentes
#   bash deploy/migrate.sh --dry-run      # lista migracoes sem executar
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DB_DIR="$SCRIPT_DIR/../database"
ENV_FILE="$SCRIPT_DIR/../backend/.env"
DRY_RUN=false

[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

# Carregar .env se existir
if [[ -f "$ENV_FILE" ]]; then
  set -a
  source "$ENV_FILE"
  set +a
fi

: "${SUPABASE_URL:?Variavel SUPABASE_URL nao definida}"
: "${SUPABASE_SERVICE_KEY:?Variavel SUPABASE_SERVICE_KEY nao definida}"

DB_URL="${SUPABASE_URL}/rest/v1/rpc/exec_sql"

run_migration() {
  local file="$1"
  local name
  name=$(basename "$file")

  if [[ "$DRY_RUN" == true ]]; then
    echo "  [dry-run] $name"
    return
  fi

  echo "  Executando: $name"
  local sql
  sql=$(cat "$file")

  # Usar o endpoint SQL do Supabase via service key
  local response
  response=$(curl -s -w "\n%{http_code}" \
    -X POST \
    -H "apikey: $SUPABASE_SERVICE_KEY" \
    -H "Authorization: Bearer $SUPABASE_SERVICE_KEY" \
    -H "Content-Type: application/json" \
    --data-binary "{\"query\": $(echo "$sql" | python3 -c 'import json,sys; print(json.dumps(sys.stdin.read()))')}" \
    "${SUPABASE_URL}/rest/v1/rpc/exec_sql" 2>/dev/null || true)

  local http_code
  http_code=$(echo "$response" | tail -n1)
  local body
  body=$(echo "$response" | head -n-1)

  if [[ "$http_code" == "200" || "$http_code" == "204" ]]; then
    echo "    OK"
  else
    echo "    AVISO (HTTP $http_code): $body"
    echo "    Execute manualmente no Supabase SQL Editor:"
    echo "    $file"
  fi
}

echo ""
echo "================================================"
echo " SalDesk — Migracoes Supabase"
if [[ "$DRY_RUN" == true ]]; then
  echo " Modo: DRY RUN (sem alteracoes)"
fi
echo "================================================"
echo ""
echo "Base de dados: $SUPABASE_URL"
echo ""

# Ordenar e correr todas as migracoes
migrations=($(ls -1 "$DB_DIR"/*.sql 2>/dev/null | sort))

if [[ ${#migrations[@]} -eq 0 ]]; then
  echo "Nenhuma migracao encontrada em $DB_DIR"
  exit 0
fi

echo "Migracoes encontradas: ${#migrations[@]}"
echo ""

for migration in "${migrations[@]}"; do
  run_migration "$migration"
done

echo ""
echo "================================================"
if [[ "$DRY_RUN" == true ]]; then
  echo " Dry-run concluido. Nenhuma alteracao feita."
else
  echo " Migracoes concluidas."
  echo ""
  echo " NOTA: Se alguma migracao falhou, execute"
  echo " manualmente no Supabase SQL Editor:"
  echo " https://supabase.com/dashboard/project/_/sql/new"
fi
echo "================================================"
echo ""
