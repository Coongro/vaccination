---
'@coongro/vaccination': patch
---

El manifest declara qué métodos del repositorio son actions.

Sin esa lista el runtime escanea la clase compilada y registra lo que encuentre,
así que un método interno nuevo se volvía una action publicada sin que nadie lo
decidiera. La lista positiva es ahora la autoridad: lo que no está declarado, no
se expone.
