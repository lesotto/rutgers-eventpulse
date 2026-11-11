/* Rutgers EventPulse — FuzeBox demo. Static, no backend. */
(() => {
const RU = window.RU, V = RU.venue;
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icons = () => window.lucide && lucide.createIcons();
const ext = (u, l) => `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(l)}</a>`;
const TZ = 'America/New_York';
const fT = d => new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: '2-digit' }).format(d);
const fD = d => new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' }).format(d);
const R = 6371000, rad = x => x * Math.PI / 180;
const dist = (a, b) => { const dl = rad(b.lat - a.lat), dg = rad(b.lng - a.lng); const h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dg / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
const fmtDist = m => m < 1000 ? `${Math.round(m * 3.281 / 10) * 10} ft` : `${(m / 1609).toFixed(m < 16000 ? 1 : 0)} mi`;
const gmaps = (lat, lng, mode = 'walking') => `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=${mode}`;
const BASE = location.origin + location.pathname.replace(/index\.html$/, '');
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('ru_' + k)) ?? d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('ru_' + k, JSON.stringify(v)); } catch (e) { } }
};
let toastT; function toast(t) { const el = $('#toast'); el.textContent = t; el.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => el.classList.remove('show'), 2600); }

const games = RU.games.map(g => ({ ...g, d: new Date(g.date) }));
const now = () => new Date();
const nextGame = () => games.find(g => g.d.getTime() + 4 * 3600e3 > now().getTime()) || games[games.length - 1];
const poiById = id => V.pois.find(p => p.id === id);
const wpById = id => RU.watch.find(w => w.id === id);
const CATS = { gate: ['Gates · QR entry', '#cc0033'], fan: ['Fan zones', '#e8b84a'], food: ['Food & drink', '#f08a3c'], parking: ['Parking', '#3b82f6'], transit: ['Shuttle & rideshare', '#8b5cf6'], amenity: ['Services', '#3fbf7f'] };

/* ---------- personalization state ---------- */
const prefs = Object.assign({ section: '118', arrive: 'jma', boardwalk: true, kids: false, first: false, student: false, home: 'nyc' }, store.get('prefs', {}));
const savePrefs = () => store.set('prefs', prefs);
let saved = new Set(store.get('itin', ['nebraska', 'psu', 'msu']));
const saveItin = () => store.set('itin', [...saved]);
let checkins = store.get('checkins', []);
function gateForSection(s) {
  const n = parseInt(s, 10); if (!n) return 'gate-w';
  if ((n >= 101 && n <= 110) || n === 144 || (n >= 201 && n <= 214)) return 'gate-w';
  if ((n >= 111 && n <= 128) || (n >= 215 && n <= 223)) return 'gate-n';
  if ((n >= 129 && n <= 131) || (n >= 224 && n <= 230)) return 'gate-e';
  if (n >= 132 && n <= 143) return 'gate-s';
  return 'gate-w';
}

/* ---------- itinerary engine ---------- */
function homePlan(g) {
  const k = g.d.getTime(), at = h => new Date(k + h * 3600e3);
  const gate = poiById(prefs.student ? 'gate-s' : gateForSection(prefs.section));
  const arrive = { jma: ['Park at Jersey Mike’s Arena ($32) and ride the free shuttle', 'jma'], busch: ['Park in your Busch season lot (walkable)', 'lot-yellow'], ride: ['Rideshare drop-off at the Light Blue Lot, Taylor Rd', 'lot-lb'], outer: ['Park in an outer Busch lot; courtesy shuttle from Brett & Bartholomew Rd', 'shuttle'] }[prefs.arrive];
  const L = [];
  L.push({ t: at(-5), b: 'Parking lots open', s: arrive[0], poi: arrive[1], mine: true });
  if (prefs.boardwalk) L.push({ t: at(-4), b: 'The Rutgers Boardwalk opens', s: 'Food trucks, rides, mini golf, live music on Scarlet Knight Way. Scan the Boardwalk QR for today’s gift.', poi: 'boardwalk', qr: true });
  if (prefs.kids) L.push({ t: at(-3.75), b: 'Sir Henry’s Kids Club', s: 'Crafts and activities for 12 and under, near the Boardwalk stage.', poi: 'kids' });
  L.push({ t: at(-3), b: 'Shuttles start running', s: 'Busch courtesy shuttle and Jersey Mike’s Arena buses begin three hours before kickoff.', poi: 'shuttle' });
  if (prefs.first) L.push({ t: at(-2.5), b: 'First-timer welcome', s: 'Stop at the R Guest Services booth for your commemorative first-visit button.', poi: 'guest', qr: true });
  L.push({ t: at(-2), b: 'Pregame parade, team arrival & Scarlet Walk', s: 'Marching Scarlet Knights, Sir Henry and Excalibur lead into the Scarlet Walk (exact time posted game week).', poi: 'boardwalk' });
  L.push({ t: at(-1.25), b: `Enter at ${gate.name}`, s: `Your ticket (Sec ${esc(prefs.section)}) routes to this gate. Clear bag 12"×6"×12". Scan your QR at the turnstile.`, poi: gate.id, qr: true, mine: true });
  L.push({ t: at(-0.5), b: 'Mobile order before the anthem', s: 'Scan the scoreboard QR; pickup at sections 106, 113, 124 or 132.', poi: 'mo-106' });
  L.push({ t: at(0), b: `Kickoff · ${g.opp}`, s: `${g.tv}${g.theme ? ' · ' + g.theme : ''}`, mine: true });
  L.push({ t: at(3.5), b: 'Postgame exit', s: 'Takis sampling at the Horizon South Gate. Shuttles run one hour after the game; optimized exit routes are posted to your phone.', poi: arrive[1] });
  return L;
}
function awayPlan(g) {
  const k = g.d.getTime(), at = h => new Date(k + h * 3600e3);
  const L = [];
  L.push({ t: at(-30), b: 'Travel window opens', s: `Hotels, flights and drive-time to ${g.city} surface from your ticket + home city.`, mine: true });
  if (g.otb) L.push({ t: at(-3), b: g.otb.name, s: `${g.otb.addr} — ${g.otb.note}. Check in by QR to join the alumni roll call.`, qr: true, ll: g.otb.ll });
  L.push({ t: at(-1.5), b: `Gates at ${g.venue}`, s: 'Visiting-fan entry, bag policy and section guidance pulled from the host venue.', ll: g.ll });
  L.push({ t: at(0), b: `Kickoff · Rutgers at ${g.opp}`, s: g.tv, mine: true });
  const w = wpById(prefs.home) || RU.watch[1];
  L.push({ t: at(-0.5), b: `Staying home? ${w.venue}`, s: `${w.host} · ${w.addr}${w.note ? ' · ' + w.note : ''}`, qr: true, ll: [w.lat, w.lng] });
  return L.sort((a, b) => a.t - b.t);
}
const planFor = g => g.home ? homePlan(g) : awayPlan(g);

/* ---------- router ---------- */
let mapObj = null, usObj = null, liveT = null;
function cleanup() { if (mapObj) { mapObj.remove(); mapObj = null; } if (usObj) { usObj.remove(); usObj = null; } document.body.classList.remove('fullmap'); }
function route() {
  const v = (location.hash.replace('#', '').split('?')[0]) || 'home';
  cleanup();
  $$('#tabs a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  const fn = { home: vHome, season: vSeason, map: vMap, watch: vWatch, checkin: vCheckin, console: vConsole, videos: vVideos }[v] || vHome;
  fn(); icons(); window.scrollTo(0, 0);
}

/* ---------- HOME ---------- */
function vHome() {
  const g = nextGame();
  $('#view').innerHTML = `
  <section class="hero">
    <video src="v/flyover_west_gate.mp4" poster="v/flyover_west_gate.jpg" autoplay muted loop playsinline aria-hidden="true"></video>
    <div class="wrap">
      <span class="eyebrow">EventPulse · Scarlet Knights Football · 2026</span>
      <h1>Every game.<br>Every fan.<br>One plan.</h1>
      <p class="lede">A personal game-day companion for Rutgers Football — your season itinerary for every home and away game, SHI Stadium wayfinding, QR check-in, watch parties across the country, and a direct line between fans, Athletics and Alumni Relations.</p>
      <div class="row">
        <a class="btn" href="#season"><i data-lucide="calendar-check"></i>Build my season</a>
        <a class="btn ghost" href="#checkin"><i data-lucide="qr-code"></i>Try QR check-in</a>
        <a class="btn ghost" href="#videos"><i data-lucide="play"></i>Watch the demo</a>
      </div>
    </div>
  </section>
  <div class="wrap">
    <div class="next">
      <div class="card">
        <span class="eyebrow">Next up · ${g.home ? 'Home · SHI Stadium' : 'Away · ' + esc(g.city)}</span>
        <div class="match" style="margin-top:10px">
          <h3>${g.home ? esc(g.opp) + ' at Rutgers' : 'Rutgers at ' + esc(g.opp)}</h3>
          <span class="tag red">${fD(g.d)} · ${g.tba ? 'Time TBA' : fT(g.d) + ' ET'} · ${esc(g.tv)}</span>
        </div>
        ${g.theme ? `<p class="mute" style="margin:8px 0 0">${esc(g.theme)}</p>` : ''}
        <div class="cd" id="cd" style="margin-top:14px"></div>
        <p class="src" style="margin-top:12px">Source: ${ext(g.src, 'Rutgers Athletics / official schedule')}</p>
      </div>
      <div class="card">
        <span class="eyebrow">Your plan for this game</span>
        <ul class="tl" style="margin-top:6px">${planFor(g).filter(x => x.mine || x.qr).slice(0, 4).map(x => `<li class="${x.mine ? 'mine' : ''}"><time>${fT(x.t)}</time><div><b>${esc(x.b)}</b></div></li>`).join('')}</ul>
        <a class="btn sm" href="#season?g=${g.id}" style="margin-top:8px">Open full itinerary</a>
      </div>
    </div>

    <section class="section">
      <span class="eyebrow">What it does</span>
      <h2 style="margin:8px 0 22px">Hyper-personal, in real time, both directions</h2>
      <div class="grid g4">
        ${[
          ['calendar-range', 'Personal season itinerary', 'All 12 games, home and away. Each plan is built from your ticket, seat, parking and family — and updates as conditions change.'],
          ['navigation', 'Two-way Google Maps', 'Routes hand off to Google Maps and come back with arrival confirmed, so the plan knows where you are and what’s next.'],
          ['ticket', 'Ticket-aware local context', 'Your section picks your gate; your lot picks your shuttle; your home city picks your watch party, hotel and travel window.'],
          ['qr-code', 'QR check-in everywhere', 'Gates, the Boardwalk, Guest Services and every watch-party bar. Each scan is a verified, first-party fan signal.'],
          ['tv', 'Watch parties nationwide', 'Every official Rutgers alumni watch party on one map, with nearest-to-you, directions and one-tap check-in.'],
          ['message-square', 'Constant communication', 'Two-way messages before, during and after the game — not one-way blasts. Fans reply; staff act.'],
          ['gift', 'Gifts & alumni outreach', 'Check-ins unlock gifts and give Athletics and Alumni Relations a direct, consented way to reach the fan.'],
          ['activity', 'Real-time signal console', 'Who is where, right now — stadium, Boardwalk and bars across the country — in one live view for staff.'],
        ].map(([i, h, p]) => `<div class="card feat"><div class="ic"><i data-lucide="${i}"></i></div><div><h3>${h}</h3><p>${p}</p></div></div>`).join('')}
      </div>
    </section>

    <section class="section" style="padding-top:0">
      <div class="grid g4">
        <div class="card stat"><b>12</b><span>Games in the 2026 itinerary</span></div>
        <div class="card stat"><b>7</b><span>Home games at SHI Stadium</span></div>
        <div class="card stat"><b>${RU.watch.length}</b><span>Official watch-party sites</span></div>
        <div class="card stat"><b>${V.pois.filter(p => p.qr).length}</b><span>QR check-in points at SHI</span></div>
      </div>
      <p class="src" style="margin-top:10px">Sources: ${ext(RU.src.sched, '2026 schedule')} · ${ext(RU.src.watch, 'Rutgers alumni watch parties')} · ${ext(RU.src.kbyg, 'SHI Stadium 2026 Know Before You Go')}</p>
    </section>
  </div>`;
  const cd = $('#cd');
  const tick = () => { if (!cd.isConnected) return clearInterval(t); let ms = Math.max(0, g.d - now()); const d = Math.floor(ms / 864e5), h = Math.floor(ms / 36e5) % 24, m = Math.floor(ms / 6e4) % 60, s = Math.floor(ms / 1e3) % 60; cd.innerHTML = [[d, 'Days'], [h, 'Hrs'], [m, 'Min'], [s, 'Sec']].map(([n, l]) => `<div><b>${String(n).padStart(2, '0')}</b><small>${l}</small></div>`).join(''); };
  tick(); const t = setInterval(tick, 1000);
}

/* ---------- SEASON ---------- */
function vSeason() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  let sel = q.get('g') || nextGame().id, filt = 'all';
  $('#view').innerHTML = `<div class="wrap section">
    <div class="season-head">
      <div><span class="eyebrow">My Season · 2026</span><h2 style="margin-top:8px">Every game, home and away</h2>
      <p class="mute" style="margin:8px 0 0;max-width:640px">Tap a game to see your personal itinerary. Save the games you’re going to (or watching) and download them all to your calendar.</p></div>
      <div class="filters" id="filt">${['all', 'home', 'away', 'upcoming', 'saved'].map(f => `<button class="chip ${f === 'all' ? 'on' : ''}" data-f="${f}">${f[0].toUpperCase() + f.slice(1)}</button>`).join('')}</div>
    </div>
    <div class="games" id="games"></div>
    <div class="plan" id="plan"></div>
    <p class="src" style="margin-top:16px">Schedule & results: ${ext(RU.src.sched, 'scarletknights.com')} · ${ext('https://www.espn.com/college-football/team/schedule/_/id/164/rutgers-scarlet-knights', 'ESPN')}. Michigan State kickoff time is TBA — your plan will update when it’s announced.</p>
  </div>`;
  const drawGames = () => {
    const list = games.filter(g => filt === 'all' || (filt === 'home' && g.home) || (filt === 'away' && !g.home) || (filt === 'upcoming' && !g.result) || (filt === 'saved' && saved.has(g.id)));
    $('#games').innerHTML = list.map(g => `<button class="game ${g.id === sel ? 'sel' : ''} ${g.result ? 'past' : ''}" data-id="${g.id}">
      ${saved.has(g.id) ? '<span class="saved-dot" title="In my itinerary"></span>' : ''}
      <div class="top-row"><span class="tag ${g.home ? 'red' : ''}">${g.home ? 'Home' : 'Away'}</span><span class="meta">${esc(g.label)} · ${g.tba ? 'TBA' : fT(g.d) + ' ET'}</span></div>
      <h3>${g.home ? 'vs ' : 'at '}${esc(g.opp)}</h3>
      <div class="top-row"><span class="meta">${g.home ? 'SHI Stadium · Piscataway' : esc(g.venue + ' · ' + g.city)}</span>${g.result ? `<span class="res ${g.result[0]}">${esc(g.result)}</span>` : `<span class="meta">${esc(g.tv)}</span>`}</div>
    </button>`).join('') || '<p class="mute">No games in this view yet.</p>';
    $$('#games .game').forEach(b => b.onclick = () => { sel = b.dataset.id; drawGames(); drawPlan(); $('#plan').scrollIntoView({ behavior: 'smooth', block: 'start' }); });
  };
  const drawPlan = () => {
    const g = games.find(x => x.id === sel), L = planFor(g);
    $('#plan').innerHTML = `<div class="card">
        <div class="season-head" style="margin-bottom:6px"><div><span class="eyebrow">${g.home ? 'Home itinerary' : 'Away itinerary'} · ${fD(g.d)}</span><h2 style="margin-top:6px;font-size:34px">${g.home ? esc(g.opp) + ' at Rutgers' : 'Rutgers at ' + esc(g.opp)}</h2></div>
        <div class="filters"><button class="btn sm" id="saveG"><i data-lucide="${saved.has(g.id) ? 'check' : 'plus'}"></i>${saved.has(g.id) ? 'In my itinerary' : 'Add to my itinerary'}</button><button class="btn sm ghost" id="ics"><i data-lucide="calendar-plus"></i>Calendar (.ics)</button></div></div>
        ${g.result ? `<p class="mute" style="margin:0 0 6px">Final: <b class="res ${g.result[0]}">${esc(g.result)}</b> — this is how your day would have run.</p>` : ''}
        <ul class="tl">${L.map(x => `<li class="${x.mine ? 'mine' : ''}"><time>${g.tba && !x.mine ? '—' : fT(x.t)}<br><small class="dim" style="font:500 11px var(--f-b)">${fD(x.t)}</small></time><div><b>${esc(x.b)} ${x.qr ? '<span class="tag red" style="margin-left:6px"><i data-lucide="qr-code" style="width:12px;height:12px"></i>QR</span>' : ''}</b><span>${x.s}</span>
          ${x.poi ? `<div style="margin-top:6px"><a class="btn sm ghost" href="#map?p=${x.poi}"><i data-lucide="map-pin"></i>Show on map</a> <a class="btn sm ghost" target="_blank" rel="noopener" href="${gmaps(poiById(x.poi).lat, poiById(x.poi).lng, x.poi.startsWith('lot') || x.poi === 'jma' ? 'driving' : 'walking')}"><i data-lucide="navigation"></i>Google Maps</a></div>` : ''}
          ${x.ll ? `<div style="margin-top:6px"><a class="btn sm ghost" target="_blank" rel="noopener" href="${gmaps(x.ll[0], x.ll[1], 'driving')}"><i data-lucide="navigation"></i>Google Maps</a></div>` : ''}
        </div></li>`).join('')}</ul>
      </div>
      <div class="card prefs">
        <span class="eyebrow">Personalize · from your ticket</span>
        <p class="mute" style="font-size:13px;margin:6px 0 10px">In production these come from the ticketing account. Here you can change them and watch the plan rebuild.</p>
        <label style="display:block">Seat section<input type="text" id="pSec" value="${esc(prefs.section)}" inputmode="numeric" style="margin-top:6px"></label>
        <label style="display:block">How you arrive<select id="pArr" style="margin-top:6px">
          <option value="jma">Jersey Mike’s Arena lot + shuttle</option><option value="busch">Busch season parking (walk)</option><option value="outer">Outer Busch lot + courtesy shuttle</option><option value="ride">Rideshare (Light Blue Lot)</option></select></label>
        <label style="display:block">Home watch party (away games)<select id="pHome" style="margin-top:6px">${RU.watch.map(w => `<option value="${w.id}">${esc(w.city)} — ${esc(w.venue)}</option>`).join('')}</select></label>
        <label><input type="checkbox" id="pBw" ${prefs.boardwalk ? 'checked' : ''}>Go to The Rutgers Boardwalk</label>
        <label><input type="checkbox" id="pKids" ${prefs.kids ? 'checked' : ''}>Bringing kids (12 and under)</label>
        <label><input type="checkbox" id="pFirst" ${prefs.first ? 'checked' : ''}>First game at SHI Stadium</label>
        <label><input type="checkbox" id="pStu" ${prefs.student ? 'checked' : ''}>I’m a student</label>
        <div class="detail" style="margin-top:12px"><b>Your gate:</b> ${esc(poiById(prefs.student ? 'gate-s' : gateForSection(prefs.section)).name)}<br><span class="mute" style="font-size:13px">Bag: clear, 12"×6"×12" or a one-gallon clear bag. Stadium is cashless. ${ext(RU.src.pol, 'Policies')}</span></div>
      </div>`;
    $('#pArr').value = prefs.arrive; $('#pHome').value = prefs.home;
    const upd = () => { prefs.section = $('#pSec').value.trim(); prefs.arrive = $('#pArr').value; prefs.home = $('#pHome').value; prefs.boardwalk = $('#pBw').checked; prefs.kids = $('#pKids').checked; prefs.first = $('#pFirst').checked; prefs.student = $('#pStu').checked; savePrefs(); drawPlan(); toast('Itinerary rebuilt'); };
    ['#pArr', '#pHome', '#pBw', '#pKids', '#pFirst', '#pStu'].forEach(s => $(s).onchange = upd);
    $('#pSec').onchange = upd;
    $('#saveG').onclick = () => { saved.has(g.id) ? saved.delete(g.id) : saved.add(g.id); saveItin(); drawGames(); drawPlan(); toast(saved.has(g.id) ? 'Added to your itinerary' : 'Removed from your itinerary'); };
    $('#ics').onclick = () => downloadICS(saved.size ? games.filter(x => saved.has(x.id)) : [g]);
    icons();
  };
  $$('#filt .chip').forEach(c => c.onclick = () => { filt = c.dataset.f; $$('#filt .chip').forEach(x => x.classList.toggle('on', x === c)); drawGames(); });
  drawGames(); drawPlan();
}
function downloadICS(list) {
  const z = d => d.toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
  const ev = list.map(g => ['BEGIN:VEVENT', `UID:${g.id}-2026@eventpulse-rutgers`, `DTSTAMP:${z(new Date())}`, `DTSTART:${z(g.d)}`, `DTEND:${z(new Date(g.d.getTime() + 3.5 * 3600e3))}`, `SUMMARY:${g.home ? g.opp + ' at Rutgers' : 'Rutgers at ' + g.opp} (${g.tv})`, `LOCATION:${g.home ? 'SHI Stadium, Piscataway, NJ' : g.venue + ', ' + g.city}`, `DESCRIPTION:Rutgers EventPulse itinerary. ${g.tba ? 'Kickoff time TBA.' : ''} ${BASE}#season?g=${g.id}`, 'END:VEVENT'].join('\r\n'));
  const blob = new Blob([['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//FuzeBox//EventPulse Rutgers//EN', ...ev, 'END:VCALENDAR'].join('\r\n')], { type: 'text/calendar' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'rutgers-football-2026.ics'; document.body.appendChild(a); a.click(); a.remove();
  toast(`${list.length} game${list.length > 1 ? 's' : ''} exported to calendar`);
}

/* ---------- MAP ---------- */
function satStyle() {
  return { version: 8, sources: { sat: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 19, attribution: 'Imagery © Esri' } }, layers: [{ id: 'sat', type: 'raster', source: 'sat' }] };
}
function darkStyle() {
  return { version: 8, sources: { d: { type: 'raster', tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}'], tileSize: 256, maxzoom: 16, attribution: 'Basemap © Esri, HERE, Garmin, © OpenStreetMap contributors' } }, layers: [{ id: 'd', type: 'raster', source: 'd' }] };
}
const qrSvg = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/></svg>';
function vMap() {
  document.body.classList.add('fullmap');
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  let on = new Set(Object.keys(CATS)), sel = q.get('p') || poiById(gateForSection(prefs.section)).id, you = { lat: poiById('lot-lb').lat, lng: poiById('lot-lb').lng, label: 'Light Blue Lot (demo start)' };
  $('#view').innerHTML = `<div class="map-shell">
    <div class="side">
      <div><span class="eyebrow">SHI Stadium · Piscataway</span><h2 style="font-size:30px;margin-top:6px">Find your way</h2></div>
      <div class="detail" id="det"></div>
      <input type="text" id="search" placeholder="Search gates, food, lots…">
      <div id="list"></div>
      <p class="src">Pins from ${ext(RU.src.kbyg, 'Know Before You Go 2026')} and ${ext('https://www.reservedseat.com/performers/rutgers-scarlet-knights-football/', 'gate/section guide')}. Pins marked “approx.” need confirmation on the official map.</p>
    </div>
    <div class="map-wrap"><div class="map-ctrl" id="cats">${Object.entries(CATS).map(([k, [l, c]]) => `<button class="chip on" data-c="${k}"><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px"></span>${l}</button>`).join('')}<button class="chip" id="me"><i data-lucide="locate" style="width:14px;height:14px"></i> Use my location</button></div><div id="mapEl"></div></div>
  </div>`;
  mapObj = new maplibregl.Map({ container: 'mapEl', style: satStyle(), center: [V.lng, V.lat], zoom: 16, pitch: 52, bearing: -15, attributionControl: { compact: true } });
  mapObj.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), 'bottom-right');
  const markers = {};
    V.pois.forEach(p => {
      const el = document.createElement('div'); el.className = 'mk' + (p.qr ? ' qr' : ''); el.style.background = CATS[p.cat][1]; el.title = p.name; if (p.qr) el.innerHTML = qrSvg;
      el.onclick = e => { e.stopPropagation(); pick(p.id); };
      markers[p.id] = new maplibregl.Marker({ element: el }).setLngLat([p.lng, p.lat]).addTo(mapObj);
    });
    const ye = document.createElement('div'); ye.className = 'mk you'; ye.title = 'You';
    markers.you = new maplibregl.Marker({ element: ye }).setLngLat([you.lng, you.lat]).addTo(mapObj);
  mapObj.on('load', () => {
    mapObj.addSource('stadium', { type: 'geojson', data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [V.poly] } } });
    mapObj.addLayer({ id: 'st-fill', type: 'fill', source: 'stadium', paint: { 'fill-color': '#cc0033', 'fill-opacity': .18 } });
    mapObj.addLayer({ id: 'st-line', type: 'line', source: 'stadium', paint: { 'line-color': '#ff3b62', 'line-width': 2.5 } });
    mapObj.addSource('route', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
    mapObj.addLayer({ id: 'route', type: 'line', source: 'route', paint: { 'line-color': '#fff', 'line-width': 4, 'line-dasharray': [1, 1.5] } });
    if (mapObj.getSource('route')) pick(sel, true);
  });
  const drawList = () => {
    const s = ($('#search').value || '').toLowerCase();
    $('#list').innerHTML = V.pois.filter(p => on.has(p.cat) && (!s || (p.name + p.desc).toLowerCase().includes(s))).map(p => `<button class="poi ${p.id === sel ? 'sel' : ''}" data-id="${p.id}"><span class="dot" style="background:${CATS[p.cat][1]}"></span><div><b>${esc(p.name)}${p.qr ? ' · QR' : ''}</b><span>${fmtDist(dist(you, p))} from you${p.approx ? ' · approx.' : ''}</span></div></button>`).join('');
    $$('#list .poi').forEach(b => b.onclick = () => pick(b.dataset.id));
  };
  function pick(id, quiet) {
    sel = id; const p = poiById(id); if (!p) return;
    const m = dist(you, p), mode = (p.cat === 'parking' || m > 2500) ? 'driving' : 'walking';
    $('#det').innerHTML = `<span class="tag" style="color:${CATS[p.cat][1]}">${CATS[p.cat][0]}</span>${p.qr ? ' <span class="tag red">QR check-in</span>' : ''}
      <h3 style="margin-top:8px">${esc(p.name)}</h3><p class="mute" style="margin:0;font-size:14px">${esc(p.desc)}</p>
      <p style="margin:8px 0 0;font-size:13px"><b>${fmtDist(m)}</b> from ${esc(you.label)} · about ${Math.max(1, Math.round(m * 1.3 / (mode === 'walking' ? 80 : 400)))} min ${mode === 'walking' ? 'walk' : 'drive'}</p>
      <div class="acts"><a class="btn sm" target="_blank" rel="noopener" href="${gmaps(p.lat, p.lng, mode)}"><i data-lucide="navigation"></i>Go in Google Maps</a>${p.qr ? `<a class="btn sm ghost" href="#checkin?at=${p.id}"><i data-lucide="qr-code"></i>Check in here</a>` : ''}</div>
      <p class="src" style="margin-top:8px">Two-way handoff: Google Maps takes you there; the QR at arrival confirms it and advances your itinerary. ${ext(p.src, 'Source')}</p>`;
    if (mapObj && mapObj.getSource('route')) {
      mapObj.getSource('route').setData({ type: 'Feature', geometry: { type: 'LineString', coordinates: [[you.lng, you.lat], [p.lng, p.lat]] } });
      if (!quiet) mapObj.flyTo({ center: [p.lng, p.lat], zoom: p.cat === 'parking' || p.cat === 'transit' ? 15.4 : 17, speed: .9 });
    }
    drawList(); icons();
  }
  $('#search').oninput = drawList;
  $$('#cats .chip[data-c]').forEach(c => c.onclick = () => { const k = c.dataset.c; on.has(k) ? on.delete(k) : on.add(k); c.classList.toggle('on'); Object.entries(markers).forEach(([id, mk]) => { const p = poiById(id); if (p) mk.getElement().style.display = on.has(p.cat) ? '' : 'none'; }); drawList(); });
  $('#me').onclick = () => {
    if (!navigator.geolocation) return toast('Location not available in this browser');
    navigator.geolocation.getCurrentPosition(pos => {
      you = { lat: pos.coords.latitude, lng: pos.coords.longitude, label: 'your location' };
      markers.you && markers.you.setLngLat([you.lng, you.lat]); pick(sel); toast('Using your location');
    }, () => toast('Location permission denied — using the Light Blue Lot as a start'));
  };
  drawList(); pick(sel, true);
}

/* ---------- WATCH PARTIES ---------- */
function vWatch() {
  document.body.classList.add('fullmap');
  let mode = 'neb', sel = null, me = null;
  $('#view').innerHTML = `<div class="wp-shell">
    <div class="side">
      <div><span class="eyebrow">Watch parties · Rutgers alumni clubs</span><h2 style="font-size:30px;margin-top:6px">Cheer with Rutgers anywhere</h2>
      <p class="mute" style="font-size:14px;margin:8px 0 0">Official Rutgers University Foundation and alumni-club sites. Check in by QR at the bar to join the national roll call and unlock your gift.</p></div>
      <div class="filters" id="wpf"><button class="chip on" data-m="neb">Nebraska · Nov 14</button><button class="chip" data-m="all">All 2026 sites</button><button class="chip" data-m="otb">Off the Banks (away)</button></div>
      <button class="btn sm ghost" id="near"><i data-lucide="locate"></i>Find the nearest to me</button>
      <div id="wlist" style="display:flex;flex-direction:column;gap:8px"></div>
      <p class="src">Sources: ${ext(RU.src.watch, 'Rutgers Football Watch Parties')} · ${ext(RU.src.neb, 'Nebraska game watch list')}. Confirm times with the host club; some sites require registration.</p>
    </div>
    <div class="map-wrap"><div id="usMap"></div></div>
  </div>`;
  usObj = new maplibregl.Map({ container: 'usMap', style: darkStyle(), center: [-96, 38.5], zoom: innerWidth < 700 ? 2.1 : 3.3, attributionControl: { compact: true } });
  usObj.addControl(new maplibregl.NavigationControl(), 'bottom-right');
  const mks = [];
  const otb = games.filter(g => g.otb).map(g => ({ id: 'otb-' + g.id, city: g.city, host: 'Rutgers Off the Banks · ' + g.label + ' at ' + g.opp, venue: g.otb.name.split('· ')[1], addr: g.otb.addr, note: g.otb.note, lat: g.otb.ll[0], lng: g.otb.ll[1], reg: true, past: !!g.result }));
  const items = () => mode === 'otb' ? otb : RU.watch.filter(w => mode === 'all' || w.neb);
  const draw = () => {
    mks.forEach(m => m.remove()); mks.length = 0;
    let L = items().map(w => ({ ...w, km: me ? dist(me, w) : null }));
    if (me) L.sort((a, b) => a.km - b.km);
    $('#wlist').innerHTML = L.map(w => `<button class="wp ${w.id === sel ? 'sel' : ''}" data-id="${w.id}">
      <b>${esc(w.venue)}</b><div class="meta">${esc(w.city)} · ${esc(w.host)}</div><div class="meta">${esc(w.addr)}</div>
      <div class="row">${w.note ? `<span class="tag">${esc(w.note)}</span>` : ''}${w.reg ? '<span class="tag sim">Registration</span>' : '<span class="tag ok">Walk-in</span>'}${w.km != null ? `<span class="tag red">${fmtDist(w.km)}</span>` : ''}${w.past ? '<span class="tag">Past</span>' : ''}</div>
      <div class="row"><a class="btn sm" href="${gmaps(w.lat, w.lng, 'driving')}" target="_blank" rel="noopener"><i data-lucide="navigation"></i>Directions</a>${w.id.startsWith('otb') ? '' : `<a class="btn sm ghost" href="#checkin?at=${w.id}"><i data-lucide="qr-code"></i>QR check-in</a>`}</div>
    </button>`).join('');
    L.forEach(w => { const el = document.createElement('div'); el.className = 'mk qr'; el.innerHTML = qrSvg; el.title = w.venue; el.onclick = () => focus(w.id); mks.push(new maplibregl.Marker({ element: el }).setLngLat([w.lng, w.lat]).setPopup(new maplibregl.Popup({ offset: 14 }).setHTML(`<b>${esc(w.venue)}</b><br><span style="font-size:12px;color:#a8a6a3">${esc(w.city)}<br>${esc(w.host)}</span>`)).addTo(usObj)); });
    $$('#wlist .wp').forEach(b => b.onclick = e => { if (e.target.closest('a')) return; focus(b.dataset.id); });
    icons();
  };
  const focus = id => { sel = id; const w = [...RU.watch, ...otb].find(x => x.id === id); usObj.flyTo({ center: [w.lng, w.lat], zoom: 12 }); draw(); };
  $$('#wpf .chip').forEach(c => c.onclick = () => { mode = c.dataset.m; $$('#wpf .chip').forEach(x => x.classList.toggle('on', x === c)); sel = null; usObj.flyTo({ center: [-96, 38.5], zoom: innerWidth < 700 ? 2.1 : 3.3 }); draw(); });
  $('#near').onclick = () => {
    if (!navigator.geolocation) return toast('Location not available');
    navigator.geolocation.getCurrentPosition(p => { me = { lat: p.coords.latitude, lng: p.coords.longitude }; mode = 'all'; $$('#wpf .chip').forEach(x => x.classList.toggle('on', x.dataset.m === 'all')); draw(); const n = RU.watch.map(w => ({ w, d: dist(me, w) })).sort((a, b) => a.d - b.d)[0]; focus(n.w.id); toast(`Nearest: ${n.w.venue}, ${fmtDist(n.d)}`); },
      () => { me = { lat: 40.7128, lng: -74.006 }; draw(); toast('Location denied — sorted from New York City'); });
  };
  draw();
}

/* ---------- CHECK-IN ---------- */
const ckPoints = () => [...V.pois.filter(p => p.qr).map(p => ({ id: p.id, name: p.name, where: 'SHI Stadium' })), ...RU.watch.map(w => ({ id: w.id, name: w.venue, where: w.city + ' watch party' }))];
const ckById = id => ckPoints().find(x => x.id === id);
const giftFor = id => {
  if (id === 'boardwalk') return ['Boardwalk gift', 'Free Scarlet Knights rally towel — show this at the Boardwalk stage.'];
  if (id === 'guest') return ['First-visit welcome', 'Commemorative first-game button + a note from Rutgers Athletics.'];
  if (id.startsWith('gate')) return ['Gate-scan reward', '10% off at the Team Shop today + entry into the halftime seat-upgrade draw.'];
  if (id === 'mo-106') return ['Mobile order perk', 'Skip-the-line pickup on your next order.'];
  return ['Watch-party gift', 'Your name is on the national roll call on the SHI video board + 15% off Rutgers gear.'];
};
function doCheckin(id, real) {
  const p = ckById(id); if (!p) return null;
  const rec = { id, name: p.name, where: p.where, t: Date.now(), real: !!real };
  checkins.unshift(rec); checkins = checkins.slice(0, 30); store.set('checkins', checkins);
  return rec;
}
function vCheckin() {
  const q = new URLSearchParams(location.hash.split('?')[1] || '');
  let at = q.get('at') || 'gate-w';
  const scanned = q.get('scanned');
  $('#view').innerHTML = `<div class="wrap section">
    <span class="eyebrow">QR check-in</span><h2 style="margin:8px 0 6px">Scan in. Get recognized. Stay connected.</h2>
    <p class="mute" style="max-width:720px;margin:0 0 22px">Every gate, the Boardwalk, Guest Services and every watch-party bar carries an EventPulse QR. Point a phone camera at the code below — it opens this site and checks you in for real. Or press “Simulate scan.”</p>
    <div class="ck">
      <div class="card">
        <label style="display:block;font-size:14px;font-weight:600">Check-in point<select id="ckSel" style="margin-top:6px">${ckPoints().map(p => `<option value="${p.id}">${esc(p.name)} — ${esc(p.where)}</option>`).join('')}</select></label>
        <div class="qrbox" id="qr" style="margin-top:16px"></div>
        <p class="src" style="text-align:center;margin-top:8px;word-break:break-all" id="qrUrl"></p>
        <div style="display:flex;gap:8px;justify-content:center;margin-top:10px;flex-wrap:wrap"><button class="btn" id="sim"><i data-lucide="scan-line"></i>Simulate scan</button><a class="btn ghost" href="#console"><i data-lucide="activity"></i>See it in the console</a></div>
        <ol class="flow" id="flow" style="margin-top:18px">
          <li>Scan verifies the location and ticket holder</li>
          <li>Itinerary advances to the next step</li>
          <li>Gift unlocks on the fan’s phone</li>
          <li>Athletics & Alumni Relations see the check-in live</li>
          <li>Two-way thread opens for follow-up outreach</li>
        </ol>
      </div>
      <div class="phone" id="phone"><div class="notch"></div><div id="pscreen"><p class="mute" style="text-align:center;margin-top:120px">Waiting for scan…</p></div></div>
    </div>
  </div>`;
  const drawQR = () => {
    const url = `${BASE}?checkin=${at}`;
    const qr = qrcode(0, 'M'); qr.addData(url); qr.make();
    $('#qr').innerHTML = qr.createSvgTag({ cellSize: 6, margin: 2, scalable: true });
    $('#qrUrl').textContent = url;
  };
  const show = rec => {
    const p = ckById(rec.id), [gt, gd] = giftFor(rec.id), g = nextGame();
    const L = planFor(g), nx = L.find(x => x.t > now()) || L[L.length - 1];
    $('#pscreen').innerHTML = `<div class="ok-badge"><i data-lucide="check"></i></div>
      <h3 style="text-align:center;text-transform:uppercase">Checked in</h3>
      <p style="text-align:center;margin:0;font-size:14px"><b>${esc(p.name)}</b><br><span class="mute">${esc(p.where)} · ${new Date(rec.t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</span></p>
      <div class="gift"><small style="letter-spacing:.12em;text-transform:uppercase;font-size:11px;opacity:.85">Gift unlocked</small><b>${gt}</b><span style="font-size:13px">${gd}</span></div>
      <div class="detail" style="padding:10px"><small class="dim" style="text-transform:uppercase;letter-spacing:.1em;font-size:10px">Next on your itinerary</small><br><b style="font-size:14px">${esc(nx.b)}</b><br><span class="mute" style="font-size:12px">${fD(nx.t)} · ${fT(nx.t)} ET</span></div>
      <div class="detail" style="padding:10px;font-size:13px"><i data-lucide="message-circle" style="width:14px;height:14px;vertical-align:-2px"></i> <b>Rutgers Alumni Relations:</b> “Great to see you here! Want us to save you a spot at the next watch party?”<div style="display:flex;gap:6px;margin-top:8px"><button class="btn sm" data-r="Yes — save me a spot">Yes</button><button class="btn sm ghost" data-r="Not this time">Not now</button></div></div>`;
    $$('#pscreen [data-r]').forEach(b => b.onclick = () => { const r = b.dataset.r; const out = store.get('replies', []); out.unshift({ t: Date.now(), r, at: p.name }); store.set('replies', out.slice(0, 20)); b.parentElement.innerHTML = `<div class="reply">You replied: “${esc(r)}” — sent to Alumni Relations</div>`; toast('Reply sent — visible in the Athletics Console'); });
    $$('#flow li').forEach((li, i) => setTimeout(() => li.classList.add('done'), 250 * (i + 1)));
    icons();
  };
  $('#ckSel').value = at; $('#ckSel').onchange = e => { at = e.target.value; drawQR(); $$('#flow li').forEach(li => li.classList.remove('done')); $('#pscreen').innerHTML = '<p class="mute" style="text-align:center;margin-top:120px">Waiting for scan…</p>'; };
  $('#sim').onclick = () => { const r = doCheckin(at, false); show(r); toast('Check-in recorded'); };
  drawQR();
  if (scanned) { const r = checkins.find(c => c.id === scanned) || doCheckin(scanned, true); if (r) { $('#ckSel').value = scanned; at = scanned; drawQR(); show(r); } }
}

/* ---------- CONSOLE ---------- */
function vConsole() {
  const locs = [['SHI · West Gate', 0.24], ['SHI · North Gate', 0.2], ['SHI · South Gate (students)', 0.18], ['SHI · East Gate', 0.08], ['Rutgers Boardwalk', 0.12], ...RU.watch.filter(w => w.neb).map((w, i) => [w.city + ' · ' + w.venue, [0.034, 0.03, 0.022, 0.016, 0.019, 0.012, 0.014, 0.011][i] || 0.012])];
  const counts = Object.fromEntries(locs.map(([l, w]) => [l, Math.round(w * 9400)]));
  let total = Object.values(counts).reduce((a, b) => a + b, 0), gifts = Math.round(total * 0.61), replies = Math.round(total * 0.34);
  const names = ['Alex M. (’14)', 'Priya S.', 'Jordan K. (’09)', 'Sam R.', 'Taylor D. (’21)', 'Chris P.', 'Morgan L. (’03)', 'Jamie V.', 'Dana W. (’17)', 'Riley T.', 'Casey N. (’98)', 'Avery B.'];
  const outreach = [
    { seg: 'First-time visitors · 312 fans', who: 'Athletics · Ticketing', msg: 'Welcome to your first game at SHI Stadium! Your commemorative button is waiting at R Guest Services. Want a 2027 season-ticket preview?', ch: 'Push + SMS' },
    { seg: 'Watch-party check-ins · 8 cities', who: 'Alumni Relations', msg: 'Thanks for cheering with your local Rutgers club today. Your name will appear on the national roll call. Can we add you to the club’s mailing list?', ch: 'In-app thread' },
    { seg: 'Lapsed donors at the game · 47 fans', who: 'R Fund', msg: 'Great to see you back on the Banks. Here’s a behind-the-scenes look at the program your support built.', ch: 'Email + in-app' },
    { seg: 'Families with kids · 540 fans', who: 'Marketing', msg: 'Sir Henry’s Kids Club is open near the Boardwalk stage until kickoff. Show this for a free activity kit.', ch: 'Push' },
  ];
  $('#view').innerHTML = `<div class="wrap section">
    <div class="season-head"><div><span class="eyebrow">Athletics & Alumni Relations Console</span><h2 style="margin-top:8px">Live fan signal · ${esc(nextGame().opp)} game day</h2></div><span class="tag sim"><i data-lucide="flask-conical" style="width:12px;height:12px"></i>Simulated stream + your real check-ins</span></div>
    <div class="kpis">
      <div class="kpi"><span>Verified check-ins</span><b id="kT">${total.toLocaleString()}</b><em>live</em></div>
      <div class="kpi"><span>Locations reporting</span><b>${locs.length}</b><em>${RU.watch.filter(w => w.neb).length} watch parties</em></div>
      <div class="kpi"><span>Gifts unlocked</span><b id="kG">${gifts.toLocaleString()}</b><em>61% of check-ins</em></div>
      <div class="kpi"><span>Two-way replies</span><b id="kR">${replies.toLocaleString()}</b><em>34% reply rate</em></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><h3>Check-in stream</h3><p class="mute" style="font-size:13px;margin:4px 0 8px">Green rows are check-ins made from this browser.</p><ul class="stream" id="stream"></ul></div>
      <div class="card"><h3>Where fans are right now</h3><div class="bars" id="bars" style="margin-top:10px"></div></div>
    </div>
    <div class="grid g2" style="margin-top:16px">
      <div class="card"><h3>Direct outreach queue</h3><p class="mute" style="font-size:13px;margin:4px 0 12px">Segments built from check-ins. Staff approve before anything is sent.</p><div id="outq"></div></div>
      <div class="card"><h3>Fan replies</h3><p class="mute" style="font-size:13px;margin:4px 0 12px">Two-way: replies come back here and route to the right team.</p><div id="replies"></div></div>
    </div>
  </div>`;
  const stream = $('#stream');
  const add = (who, where, real, t = Date.now()) => { const li = document.createElement('li'); if (real) li.className = 'real'; li.innerHTML = `<time>${new Date(t).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', second: '2-digit' })}</time><span><b>${esc(who)}</b> · ${esc(where)}</span><span class="tag ${real ? 'ok' : ''}">${real ? 'You' : 'QR'}</span>`; stream.prepend(li); while (stream.children.length > 40) stream.lastChild.remove(); };
  for (let i = 0; i < 10; i++) { const l = locs[Math.floor(Math.random() * locs.length)][0]; add(names[i % names.length], l, false, Date.now() - (10 - i) * 7000); }
  checkins.slice(0, 8).reverse().forEach(c => add('You', c.name + ' · ' + c.where, true, c.t));
  const drawBars = () => { const mx = Math.max(...Object.values(counts)); $('#bars').innerHTML = Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([l, n]) => `<div class="b"><span title="${esc(l)}" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(l)}</span><div class="t"><i style="width:${(n / mx * 100).toFixed(1)}%"></i></div><span style="text-align:right;font-variant-numeric:tabular-nums">${n.toLocaleString()}</span></div>`).join(''); };
  drawBars();
  $('#outq').innerHTML = outreach.map((o, i) => `<div class="msg"><div class="h"><span><b style="color:var(--ink)">${esc(o.seg)}</b></span><span>${esc(o.who)} · ${esc(o.ch)}</span></div><p>“${esc(o.msg)}”</p><div class="acts"><button class="btn sm" data-o="${i}"><i data-lucide="send"></i>Approve & send</button><button class="btn sm ghost">Edit</button></div></div>`).join('');
  $$('#outq [data-o]').forEach(b => b.onclick = () => { b.outerHTML = '<span class="tag ok">Sent (demo) · delivery tracked</span>'; toast('Outreach approved (demo — nothing is actually sent)'); });
  const reps = [...store.get('replies', []).map(r => ({ who: 'You', r: r.r, at: r.at, real: true })), { who: 'Jordan K. (’09)', r: 'Yes! Save 4 spots for the Penn State watch party at District Tap House.', at: 'District Tap House' }, { who: 'Priya S.', r: 'First game ever — loved it. How do I get season tickets for 2027?', at: 'West Gate' }, { who: 'Casey N. (’98)', r: 'Can the Charlotte club do a Michigan State watch party?', at: 'Hoppin’ Charlotte' }];
  $('#replies').innerHTML = reps.map(r => `<div class="msg"><div class="h"><span><b style="color:var(--ink)">${esc(r.who)}</b> · checked in at ${esc(r.at)}</span>${r.real ? '<span class="tag ok">Real reply from this browser</span>' : '<span class="tag sim">Sample</span>'}</div><p>“${esc(r.r)}”</p><div class="acts"><button class="btn sm ghost">Route to ${/season|tickets/i.test(r.r) ? 'Ticketing' : 'Alumni Relations'}</button></div></div>`).join('');
  clearInterval(liveT);
  liveT = setInterval(() => {
    if (!$('#stream')) return clearInterval(liveT);
    const r = Math.random(); let acc = 0, pick = locs[0][0]; for (const [l, w] of locs) { acc += w / 0.9; if (r < acc) { pick = l; break; } }
    counts[pick] = (counts[pick] || 0) + 1; total++; if (Math.random() < .61) gifts++; if (Math.random() < .34) replies++;
    add(names[Math.floor(Math.random() * names.length)], pick, false);
    $('#kT').textContent = total.toLocaleString(); $('#kG').textContent = gifts.toLocaleString(); $('#kR').textContent = replies.toLocaleString(); drawBars();
  }, 1800);
}

/* ---------- VIDEOS ---------- */
function vVideos() {
  const V5 = [
    ['bar_checkin', 'Watch party: scan in, find your crew', 'A fan walks into a Rutgers watch party, scans the QR at the host stand, crosses the bar to her friends — and the room erupts as the Scarlet Knights break a big play on the screen.', true],
    ['flyover_west_gate', 'SHI Stadium · West Gate entry', 'The flyover descends on the West Gate (A & B). A fan scans at the turnstile; the itinerary advances and a gate-scan reward unlocks.'],
    ['flyover_boardwalk', 'The Rutgers Boardwalk · gift kiosk', 'Pregame on Scarlet Knight Way: band, food trucks and a QR kiosk where a family scans and unlocks a Boardwalk gift.'],
    ['flyover_student_gate', 'Horizon South Gate · students', 'Over the student section and down to the South Gate (G & H), where every student scan becomes a live attendance signal.'],
    ['flyover_bowl_scoreboard', 'In-bowl scoreboard QR', 'The video board shows a QR; thousands of phones light up to scan for mobile ordering, polls and the national watch-party roll call.'],
  ];
  $('#view').innerHTML = `<div class="wrap section">
    <span class="eyebrow">Concept videos</span><h2 style="margin:8px 0 6px">See EventPulse on game day</h2>
    <p class="mute" style="max-width:720px;margin:0 0 20px">AI concept footage illustrating the experience — not real events, venues or players. Generated end-zone lettering is not Rutgers branding.</p>
    <div class="vids">${V5.map(([f, h, p, wide]) => `<figure class="vid ${wide ? 'wide' : ''}" style="margin:0"><video src="v/${f}.mp4" poster="v/${f}.jpg" controls playsinline preload="metadata" ${wide ? '' : 'muted loop'}></video><figcaption class="cap"><span class="tag sim">AI concept footage</span><h3 style="margin-top:8px">${h}</h3><p>${p}</p></figcaption></figure>`).join('')}</div>
  </div>`;
}

/* ---------- CONCIERGE ---------- */
const KB = [
  [/park|lot|car|\$32|drive/i, () => `Lots open 5 hours before kickoff. Jersey Mike’s Arena lots are $32 per car (tax included) with a free shuttle; Johnson Park is no longer an option. Outer Busch lots use the courtesy shuttle from Brett & Bartholomew Rd starting 3 hours out.`, ['jma', 'shuttle']],
  [/gate|enter|section|seat/i, () => `Your section ${esc(prefs.section)} uses the ${esc(poiById(gateForSection(prefs.section)).name)}. West A/B: 101–110, 144, 201–214. North C/D: 111–128, 217–223. East E/F: 129–131, 224–230, club. Students: South G/H.`, [gateForSection(prefs.section)]],
  [/bag|clear|purse|backpack/i, () => `Clear plastic/vinyl/PVC bags about 12"×6"×12", a one-gallon clear bag, or a hand-sized clutch. $12 lockers in Athletes Glen across from North (C&D) and South (G&H) gates.`, ['glen-n', 'glen-s']],
  [/uber|lyft|rideshare|drop/i, () => `Rideshare drop-off and pickup is the Light Blue Lot on Taylor Road, Piscataway.`, ['lot-lb']],
  [/boardwalk|fan ?fest|food truck|kids|scarlet walk/i, () => `The Rutgers Boardwalk opens 4 hours before kickoff on Scarlet Knight Way — NJ food trucks, rides, mini golf, live music, then the pregame parade and Scarlet Walk. Sir Henry’s Kids Club (12 and under) is near the stage.`, ['boardwalk', 'kids']],
  [/food|eat|drink|beer|order/i, () => `Scan the scoreboard QR for mobile ordering (pickup at 106, 113, 124, 132). Prime 52 is at 102, Behind Enemy Lines (NJ + opponent beers) near 110, Red Zone Market behind 127. Stadium is cashless; cash-to-card kiosk at 113.`, ['mo-106', 'enemy', 'redzone']],
  [/watch|bar|party|away|tv|where.*watch/i, () => `For Nebraska (Nov 14, 12:30 PM ET, BTN) official watch parties include District Tap House (NYC), Green Rock Tap & Grill (Hoboken), Nanny O’Briens (DC), Mazzy’s (Marietta), Glory Days Grill (St. Pete), Boston’s (Tempe), Ace’s Bar (SF) and The Harp Inn (Costa Mesa). <a href="#watch">Open the map</a>.`, []],
  [/nebraska|next game|kickoff|when/i, () => { const g = nextGame(); return `Next: ${g.home ? g.opp + ' at Rutgers' : 'Rutgers at ' + g.opp}, ${fD(g.d)} ${g.tba ? '(time TBA)' : fT(g.d) + ' ET'} on ${g.tv}.${g.theme ? ' ' + g.theme + '.' : ''}`; }, []],
  [/penn state|psu/i, () => `Rutgers at Penn State: Sat Nov 21, 3:30 PM ET on FS1 at Beaver Stadium. Your away itinerary includes travel timing and your home watch party.`, []],
  [/help|guest|lost|issue/i, () => `Text KNIGHTS to 69050 on game days for R Guest Services, or visit the Guest Services booth on the Boardwalk.`, ['guest']],
];
function cAsk(text) {
  const log = $('#cLog'); log.insertAdjacentHTML('beforeend', `<div class="bub me">${esc(text)}</div>`);
  const hit = KB.find(([re]) => re.test(text));
  const ans = hit ? hit[1]() : `I can help with parking, gates, bags, rideshare, the Boardwalk, food, watch parties and kickoff times. Try one of the chips below.`;
  const pois = hit ? hit[2] : [];
  setTimeout(() => { log.insertAdjacentHTML('beforeend', `<div class="bub bot">${ans}${pois.length ? `<div style="margin-top:6px">${pois.map(id => `<a href="#map?p=${id}">${esc(poiById(id).name)}</a>`).join(' · ')}</div>` : ''}<div class="trace">intent:${hit ? hit[0].source.split('|')[0].replace(/\W/g, '') : 'fallback'} · profile:sec ${esc(prefs.section)} · source: rutgers official pages</div></div>`); log.scrollTop = log.scrollHeight; }, 250);
}
function initConcierge() {
  const box = $('#concierge');
  $('#openConcierge').onclick = () => { box.hidden = !box.hidden; if (!box.hidden && !$('#cLog').children.length) { $('#cLog').innerHTML = `<div class="bub bot">Hi, I’m Henry — named for Sir Henry, the Scarlet Knights mascot. I know your seat, your parking and your itinerary. What do you need?</div>`; } $('#cInput').focus(); };
  $('#closeConcierge').onclick = () => box.hidden = true;
  $('#cChips').innerHTML = ['Which gate do I use?', 'Where do I park?', 'Bag policy', 'Watch parties near me', 'Next game'].map(c => `<button>${c}</button>`).join('');
  $$('#cChips button').forEach(b => b.onclick = () => cAsk(b.textContent));
  $('#cForm').onsubmit = e => { e.preventDefault(); const v = $('#cInput').value.trim(); if (v) { cAsk(v); $('#cInput').value = ''; } };
}

/* ---------- boot ---------- */
initConcierge();
const qs = new URLSearchParams(location.search);
if (qs.get('checkin') && ckById(qs.get('checkin'))) {
  const id = qs.get('checkin'); doCheckin(id, true);
  history.replaceState(null, '', location.pathname + `#checkin?at=${id}&scanned=${id}`);
}
window.addEventListener('hashchange', route);
route();
})();
