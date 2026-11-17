import type { IntegrationShow } from "./show";
type FolderStatus = {
  path: string; error: string; lastScan: string | null;
  config: { enabled: boolean; authorized: boolean; normalizeAlpha: boolean; author: string; source: string; license: string };
  results: {file: string;status: string;message?: string;cached?: boolean}[];
};
export function folderPanel() {
  return `<details id="skin-folder"><summary>Importar una carpeta completa</summary>
  <p>Pegá tus PNG 64×64 en <code id="folder-path">Mis-skins</code>. Usá la subcarpeta <strong>slim</strong> para brazos finos; la raíz y <strong>classic</strong> son para brazos clásicos. El acceso «Abrir-carpeta-skins» abre esa carpeta.</p>
  <form id="folder-config"><label>Autor del lote<input name="author" required maxlength="96"></label><label>Procedencia del lote<input name="source" required maxlength="256"></label><label>Licencia o permiso<input name="license" required maxlength="256"></label>
  <label><input name="authorized" type="checkbox" required> Tengo autorización para usar estas skins</label>
  <label><input name="enabled" type="checkbox"> Importar automáticamente cada 10 segundos</label>
  <label><input name="normalizeAlpha" type="checkbox"> Convertir semitransparencia a recorte</label>
  <button type="submit">Guardar ajustes del lote</button></form>
  <div class="row"><button id="folder-scan" type="button">Importar carpeta ahora</button><button id="folder-stop" type="button">Desactivar automático</button></div>
  <p class="hint">Guardá los datos antes de importar. Máximo 1 MiB por PNG y 200 skins en biblioteca. Los originales quedan intactos; archivos repetidos no se duplican. Para otro autor o permiso, cambiá los datos del lote.</p>
  <p id="folder-status" role="status"></p><ul id="folder-results"></ul></details>`;
}
export function mountFolder(show: IntegrationShow, toast: (s: string) => void, redraw: () => void) {
  let polling=false;
  let current: FolderStatus | undefined;
  const paint=(s:FolderStatus)=>{
    current=s;
    const form=document.querySelector<HTMLFormElement>("#folder-config");
    if(!form)return;
    document.querySelector("#folder-path")!.textContent=s.path;
    if(!form.dataset.loaded){
      for(const [key,value] of Object.entries(s.config)){
        const input=form.elements.namedItem(key) as HTMLInputElement;
        if(typeof value==="boolean")input.checked=value;else input.value=value;
      }
      form.dataset.loaded="1";
    }
    const imported=s.results.filter(r=>r.status==="importada").length;
    const errors=s.results.filter(r=>r.status==="rechazado"||r.status==="límite");
    document.querySelector("#folder-status")!.textContent=s.error || `${s.config.enabled?"Automático activo":"Importación manual"} · ${s.lastScan?"Última revisión "+new Date(s.lastScan).toLocaleTimeString():"Sin revisar todavía"} · ${imported} importadas · ${errors.length} rechazadas.`;
    const list=document.querySelector("#folder-results")!;
    list.replaceChildren(...s.results.map(r=>{const li=document.createElement("li");li.textContent=`${r.file}: ${r.status}${r.cached?" (ya revisado)":""}${r.message?" — "+r.message:""}`;return li;}));
  };
  const refresh=async()=>{
    if(polling||!document.querySelector("#folder-config")||!show.ready)return;
    polling=true;
    try {
      const response=await fetch("/api/skins/folder-status");
      if(!response.ok)throw Error("No se pudo consultar la carpeta de skins");
      paint(await response.json());
      const revision=show.client.state?.revision;
      await show.client.refresh();
      if(revision!==show.client.state.revision)redraw();
    }catch(e){const el=document.querySelector("#folder-status");if(el)el.textContent=String(e);}
    finally{polling=false;}
  };
  const act=async(button:HTMLButtonElement,fn:()=>Promise<void>)=>{
    button.disabled=true;try{await show.init();await fn();redraw();}catch(e){toast(String(e));const el=document.querySelector("#folder-status");if(el)el.textContent=String(e);}finally{button.disabled=false;}
  };
  document.addEventListener("submit",e=>{
    if((e.target as HTMLElement).id!=="folder-config")return;
    e.preventDefault();
    const form=e.target as HTMLFormElement,button=form.querySelector("button")!;
    const data=new FormData(form);
    void act(button,async()=>{
      paint(await show.client.mutate("folder-config",{
        author:data.get("author"),source:data.get("source"),license:data.get("license"),
        enabled:data.has("enabled"),authorized:data.has("authorized"),normalizeAlpha:data.has("normalizeAlpha"),
      }));
      toast("Datos del lote guardados");
    });
  });
  document.addEventListener("click",e=>{
    const b=(e.target as HTMLElement).closest<HTMLButtonElement>("#folder-scan,#folder-stop");
    if(!b)return;
    void act(b,async()=>{
      if(b.id==="folder-scan"){paint(await show.client.mutate("folder-scan",{}));toast("Carpeta revisada; consultá el resultado de cada archivo");}
      else if(current){paint(await show.client.mutate("folder-config",{...current.config,enabled:false}));(document.querySelector('#folder-config [name="enabled"]') as HTMLInputElement).checked=false;}
    });
  });
  // One application-wide poll, only reads when the library panel is open.
  window.setInterval(()=>void refresh(),3000);
  void refresh();
}
