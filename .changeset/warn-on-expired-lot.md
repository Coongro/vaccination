---
'@coongro/vaccination': patch
---

fix(vaccination): avisa al aplicar desde un lote vencido

Al descontar el frasco elegido manualmente, se permite usar un lote vencido —el vet ya lo tiene físicamente en la mano, bloquearlo no matchea la realidad— pero ahora **avisa** si el lote estaba vencido (usa `allowExpired` + el flag `expired` que devuelve el motor de lotes de products, COONG-248).
