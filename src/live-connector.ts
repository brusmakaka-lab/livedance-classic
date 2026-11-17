import type { AdmissionGate } from './admission';
import type { IngressPacket } from './ingress';
type Status = { state: string; queue?: number; counts?: Record<string, number>; logs?: { code: string }[]; events?: { sequence: number; packet: IngressPacket }[] };
export function mountLiveConnector(gate: AdmissionGate, prepare: () => void) {
  const panel = document.createElement('section');
  panel.className = 'panel live-connector';
  panel.innerHTML = `<details open><summary>TikTok LIVE · conector experimental</summary><p class="hint">Entrada automática al recibir member/join con ID. Alternativas: seguir, comentar, regalar o dar likes identificados. TikTok puede omitir eventos; no se garantiza detectar cada entrada. F8 desconecta; Reanudar vuelve al Simulador.</p><div class="row"><label>Canal autorizado <input id="live-user" value="palermotusi" maxlength="24" autocomplete="off"></label><button id="live-connect">Conectar LIVE</button><button id="live-disconnect">Volver al Simulador</button><button id="live-diagnostics">Guardar diagnóstico</button></div><p id="live-status" role="status">SIMULADOR · sin conexión real</p><details><summary>Diagnóstico de eventos</summary><pre id="live-diagnostic-detail"></pre></details></details>`;
  document.querySelector('.topbar')!.after(panel);
  const output = panel.querySelector<HTMLElement>('#live-status')!;
  const connect = panel.querySelector<HTMLButtonElement>('#live-connect')!;
  const owner = crypto.randomUUID();
  let token = '', active = false, epoch = 0, ack = 0, rejected = 0, status: Status = { state: 'DISCONNECTED' }, busy = false, lastError = '', starting = false;
  async function request(route: string, body?: unknown) {
    if (!token) { const r = await fetch('/api/session'); token = (await r.json()).token; }
    const r = await fetch('/api/live/' + route, { method: body ? 'POST' : 'GET', headers: { 'Content-Type': 'application/json', 'x-livedance-token': token }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(6000) });
    const data = await r.json();
    if (!r.ok) throw Error(data.error || 'Fallo del servidor local');
    return data;
  }
  function draw(error = '') {
    if (error) lastError = error;
    const mode = active ? 'TIKTOK · ' + status.state : 'SIMULADOR';
    const counts = status.counts;
    output.textContent = lastError || `${mode} · aceptados: ${counts ? `entradas ${(counts.member || 0) + (counts.join || 0)}, comentarios ${counts.chat || 0}, follow ${counts.follow}, likes ${counts.likeUnits || 0}, regalos ${counts.gift} · rechazados ${counts.invalid || 0}, duplicados ${counts.duplicate || 0}, likes sin ID ${counts.anonymousLikes || 0}` : '0'} · cola ${status.queue || 0} · ${status.logs?.at(-1)?.code || 'sin evidencia LIVE'}`;
    panel.querySelector('#live-diagnostic-detail')!.textContent = JSON.stringify({ connector: status, ingress: gate.ingress.inspect() }, null, 2);
    document.querySelectorAll('.sim-badge').forEach(el => { el.textContent = mode; });
    const note = document.querySelector('.bottom-note > span');
    if (note) note.textContent = active ? 'CONECTOR NO OFICIAL · EVENTOS DEL CANAL SELECCIONADO' : 'SIMULADOR LOCAL · EVENTOS FICTICIOS';
    const version = document.querySelector('.version'); if (version) version.textContent = 'STUDIO / v0.6.12 STAGE ALIVE · ' + mode;
    connect.disabled = active || gate.paused;
  }
  async function stop(emergency = false) {
    prepare();
    lastError = '';
    epoch++; active = false; starting = false; gate.source = 'simulator';
    gate.ingress.pause(); if (!gate.paused) gate.ingress.resume();
    draw();
    try { status = await request('disconnect', {owner, emergency}); draw(); }
    catch { draw('Entrada local detenida. Servidor sin respuesta; su conexión caduca sin heartbeat en 15 s.'); }
  }
  connect.onclick = async () => {
    if (gate.paused) return;
    lastError = '';
    prepare(); gate.ingress.pause(); gate.ingress.resume(); gate.source = 'tiktok';
    active = true; starting = true; ack = rejected = 0; const mine = ++epoch; status = { state: 'CONNECTING' }; draw();
    try {
      const result = await request('connect', { username: panel.querySelector<HTMLInputElement>('#live-user')!.value, owner });
      if (mine !== epoch) return;
      starting = false; status = result; draw();
    } catch (e) {
      if (mine !== epoch) return;
      active = false; starting = false; gate.source = 'simulator'; draw(String(e));
    }
  };
  panel.querySelector<HTMLButtonElement>('#live-disconnect')!.onclick = () => { void stop(); };
  panel.querySelector<HTMLButtonElement>('#live-diagnostics')!.onclick = async () => {
    try {
      const server = await request('status');
      const app = (window as any).__LiveDance?.inspect();
      const show = (window as any).__V05?.inspect();
      const payload = { version: '0.6.12-stagealive.1', at: new Date().toISOString(), server, ingress: gate.ingress.inspect(), spawn: app?.spawn, events: app?.events, dancers: app?.dancers, errors: app?.errors, actors: show?.actors, spotlight: show?.spotlight, labels: show?.labels, registered: show?.registered, failure: show?.failure };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }));
      const link = document.createElement('a'); link.href = url; link.download = 'LiveDance-diagnostico.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch { draw('No se pudo guardar el diagnóstico. Revisá la conexión local.'); }
  };
  const timer = setInterval(async () => {
    if (busy) return;
    draw(); if (!active || starting) return;
    busy = true; const mine = epoch;
    try {
      const result: Status = await request('poll', { owner, ack, rejected });
      if (mine !== epoch || !active) return;
      status = result; rejected = 0;
      for (const row of result.events || []) {
        const verdict = gate.ingress.submit(row.packet);
        if (['full', 'rate_limited'].includes(verdict.reason)) break; // ACK only handled prefix; retry rest.
        ack = row.sequence;
        if (!verdict.accepted && verdict.reason !== 'duplicate') rejected++;
      }
      draw();
    } catch (e) { if (mine === epoch) { await stop(); draw('Conexión local interrumpida: ' + String(e)); } }
    finally { busy = false; }
  }, 250);
  window.addEventListener('pagehide', () => { clearInterval(timer); void stop(); });
  // Block simulator controls while receiving LIVE; the admission gate also blocks background producers.
  document.addEventListener('click', e => {
    if (!active) return;
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-action], [data-v05], [data-event]');
    if (!target) return;
    const action = target.dataset.action || target.dataset.v05 || target.dataset.event || '';
    if (/demo|spam|stress|reset|join|follow|gift|like|bulk|simulate|send/i.test(action)) { e.preventDefault(); e.stopImmediatePropagation(); }
  }, true);
  return { stop, inspect: () => ({ active, ack, status }) };
}
