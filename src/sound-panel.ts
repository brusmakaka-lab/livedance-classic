import type { AudioManager } from './audio';
import { soundSlots } from './event-sounds';
const esc = (s: string) => s.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]!));
export function eventSoundsPanel(a: AudioManager) {
  return `<section class="panel"><h2>Sonidos de eventos</h2><label class="switch-row">Avisos sonoros<input id="event-sounds-enabled" type="checkbox" ${a.customSounds.enabled?'checked':''}></label><p class="hint">Podés silenciar los avisos sin detener la música. Archivos propios o autorizados: MP3, WAV u OGG · hasta 8 s y 512 KiB. Se guardan en este perfil.</p><details><summary>Personalizar entrada, Follow y regalos</summary>${Object.entries(soundSlots).map(([slot,label])=>`<div class="field"><label for="sound-${slot}">${label}</label><input id="sound-${slot}" data-sound-file="${slot}" type="file" accept=".mp3,.wav,.ogg"><small data-sound-name="${slot}">${esc(a.customSounds.name(slot))}</small><div class="row"><button data-sound-test="${slot}">Probar ${label}</button><button data-sound-reset="${slot}">Usar original</button></div></div>`).join('')}</details></section>`;
}
export function mountSoundControls(a: AudioManager, toast: (s: string) => void) {
  const refresh = (slot: string) => { const el=document.querySelector(`[data-sound-name="${slot}"]`); if(el)el.textContent=a.customSounds.name(slot); };
  document.addEventListener('change', async e => {
    const el=e.target as HTMLInputElement;
    try {
      if(el.id==='event-sounds-enabled'){a.customSounds.setEnabled(el.checked);if(!el.checked)a.stopEffects();}
      if(el.dataset.soundFile && el.files?.[0]){await a.unlock();await a.customSounds.import(el.dataset.soundFile,el.files[0],a.context!);refresh(el.dataset.soundFile);toast('Sonido guardado para este evento');el.value='';}
    } catch(err){if(el.id==='event-sounds-enabled')el.checked=a.customSounds.enabled;toast(String((err as Error).message));}
  });
  document.addEventListener('click',async e=>{
    const b=(e.target as HTMLElement).closest<HTMLElement>('button');if(!b)return;
    try {
      if(b.dataset.soundTest){await a.unlock();a.sound(b.dataset.soundTest);toast('Si no se escucha, activá audio y Avisos sonoros; revisá el volumen de Efectos.');}
      if(b.dataset.soundReset){a.stopEffects();a.customSounds.remove(b.dataset.soundReset);refresh(b.dataset.soundReset);}
    }catch(err){toast(String((err as Error).message));}
  });
}
