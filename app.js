// ── HARİTA ──────────────────────────────────────────────
const map = L.map('map', { zoomControl: false }).setView([39.0, 35.0], 6);

L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '© OpenStreetMap © CartoDB', maxZoom: 19
}).addTo(map);

L.control.zoom({ position: 'bottomright' }).addTo(map);

// ── CLUSTER GRUBU ────────────────────────────────────────
const clusterGroup = L.markerClusterGroup({
  showCoverageOnHover: false,
  maxClusterRadius: 55,
  spiderfyOnMaxZoom: true,
  chunkedLoading: true,
  iconCreateFunction(cluster) {
    return L.divIcon({
      html: `<div class="cluster-icon">${cluster.getChildCount()}</div>`,
      className: '', iconSize: [38, 38], iconAnchor: [19, 19]
    });
  }
});
map.addLayer(clusterGroup);

// ── GLOBAL ───────────────────────────────────────────────
let mevcutRota = null;
let tumMekanlar = [];
let aktifFiltre = 'hepsi';
let tumMarkers = [];
let rotaBas = null;       // [lat, lon]
let rotaBit = null;       // [lat, lon]
let rotaSuresi = 0;       // saniye
let rotaKoord = [];       // rota koordinatları (LatLng[])
let seciliDuraklar = new Set(); // seçili mekan indeksleri
let aiOneriler = [];      // AI öneri isimleri (highlight için)
let aiOneriData = {};     // isim → {sebep, aciklama}

// ── KATEGORİ ─────────────────────────────────────────────
const KAT = {
  tarihi:    { label: 'Tarihi Yer',     lucide: 'landmark',     renk: '#F59E0B', bg: '#FEF3C7' },
  restoran:  { label: 'Yemek & Kafe',   lucide: 'utensils',     renk: '#EF4444', bg: '#FEE2E2' },
  muze:      { label: 'Müze & Galeri',  lucide: 'image',        renk: '#8B5CF6', bg: '#EDE9FE' },
  doga:      { label: 'Doğa & Park',    lucide: 'trees',        renk: '#10B981', bg: '#D1FAE5' },
  konaklama: { label: 'Konaklama',      lucide: 'bed',          renk: '#3B82F6', bg: '#DBEAFE' },
  alisveris: { label: 'Alışveriş',      lucide: 'shopping-bag', renk: '#F97316', bg: '#FFEDD5' },
  diger:     { label: 'Diğer',          lucide: 'map-pin',      renk: '#6B7280', bg: '#F3F4F6' }
};

function osmTagKategori(tags) {
  const { amenity='', tourism='', historic='', leisure='', shop='' } = tags;
  if (tourism === 'museum' || amenity === 'arts_centre') return 'muze';
  if (historic || tourism === 'attraction' || tourism === 'viewpoint') return 'tarihi';
  if (['restaurant','cafe','fast_food','food_court','bar'].includes(amenity)) return 'restoran';
  if (['hotel','hostel','motel','guest_house'].includes(tourism)) return 'konaklama';
  if (['park','nature_reserve'].includes(leisure)) return 'doga';
  if (amenity === 'place_of_worship') return 'tarihi';
  if (['mall','marketplace'].includes(shop) || amenity === 'marketplace') return 'alisveris';
  return 'diger';
}

// ── AUTOCOMPLETE ─────────────────────────────────────────
function debounce(fn, ms) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

function setupAutocomplete(inputId, dropdownId, onSelect) {
  const input = document.getElementById(inputId);
  const drop  = document.getElementById(dropdownId);
  if (!input || !drop) return;

  let focused = -1;

  const fetchSuggestions = debounce(async (q) => {
    if (q.length < 2) { drop.classList.add('hidden'); return; }
    try {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&countrycodes=tr&limit=5&addressdetails=1`,
        { headers: { 'Accept-Language': 'tr' } }
      );
      const data = await r.json();
      renderDropdown(data, drop, input, onSelect);
      focused = -1;
    } catch { drop.classList.add('hidden'); }
  }, 300);

  input.addEventListener('input', e => fetchSuggestions(e.target.value.trim()));

  input.addEventListener('keydown', e => {
    const items = drop.querySelectorAll('.ac-item');
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      focused = Math.min(focused + 1, items.length - 1);
      items.forEach((el, i) => el.classList.toggle('focused', i === focused));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      focused = Math.max(focused - 1, 0);
      items.forEach((el, i) => el.classList.toggle('focused', i === focused));
    } else if (e.key === 'Enter') {
      if (focused >= 0 && items[focused]) items[focused].click();
    } else if (e.key === 'Escape') {
      drop.classList.add('hidden');
    }
  });

  document.addEventListener('click', e => {
    if (!input.contains(e.target) && !drop.contains(e.target)) drop.classList.add('hidden');
  });
}

function renderDropdown(results, drop, input, onSelect) {
  if (!results.length) { drop.classList.add('hidden'); return; }

  drop.innerHTML = results.map((r, i) => {
    const addr = r.address || {};
    const il = addr.province || addr.state || addr.county || '';
    const sub = il && il !== r.display_name.split(',')[0] ? il : '';
    return `
      <div class="ac-item" data-idx="${i}" data-name="${escHtml(r.display_name.split(',')[0])}">
        <div class="ac-item-icon"><i data-lucide="map-pin"></i></div>
        <div class="ac-item-text">
          <span class="ac-item-name">${escHtml(r.display_name.split(',')[0])}</span>
          ${sub ? `<span class="ac-item-sub">${escHtml(sub)}</span>` : ''}
        </div>
      </div>`;
  }).join('');

  drop.querySelectorAll('.ac-item').forEach(el => {
    el.addEventListener('click', () => {
      const name = el.dataset.name;
      input.value = name;
      drop.classList.add('hidden');
      if (onSelect) onSelect(name);
      lucide.createIcons();
    });
  });

  drop.classList.remove('hidden');
  lucide.createIcons();
}

function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

// ── TÜRKİYE SINIR VURGUSU ───────────────────────────────
async function turkiyeVurgula() {
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?q=Turkey&format=geojson&polygon_geojson=1&limit=1');
    const data = await r.json();
    if (!data.features?.length) return;

    const geom = data.features[0].geometry;
    const worldRect = [[-90,-180],[-90,180],[90,180],[90,-180],[-90,-180]];
    let halkalar = geom.type === 'Polygon' ? geom.coordinates
      : geom.coordinates.reduce((best, p) => p[0].length > best[0].length ? p : best, [[]]);

    if (halkalar.length) {
      L.geoJSON({ type:'Feature', geometry:{ type:'Polygon', coordinates:[worldRect, ...halkalar] }}, {
        style: { fillColor:'#94a3b8', fillOpacity:.24, stroke:false }, interactive:false
      }).addTo(map);
    }
    // Glow katmanı
    L.geoJSON(data, {
      style: { color:'#3B82F6', weight:10, opacity:.12, fill:false }, interactive:false
    }).addTo(map);
    // Ana sınır + dolgu
    L.geoJSON(data, {
      style: { color:'#1D4ED8', weight:2, opacity:.9, fillColor:'#DBEAFE', fillOpacity:.55 }, interactive:false
    }).addTo(map);
  } catch(e) { console.warn('Türkiye sınırı yüklenemedi'); }
}
turkiyeVurgula();

// ── HARİTA KOORDİNATI ────────────────────────────────────
async function sehirKoordinat(sehir) {
  const r = await fetch(
    `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(sehir+', Türkiye')}&format=json&limit=1`,
    { headers: { 'Accept-Language': 'tr' } }
  );
  const d = await r.json();
  if (!d.length) throw new Error(`"${sehir}" bulunamadı`);
  return [parseFloat(d[0].lat), parseFloat(d[0].lon)];
}

// ── ROTA ─────────────────────────────────────────────────
function rotaCiz(bas, bit) {
  return new Promise((resolve, reject) => {
    if (mevcutRota) { map.removeControl(mevcutRota); mevcutRota = null; }
    const timeout = setTimeout(() => reject(new Error('Rota hesaplaması zaman aşımına uğradı. Tekrar deneyin.')), 20000);
    mevcutRota = L.Routing.control({
      waypoints: [L.latLng(bas[0], bas[1]), L.latLng(bit[0], bit[1])],
      routeWhileDragging: false, show: false, addWaypoints: false,
      router: L.Routing.osrmv1({ serviceUrl:'https://router.project-osrm.org/route/v1', profile:'driving' }),
      lineOptions: { styles:[{ color:'#3B82F6', weight:4, opacity:.85 }] },
      createMarker(i, wp) {
        const html = `<div style="width:13px;height:13px;border-radius:50%;background:${i===0?'#10B981':'#EF4444'};border:3px solid white;box-shadow:0 1px 4px rgba(0,0,0,.3)"></div>`;
        return L.marker(wp.latLng, { icon: L.divIcon({ html, className:'', iconSize:[13,13], iconAnchor:[6,6] }) });
      }
    }).addTo(map);
    mevcutRota.on('routesfound', e => {
      clearTimeout(timeout);
      const rota = e.routes[0];
      rotaSuresi = rota.summary.totalTime;
      rotaKoord = rota.coordinates;
      document.getElementById('stat-distance').textContent = `${(rota.summary.totalDistance/1000).toFixed(0)} km`;
      document.getElementById('route-stats').classList.remove('hidden');
      resolve(rota.coordinates);
    });
    mevcutRota.on('routingerror', () => { clearTimeout(timeout); reject(new Error('Rota hesaplanamadı')); });
  });
}

// ── OVERPASS ─────────────────────────────────────────────
const NOMINATIM = 'https://nominatim.openstreetmap.org/search';

function bbox(coords) {
  const s = coords.length > 200 ? coords.filter((_,i) => i % Math.floor(coords.length/100)===0) : coords;
  let [minLat,maxLat,minLon,maxLon] = [Infinity,-Infinity,Infinity,-Infinity];
  s.forEach(k => {
    minLat=Math.min(minLat,k.lat); maxLat=Math.max(maxLat,k.lat);
    minLon=Math.min(minLon,k.lng); maxLon=Math.max(maxLon,k.lng);
  });
  const p=.08;
  return { minLat:minLat-p, maxLat:maxLat+p, minLon:minLon-p, maxLon:maxLon+p };
}

async function fetchWithTimeout(url, options, ms = 10000) {
  const ctrl = new AbortController();
  const id = setTimeout(() => ctrl.abort(), ms);
  try {
    const r = await fetch(url, { ...options, signal: ctrl.signal });
    clearTimeout(id);
    return r;
  } catch (e) {
    clearTimeout(id);
    throw e;
  }
}

const bekle = ms => new Promise(r => setTimeout(r, ms));

async function mekanCek({ minLat, maxLat, minLon, maxLon }) {
  // Nominatim viewbox formatı: minLon,maxLat,maxLon,minLat
  const vb = `${minLon},${maxLat},${maxLon},${minLat}`;
  const base = `${NOMINATIM}?format=json&bounded=1&limit=25&dedupe=1&viewbox=${vb}`;
  const hdrs = { headers: { 'Accept-Language': 'tr', 'User-Agent': 'RotaKesif/1.0' } };

  // Kategori başına bir arama — toplam 6 istek, 200ms aralıklı
  const aramalar = [
    `${base}&amenity=restaurant`,
    `${base}&amenity=cafe`,
    `${base}&amenity=museum`,
    `${base}&amenity=hotel`,
    `${base}&q=${encodeURIComponent('kale türbe anıt tarihi alan kilise')}`,
    `${base}&q=${encodeURIComponent('cami camii')}`,
    `${base}&amenity=place_of_worship`,
  ];

  const sonuclar = [];
  const goruldu = new Set();

  for (const url of aramalar) {
    try {
      const r = await fetchWithTimeout(url, hdrs, 8000);
      if (!r.ok) { await bekle(200); continue; }
      const items = await r.json();

      for (const item of items) {
        if (!item.display_name) continue;
        // Yakın konumdaki tekrarları at (3 ondalık ≈ 111m hassasiyet)
        const anahtar = `${parseFloat(item.lat).toFixed(3)}_${parseFloat(item.lon).toFixed(3)}`;
        if (goruldu.has(anahtar)) continue;
        goruldu.add(anahtar);

        // Nominatim → Overpass benzeri format (osmTagKategori uyumlu)
        const tags = { name: item.display_name.split(',')[0].trim() };
        tags[item.class] = item.type; // ör: { amenity:'restaurant' } veya { historic:'castle' }

        sonuclar.push({ lat: parseFloat(item.lat), lon: parseFloat(item.lon), tags });
      }
    } catch (e) {
      console.warn('Nominatim araması başarısız:', e.message);
    }
    await bekle(200); // Rate limit: max 1 istek/saniye
  }

  console.log(`✓ ${sonuclar.length} mekan bulundu`);
  return sonuclar;
}

// ── SAPMA ANALİZİ ────────────────────────────────────────
async function sapmaHesapla(mekan) {
  if (!rotaBas || !rotaBit) return null;
  const url = `https://router.project-osrm.org/route/v1/driving/` +
    `${rotaBas[1]},${rotaBas[0]};${mekan.lon},${mekan.lat};${rotaBit[1]},${rotaBit[0]}` +
    `?overview=false`;
  try {
    const r = await fetchWithTimeout(url, {}, 8000);
    if (!r.ok) return null;
    const d = await r.json();
    if (!d.routes?.length) return null;
    return Math.max(0, Math.round((d.routes[0].duration - rotaSuresi) / 60));
  } catch { return null; }
}

// ── UZAKLIK ──────────────────────────────────────────────
function haversine(lat1,lon1,lat2,lon2) {
  const R=6371, d2r=Math.PI/180;
  const a = Math.sin((lat2-lat1)*d2r/2)**2 + Math.cos(lat1*d2r)*Math.cos(lat2*d2r)*Math.sin((lon2-lon1)*d2r/2)**2;
  return R*2*Math.atan2(Math.sqrt(a),Math.sqrt(1-a));
}
const rotayaUzaklik = (n, rc) => rc.reduce((min,k) => { const d=haversine(n.lat,n.lon,k.lat,k.lng); return d<min?d:min; }, Infinity);

// ── MARKER ───────────────────────────────────────────────
function mekanMarkerOlustur(mekan) {
  const kat = KAT[mekan.kategori];
  const icon = L.divIcon({
    html: `<div style="width:28px;height:28px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${kat.renk};border:2.5px solid white;box-shadow:0 2px 6px rgba(0,0,0,.22);display:flex;align-items:center;justify-content:center;"><div style="transform:rotate(45deg);width:12px;height:12px;background:rgba(255,255,255,.28);border-radius:50%"></div></div>`,
    className:'', iconSize:[28,28], iconAnchor:[14,28]
  });
  return L.marker([mekan.lat, mekan.lon], { icon })
    .bindPopup(`<div class="popup-content">
      <div class="popup-cat-badge" style="background:${kat.bg};color:${kat.renk}">${kat.label}</div>
      <div class="popup-name">${mekan.isim}</div>
      <div class="popup-dist">Rotaya ${mekan.uzaklik.toFixed(1)} km uzaklıkta</div>
    </div>`, { closeButton:false });
}

// ── LİSTE ────────────────────────────────────────────────
const ICONS = { tarihi:'landmark', restoran:'utensils', muze:'image', doga:'trees', konaklama:'bed', alisveris:'shopping-bag', diger:'map-pin' };

function listeGuncelle() {
  const container = document.getElementById('place-list');
  const filtreli  = aktifFiltre === 'hepsi' ? tumMekanlar : tumMekanlar.filter(m => m.kategori === aktifFiltre);

  document.getElementById('tab-badge').textContent       = filtreli.length;
  document.getElementById('stat-places').textContent     = `${tumMekanlar.length} mekan`;
  document.getElementById('mobile-handle-count').textContent = filtreli.length;

  if (!filtreli.length) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon"><i data-lucide="search-x"></i></div><p class="empty-title">Mekan bulunamadı</p><p class="empty-desc">Bu kategoride yol üzeri mekan yok.</p></div>`;
    lucide.createIcons(); return;
  }

  container.innerHTML = filtreli.map(m => {
    const idx      = tumMekanlar.indexOf(m);
    const isAi     = aiOneriler.includes(m.isim);
    const isSec    = seciliDuraklar.has(idx);
    const aiBadge  = isAi ? `<span class="place-card-ai-badge">✨ AI</span>` : '';
    return `
    <div class="place-card cat-${m.kategori}${isAi ? ' ai-pick' : ''}" onclick="mekanDetay(${idx})">
      <div class="place-card-stripe"></div>
      <div class="place-card-body">
        <div class="place-card-name">${escHtml(m.isim)}</div>
        <div class="place-card-meta">
          <span class="place-card-cat">${KAT[m.kategori].label}</span>
          <span class="place-card-dist"><i data-lucide="move-diagonal"></i>${m.uzaklik.toFixed(1)} km</span>
          ${aiBadge}
        </div>
      </div>
      <button class="place-card-add${isSec ? ' added' : ''}" onclick="event.stopPropagation();durakToggle(${idx})" title="${isSec ? 'Plandan çıkar' : 'Plana ekle'}">
        <i data-lucide="${isSec ? 'check' : 'plus'}"></i>
      </button>
    </div>`;
  }).join('');
  lucide.createIcons();
}

function haritaOdakla(lat, lon) {
  map.setView([lat, lon], 15);
  tumMarkers.forEach(m => { const p=m.getLatLng(); if (Math.abs(p.lat-lat)<.001&&Math.abs(p.lng-lon)<.001) m.openPopup(); });
}

// ── MEKAN DETAY PANELİ ──────────────────────────────────
async function mekanDetay(idx) {
  const mekan = tumMekanlar[idx];
  if (!mekan) return;

  const kat = KAT[mekan.kategori];
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${mekan.lat},${mekan.lon}`;
  const appleUrl  = `https://maps.apple.com/?daddr=${mekan.lat},${mekan.lon}`;

  // AI verisi varsa göster, yoksa kutunu gizle
  const aiInfo = aiOneriData[mekan.isim];
  const aiBoxHtml = aiInfo ? `
    <div class="dp-ai-box">
      <div class="dp-ai-label"><i data-lucide="sparkles"></i> AI Önerisi</div>
      <div class="dp-ai-text" style="color:var(--blue);font-style:italic;margin-bottom:6px">${escHtml(aiInfo.sebep)}</div>
      <div class="dp-ai-text">${escHtml(aiInfo.aciklama)}</div>
    </div>` : '';

  document.getElementById('dp-content').innerHTML = `
    <div class="dp-badge" style="background:${kat.bg};color:${kat.renk}">
      <i data-lucide="${ICONS[mekan.kategori]}"></i>
      ${kat.label}
    </div>

    <h2 class="dp-name">${escHtml(mekan.isim)}</h2>

    <div class="dp-meta">
      <div class="dp-meta-row">
        <i data-lucide="move-diagonal"></i>
        <span>Rotaya <strong>${mekan.uzaklik.toFixed(1)} km</strong> uzaklıkta</span>
      </div>
      <div class="dp-meta-row dp-detour-row" id="dp-detour">
        <i data-lucide="timer"></i>
        <span class="dp-detour-loading">Sapma hesaplanıyor...</span>
      </div>
      <div class="dp-meta-row">
        <i data-lucide="map-pin"></i>
        <span><strong>${mekan.lat.toFixed(5)}</strong>, <strong>${mekan.lon.toFixed(5)}</strong></span>
      </div>
    </div>

    ${aiBoxHtml}

    <div class="dp-divider"></div>

    <div class="dp-nav-title">Navigasyon</div>
    <div class="dp-nav-buttons">
      <a href="${googleUrl}" target="_blank" class="dp-nav-btn google">
        <div class="btn-icon"><i data-lucide="navigation"></i></div>
        <div class="btn-text">
          <span class="btn-label">Google Maps'te Aç</span>
          <span class="btn-sub">Yol tarifi al</span>
        </div>
      </a>
      <a href="${appleUrl}" target="_blank" class="dp-nav-btn apple">
        <div class="btn-icon"><i data-lucide="map"></i></div>
        <div class="btn-text">
          <span class="btn-label">Apple Maps'te Aç</span>
          <span class="btn-sub">iPhone & Mac için</span>
        </div>
      </a>
    </div>
  `;

  document.getElementById('detail-panel').classList.add('open');
  haritaOdakla(mekan.lat, mekan.lon);
  lucide.createIcons();

  // Sapma hesabını arka planda çalıştır, hazır olunca güncelle
  const dakika = await sapmaHesapla(mekan);
  const el = document.getElementById('dp-detour');
  if (!el) return;
  if (dakika === null) {
    el.innerHTML = `<i data-lucide="timer"></i><span class="dp-detour-loading">Sapma hesaplanamadı</span>`;
  } else {
    const renk   = dakika <= 10 ? '#10B981' : dakika <= 25 ? '#F59E0B' : '#EF4444';
    const etiket = dakika <= 10 ? 'küçük sapma' : dakika <= 25 ? 'orta sapma' : 'büyük sapma';
    el.innerHTML = `<i data-lucide="timer"></i><span>+<strong>${dakika} dk</strong> · <span style="color:${renk};font-weight:600">${etiket}</span></span>`;
  }
  lucide.createIcons();
}

function detayKapat() {
  document.getElementById('detail-panel').classList.remove('open');
}

// ── FİLTRE ───────────────────────────────────────────────
function filtreUygula(btn) {
  document.querySelectorAll('.chip').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  aktifFiltre = btn.dataset.kategori;

  clusterGroup.clearLayers();
  const gorunur = aktifFiltre==='hepsi' ? tumMekanlar : tumMekanlar.filter(m=>m.kategori===aktifFiltre);
  gorunur.forEach((m,i) => clusterGroup.addLayer(tumMarkers[tumMekanlar.indexOf(m)]));
  listeGuncelle();
}

// ── STATE: HERO → UYGULAMA GEÇİŞİ ──────────────────────
const isMobile = () => window.innerWidth <= 768;

function heroGizle(start, end) {
  const hero = document.getElementById('hero');
  hero.classList.add('exit');
  setTimeout(() => { hero.style.display = 'none'; }, 400);

  document.getElementById('topbar').classList.remove('hidden');

  if (isMobile()) {
    // Mobilde: topbar'da rota özeti göster, arama gizli kalır
    const routeBar = document.getElementById('mobile-route-bar');
    routeBar.classList.remove('hidden');
    document.getElementById('mobile-route-text').textContent = `${start} → ${end}`;
    // Panel başta kapalı, handle'a basınca açılır
    const panel = document.getElementById('side-panel');
    panel.classList.remove('closed');
    panel.classList.add('open');
  } else {
    const panel = document.getElementById('side-panel');
    panel.classList.remove('closed');
    panel.classList.add('open');
  }

  setTimeout(() => map.invalidateSize(), 350);
}

// Mobil: hero'ya geri dön (rota değiştir)
function heroGoster() {
  const hero = document.getElementById('hero');
  hero.style.display = 'flex';
  hero.classList.remove('exit');
  document.getElementById('topbar').classList.add('hidden');
  document.getElementById('mobile-route-bar').classList.add('hidden');
  const panel = document.getElementById('side-panel');
  panel.classList.remove('open', 'expanded');
  panel.classList.add('closed');
}

// Mobil: bottom sheet aç/kapat
let panelExpanded = false;
function panelToggle() {
  const panel = document.getElementById('side-panel');
  panelExpanded = !panelExpanded;
  if (panelExpanded) {
    panel.classList.remove('open');
    panel.classList.add('expanded');
  } else {
    panel.classList.remove('expanded');
    panel.classList.add('open');
  }
}

// ── ARA FONKSİYONLARI ────────────────────────────────────
function heroAra() {
  const s = document.getElementById('hero-start').value.trim();
  const e = document.getElementById('hero-end').value.trim();
  if (!s || !e) { alert('Lütfen başlangıç ve hedef şehri girin.'); return; }
  document.getElementById('tb-start').value = s;
  document.getElementById('tb-end').value   = e;
  heroGizle(s, e);
  rotayiHesapla(s, e);
}

function topbarAra() {
  const s = document.getElementById('tb-start').value.trim();
  const e = document.getElementById('tb-end').value.trim();
  if (!s || !e) { alert('Lütfen başlangıç ve hedef şehri girin.'); return; }
  rotayiHesapla(s, e);
}

// ── ROTA HESAPLA ─────────────────────────────────────────
async function rotayiHesapla(start, end) {
  document.getElementById('loading-overlay').classList.remove('hidden');
  clusterGroup.clearLayers();
  tumMekanlar = []; tumMarkers = []; aiOneriler = []; aiOneriData = {};
  seciliDuraklar = new Set(); rotaKoord = [];
  document.getElementById('route-stats').classList.add('hidden');
  document.getElementById('ai-results').innerHTML = '';
  document.getElementById('plan-ai-result').innerHTML = '';
  const planBadge = document.getElementById('plan-badge');
  if (planBadge) { planBadge.style.display = 'none'; planBadge.textContent = '0'; }
  switchTab('mekanlar');

  try {
    const [bas, bit] = await Promise.all([sehirKoordinat(start), sehirKoordinat(end)]);
    rotaBas = bas; rotaBit = bit;
    const rotaKoord  = await rotaCiz(bas, bit);
    const b          = bbox(rotaKoord);
    const osmData    = await mekanCek(b);

    tumMekanlar = osmData
      .filter(el => el.tags?.name)
      .map(el => ({
        isim: el.tags.name, lat: el.lat, lon: el.lon,
        kategori: osmTagKategori(el.tags),
        uzaklik: rotayaUzaklik({ lat:el.lat, lon:el.lon }, rotaKoord)
      }))
      .filter(m => m.uzaklik <= 20)
      .sort((a,b) => a.uzaklik - b.uzaklik)
      .slice(0, 80);

    tumMarkers = tumMekanlar.map(m => mekanMarkerOlustur(m));
    tumMarkers.forEach(m => clusterGroup.addLayer(m));

    listeGuncelle();
    map.fitBounds(rotaKoord.map(k=>[k.lat,k.lng]), { padding:[40,40] });
    // Mobilde paneli otomatik genişlet
    if (isMobile()) {
      panelExpanded = true;
      const panel = document.getElementById('side-panel');
      panel.classList.remove('open');
      panel.classList.add('expanded');
    }

  } catch(err) {
    console.error(err);
    toastGoster(err.message);
  } finally {
    document.getElementById('loading-overlay').classList.add('hidden');
  }
}

// ── TOAST BİLDİRİM ───────────────────────────────────────
function toastGoster(mesaj, tip = 'hata') {
  const eski = document.getElementById('toast');
  if (eski) eski.remove();
  const t = document.createElement('div');
  t.id = 'toast';
  t.style.cssText = `
    position:fixed; bottom:24px; left:50%; transform:translateX(-50%);
    background:${tip==='hata'?'#1f2937':'#065f46'};
    color:white; padding:12px 20px; border-radius:12px;
    font-family:Inter,sans-serif; font-size:13px; font-weight:500;
    box-shadow:0 8px 24px rgba(0,0,0,.2); z-index:9999;
    max-width:90vw; text-align:center; line-height:1.4;
  `;
  t.textContent = mesaj;
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 5000);
}

// ── SEKME GEÇİŞİ ─────────────────────────────────────────
function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  document.getElementById(`tab-btn-${tab}`).classList.add('active');
  document.getElementById(`tab-${tab}`).classList.add('active');
  const labels = { mekanlar: 'Mekanlar', ai: 'AI Öneri', plan: 'Yolculuk Planı' };
  document.getElementById('mobile-handle-label').textContent = labels[tab] || 'Mekanlar';
  if (tab === 'plan') planGuncelle();
}

// ── AI ÖNERİ ─────────────────────────────────────────────

// Tercih chip seçim mantığı
document.addEventListener('click', e => {
  const btn = e.target.closest('.pref-chip');
  if (!btn) return;
  const group = btn.dataset.group;
  const isMulti = btn.classList.contains('multi');

  if (!isMulti) {
    // Tek seçim: aynı gruptaki diğerlerini kapat
    document.querySelectorAll(`.pref-chip[data-group="${group}"]`).forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  } else {
    // Çoklu seçim: toggle
    btn.classList.toggle('active');
  }
});

function getPrefValue(group) {
  const actives = [...document.querySelectorAll(`.pref-chip.active[data-group="${group}"]`)];
  const vals = actives.map(b => b.dataset.val);
  return group === 'ilgi' ? vals : (vals[0] || '');
}

async function aiOneriAl() {
  if (!tumMekanlar.length) {
    toastGoster('Önce bir rota ara, mekanlar yüklensin.', 'bilgi');
    return;
  }

  const btn = document.getElementById('btn-ai-oner');
  const results = document.getElementById('ai-results');

  btn.disabled = true;
  btn.querySelector('span').textContent = 'Düşünüyor...';
  results.innerHTML = `<div class="ai-loading"><div class="spinner"></div> AI senin için seçiyor...</div>`;

  const tercihler = {
    kim:   getPrefValue('kim'),
    ilgi:  getPrefValue('ilgi'),
    butce: getPrefValue('butce')
  };

  const payload = {
    bas: document.getElementById('tb-start').value || document.getElementById('hero-start').value,
    bit: document.getElementById('tb-end').value   || document.getElementById('hero-end').value,
    mekanlar: tumMekanlar.slice(0, 30).map(m => ({
      isim: m.isim, kategori: m.kategori, uzaklik: m.uzaklik
    })),
    tercihler
  };

  try {
    const r = await fetchWithTimeout('/api/oner', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 25000);

    if (!r.ok) throw new Error(`Sunucu hatası: ${r.status}`);
    const data = await r.json();

    if (data.hata) throw new Error(data.hata);

    aiOneriler = (data.oneriler || []).map(o => o.isim);
    aiOneriData = {};
    (data.oneriler || []).forEach(o => { aiOneriData[o.isim] = o; });
    tercihleriKaydet();
    renderAiResults(data.oneriler || []);
    listeGuncelle();
    // AI sekmesine geç, mobilse paneli genişlet, sonra sonuçlara kaydır
    switchTab('ai');
    if (isMobile() && !panelExpanded) {
      panelExpanded = true;
      const panel = document.getElementById('side-panel');
      panel.classList.remove('open');
      panel.classList.add('expanded');
    }
    setTimeout(() => {
      const inner = document.querySelector('.ai-inner');
      const results = document.getElementById('ai-results');
      if (inner && results) {
        inner.scrollTo({ top: results.offsetTop - 8, behavior: 'smooth' });
      }
    }, 150);

  } catch (err) {
    results.innerHTML = `<div class="ai-loading" style="color:#EF4444">Hata: ${escHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'AI Önerisi Al';
    lucide.createIcons();
  }
}

function renderAiResults(oneriler) {
  const results = document.getElementById('ai-results');
  if (!oneriler.length) {
    results.innerHTML = `<div class="ai-loading">Öneri oluşturulamadı.</div>`;
    return;
  }
  results.innerHTML = oneriler.map((o, i) => {
    const idx = tumMekanlar.findIndex(m => m.isim === o.isim);
    return `
    <div class="ai-card" onclick="${idx >= 0 ? `mekanDetay(${idx})` : ''}">
      <div class="ai-card-header">
        <div class="ai-card-num">${i + 1}</div>
        <div class="ai-card-name">${escHtml(o.isim)}</div>
      </div>
      <div class="ai-card-sebep">${escHtml(o.sebep)}</div>
      <div class="ai-card-aciklama">${escHtml(o.aciklama)}</div>
    </div>`;
  }).join('');
}

// ── YOLCULUK PLANI (FAZ D) ───────────────────────────────

function durakToggle(idx) {
  if (seciliDuraklar.has(idx)) {
    seciliDuraklar.delete(idx);
  } else {
    seciliDuraklar.add(idx);
  }
  listeGuncelle();
  planGuncelle();
  // Plan badge güncelle
  const badge = document.getElementById('plan-badge');
  if (badge) {
    if (seciliDuraklar.size > 0) {
      badge.textContent = seciliDuraklar.size;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }
}

function rotaFraksiyonu(lat, lon) {
  if (!rotaKoord.length) return 0;
  let minDist = Infinity, minIdx = 0;
  rotaKoord.forEach((k, i) => {
    const d = haversine(lat, lon, k.lat, k.lng);
    if (d < minDist) { minDist = d; minIdx = i; }
  });
  let cumDist = 0;
  for (let i = 1; i <= minIdx; i++) {
    cumDist += haversine(rotaKoord[i-1].lat, rotaKoord[i-1].lng, rotaKoord[i].lat, rotaKoord[i].lng);
  }
  let totalDist = 0;
  for (let i = 1; i < rotaKoord.length; i++) {
    totalDist += haversine(rotaKoord[i-1].lat, rotaKoord[i-1].lng, rotaKoord[i].lat, rotaKoord[i].lng);
  }
  return totalDist > 0 ? cumDist / totalDist : 0;
}

function dakikaToSaat(min) {
  const h = Math.floor(min / 60) % 24;
  const m = Math.floor(min % 60);
  return `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
}

function planGuncelle() {
  const container = document.getElementById('plan-stops');
  const actions   = document.getElementById('plan-actions');
  if (!container) return;

  if (!seciliDuraklar.size) {
    container.innerHTML = `
      <div class="plan-empty">
        <div class="plan-empty-icon"><i data-lucide="map-pin-plus"></i></div>
        <p>Mekanlar sekmesinden <strong>+</strong> butonuna basarak durak ekle</p>
      </div>`;
    if (actions) actions.style.display = 'none';
    lucide.createIcons(); return;
  }

  const timeVal = document.getElementById('plan-time')?.value || '08:00';
  const [hh, mm] = timeVal.split(':').map(Number);
  const departMin = hh * 60 + mm;

  const duraklar = [...seciliDuraklar]
    .map(idx => ({ idx, mekan: tumMekanlar[idx], frak: rotaFraksiyonu(tumMekanlar[idx].lat, tumMekanlar[idx].lon) }))
    .sort((a, b) => a.frak - b.frak);

  container.innerHTML = duraklar.map(({ idx, mekan, frak }, i) => {
    const arrMin  = departMin + frak * (rotaSuresi / 60);
    const saat    = dakikaToSaat(arrMin);
    const kat     = KAT[mekan.kategori];
    const isLast  = i === duraklar.length - 1;
    return `
    <div class="stop-item">
      <div class="stop-time">${saat}</div>
      <div class="stop-line">
        <div class="stop-dot" style="color:${kat.renk}"></div>
        ${!isLast ? '<div class="stop-connector"></div>' : ''}
      </div>
      <div class="stop-body">
        <div class="stop-info">
          <div class="stop-name">${escHtml(mekan.isim)}</div>
          <div class="stop-cat">${kat.label}</div>
        </div>
        <button class="stop-remove" onclick="durakToggle(${idx})">
          <i data-lucide="x"></i>
        </button>
      </div>
    </div>`;
  }).join('');

  if (actions) actions.style.display = '';
  lucide.createIcons();
}

async function planAiAl() {
  if (!seciliDuraklar.size) return;
  const btn    = document.getElementById('btn-plan-ai');
  const result = document.getElementById('plan-ai-result');
  btn.disabled = true;
  btn.querySelector('span').textContent = 'Düşünüyor...';
  result.innerHTML = `<div class="ai-loading"><div class="spinner"></div> Plan hazırlanıyor...</div>`;

  const timeVal = document.getElementById('plan-time')?.value || '08:00';
  const [hh, mm] = timeVal.split(':').map(Number);
  const departMin = hh * 60 + mm;

  const duraklar = [...seciliDuraklar]
    .map(idx => ({ mekan: tumMekanlar[idx], frak: rotaFraksiyonu(tumMekanlar[idx].lat, tumMekanlar[idx].lon) }))
    .sort((a, b) => a.frak - b.frak)
    .map(({ mekan, frak }) => ({
      isim:     mekan.isim,
      kategori: mekan.kategori,
      saat:     dakikaToSaat(departMin + frak * (rotaSuresi / 60))
    }));

  const payload = {
    bas:     document.getElementById('tb-start').value || document.getElementById('hero-start').value,
    bit:     document.getElementById('tb-end').value   || document.getElementById('hero-end').value,
    cikis:   timeVal,
    sure:    Math.round(rotaSuresi / 60),
    duraklar,
    tercihler: {
      kim:       getPrefValue('plan-kim'),
      stil:      getPrefValue('plan-stil'),
      konaklama: getPrefValue('plan-konaklama')
    }
  };

  try {
    const r = await fetchWithTimeout('/api/plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }, 30000);
    if (!r.ok) throw new Error(`Sunucu hatası: ${r.status}`);
    const data = await r.json();
    if (data.hata) throw new Error(data.hata);
    tercihleriKaydet();
    renderPlanResult(data);
  } catch (err) {
    result.innerHTML = `<div class="ai-loading" style="color:#EF4444">Hata: ${escHtml(err.message)}</div>`;
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = 'AI Plan Oluştur';
    lucide.createIcons();
  }
}

function renderPlanResult(data) {
  const result = document.getElementById('plan-ai-result');
  const items  = data.plan  || [];
  const ozet   = data.ozet  || '';
  result.innerHTML = `
    ${ozet ? `<div class="plan-ozet">${escHtml(ozet)}</div>` : ''}
    ${items.map(item => `
      <div class="plan-result-item">
        <div class="plan-result-time">${escHtml(item.saat || '')}</div>
        <div>
          ${item.sure ? `<div class="plan-result-sure">${escHtml(item.sure)}</div>` : ''}
          <div class="plan-result-name">${escHtml(item.yer || '')}</div>
          <div class="plan-result-tip">${escHtml(item.mesaj || '')}</div>
        </div>
      </div>`).join('')}`;
  lucide.createIcons();
}

function planMapsAc() {
  if (!seciliDuraklar.size || !rotaBas || !rotaBit) return;
  const duraklar = [...seciliDuraklar]
    .map(idx => tumMekanlar[idx])
    .sort((a, b) => rotaFraksiyonu(a.lat, a.lon) - rotaFraksiyonu(b.lat, b.lon));
  const son  = duraklar[duraklar.length - 1];
  const orta = duraklar.slice(0, -1);
  let url = `https://www.google.com/maps/dir/${rotaBas[0]},${rotaBas[1]}/`;
  orta.forEach(d => { url += `${d.lat},${d.lon}/`; });
  url += `${son.lat},${son.lon}/${rotaBit[0]},${rotaBit[1]}/`;
  window.open(url, '_blank');
}

// ── PLANI PAYLAŞ (link ile) ──────────────────────────────
function planPaylas() {
  if (!rotaBas || !tumMekanlar.length) { toastGoster('Önce bir rota planla.', 'bilgi'); return; }
  const bas = document.getElementById('tb-start').value || document.getElementById('hero-start').value;
  const bit = document.getElementById('tb-end').value   || document.getElementById('hero-end').value;
  const duraklar = [...seciliDuraklar].map(i => {
    const m = tumMekanlar[i];
    return { isim: m.isim, lat: m.lat, lon: m.lon, kategori: m.kategori };
  });
  const kod = btoa(unescape(encodeURIComponent(JSON.stringify({ bas, bit, duraklar }))));
  const url = `${location.origin}/?plan=${kod}`;
  if (navigator.clipboard) {
    navigator.clipboard.writeText(url).then(
      () => toastGoster('Paylaşım linki kopyalandı! ✓', 'basari'),
      () => prompt('Linki kopyala:', url)
    );
  } else {
    prompt('Linki kopyala:', url);
  }
}

async function paylasimLinkiKontrol() {
  const kod = new URLSearchParams(location.search).get('plan');
  if (!kod) return;
  try {
    const p = JSON.parse(decodeURIComponent(escape(atob(kod))));
    if (!p.bas || !p.bit) return;
    document.getElementById('tb-start').value   = p.bas;
    document.getElementById('tb-end').value     = p.bit;
    document.getElementById('hero-start').value = p.bas;
    document.getElementById('hero-end').value   = p.bit;
    heroGizle(p.bas, p.bit);
    await rotayiHesapla(p.bas, p.bit);
    const savedNames = new Set((p.duraklar || []).map(d => d.isim));
    seciliDuraklar = new Set();
    tumMekanlar.forEach((m, i) => { if (savedNames.has(m.isim)) seciliDuraklar.add(i); });
    listeGuncelle(); planGuncelle();
    const badge = document.getElementById('plan-badge');
    if (badge && seciliDuraklar.size) { badge.textContent = seciliDuraklar.size; badge.style.display = ''; }
    toastGoster('Paylaşılan rota yüklendi! 🗺️', 'basari');
  } catch (e) {
    console.warn('Paylaşım linki çözülemedi:', e);
  }
}

// ── ÜYELİK & KAYDETME (Supabase) ─────────────────────────
const SUPABASE_URL = 'https://tnbmblkxikorxztctrlh.supabase.co';
const SUPABASE_KEY = 'sb_publishable_NUayPw1ODqCOOWUA9p3kEw_IpvToJhH';
const sb = (window.supabase && window.supabase.createClient)
  ? window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY)
  : null;

let authMode = 'giris';
let aktifKullanici = null;
let kayitliRotalar = [];

if (sb) {
  sb.auth.onAuthStateChange((_event, session) => {
    aktifKullanici = session?.user || null;
    accountUIGuncelle();
    if (aktifKullanici?.user_metadata?.tercihler) tercihleriUygula(aktifKullanici.user_metadata.tercihler);
  });
  sb.auth.getSession().then(({ data }) => {
    aktifKullanici = data.session?.user || null;
    accountUIGuncelle();
    if (aktifKullanici?.user_metadata?.tercihler) tercihleriUygula(aktifKullanici.user_metadata.tercihler);
  });
}

// Tercihleri profil verisine kaydet (giriş yapılmışsa)
async function tercihleriKaydet() {
  if (!aktifKullanici) return;
  const prefs = {
    kim:      getPrefValue('kim'),
    ilgi:     getPrefValue('ilgi'),
    butce:    getPrefValue('butce'),
    planKim:  getPrefValue('plan-kim'),
    planStil: getPrefValue('plan-stil'),
    planKon:  getPrefValue('plan-konaklama')
  };
  try { await sb.auth.updateUser({ data: { tercihler: prefs } }); } catch (e) { /* sessiz */ }
}

function prefGrubuAyarla(group, values) {
  const vals = Array.isArray(values) ? values : [values];
  document.querySelectorAll(`.pref-chip[data-group="${group}"]`).forEach(b => {
    b.classList.toggle('active', vals.includes(b.dataset.val));
  });
}

function tercihleriUygula(p) {
  if (!p) return;
  if (p.kim)                 prefGrubuAyarla('kim', p.kim);
  if (p.ilgi && p.ilgi.length) prefGrubuAyarla('ilgi', p.ilgi);
  if (p.butce)               prefGrubuAyarla('butce', p.butce);
  if (p.planKim)             prefGrubuAyarla('plan-kim', p.planKim);
  if (p.planStil)            prefGrubuAyarla('plan-stil', p.planStil);
  if (p.planKon)             prefGrubuAyarla('plan-konaklama', p.planKon);
}

function accountUIGuncelle() {
  const btn     = document.getElementById('account-btn');
  const label   = document.getElementById('account-label');
  const menu    = document.getElementById('account-menu');
  const emailEl = document.getElementById('account-menu-email');
  if (!btn) return;
  if (aktifKullanici) {
    btn.classList.add('logged-in');
    label.textContent   = aktifKullanici.email.split('@')[0];
    emailEl.textContent = aktifKullanici.email;
  } else {
    btn.classList.remove('logged-in');
    label.textContent = 'Giriş';
    menu.classList.add('hidden');
  }
}

function accountBtnClick() {
  if (aktifKullanici) {
    document.getElementById('account-menu').classList.toggle('hidden');
  } else {
    authModalAc();
  }
}

// Menü dışına tıklayınca kapat
document.addEventListener('click', e => {
  const area = document.querySelector('.account-area');
  if (area && !area.contains(e.target)) {
    document.getElementById('account-menu')?.classList.add('hidden');
  }
});

function authModalAc() {
  document.getElementById('auth-modal').classList.remove('hidden');
  const msg = document.getElementById('auth-msg');
  msg.textContent = ''; msg.className = 'auth-msg';
}
function authModalKapat() {
  document.getElementById('auth-modal').classList.add('hidden');
}

function authTabDegis(mode) {
  authMode = mode;
  document.getElementById('auth-tab-giris').classList.toggle('active', mode === 'giris');
  document.getElementById('auth-tab-kayit').classList.toggle('active', mode === 'kayit');
  document.getElementById('auth-title').textContent  = mode === 'giris' ? 'Giriş Yap' : 'Kayıt Ol';
  document.getElementById('auth-submit').textContent = mode === 'giris' ? 'Giriş Yap' : 'Kayıt Ol';
  const msg = document.getElementById('auth-msg');
  msg.textContent = ''; msg.className = 'auth-msg';
}

function cevirHata(m) {
  if (/Invalid login/i.test(m))        return 'E-posta veya şifre hatalı.';
  if (/already registered/i.test(m))   return 'Bu e-posta zaten kayıtlı. Giriş yapmayı dene.';
  if (/at least 6/i.test(m))           return 'Şifre en az 6 karakter olmalı.';
  if (/Email not confirmed/i.test(m))  return 'E-posta onayı gerekli (Supabase ayarlarından kapatabilirsin).';
  if (/valid email/i.test(m))          return 'Geçerli bir e-posta gir.';
  return m;
}

async function authGonder() {
  const email = document.getElementById('auth-email').value.trim();
  const pass  = document.getElementById('auth-password').value;
  const msg   = document.getElementById('auth-msg');
  const btn   = document.getElementById('auth-submit');
  if (!sb) { msg.className = 'auth-msg error'; msg.textContent = 'Giriş sistemi yüklenemedi, sayfayı yenile.'; return; }
  if (!email || !pass) {
    msg.className = 'auth-msg error'; msg.textContent = 'E-posta ve şifre gerekli.';
    return;
  }
  btn.disabled = true;
  msg.className = 'auth-msg'; msg.textContent = 'Lütfen bekle...';
  try {
    if (authMode === 'kayit') {
      const { error } = await sb.auth.signUp({ email, password: pass });
      if (error) throw error;
      msg.className = 'auth-msg success'; msg.textContent = 'Kayıt başarılı! 🎉';
    } else {
      const { error } = await sb.auth.signInWithPassword({ email, password: pass });
      if (error) throw error;
    }
    setTimeout(() => { authModalKapat(); toastGoster('Hoş geldin! ✓', 'basari'); }, 500);
  } catch (err) {
    msg.className = 'auth-msg error'; msg.textContent = cevirHata(err.message || String(err));
  } finally {
    btn.disabled = false;
  }
}

async function cikisYap() {
  await sb.auth.signOut();
  document.getElementById('account-menu').classList.add('hidden');
  toastGoster('Çıkış yapıldı.', 'bilgi');
}

async function rotaKaydet() {
  if (!aktifKullanici) { authModalAc(); return; }
  if (!rotaBas || !tumMekanlar.length) { toastGoster('Önce bir rota hesapla.', 'bilgi'); return; }
  const bas = document.getElementById('tb-start').value || document.getElementById('hero-start').value;
  const bit = document.getElementById('tb-end').value   || document.getElementById('hero-end').value;
  const duraklar = [...seciliDuraklar].map(i => {
    const m = tumMekanlar[i];
    return { isim: m.isim, lat: m.lat, lon: m.lon, kategori: m.kategori };
  });
  const { error } = await sb.from('trips').insert({ user_id: aktifKullanici.id, bas, bit, duraklar });
  if (error) { toastGoster('Kaydedilemedi: ' + error.message); return; }
  toastGoster('Rota kaydedildi! ✓', 'basari');
}

async function rotalarimAc() {
  document.getElementById('account-menu').classList.add('hidden');
  if (!aktifKullanici) { authModalAc(); return; }
  const modal = document.getElementById('trips-modal');
  const list  = document.getElementById('trips-list');
  modal.classList.remove('hidden');
  list.innerHTML = `<div class="trips-empty">Yükleniyor...</div>`;
  const { data, error } = await sb.from('trips').select('*').order('created_at', { ascending: false });
  if (error)        { list.innerHTML = `<div class="trips-empty">Hata: ${escHtml(error.message)}</div>`; return; }
  if (!data.length) { list.innerHTML = `<div class="trips-empty">Henüz kayıtlı rotan yok.<br>Bir rota planla ve "Rotamı Kaydet" de.</div>`; return; }
  kayitliRotalar = data;
  list.innerHTML = data.map(t => {
    const adet  = (t.duraklar || []).length;
    const tarih = new Date(t.created_at).toLocaleDateString('tr-TR');
    return `
    <div class="trip-card" onclick="rotaYukle('${t.id}')">
      <div class="trip-card-body">
        <div class="trip-card-route">${escHtml(t.bas)} → ${escHtml(t.bit)}</div>
        <div class="trip-card-meta">${adet} durak · ${tarih}</div>
      </div>
      <button class="trip-card-del" onclick="event.stopPropagation();rotaSil('${t.id}')">
        <i data-lucide="trash-2"></i>
      </button>
    </div>`;
  }).join('');
  lucide.createIcons();
}

function tripsModalKapat() {
  document.getElementById('trips-modal').classList.add('hidden');
}

async function rotaYukle(id) {
  const trip = kayitliRotalar.find(t => String(t.id) === String(id));
  if (!trip) return;
  tripsModalKapat();
  document.getElementById('tb-start').value   = trip.bas;
  document.getElementById('tb-end').value     = trip.bit;
  document.getElementById('hero-start').value = trip.bas;
  document.getElementById('hero-end').value   = trip.bit;
  if (document.getElementById('hero').style.display !== 'none') heroGizle(trip.bas, trip.bit);
  await rotayiHesapla(trip.bas, trip.bit);
  // Kayıtlı durakları isimle eşleştirip yeniden seç
  const savedNames = new Set((trip.duraklar || []).map(d => d.isim));
  seciliDuraklar = new Set();
  tumMekanlar.forEach((m, i) => { if (savedNames.has(m.isim)) seciliDuraklar.add(i); });
  listeGuncelle(); planGuncelle();
  const badge = document.getElementById('plan-badge');
  if (badge) {
    if (seciliDuraklar.size) { badge.textContent = seciliDuraklar.size; badge.style.display = ''; }
    else badge.style.display = 'none';
  }
}

async function rotaSil(id) {
  if (!confirm('Bu rotayı silmek istediğine emin misin?')) return;
  const { error } = await sb.from('trips').delete().eq('id', id);
  if (error) { toastGoster('Silinemedi: ' + error.message); return; }
  rotalarimAc();
}

// ── AUTOCOMPLETE KURULUM ─────────────────────────────────
setupAutocomplete('hero-start', 'drop-hs');
setupAutocomplete('hero-end',   'drop-he');
setupAutocomplete('tb-start',   'drop-ts');
setupAutocomplete('tb-end',     'drop-te');

// ── ENTER TUŞU ───────────────────────────────────────────
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('hero').style.display !== 'none') heroAra();
  else topbarAra();
});

// ── BAŞLANGIÇ: paylaşım linki var mı? ────────────────────
paylasimLinkiKontrol();
