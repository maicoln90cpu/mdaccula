#!/usr/bin/env bash
# Scaffold mínimo de testes. Não sobrescreve arquivos existentes.
set -euo pipefail

ROOT="${1:-.}"
cd "$ROOT"

mkdir -p docs tests/unit tests/integration tests/e2e tests/contract tests/factories tests/regression

copy_if_absent() {
  local src="$1" dst="$2"
  if [ -f "$dst" ]; then
    echo "skip (existe): $dst"
  else
    cp "$src" "$dst"
    echo "criado: $dst"
  fi
}

HERE="$(cd "$(dirname "$0")" && pwd)"
ASSETS="$HERE/../assets"

copy_if_absent "$ASSETS/TESTING.md.template" "docs/TESTING.md"
copy_if_absent "$ASSETS/risk-matrix.md.template" "docs/risk-matrix.md"
copy_if_absent "$ASSETS/e2e-flows.md.template" "docs/e2e-flows.md"

cat <<'EOF'

Próximos passos sugeridos:
  bun add -d vitest @testing-library/react @testing-library/jest-dom @vitest/coverage-v8
  bun add -d @playwright/test @axe-core/playwright
  bunx playwright install --with-deps

Edite docs/TESTING.md, docs/risk-matrix.md e docs/e2e-flows.md para refletir o projeto.
Rode: bun run scripts/check-test-health.mjs
EOF
