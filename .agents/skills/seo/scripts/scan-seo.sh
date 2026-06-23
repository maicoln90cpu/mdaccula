#!/bin/bash
# scan-seo.sh — varre o projeto por lacunas de SEO sem modificar nada
# Uso: bash scripts/scan-seo.sh

echo "=== SCAN SEO ==="
echo ""

echo "1. Paginas publicas sem useDocumentMeta:"
grep -rn "export.*function\|export default" src/pages src/routes 2>/dev/null \
  | grep -v "useDocumentMeta" | grep -v "test\|spec\|layout\|error" | head -10

echo ""
echo "2. Sitemap existe?"
ls public/sitemap.xml 2>/dev/null && echo "   ✅ sitemap.xml encontrado" || echo "   ❌ sitemap.xml NAO encontrado"

echo ""
echo "3. robots.txt existe?"
ls public/robots.txt 2>/dev/null && echo "   ✅ robots.txt encontrado" || echo "   ❌ robots.txt NAO encontrado"

echo ""
echo "4. llms.txt existe?"
ls public/llms.txt 2>/dev/null && echo "   ✅ llms.txt encontrado" || echo "   ❌ llms.txt NAO encontrado"

echo ""
echo "5. Open Graph no index.html?"
grep -c "og:title" index.html 2>/dev/null && echo "   ✅ OG encontrado" || echo "   ❌ OG NAO encontrado"

echo ""
echo "6. react-helmet em uso (deveria ser useDocumentMeta)?"
COUNT=$(grep -rn "react-helmet\|Helmet" src --include="*.tsx" --include="*.ts" | wc -l)
[ "$COUNT" -gt 0 ] && echo "   ⚠️  react-helmet encontrado: $COUNT ocorrencias" || echo "   ✅ sem react-helmet"

echo ""
echo "7. Paginas privadas com risco de indexacao:"
grep -rn "RequireAuth\|ProtectedRoute" src --include="*.tsx" | grep -v "noindex" | head -5

echo ""
echo "=== FIM DO SCAN ==="
