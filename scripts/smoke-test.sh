#!/usr/bin/env bash
# Smoke test después de un despliegue en Render (lo usa el pipeline; también se puede correr a mano).
#   scripts/smoke-test.sh api   <URL-del-backend>  <commit>
#   scripts/smoke-test.sh front <URL-del-frontend> <commit>
# El deploy hook de Render responde al instante y despliega en segundo plano: mientras tanto la versión
# anterior sigue respondiendo 200. Por eso no basta con un 200: se espera hasta que el servicio informe
# el commit recién mergeado. Si no llega en ~10 minutos (o la página no carga), falla y bloquea el paso siguiente.
set -euo pipefail

tipo="${1:?tipo: api o front}"
url="${2:?falta la URL}"
version="${3:?falta el commit}"
version="${version:0:7}"
intentos="${SMOKE_INTENTOS:-30}"
espera="${SMOKE_ESPERA:-20}"

for i in $(seq 1 "$intentos"); do
  if [ "$tipo" = "api" ]; then
    respuesta="$(curl -fsS --max-time 30 "$url/health" || true)"
    if echo "$respuesta" | grep -q '"status":"ok"' && echo "$respuesta" | grep -q "\"version\":\"$version\""; then
      echo "OK: la API responde y ya corre el commit $version"; exit 0
    fi
  else
    respuesta="$(curl -fsS --max-time 30 "$url/" || true)"
    if echo "$respuesta" | grep -q 'id="root"' && echo "$respuesta" | grep -q "name=\"version\" content=\"$version\""; then
      echo "OK: la página carga y ya sirve el commit $version"; exit 0
    fi
  fi
  echo "Intento $i/$intentos: todavía no está el commit $version en $url; reintento en ${espera}s"
  sleep "$espera"
done

echo "::error::Smoke test fallido ($tipo): $url no sirvió el commit $version. No se continúa al siguiente ambiente."
exit 1
