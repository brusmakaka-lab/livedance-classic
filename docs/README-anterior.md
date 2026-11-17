# LiveDance v0.6.14.1 — RowShow Polish

Abrir Iniciar-RowShowPolish.cmd. Captura-RowShowPolish.cmd abre la vista de captura existente. Detener-RowShowPolish.cmd sólo detiene el servidor registrado de esta copia.

Dirección local: http://127.0.0.1:5600. Perfil propio: .profile-rowshow-polish. Datos propios: data-rowshow-polish. Node.js y Microsoft Edge deben estar disponibles. Las dependencias y la compilación se incluyen.

Esta copia conserva la estructura lógica de filas horizontales de 20 y el encuadre por segmentos existente. El presupuesto de GPU y los lotes de 5/10 siguen en sus controles originales. No borra identidad, estadísticas ni plaza al retirar un modelo visual.

Las presentaciones esperan un modelo listo, una plaza válida y un cuerpo dentro del plano. El nombre fijo aparece junto al protagonista visible. Las etiquetas locales siguen la cabeza; la vista secundaria conserva los materiales originales de la skin. Los cambios largos usan un fundido de 0,28 s y el VIP acerca la cámara conservando el cuerpo entero.

Informe y evidencia: docs/rowshow-polish/INFORME.html. Incluye límites de las pruebas; la simulación local no valida un TikTok LIVE.

## Repetir las comprobaciones

- npm test: regresiones de lógica.
- npm run build: compilación de la aplicación.
- npm run test:polish: auditoría continua de la cronología original y casos de carga, filas, VIP y retiro.
- npm run test:polish-extras: nombres, materiales, vista previa y FPS; ejecutar sin otras grabaciones.
- npm run test:polish-avatar: foto de prueba vinculada al ID, duplicados y opción de visualización.
- npm run test:audio-skins: controles existentes de audio y skins en almacenamiento temporal.
- npm run record:polish: comparación completa con la versión 0.6.14; crea una copia de prueba bajo work/polish-baseline sin ejecutar pruebas en la versión original.
- npm run extract:polish: extrae capturas de la grabación y el video limpio. Requiere FFmpeg de Playwright, o definir LIVEDANCE_FFMPEG con su ruta.

La comparación busca la base en E:/LiveDance/LiveDance-v0.6.14-RowShow. LIVEDANCE_POLISH_SOURCE permite otra ubicación. LIVEDANCE_POLISH_BASELINE sólo debe apuntar a una copia temporal aislada ya preparada. Las pruebas usan puertos locales 5604–5607 y datos temporales; no se conectan a TikTok ni generan eventos Join falsos. Los ingresos de la simulación nueva usan eventos COMMENT locales para demostrar la detección existente.

Las ocho observaciones del informe de referencia están documentadas con causa, cambio y evidencia. No se agregan paneles, rankings, fondos, NPC, vehículos ni bailes.
