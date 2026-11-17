import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const read=async f=>JSON.parse((await fs.readFile('docs/v061/'+f,'utf8')).replace(/^\uFEFF/,''));
const [bench,frame,repeat,final,unit,e2e,integration,probe,baseline]=await Promise.all(['benchmark-v06.json','framing-v06.json','confirmation-720-10.json','final-metric.json','unit-results.json','e2e-results.json','integration-results.json','authorized-probe.json','preservation-baseline.json'].map(read));
const changed=[];
for(const entry of baseline){const digest=createHash('sha256').update(await fs.readFile(entry.path)).digest('hex');if(digest!==entry.sha256)changed.push(entry.path);}
const source='E:/LiveDance/LiveDance-v0.5.1-StreamingMVP', files=[];
async function walk(dir){for(const e of await fs.readdir(dir,{withFileTypes:true})){if(['node_modules','temp','logs','test-results'].includes(e.name)||e.name.startsWith('.profile'))continue;const f=path.join(dir,e.name);if(e.isDirectory())await walk(f);else files.push(f);}}
await walk('.');
const modified=[];
for(const f of files){try{if(!(await fs.readFile(f)).equals(await fs.readFile(path.join(source,f))))modified.push(f);}catch{modified.push(f);}}
await fs.writeFile('docs/v061/preservation-result.json',JSON.stringify({checked:baseline.length,changed,modifiedInCopy:modified,nodeModulesTarget:await fs.realpath('node_modules')},null,2));
const fmt=n=>Number(n).toFixed(2), mb=n=>fmt(n/1048576);
const table=bench.rows.map(r=>`|${r.res.join('×')}|${r.n}|${r.cap}|${r.kind}|${fmt(r.fps)}|${fmt(r.p95RAF)}|${fmt(r.cpuMs)}|${r.metrics.drawCalls}|${r.visibleMin}–${r.visibleMax}|`).join('\n');
const report=`# LiveDance v0.6 — informe de entrega

**GO para pruebas locales controladas. NO-GO para declarar conexión real o preparación de streaming.** Falta un LIVE autorizado activo, validar la firma externa y ejecutar follows, likes y regalos reales por separado. No se simuló evidencia de TikTok.

## Entrega y preservación

Carpeta: E:\\LiveDance\\LiveDance-v0.6-ConnectorLab. Versión 0.6.0-connector.1. Launcher Iniciar-v06.cmd / Detener-v06.cmd. Puerto5380, datos data-v06 y perfil .profile-v06-connector propios. v0.5.1 no fue modificada: **${baseline.length} archivos verificados por SHA-256, ${changed.length} cambios**. No se tocaron laboratorios históricos ni FBX.

Dependencias grandes reutilizadas mediante junction; sólo 60 paquetes nuevos del adaptador en E. No portable final, sin nuevas animaciones/personajes/escenario ni LiveForge. Espacio comprobado durante la entrega: aproximadamente25.3GiB en C y102.4GiB en E. El launcher pasó --smoke: servidor, versión, ruta y puerto; ese modo no abre el perfil GUI. El navegador real se probó con Edge mediante harness aislado.

## Implementación

Adaptador Node no oficial tiktok-live-connector2.5.0, seleccionado tras comparar API oficial documentada y TikTokLive Python. Firma Euler Stream aceptada expresamente. [Auditoría y fuentes](AUDIT.md); licencias completas en THIRD-PARTY e inventario en dependency-inventory.json. No se usa contraseña ni se importan cookies del navegador. API key opcional sólo mediante entorno del servidor.

Mapeo v3 con IDs estables, deduplicación, room ID como sesión y rachas convertidas en deltas. Coins del regalo se recalculan con el delta; nickname no cambia la identidad. Likes generan una reacción por mensaje y conservan cantidad para Goals. No se prometen eventos que el proveedor no entregue.

Cola512, dedup4096, lotes32 con ACK hacia EventIngress128/8 por frame. Rachas hasta1000 acumuladas; eventos incompatibles se rechazan con diagnóstico. Reintentos acotados, cooldown/rate-limit, consumidor único y heartbeat. F8 cancela conexión, cola y reintentos; Reanudar vuelve al Simulator. Cerrar otra ventana no debe desconectar al consumidor activo; F8 mantiene prioridad global.

Política local de regalos, documentada en README: valor unitario informado1000+ VIP/HIGH,100–999 NORMAL, menor/desconocido LOW. No es taxonomía oficial. La recuperación usa sistemas existentes; no se añadieron mecánicas.

## Evidencia real y simulada

- Consulta autorizada a **@palermotusi**: **${probe.state}**, duración${fmt(probe.seconds)}s, cero follows/likes/regalos recibidos. Archivo authorized-probe.json. El usuario informó que no estaba en directo.
- La detección offline no ejercita una sesión LIVE firmada. No se verificaron recepción real, entrega real, reconexión real ni compatibilidad regional/cuota en directo.
- **${unit.numPassedTests}/${unit.numTotalTests} tests unitarios**, incluidos10 del conector; source tiktok pasa a estar autorizado por contrato, se conserva rechazo de fuentes desconocidas.
- **${e2e.stats.expected} E2E heredados**, ${e2e.stats.unexpected} fallos: navegación, escenas, audio/playlist, crossfade, ducking, persistencia y controles.
- **${integration.checks.length} comprobaciones integradas con fixtures locales** en la versión final: Follow → actor/skin, duplicados, likes, delta coins, VIP correcto, F8, recuperación,30 identidades/puntuaciones/skins. Se conserva integración-results.json.
- **${frame.frames.length} muestras de transiciones**, aforo20/30 en365×648 y720×1280: ${frame.crops.length} recortes observados,30 participantes conservados. Son muestras, no garantía matemática de todos los frames.
- Selector real de UI y persistencia tras reload comprobados. Video de18s en evidence/SIMULATOR-aforo20-VIP-Fever.webm, sin audio y exclusivamente Simulator. Capturas identificadas como fixtures/simulación.

## Aforo y revisión visual

Selector10/20/30, inicial20, cambia casting/distribución y no el registro ni puntuaciones. VIP puede mostrar menos cuerpos secundarios para mantenerlos enteros; el máximo visual no es promesa de30 en un primer plano.

Se corrigieron dos defectos encontrados por inspección: la niebla ocultaba el elenco al alejar la cámara; ahora su distancia acompaña el encuadre. En la matriz se registró un recorte lateral al terminar VIP30 en HD; ahora también se comprueba el primer bailarín durante el regreso si ya no es protagonista de un evento. El fallo original queda en benchmark-v06.json; la corrección se verificó en framing-v06.json y en la medición final.

**Pendiente artístico:**20/30 comprimen personajes y acumulan nombres/cuerpos en el fondo. Las cajas proyectadas registran superposición; no equivalen a oclusión exacta de píxeles. Las capturas lo confirman visualmente. VIP destaca al protagonista y muestra cabeza/pies; Fever cambia luces/pista/caption sin sonido. No se aprueba calidad artística automáticamente. Recomiendo empezar la evaluación supervisada con10 visibles a365×648;20 sigue siendo el default solicitado y30 una opción experimental.

## Rendimiento

Edge, Intel UHD Graphics vía ANGLE/D3D11, MEDIUM, DPR1, adaptativa desactivada para medir. CPU incluye actualización JS y envío de render, no tiempo GPU. Heap es JS, no VRAM/RAM total. Matriz${bench.rows.length} muestras de5–12s; sin grabación ni cálculo de vértices durante muestras. El primer intento de matriz se detuvo al repetir Fever en cooldown; se separaron casos mediante F8/Reanudar. Los ciclos no sustituyen una prueba AFK prolongada.

|Resolución|Registrados|Aforo|Escenario|FPS|p95 RAF ms|CPU media ms|Draw calls final|Visibles min–max|
|---|---:|---:|---|---:|---:|---:|---:|---:|
${table}

No se oculta la muestra HD/10 a52.80FPS y p9533.40ms. Repetición específica de10s: **${fmt(repeat.fps)}FPS, p95${fmt(repeat.p95RAF)}ms, CPU${fmt(repeat.cpuMs)}ms**. No se reprodujo allí; causa no aislada y no garantiza60FPS con OBS/Live Studio.

Medición de la **compilación final**, VIP30+regreso en720×1280,10s: **${fmt(final.fps)}FPS, p95${fmt(final.p95RAF)}ms, CPU${fmt(final.cpuMs)}ms**, ${final.show.registered.length} registrados, ${final.errors.length} errores. Matriz principal anterior a la última corrección de ocultación durante el retorno; prueba final específica cubre ese cambio.

Tres ciclos llenado/F8/recuperación/vaciado: geometrías${bench.cycles.map(c=>c.metrics.geometries).join(' → ')}, texturas${bench.cycles.map(c=>c.metrics.textures).join(' → ')}, heap tras GC${bench.cycles.map(c=>mb(c.heap)).join(' → ')}MiB; actores/colas vacíos al terminar. Matriz+ciclos duró${fmt(bench.elapsedSeconds)}s. Sin evidencia de fuga gráfica en esos ciclos; no afirma estabilidad por horas.

## Archivos y próximos pasos

Principales archivos nuevos: connector/adapter.mjs, connector/normalize.mjs, connector/package*.json, src/live-connector.ts, tests/connector-v06.test.ts, scripts/*v06.mjs, launchers y docs/v06.

Modificados en la copia: src/domain.ts, ingress.ts, admission.ts, entertainment.ts, main.ts, style.css, integration/config.ts, integration/ui.ts, integration/show.ts, integration/camera.ts, integration/show/show-plan.ts; servidor, configuración de versión/puertos, pruebas de contrato/cámara y README. Lista completa: preservation-result.json → modifiedInCopy. Los scripts heredados se mantienen como referencia; los comandos de v0.6 están en README.

1. Iniciar el LIVE autorizado y abrir este launcher. Comenzar sin demo/participantes ficticios, usando Reiniciar escena antes de conectar si corresponde.
2. Conectar palermotusi, confirmar CONNECTED y recibir una interacción real; verificar por separado Follow, like y regalo, sin automatizar interacciones. Registrar el resultado visual y deduplicación/racha real.
3. Verificar desconexión/reconexión y F8 durante ese LIVE. Si Euler exige clave/cuota o TikTok rechaza el acceso, detener y revisar el proveedor; no usar cookies privadas ni evasiones.
4. Probar captura/audio OBS o TikTok Live Studio y una sesión supervisada prolongada. El ensayo local no valida estas herramientas ni autoriza afirmar streaming listo.

**Bloqueo P0:** no hay LIVE activo ni evento real ejecutado. **P1:** firma/cuota/estabilidad real y prueba de captura/audio. **P2:** legibilidad de20/30 y variación puntual de frame time en HD.
`;
let readable=report;
for(const [before,after] of [
 ['Puerto5380','Puerto 5380'], ['aproximadamente25.3GiB','aproximadamente 25,3 GiB'], ['y102.4GiB','y 102,4 GiB'],
 ['connector2.5.0','connector 2.5.0'], ['Cola512','Cola de 512'], ['dedup4096','deduplicación de 4096'], ['lotes32','lotes de 32'], ['EventIngress128/8','EventIngress 128/8'],
 ['hasta1000','hasta 1000'], ['informado1000+','informado 1000+'], [',100–999',', 100–999'], ['duración'+fmt(probe.seconds),'duración '+fmt(probe.seconds)],
 ['incluidos10','incluidos 10'], ['F8, recuperación,30','F8, recuperación, 30'], ['aforo20/30 en365×648 y720×1280','aforo 20/30 en 365×648 y 720×1280'], ['de18s','de 18 s'],
 ['Selector10/20/30, inicial20','Selector 10/20/30, inicial 20'], ['de30','de 30'], ['VIP30','VIP 30'], ['**Pendiente artístico:**20/30','**Pendiente artístico:** 20/30'],
 ['con10 visibles a365×648;20','con 10 visibles a 365×648; 20'], ['y30','y 30'], ['DPR1','DPR 1'], ['Matriz'+bench.rows.length,'Matriz de '+bench.rows.length], ['de5–12s','de 5–12 s'],
 ['HD/10 a52.80FPS y p9533.40ms','HD/10 a 52,80 FPS y p95 de 33,40 ms'], ['de10s','de 10 s'], ['garantiza60FPS','garantiza 60 FPS'], ['en720×1280,10s','en 720×1280, 10 s'],
 ['geometrías'+bench.cycles[0].metrics.geometries,'geometrías '+bench.cycles[0].metrics.geometries], ['texturas'+bench.cycles[0].metrics.textures,'texturas '+bench.cycles[0].metrics.textures],
 ['GC'+mb(bench.cycles[0].heap),'GC '+mb(bench.cycles[0].heap)], ['duró'+fmt(bench.elapsedSeconds),'duró '+fmt(bench.elapsedSeconds)], ['legibilidad de20/30','legibilidad de 20/30']
 ]) readable=readable.replaceAll(before,after);
await fs.writeFile('docs/v061/REPORT.md',readable);
console.log(JSON.stringify({preserved:baseline.length,changed:changed.length,unit:unit.numPassedTests,e2e:e2e.stats.expected,framing:frame.frames.length,report:'docs/v061/REPORT.md'}));
