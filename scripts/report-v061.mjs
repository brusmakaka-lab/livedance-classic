import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const root='E:/LiveDance/LiveDance-v0.6.1-PostLive/',src='E:/LiveDance/LiveDance-v0.6-ConnectorLab/';
const read=p=>JSON.parse(fs.readFileSync(root+p,'utf8').replace(/^\uFEFF/,''));
const write=(p,s)=>fs.writeFileSync(root+p,s);
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex').toUpperCase();
const baseline=read('docs/v061/source-baseline.json');
const changedOriginal=baseline.filter(x=>hash(src+x.path)!==x.hash);
write('docs/v061/preservation-result.json',JSON.stringify({checked:baseline.length,changedOriginal},null,2));
function files(dir,base=''){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isSymbolicLink()?[]:e.isDirectory()?files(path.join(dir,e.name),base+e.name+'/'):[base+e.name]);}
const changed=[];
for(const d of ['src','tests','scripts','connector'])for(const p of files(root+d,d+'/'))if(!fs.existsSync(src+p)||hash(src+p)!==hash(root+p))changed.push(p);
for(const p of ['index.html','package.json','package-lock.json','vite.config.ts','playwright.config.ts','README.md','Iniciar-v061.cmd','Captura-v061.cmd','Detener-v061.cmd'])changed.push(p);
write('docs/v061/modified-files.json',JSON.stringify(changed,null,2));
const units=read('docs/v061/unit-results.json'),integration=read('docs/v061/integration-results.json'),free=read('docs/v061/free-dance-results.json'),capture=read('docs/v061/capture-diagnosis.json'),e2e=read('docs/v061/e2e-results.json');
const table=free.metrics.map(r=>`| ${r.size.width}×${r.size.height} | ${r.n} | ${r.fps.toFixed(2)} | ${r.p95.toFixed(1)} | ${r.cpuMs.toFixed(2)} | ${r.snapshot.drawCalls} | ${(r.heap/1048576).toFixed(1)} |`).join('\n');
const captureTable=capture.rows.filter(r=>!r.mitigation&&r.frameDelta!==undefined).map(r=>`| ${r.label} | ${r.frameDelta} | ${r.capture.sinceFrameMs} |`).join('\n');
const report=`# LiveDance v0.6.1 — post-LIVE / P0 y P1

Versión: 0.6.1-postlive.1. Copia independiente: E:\\LiveDance\\LiveDance-v0.6.1-PostLive.
Puerto 5390; data-v061; perfil .profile-v061-postlive. Sin TikTok real conectado durante esta iteración. Sin dependencias nuevas ni copias de node_modules: dos junctions reutilizan las existentes; no eliminar las carpetas proveedoras.

## Diagnóstico P0

El usuario reporta captura de ventana TikTok Live Studio funcionando en Vista limpia aunque LiveDance esté tapado. No reporta haberlo minimizado. Su conexión, Follow, likes, música, F8 y reconexión reales son evidencia aportada por el usuario de v0.6; no una nueva validación automática. Regalos reales siguen pendientes.

Prueba controlada: Edge visible, una pantalla física de 1536×864, 10 participantes ficticios, otra ventana opaca maximizada encima. Cada muestra dura 7 s. No es una captura de TikTok Studio. Se usaron los flags existentes de v0.6 y los defaults de Playwright; la prueba no equivale exactamente al launcher manual.

| Estado | Frames en 7 s | ms desde último frame al consultar |
|---|---:|---:|
${captureTable}

Tapar la ventana NO reprodujo congelamiento, ni en Dashboard ni en Vista limpia. Minimizar redujo RAF aproximadamente a 1 FPS; visibilityState seguía diciendo visible. La restauración recuperó el render. Por eso el diagnóstico ahora observa frames, huecos RAF, visibilidad, foco, modo limpio y tamaños CSS/buffer, sin añadir otro bucle de simulación. Historial acotado a 24 incidencias.

Se probó CalculateNativeWinOcclusion desactivado: no resolvió la minimización ni aportó una mejora decisiva al tapar. Se retiró del launcher final. Se mantienen sus flags anteriores, sin cambios globales de Edge, PATH o registro.

La CSS anterior imponía altura de ventana y limitaba ancho por separado: al estrechar podía deformar 9:16. Se corrigió a las dimensiones máximas que caben conservando proporción. Prueba estrecha 300×900: PASS. Captura-v061.cmd abre directamente Vista limpia. No se reconstruyó el renderer.

Conclusión: corrección de proporción validada; causa específica de la fuente TikTok Studio todavía NO confirmada. Si el renderer sigue avanzando mientras la previsualización de Studio está estática, el fallo está después del renderer (fuente/captura/recorte). No afirmar que el congelamiento original quedó resuelto.

## Likes y participación gratuita

SDK instalado tiktok-live-connector 2.5.0/protobuf v3: WebcastLikeMessage.count es la cantidad del mensaje; total es un contador agregado de sala y string. El panel anterior incrementaba counts.like una vez por mensaje y lo rotulaba likes. Ahora muestra unidades observadas y número de mensajes por separado, acumulados durante la vida del servidor. El 36 anterior pudo ser 36 mensajes; no hay payloads históricos guardados para reconstruir el total real. No se rellenan likes faltantes usando total.

P1 recibe EventBus después de EventIngress: sólo eventos entregados/deduplicados. Cada source + sessionId tiene contador separado (hasta ocho sesiones en memoria); reconectar a la misma sala conserva el observado, recargar la página inicia un contador nuevo. No se mezclan Simulator y LIVE. Los recibidos por el servidor pueden superar los entregados si hubo caducidad o rechazo; diagnósticos de ingreso lo muestran. Los puntos, identidades y skins mantienen su sistema anterior.

- Cada 100: selección entre Hip Hop y Excited; con sólo dos clips, una vez seleccionado el primero se alterna para evitar repetición inmediata. Transición existente de 450 ms.
- Cada 500: grupo Excited durante 12 s, sincronizando actores visibles. No añade coreografías.
- Tras 60 s activos renderizados sin eventos destacados: cambio automático. Sin recuperación masiva del tiempo minimizado.
- Cooldown 15 s, una sola petición pendiente coalescida, caduca a los 30 s. Un lote grande no genera cientos de acciones; el umbral de grupo prevalece.
- Follow/regalos/VIP/Fever tienen prioridad sobre automatismos. VIP/Fever interrumpen el grupo. F8 congela mixers y descarta pendientes; Reanudar es explícito. Cambiar LIVE/Simulator también descarta pendientes.
- Tres interruptores persistentes en Dashboard/Simulator/Camera/Settings → Participación gratuita. Activos por defecto. Ninguna modificación al contrato del proveedor ni al scoring por likes de Phase2.

Comentarios: el SDK tiene evento chat, pero no se verificó recepción real ni comportamiento de moderación/duplicación. !baile queda como propuesta futura; no se escucha ni se ejecuta.

## Validación

- Build TypeScript/Vite: PASS; warning preexistente de bundle mayor a 500 kB, sin añadir bibliotecas.
- Unitarias: ${units.numPassedTests}/${units.numTotalTests}; ${units.numFailedTests} fallos. Incluye siete nuevas y adaptación del mock anterior al nuevo director.
- Regresión de conector con fixtures: ${integration.checks.length} comprobaciones, ${integration.browserErrors.length} errores. Follow, duplicados, gifts acumulativos, VIP, F8, aforo, Fever, skins.
- P1 navegador: ${free.checks.length} comprobaciones, ${free.errors.length} errores. Umbrales, sincronía, VIP, F8, persistencia y proporción estrecha.
- E2E focalizadas: ${e2e.stats.expected} esperadas correctas, ${e2e.stats.unexpected} inesperadas, ${e2e.stats.skipped} omitidas. Audio secuencial/crossfade, ducking VIP y ajustes/Vista limpia. No se volvió a ejecutar la totalidad de las 17 E2E históricas.
- Launcher smoke: puerto, versión, raíz y perfil propios comprobados. No representa captura/audio reales.
- Conservación: ${baseline.length} archivos originales cotejados SHA-256, ${changedOriginal.length} cambios. Ver preservation-result.json. FBX, rigs y assets no se editaron.

Rendimiento MEDIUM, Edge headless/GPU local, DPR1, aforo por defecto20, 1/10/30 registrados (30 no significa 30 visibles), ventanas de 5 s por caso. Sin captura TikTok activa. CPU es tiempo de trabajo del frame JS, heap es JS, no VRAM.

| Resolución | Registrados | FPS | p95 RAF ms | CPU ms | Draw calls | Heap MiB |
|---|---:|---:|---:|---:|---:|---:|
${table}

Son muestras breves, no prueba de estabilidad prolongada ni benchmark con Studio capturando. No hay evidencia nueva suficiente para afirmar ausencia de fugas durante horas. Los cambios no crean nuevas texturas, geometrías ni timers periódicos.

Revisión visual de capturas: escena y personajes visibles después de restaurar; pies/cabeza del protagonista visibles; barras laterales esperables cuando la ventana es horizontal. Persisten superposiciones de bailarines de fondo propias del escenario anterior. No se rediseñó ni se aprobó calidad artística.

## Procedimiento manual y pendientes

1. Cerrar la ventana de v0.6 antes de probar v0.6.1. No mezclar dos instancias controlando el mismo LIVE.
2. Abrir Iniciar-v061.cmd, conectar sólo durante un LIVE autorizado; usar Vista limpia en ESA misma ventana. Alternativa desde cero: Captura-v061.cmd, Escape para configurar/conectar y volver a Vista limpia. No abrir el acceso de captura como segunda instancia de una sesión ya activa.
3. En Studio, seleccionar de nuevo la ventana v0.6.1; el puerto/perfil y título son nuevos. Ajustar recorte a la región vertical después de fijar modo y tamaño. Mantener ventana restaurada, aunque tapada; no minimizar.
4. Comparar visualización 10 s destapada/tapada y Dashboard/Vista limpia. Si Studio deja de actualizar, consultar window.__LiveDance.capture() o exportar diagnóstico después de restaurar. Frames avanzando + captura estática apunta a la fuente de Studio; frames detenidos apunta al navegador/render. Registrar modo, tamaño y método de captura disponible; no cambiar varias opciones a la vez.
5. Verificar audio real una sola vez en la mezcla y regalo real por separado. Probar los umbrales con likes reales; el total mostrado por TikTok puede diferir del subconjunto recibido por el conector no oficial.

GO para ensayo local y siguiente prueba supervisada. NO-GO para dar por resuelto el incidente específico de captura o certificar streaming sin supervisión. P2 LED omitido deliberadamente para preservar presupuesto.

## Evidencia y archivos

capture-diagnosis.json, free-dance-results.json, integration-results.json, unit-results.json, e2e-results.json, preservation-result.json, modified-files.json y evidence/*.png. Las capturas de esta entrega son fixtures locales. No se realizó un nuevo LIVE ni se grabó video de Studio.

Archivos de implementación principales: connector/adapter.mjs; src/live-connector.ts; src/integration/free-dance.ts, show.ts, config.ts, ui.ts; src/capture-diagnostics.ts; src/main.ts; src/style.css; scripts/launch-v05.mjs y server.mjs. Resto: configuración de versión/puertos, launchers, pruebas y reportes. Listado completo en modified-files.json.

Fuentes: protocolo instalado connector/node_modules/tiktok-live-proto/dist/node/v3.d.ts; [conector Node](https://github.com/zerodytrash/TikTok-Live-Connector); [flags documentados por GoogleChrome](https://github.com/GoogleChrome/chrome-launcher/blob/main/docs/chrome-flags-for-tools.md). El protocolo instalado, no los ejemplos antiguos de README, determina los nombres count/total usados. Licencias conservadas en THIRD-PARTY; no se añadieron assets ni proveedores.
`;
write('docs/v061/REPORT.md',report);
write('README.md',`# LiveDance v0.6.1 — Post-LIVE experimental\n\nBase preservada: v0.6-ConnectorLab.\n\n- Iniciar-v061.cmd: aplicación, http://127.0.0.1:5390.\n- Captura-v061.cmd: arranque directo en Vista limpia (usar con la ventana anterior cerrada).\n- Detener-v061.cmd: detener únicamente este servidor.\n- F8: emergencia; Reanudar explícitamente.\n- Participación gratuita: interruptores en Dashboard/Simulator/Camera/Settings.\n\nNo minimizar durante captura. Las pruebas no certifican el incidente de TikTok Live Studio como resuelto. Regalos reales pendientes. Perfil nuevo: reconfigurar preferencias de navegador; música/skins copiadas a data-v061, sin copiar el perfil antiguo. Dependencias compartidas mediante junctions: no eliminar las carpetas proveedoras.\n\nVer [informe, resultados y procedimiento](docs/v061/REPORT.md).\n\nPruebas: npm test; npm run build; node scripts/validate-v061.mjs; node scripts/validate-v06.mjs. Eventos ficticios, sin conexión TikTok. El script probe-live-v06.mjs heredado sí contacta al proveedor: no se ejecutó en esta iteración.\n`);
if(changedOriginal.length)throw Error('Original source changed; inspect preservation result');
console.log(JSON.stringify({units:units.numPassedTests,e2e:e2e.stats,originalsChecked:baseline.length,changedOriginal:changedOriginal.length,modified:changed.length}));
