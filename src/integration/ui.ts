import type { IntegrationShow } from "./show";
import { folderPanel, mountFolder } from "./skin-folder";
import { integrationDefaults } from "./config";
export function integrationPanel(section: string, show?: IntegrationShow) {
  if (
    !["Dashboard", "Simulator", "Dancers", "Camera", "Settings"].includes(
      section,
    )
  )
    return "";
  const c = show?.config || integrationDefaults;
  return `<section class="panel"><h2>Filas de 20 · rendimiento</h2><p>Las plazas lógicas siempre son 20 por fila. En vertical, el encuadre por segmentos mantiene cuerpos y nombres legibles. El grupo se encuadra alrededor de la última entrada.</p><label>Personajes cargados (GPU)<select data-integration="gpuBudget">${[20,40,60,80,100].map(n=>`<option value="${n}" ${c.gpuBudget===n?'selected':''}>${n}</option>`).join('')}</select></label><label>Retirar por lote<select data-integration="retireBatch">${[5,10].map(n=>`<option value="${n}" ${c.retireBatch===n?'selected':''}>${n}</option>`).join('')}</select></label><label>Encuadre de grupo<select data-integration="segmentSize">${[3,5,20].map(n=>`<option value="${n}" ${c.segmentSize===n?'selected':''}>${n===20?'Fila completa de 20 (panorámica)':n+' plazas por segmento'}</option>`).join('')}</select></label><p class="hint">Retiro visual con fundido de 1,5 s; identidad, puntos y skin permanecen. Entradas y VIP protegidos pueden superar temporalmente el límite. Una ráfaga se carga en grupos de 6 modelos.</p></section>${entrancePanel(show)}<section class="panel integration-panel"><h2>Presentación · ShowDirector</h2><label>Presentación<select data-integration="artMode"><option value="BASE" ${c.artMode === "BASE" ? "selected" : ""}>Base v0.6.3</option><option value="CONCERT" ${c.artMode === "CONCERT" ? "selected" : ""}>Propuesta concierto</option></select></label><p class="hint">Filas horizontales de 20 plazas, de izquierda a derecha. Cada nuevo espectador detectado presenta su personaje en su lugar. VIP y Fever conservan prioridad de cámara.</p><label class="switch-row">Entrada con materialización<input type="checkbox" data-integration="materialize" ${c.materialize ? "checked" : ""}></label><label>Bailes de fondo<select data-integration="backgroundDance">${[{id:"AUTO",label:"Variedad automática"},{id:"MixamoHipHopLoop",label:"Hip Hop original"},...(show?.catalog||[]).filter(d=>d.role==="dance")].map(d=>`<option value="${d.id}" ${c.backgroundDance===d.id?"selected":""}>${d.label}</option>`).join("")}</select></label><p class="hint">El cartel de bienvenida no muestra etiquetas técnicas. La fuente real o simulada sigue identificada en el panel y los LED.</p><label class="switch-row">Entrada protagonista<input type="checkbox" data-integration="entrance" ${c.entrance ? "checked" : ""}></label><label class="switch-row">Escenario + skins Minecraft<input type="checkbox" data-integration="enabled" ${c.enabled ? "checked" : ""}></label><p class="hint">Phase2 conserva espectadores, eventos, reglas, audio y progreso. Desactivar vuelve al renderer anterior.</p><div class="row"><button data-v05="next">Ver último segmento</button><button data-v05="wide">General</button><button data-v05="hero">Protagonista</button></div><label>Movimiento<select data-integration="motion"><option ${c.motion === "OFF" ? "selected" : ""}>OFF</option><option ${c.motion === "SUAVE" ? "selected" : ""}>SUAVE</option><option value="DINAMICO" ${c.motion === "DINAMICO" ? "selected" : ""}>DINÁMICO</option></select></label><label class="switch-row">Cámara fija · sin acercamientos<input type="checkbox" data-integration="fixed" ${c.fixed ? "checked" : ""}></label><label>Intensidad visual<input type="range" min="0" max="1" step="0.05" value="${c.intensity}" data-integration="intensity"></label><label class="switch-row">Piso y luces en movimiento<input type="checkbox" data-integration="stagePolish" ${c.stagePolish ? "checked" : ""}></label><label class="switch-row">Pantallas LED<input type="checkbox" data-integration="ledWall" ${c.ledWall ? "checked" : ""}></label><details><summary>Participación gratuita</summary>${[["likeDance","Cambio cada 100 likes"],["groupDance","Grupo cada 500 likes"],["idleDance","Cambio tras 60 s sin destacados"]].map(([key,label]) => `<label class="switch-row">${label}<input type="checkbox" data-integration="${key}" ${c[key as "likeDance"] ? "checked" : ""}></label>`).join("")}<p class="hint">Likes recibidos y aceptados; no el total de TikTok. Cooldown 15 s. VIP, Fever y F8 tienen prioridad. Usa Hip Hop y Excited.</p></details><div class="row"><button data-v05="demo">Demo completa</button><button data-v05="record">Grabar 14 s</button></div><p class="hint">La demo reinicia la escena: Follow → VIP → Fever. Probar F8 y Reanudar manualmente. Simulación local, sin TikTok.</p></section>${["Dancers", "Settings"].includes(section) ? `<section class="panel skin-library"><h2>Biblioteca de skins</h2><p class="hint">Elegí una skin para verla de cuerpo completo. Tu biblioteca y las asignaciones se conservan.</p><input id="skin-search" placeholder="Buscar nombre, autor o modelo" aria-label="Buscar skins"><div id="skin-cards"></div><div class="row"><button data-v05="random">Skin aleatoria · vista previa</button><button data-v05="exit-preview">Volver a participantes</button></div>${folderPanel()}<details><summary>Importar PNG 64×64</summary><form id="skin-import"><input id="skin-file" type="file" accept=".png,image/png" required><input id="skin-name" placeholder="Nombre de la skin" required maxlength="64"><select id="skin-model"><option value="classic">Classic · 4 px</option><option value="slim">Slim · 3 px</option></select><input id="skin-author" placeholder="Autor" required maxlength="96"><input id="skin-source" placeholder="Procedencia" required maxlength="256"><input id="skin-license" placeholder="Licencia o permiso" required maxlength="256"><label><input id="skin-authorized" type="checkbox" required> Tengo autorización para usarla</label><label><input id="skin-normalize" type="checkbox"> Convertir semitransparencia a recorte</label><button type="submit">Importar skin</button></form></details><p class="hint">Los originales y su procedencia se archivan al eliminar una entrada. La vista previa no crea un espectador.</p></section>` : ""}`;
}

function entrancePanel(show?: IntegrationShow) {
  const c=show?.config||integrationDefaults;
  const choices=[{id:"MixamoHipHopLoop",label:"Hip Hop original"},{id:"MixamoDance2Loop",label:"Excited"},...(show?.catalog||[])];
  return `<section class="panel stagealive-names"><h2>Stage Alive · bienvenidas y nombres</h2><p>Cada cuenta nueva detectada recibe su baile sin esperar otra bienvenida. La cámara sigue al último entrante y vuelve al grupo del segmento. No se infieren entradas de los totales de audiencia.</p><label>Nombres del fondo<select aria-label="Nombres del fondo" data-integration="backgroundNames">${[['FULL','Completos'],['COMPACT','Simplificados'],['OFF','Ocultos']].map(([key,label])=>`<option value="${key}" ${c.backgroundNames===key?'selected':''}>${label}</option>`).join('')}</select></label><label class="switch-row">Fotos de perfil opcionales<input type="checkbox" data-integration="profilePhotos" ${c.profilePhotos?'checked':''}></label><p class="hint">Sólo si el evento trae una imagen HTTPS de un CDN admitido. Caché limitada y una inicial cuando la imagen falta o falla. Activadas por defecto; si no llega foto, se muestra una inicial.</p></section><section class="panel entrance-settings"><h2>Entrada de nuevos espectadores</h2>
  <p>Elegí el baile que hace cada persona al ingresar. Podés cambiarlo cuando quieras: se guarda automáticamente en este perfil.</p>
  <label>Baile de entrada<select aria-label="Baile de entrada" data-integration="entranceDance" ${show?.ready?"":"disabled"}>${choices.map(d=>`<option value="${d.id}" ${c.entranceDance===d.id?"selected":""}>${d.label}</option>`).join("")}</select></label>
  <label>Duración del aviso Follow<select aria-label="Duración del aviso Follow" data-integration="followSeconds">${[3.5,5,7].map(n=>`<option value="${n}" ${c.followSeconds===n?"selected":""}>${n} segundos</option>`).join("")}</select></label>
  <div class="row"><button data-v05="preview-entrance">Probar baile</button><button data-v05="exit-preview">Volver al espectáculo</button></div>
  <p class="hint">La prueba muestra sólo el baile, sin crear seguidores ni sumar puntos. Los eventos reales y F8 tienen prioridad. Los bailes de fondo se eligen por separado en Presentación.</p>
  <p class="hint">Este menú reúne los bailes ya adaptados. Agregar un FBX nuevo requiere importarlo y comprobar su adaptación una vez; después podrás elegirlo aquí.</p>
  <p id="entrance-choice-status" role="status"></p></section>`;
}

export function drawSkins(show: IntegrationShow) {
  for(const key of ["entranceDance","backgroundDance"] as const){
    const select=document.querySelector<HTMLSelectElement>('[data-integration="'+key+'"]');
    if(!select)continue;
    const choices=[...(key==="backgroundDance"?[{id:"AUTO",label:"Variedad automática"}]:[]),{id:"MixamoHipHopLoop",label:"Hip Hop original"},{id:"MixamoDance2Loop",label:"Excited"},...show.catalog.filter(c=>key==="entranceDance"||c.role==="dance")];
    select.replaceChildren(...choices.map(c=>{const o=document.createElement("option");o.value=c.id;o.textContent=c.label;return o;}));
    select.value=show.config[key];select.disabled=!show.ready;
  }
  const root = document.querySelector("#skin-cards");
  if (!root) return;
  root.replaceChildren();
  const query = (
    document.querySelector<HTMLInputElement>("#skin-search")?.value || ""
  ).toLowerCase();
  for (const skin of show.client.state?.records || []) {
    if (
      !(skin.name + " " + skin.model + " " + skin.provenance[0].author)
        .toLowerCase()
        .includes(query)
    )
      continue;
    const row = document.createElement("div");
    row.className = "skin-card";
    const img = document.createElement("span");
    img.className = "skin-face";
    img.setAttribute("role", "img");
    img.setAttribute("aria-label", "Rostro de " + skin.name);
    const url = "/api/skins/blob/" + skin.hash;
    img.style.backgroundImage = 'url("'+url+'"),url("'+url+'")';
    const choose = document.createElement("button");
    choose.textContent = skin.name + " · " + skin.model;
    choose.dataset.skinPreview = skin.id;
    const remove = document.createElement("button");
    remove.textContent = "×";
    remove.title = "Eliminar " + skin.name;
    remove.dataset.skinDelete = skin.id;
    row.append(img, choose, remove);
    root.append(row);
  }
}
export function mountIntegration(
  show: IntegrationShow,
  toast: (s: string) => void,
  demo: () => void,
  record: () => Promise<void>,
) {
  const guard = (fn: () => Promise<unknown> | void) => {
    Promise.resolve()
      .then(fn)
      .catch((e) => toast(String(e)));
  };
  document.addEventListener("change", (e) => {
    const el = e.target as HTMLInputElement;
    if (el.dataset.integration) {
      show.configure({
        [el.dataset.integration]:
          el.type === "checkbox"
            ? el.checked
            : ["featured", "intensity", "followSeconds", "gpuBudget", "retireBatch", "segmentSize"].includes(el.dataset.integration)
              ? Number(el.value)
              : el.value,
      });
      if(el.dataset.integration==="entranceDance"||el.dataset.integration==="followSeconds"){
        const status=document.querySelector("#entrance-choice-status");
        if(status)status.textContent="Elección guardada automáticamente";
      }
      if (!show.ready && show.config.enabled)
        void show.init().then(() => drawSkins(show));
    }
  });
  document.addEventListener("input", (e) => {
    if ((e.target as HTMLElement).id === "skin-search") drawSkins(show);
  });
  document.addEventListener("click", (e) => {
    const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
    if (!b) return;
    guard(async () => {
      if (b.dataset.skinPreview) {
        show.configure({ enabled: true });
        await show.init();
        await show.preview(b.dataset.skinPreview);
      }
      if (
        b.dataset.skinDelete &&
        confirm(
          "Quitar skin; reasignar espectadores afectados y conservar original/procedencia?",
        )
      ) {
        await show.client.mutate("delete", { id: b.dataset.skinDelete });
        await show.preview();
        drawSkins(show);
      }
      switch (b.dataset.v05) {
        case "preview-entrance":
          b.disabled=true;
          try{
            await show.init();
            await show.previewEntrance();
            toast("Vista previa del baile de entrada; no se generó ningún Follow");
          } finally { b.disabled=false; }
          break;
        case "next":
          show.next();
          break;
        case "wide":
          show.manual = "WIDE";
          await show.preview();
          break;
        case "hero":
          show.manual = "HERO";
          break;
        case "demo":
          demo();
          break;
        case "record":
          b.disabled = true;
          try {
            await record();
          } finally {
            b.disabled = false;
          }
          break;
        case "exit-preview":
          await show.preview();
          break;
        case "random":
          show.configure({ enabled: true });
          await show.init();
          await show.preview(await show.client.mutate("random", {}));
          break;
      }
    });
  });
  document.addEventListener("submit", (e) => {
    if ((e.target as HTMLElement).id !== "skin-import") return;
    e.preventDefault();
    guard(async () => {
      const val = (id: string) =>
          (document.getElementById("skin-" + id) as HTMLInputElement).value,
        checked = (id: string) =>
          (document.getElementById("skin-" + id) as HTMLInputElement).checked,
        file = (document.getElementById("skin-file") as HTMLInputElement)
          .files?.[0];
      if (!file || file.size > 1048576) throw Error("PNG máximo 1 MiB");
      show.configure({ enabled: true });
      await show.init();
      let binary = "";
      for (const x of new Uint8Array(await file.arrayBuffer()))
        binary += String.fromCharCode(x);
      const result = await show.client.mutate("import", {
        name: val("name"),
        model: val("model"),
        author: val("author"),
        source: val("source"),
        license: val("license"),
        authorized: checked("authorized"),
        normalizeAlpha: checked("normalize"),
        png: btoa(binary),
      });
      drawSkins(show);
      await show.preview(result.id);
      toast(
        result.duplicate
          ? "Skin ya existente; original conservado"
          : "Skin importada; original conservado",
      );
    });
  });
  mountFolder(show, toast, () => drawSkins(show));
  if (show.config.enabled) void show.init().then(() => drawSkins(show));
}
