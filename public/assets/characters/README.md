# Personajes

`afterglow-original.glb`: placeholder humanoide original, generado por `scripts/generate-assets.mjs`. Seis clips: Idle, Walk, Groove, Disco, Shuffle, Wave. Jerarquía articulada con animaciones de transformaciones; no es un humanoide skinned listo para retargeting comercial. +Y arriba, +Z frente, pies cerca de y=0, altura ~2.5 unidades. Sin texturas ni referencias externas.

La escena usa una versión procedural instanciada del mismo diseño (`src/avatars.ts`) para reducir draw calls. `GLBAvatar` demuestra la vía GLTFLoader + AnimationMixer con clones de jerarquía; activarla con un asset externo requiere integración deliberada y medición. No hay importador de modelos por UI en v0.1.

Reemplazo: implementar AvatarVisual, devolver root, update y dispose. Mantener el dominio Dancer independiente. El factory del SceneManager puede sustituirse por el adaptador GLB; añadir root a scene, conservar recursos compartidos hasta destruir el factory, respetar los nombres de clips y probar rendimiento nuevamente.

Origen: creado desde cero para LiveDance. Sin Livecade, Roblox, Minecraft ni descargas. Assets originales ofrecidos bajo CC0-1.0; ver docs/ASSETS.md.
