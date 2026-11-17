# Verificación del respaldo · 2026-11-17

## Fuente

Proyecto LiveDance clásico · RowShow Polish, versión 0.6.14.1. Copia actual de los archivos seleccionados, sin historial Git previo. Se conservó el código de 0.6.14.1 y su conector. Se excluyeron perfiles, bibliotecas personales, logs y resultados generados. El README anterior está en `docs/README-anterior.md`: sus menciones de dependencias/build incluidos son históricas; este respaldo requiere instalación y compilación.

## Controles previos a publicar

Instalación desde lockfile con `npm ci --ignore-scripts`, suite de 331 pruebas y ensayo local en Edge con solicitudes externas bloqueadas. En el clásico también se compila TypeScript/Vite y se instala el lockfile del conector. Los temporales de estos procesos de verificación se crean en la copia de trabajo de E:, sin cambiar TEMP/TMP globales. Esto permite conservar la reserva de disco de 5 GiB exigida por el escritor de caché Roblox.

Los tests unitarios y la compilación se ejecutan desde la copia de respaldo. El ensayo de navegador verifica arranque del build y una simulación local de participante y reinicio. Algunos scripts históricos dependen de otras carpetas de E:/LiveDance o de bibliotecas personales; no constituyen pruebas portables del respaldo. No se ejecutaron todos esos scripts ni se validó una emisión real.

## Archivos privados y reproducibilidad

Se seleccionan código, lockfiles, recursos estáticos, licencias y fuentes de arte requeridas por los tests. Se excluyen claves, configuración privada, sesiones, perfiles, música personal, dependencias y derivados. Algunos informes históricos y sus capturas no se incluyen. Se conserva el estado y los hashes de los archivos originales en el inventario privado del propietario.

## Comprobación remota exigida

Antes de publicar se revisa con Gitleaks la selección y cada commit, comprobando el número real de commits analizados. La subida usa un repositorio público nuevo sin forzar historial. Se compara el árbol remoto completo y después se clona desde GitHub en otra carpeta, se reinstala desde los lockfiles y se repiten pruebas, compilación cuando corresponde y ensayo de navegador. La evidencia final se registra en el inventario local; este documento no anticipa resultados de pasos aún pendientes.

No se borró, movió ni reconfiguró la aplicación original. La recuperación del código no implica que los datos privados y medios excluidos estén respaldados.
