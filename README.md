# LiveDance clásico · RowShow Polish · 0.6.14.1

Última variante identificada de la línea clásica: filas de participantes y presentación 3D con cámaras, skins, audio y conector de eventos.

Respaldo del código vigente localizado el **17 de noviembre de 2026**. Estas tres líneas tienen implementaciones diferentes y se conservan por separado. Las carpetas de origen no tenían historial Git: este repositorio inicia un historial del respaldo, sin inventar commits de desarrollo anteriores.

## Funciones y contenido

- Filas horizontales, segmentos, presupuesto de GPU, presentación de participantes y primeros planos.
- Motor 3D en TypeScript/Three.js, biblioteca de skins, modelos y clips locales.
- Servidor Node local con biblioteca musical, importación de skins y controles de origen/sesión.
- Adaptador TikTok en `connector/`, con su propio package.json y lockfile.
- Fuentes de arte, pruebas unitarias, scripts de revisión visual y licencias en `THIRD-PARTY/`.

**Tecnologías:** TypeScript · Vite · Three.js · Node.js · Vitest · Playwright. Las versiones exactas están fijadas en los lockfiles. No hay que usar un monorepo ni copiar `node_modules` de otra aplicación para restaurar este proyecto.

## Instalar y ejecutar

Entorno verificado: Node.js 24.13.1, npm 11.8.0 y Microsoft Edge en Windows. Las dos variantes recientes requieren Node >=22.10.0. Configurar valores propios a partir de `.env.example` cuando exista; para una primera prueba mantener deshabilitada la conexión TikTok y no cargar claves reales.

```bash
npm ci
npm --prefix connector ci
npm test
npm run build
npm start
```

El servidor de `npm start` usa 5580 por defecto y sirve `dist/`. `LIVEDANCE_PORT` permite elegir otro puerto local. El lanzador histórico `Iniciar-RowShowPolish.cmd` usa su perfil y puerto propios; debe ejecutarse sólo después de instalar y compilar.

`LIVEDANCE_PORT`, `LIVEDANCE_DATA_DIR` y `LIVEDANCE_SKIN_DIR` controlan el servidor y almacenamiento. El directorio de skins debe permanecer dentro de esta copia. La conexión TikTok se inicia desde el estudio y requiere configuración del proveedor; no hay credenciales incorporadas.

La instalación normal de Electron puede descargar su ejecutable. En la verificación automatizada se usó `npm ci --ignore-scripts` y Edge, por lo que ese ejecutable no es parte del respaldo ni de la prueba de navegador. Blender y los importadores de animación son herramientas opcionales para reeditar recursos, no requisitos para servir la escena existente.

## Validación

Suite de **331 pruebas**; más un ensayo en servidor y navegador aislados. Los tests unitarios y la compilación se ejecutan desde la copia de respaldo. El ensayo de navegador verifica arranque del build y una simulación local de participante y reinicio. Algunos scripts históricos dependen de otras carpetas de E:/LiveDance o de bibliotecas personales; no constituyen pruebas portables del respaldo. No se ejecutaron todos esos scripts ni se validó una emisión real.

Ver [VALIDACION-GITHUB.md](VALIDACION-GITHUB.md) para el alcance. Los recuentos viejos de documentos históricos no sustituyen la verificación actual.

## Preparación de este respaldo

Se conservó el código de 0.6.14.1 y su conector. Se excluyeron perfiles, bibliotecas personales, logs y resultados generados. El README anterior está en `docs/README-anterior.md`: sus menciones de dependencias/build incluidos son históricas; este respaldo requiere instalación y compilación.

No se incluye música personal, `.env` privado, claves DPAPI, sesiones LIVE, perfiles de captura/navegador, logs ni grabaciones de pruebas. El catálogo público Roblox y sus dependencias estáticas seleccionadas son fixtures versionados; el resto de su caché de operación queda fuera. Los originales de esos datos siguen en su equipo y requieren un respaldo privado antes de limpiar carpetas.

Los scripts históricos de diagnóstico/mantenimiento pueden mencionar rutas de la máquina original o un servicio activo. No ejecutarlos indiscriminadamente durante una emisión. La instalación/arranque anterior y los tests locales son el punto de entrada documentado para una copia nueva.

## Recursos y atribuciones

Se conservan los archivos de procedencia, créditos y licencias existentes junto a los recursos de terceros. Los modelos/avatares públicos conservan su autoría y los términos de su fuente; este respaldo no los presenta como creaciones propias ni cambia su licencia. Las escenas no son productos oficiales de Roblox, Minecraft ni TikTok. Los clips aportados al proyecto conservan la procedencia indicada en su documentación.

## Otras líneas

| Repositorio | Línea |
| --- | --- |
| [livedance-roblox](https://github.com/brusmakaka-lab/livedance-roblox) | Pasarela Roblox 0.15.13 |
| [livedance-minecraft](https://github.com/brusmakaka-lab/livedance-minecraft) | Dance Party Minecraft 1.27.0 |
| [livedance-classic](https://github.com/brusmakaka-lab/livedance-classic) | RowShow Polish 0.6.14.1 |


Las versiones clásicas anteriores, SkinLab y otros laboratorios de E:/LiveDance necesitan una comparación independiente; este repositorio no los reemplaza ni autoriza borrarlos.
