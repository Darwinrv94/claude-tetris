---
description: Crea un git worktree aislado en .trees/[nombre] y ejecuta ahí el requerimiento
argument-hint: <requerimiento a implementar en el worktree>
---

Requerimiento recibido: $ARGUMENTS

Sigue estos pasos en orden:

1. **Determina el nombre.** Deriva un nombre corto en kebab-case (minúsculas, sin acentos, 2-4 palabras, solo `a-z0-9-`) a partir del requerimiento. Ejemplo: "agregar pausa con tecla P" -> `pausa-tecla-p`. Si `.trees/[nombre]` ya existe, añade un sufijo (`-2`, `-3`).

2. **Prepara el repo.** Si `.trees/` no está en `.gitignore`, agrégalo (una línea `.trees/`) para que los worktrees no se rastreen.

3. **Crea el worktree** desde la raíz del repo:

   ```bash
   git worktree add .trees/[nombre]
   ```

   Si falla, reporta el error exacto y detente. No uses `--force`.

4. **Ejecuta el requerimiento de forma aislada.** Lanza un subagente (Agent tool, `general-purpose`) con un prompt autocontenido que incluya:
   - El requerimiento completo, textual.
   - La ruta absoluta del worktree (`<raíz-del-repo>/.trees/[nombre]`).
   - Regla estricta: leer, editar y ejecutar comandos SOLO dentro de esa ruta. Nunca tocar el directorio principal ni otros worktrees. Usar rutas absolutas dentro del worktree y `git -C <ruta>` para git.
   - Seguir las convenciones de `CLAUDE.md` (también existe dentro del worktree).
   - Al terminar: hacer commit en la rama del worktree con un mensaje descriptivo. No hacer push ni merge.

5. **Reporta** en pocas líneas: nombre del worktree, ruta, rama, resumen de cambios y commit. Indica cómo integrarlo (`git merge [nombre]`) y cómo eliminarlo (`git worktree remove .trees/[nombre]`). No integres ni elimines nada sin que el usuario lo pida.
