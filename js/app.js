/* PROCASEF – carte Leaflet des opérations foncières par commune
   Données : window.COMMUNES, PAYS, GRAPPES, REGIONS (dossier data/) */
(function () {
  'use strict';

  var IND = {
    i: ['Inventaires', 'Parcelles inventoriées'],
    n: ['NICAD', 'NICAD générés'],
    l: ['Délibérations', 'Parcelles délibérées'],
    a: ['Approbations', 'Parcelles approuvées']
  };
  var ORDER = ['i', 'n', 'l', 'a'];
  var GC = {
    'Vallée du Fleuve Sénégal et Ferlo': '#6fb0ff',
    'Grand Dakar': '#a0ff70',
    'Bassin Arachidier': '#86694a',
    'Casamance Naturelle': '#3da600',
    'Boundou': '#fdd07a'
  };
  var GS = {
    'Vallée du Fleuve Sénégal et Ferlo': 'Vallée',
    'Grand Dakar': 'Dakar',
    'Bassin Arachidier': 'Arachidier',
    'Casamance Naturelle': 'Casamance',
    'Boundou': 'Boundou'
  };
  var REGION_LABEL = {
    DAKAR: 'Dakar', DIOURBEL: 'Diourbel', FATICK: 'Fatick', KAFFRINE: 'Kaffrine',
    KAOLACK: 'Kaolack', KEDOUGOU: 'Kédougou', KOLDA: 'Kolda', LOUGA: 'Louga',
    MATAM: 'Matam', 'SAINT-LOUIS': 'Saint-Louis', SEDHIOU: 'Sédhiou',
    TAMBACOUNDA: 'Tambacounda', THIES: 'Thiès', ZIGUINCHOR: 'Ziguinchor'
  };
  var COLS = ['--c1', '--c2', '--c3', '--c4', '--c5'].map(function (c) { return 'var(' + c + ')'; });
  var CT = [['MAURITANIE', -11.6, 17.3], ['MALI', -11.2, 14.6], ['GUINÉE', -12.3, 11.4], ['GUINÉE-B.', -15.1, 12.1],
    ['THE GAMBIA', -15.4, 13.52, 'cty gm'], ['Gorgol', -12.8, 16.0, 'rgn'], ['Guidimaka', -12.25, 15.4, 'rgn']];
  var PL = [['Dakar', -17.44, 14.69], ['Saint-Louis', -16.49, 16.03], ['Thiès', -16.93, 14.79],
    ['Touba', -15.88, 14.85], ['Kaolack', -16.07, 14.15], ['Tambacounda', -13.67, 13.77],
    ['Kolda', -14.95, 12.89], ['Ziguinchor', -16.27, 12.58], ['Matam', -13.26, 15.66],
    ['Kédougou', -12.18, 12.56], ['Banjul', -16.58, 13.45], ['Rosso', -15.81, 16.51],
    ['Kaédi', -13.51, 16.15], ['Kiffa', -11.4, 16.62], ['Sélibabi', -12.18, 15.16], ['Kayes', -11.44, 14.45]];

  var feats = window.COMMUNES.features;
  var key = 'g';
  var scale = null;
  var layerOf = new Map();
  var region = '';
  var grappe = '';
  var selected = null;
  var hot = null;
  var namesOn = true;

  function fmt(v) {
    return v == null ? 'n.d.' : String(Math.round(v)).replace(/\B(?=(\d{3})+(?!\d))/g, '\u202f');
  }
  function sum(arr, k) {
    return arr.reduce(function (s, f) { return s + (f.properties[k] || 0); }, 0);
  }
  function name(p) { return p.c || 'Zone non nommée'; }
  function regionName(r) { return REGION_LABEL[r] || r || ''; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function fold(s) {
    return String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  }
  function metricKey() { return key === 'g' ? 'i' : key; }
  function matches(f) {
    var p = f.properties;
    if (region && p.r !== region) return false;
    if (grappe && p.g !== grappe) return false;
    return true;
  }
  function inRegion(f) { return !region || f.properties.r === region; }
  function scopeFeats() { return feats.filter(inRegion); }
  function visibleFeats() { return feats.filter(matches); }
  function named(list) { return list.filter(function (f) { return f.properties.c; }); }

  function centroid(geom) {
    var polys = geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates, best = null, bestA = -1;
    polys.forEach(function (rings) {
      var r = rings[0], a = 0, cx = 0, cy = 0;
      for (var i = 0, j = r.length - 1; i < r.length; j = i++) {
        var f = r[j][0] * r[i][1] - r[i][0] * r[j][1];
        a += f; cx += (r[j][0] + r[i][0]) * f; cy += (r[j][1] + r[i][1]) * f;
      }
      a /= 2;
      if (Math.abs(a) > bestA && a !== 0) { bestA = Math.abs(a); best = [cy / (6 * a), cx / (6 * a)]; }
    });
    return best || [0, 0];
  }

  function quantile(sorted, p) {
    var h = (sorted.length - 1) * p, lo = Math.floor(h), hi = Math.ceil(h);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (h - lo);
  }
  function buildScale() {
    if (key === 'g') { scale = null; return; }
    var v = feats.map(function (f) { return f.properties[key]; })
      .filter(function (x) { return x != null && x > 0; }).sort(function (a, b) { return a - b; });
    if (!v.length) { scale = { th: [0, 0, 0, 0], min: 0, max: 0 }; return; }
    scale = { th: [1, 2, 3, 4].map(function (i) { return quantile(v, i / 5); }), min: v[0], max: v[v.length - 1] };
  }
  /* Couleur de base de la grappe, sans dégradé ; gris si la valeur est absente ou nulle */
  function colorOf(f) {
    var p = f.properties;
    if (key === 'g') return GC[p.g] || 'var(--nd)';
    var v = p[key];
    if (v == null || v === 0) return 'var(--nd)';
    return GC[p.g] || 'var(--nd)';
  }
  function dot(g) {
    return GC[g] ? '<i class="sw" style="background:' + GC[g] + '"></i>' : '';
  }
  function share(part, base) {
    if (part == null || !base) return null;
    return Math.round(100 * part / base);
  }
  function linesHtml(p) {
    return ORDER.map(function (x) {
      return '<div class="ln"><span>' + IND[x][0] + '</span><b>' + fmt(p[x]) + '</b></div>';
    }).join('');
  }
  function pipeHtml(p) {
    var base = p.i || 0;
    return '<div class="pipe">' + ORDER.map(function (x) {
      var pct = x === 'i' ? (base ? 100 : 0) : share(p[x], base);
      var w = pct == null ? 0 : Math.max(0, Math.min(100, pct));
      var label = x === 'i' ? fmt(p[x]) : (pct == null ? 'n.d.' : pct + ' %');
      return '<div class="ln"><span>' + IND[x][0] + '</span><b>' + label + '</b></div>' +
        '<div class="mini"><i style="width:' + w + '%;background:' + (GC[p.g] || 'var(--pr)') + '"></i></div>';
    }).join('') + '</div>';
  }
  function tipHtml(f, full) {
    var p = f.properties;
    return '<b>' + esc(name(p)) + '</b><br><small>' + esc(regionName(p.r)) + ' · ' + dot(p.g) + esc(p.g) + '</small>' +
      (full ? pipeHtml(p) : linesHtml(p));
  }

  var map = L.map('map', { zoomSnap: 0.25, minZoom: 5, maxZoom: 13, zoomControl: true, attributionControl: true });
  map.attributionControl.setPrefix('<a href="https://leafletjs.com">Leaflet</a>');
  L.control.scale({ imperial: false, position: 'bottomleft' }).addTo(map);
  var Home = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
      var b = L.DomUtil.create('button', 'home-btn');
      b.type = 'button';
      b.title = 'Recentrer sur les communes';
      b.setAttribute('aria-label', 'Recentrer sur les communes');
      b.textContent = '⌂';
      L.DomEvent.disableClickPropagation(b);
      L.DomEvent.on(b, 'click', function (ev) {
        L.DomEvent.stop(ev);
        map.fitBounds(bounds, { padding: [10, 10] });
      });
      return b;
    }
  });
  new Home().addTo(map);
  var North = L.Control.extend({
    options: { position: 'topleft' },
    onAdd: function () {
      var d = L.DomUtil.create('div', 'north');
      d.setAttribute('aria-label', 'Nord');
      d.innerHTML = '<span>N</span><svg viewBox="0 0 24 34" width="22" height="32" aria-hidden="true"><path d="M12 0 L23 33 L12 25 L1 33 Z" fill="currentColor"/></svg>';
      return d;
    }
  });
  new North().addTo(map);

  [['basePane', 300], ['regPane', 410], ['grpPane', 420], ['lblPane', 430]].forEach(function (x) {
    map.createPane(x[0]).style.zIndex = x[1];
  });
  map.getPane('lblPane').style.pointerEvents = 'none';

  var osm = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18, attribution: '© contributeurs OpenStreetMap'
  });

  function labelMarker(latlng, text, cls) {
    return L.marker(latlng, {
      pane: 'lblPane', interactive: false, keyboard: false,
      icon: L.divIcon({ className: 'lbl ' + cls, html: '<span>' + esc(text) + '</span>', iconSize: null })
    });
  }

  var baseGeo = L.geoJSON(window.PAYS, {
    pane: 'basePane', interactive: false,
    style: { weight: 0.6, fillOpacity: 1 },
    onEachFeature: function (f, l) {
      var n = f.properties.n;
      l.options.className = 'b ' + (n === 'Senegal' ? 'b-sn' : 'b-ot' + (n === 'Gambia' ? ' b-gm' : ''));
    }
  });
  var baseCom = L.geoJSON(window.COMMUNES_SN, {
    pane: 'basePane', interactive: false,
    style: { weight: 0.5, fillOpacity: 1 },
    onEachFeature: function (f, l) { l.options.className = 'bc'; }
  });
  var baseLbl = L.layerGroup(CT.map(function (c) { return labelMarker([c[2], c[1]], c[0], c[3] || 'cty'); }));
  var baseGroup = L.layerGroup([baseGeo, baseLbl]).addTo(map);
  baseCom.addTo(map);

  function setFlag(f, cls, on) {
    var l = layerOf.get(f), el = l && l.getElement();
    if (el) el.classList.toggle(cls, on);
    if (on && l) l.bringToFront();
  }

  var comGeo = L.geoJSON(window.COMMUNES, {
    style: { weight: 0.6, fillOpacity: 1 },
    bubblingMouseEvents: false,
    onEachFeature: function (f, l) {
      l.options.className = 'c';
      layerOf.set(f, l);
      l.bindTooltip(function () { return '<b>' + esc(name(f.properties)) + '</b>'; }, { sticky: true, className: 'tipx', direction: 'top', opacity: 1 });
      l.on('mouseover', function () { l.bringToFront(); });
      l.on('click', function () { choose(f); });
    }
  }).addTo(map);

  var regGeo = L.geoJSON(window.REGIONS, {
    pane: 'regPane', interactive: false, style: { weight: 1, fill: false },
    onEachFeature: function (f, l) { l.options.className = 'rg'; }
  });
  var regLbl = L.layerGroup(window.REGIONS.features.map(function (f) {
    return labelMarker(centroid(f.geometry), f.properties.n, '');
  }));
  var regGroup = L.layerGroup([regGeo, regLbl]).addTo(map);

  var grpGeo = L.geoJSON(window.GRAPPES, {
    pane: 'grpPane', interactive: false, style: { weight: 3.5, color: '#000', opacity: 1, fill: false },
    onEachFeature: function (f, l) { l.options.className = 'gl'; }
  });
  var grpLbl = L.layerGroup(window.GRAPPES.features.map(function (f) {
    return labelMarker(centroid(f.geometry), f.properties.n, 'gt');
  }));
  var grpGroup = L.layerGroup([grpGeo, grpLbl]);

  var cities = L.layerGroup();
  PL.forEach(function (p) {
    L.marker([p[2], p[1]], {
      pane: 'lblPane', interactive: false, keyboard: false,
      icon: L.divIcon({ className: '', html: '<div class="dot"></div>', iconSize: [7, 7] })
    }).addTo(cities);
    labelMarker([p[2], p[1]], p[0], 'pl').addTo(cities);
  });

  var nameLabels = L.layerGroup();
  feats.forEach(function (f) {
    if (!f.properties.c) return;
    var m = labelMarker(centroid(f.geometry), f.properties.c, 'cn');
    m._feat = f;
    nameLabels.addLayer(m);
  });

  function syncCities() { map[map.getZoom() >= 7 ? 'addLayer' : 'removeLayer'](cities); }
  function syncNames() {
    var show = namesOn && map.getZoom() >= 9;
    if (show) {
      if (!map.hasLayer(nameLabels)) nameLabels.addTo(map);
      nameLabels.eachLayer(function (m) {
        var el = m.getElement();
        if (el) el.style.display = matches(m._feat) ? '' : 'none';
      });
    } else if (map.hasLayer(nameLabels)) {
      map.removeLayer(nameLabels);
    }
  }
  map.on('zoomend', function () { syncCities(); syncNames(); });

  var bounds = comGeo.getBounds();
  map.fitBounds(bounds, { padding: [10, 10] });
  map.setMaxBounds(bounds.pad(1.5));
  syncCities();

  function fitList(list) {
    var b = L.latLngBounds([]);
    list.forEach(function (f) {
      var l = layerOf.get(f);
      if (l) b.extend(l.getBounds());
    });
    if (b.isValid()) map.fitBounds(b, { padding: [24, 24], maxZoom: 10 });
  }

  function drawLegend() {
    var el = document.getElementById('leg');
    el.innerHTML = (key === 'g' ? '' : '<span class="lt">' + esc(IND[key][1]) + '</span>') +
      Object.keys(GC).map(function (n) {
        return '<span><i style="background:' + GC[n] + '"></i>' + esc(n) + '</span>';
      }).join('') +
      (key === 'g' ? '' : '<span><i style="background:var(--nd)"></i>Non renseigné / 0</span>') +
      '<span><i style="background:var(--land);border:1px solid var(--mu)"></i>Hors phase initiale</span>' +
      '<span><i style="background:none;border:1px solid #8a8a8a"></i>Régions</span>';
  }

  var osmOn = false;
  function paint() {
    layerOf.forEach(function (l, f) {
      var el = l.getElement();
      if (!el) return;
      var on = matches(f);
      el.style.fill = colorOf(f);
      el.style.fillOpacity = osmOn ? (on ? 0.78 : 0.15) : (on ? 1 : 0.18);
      el.classList.toggle('sel', f === selected);
      el.classList.toggle('hot', f === hot);
    });
    syncNames();
  }

  function scopeLabel() {
    var n = named(visibleFeats()).length;
    var bits = [n + ' commune' + (n > 1 ? 's' : '')];
    bits.push(region ? regionName(region) : 'toutes les régions');
    bits.push(grappe ? (GS[grappe] || grappe) : 'toutes les grappes');
    return bits.join(' · ');
  }

  var panel = document.getElementById('panel');
  L.DomEvent.disableClickPropagation(document.getElementById('leg'));
  L.DomEvent.disableScrollPropagation(document.getElementById('leg'));

  function panelHtml(f) {
    var p = f.properties;
    return '<button type="button" class="pnl-x" id="pnl-x" aria-label="Fermer">&times;</button>' +
      '<h3>' + esc(name(p)) + '</h3>' +
      '<div class="pnl-sub">' + esc(regionName(p.r)) + '<br>' + dot(p.g) + esc(p.g || '') + '</div>' +
      '<h4>Parcelles</h4>' + linesHtml(p) +
      '<h4>Chaîne foncière <small>(% de l’inventaire)</small></h4>' + pipeHtml(p);
  }

  function choose(f) {
    if (selected && selected !== f) setFlag(selected, 'sel', false);
    selected = f;
    setFlag(f, 'sel', true);
    panel.innerHTML = panelHtml(f);
    panel.classList.add('open');
  }

  function unselect() {
    if (selected) setFlag(selected, 'sel', false);
    selected = null;
    panel.classList.remove('open');
  }

  panel.addEventListener('click', function (e) {
    if (e.target.closest('#pnl-x')) unselect();
  });
  map.on('click', unselect);

  /* Recherche de commune (insensible aux accents : commune, région, grappe) */
  var q = document.getElementById('q'), sr = document.getElementById('sr'), hits = [], cur = -1;
  L.DomEvent.disableClickPropagation(document.getElementById('srch'));
  L.DomEvent.disableScrollPropagation(document.getElementById('srch'));

  function search() {
    var s = fold(q.value);
    if (!s) return [];
    return named(feats).filter(function (f) {
      var p = f.properties;
      return fold(p.c + ' ' + regionName(p.r) + ' ' + p.g).indexOf(s) >= 0;
    }).sort(function (a, b) {
      var sa = fold(a.properties.c).indexOf(s) === 0 ? 0 : 1, sb = fold(b.properties.c).indexOf(s) === 0 ? 0 : 1;
      return sa - sb || a.properties.c.localeCompare(b.properties.c, 'fr');
    }).slice(0, 8);
  }
  function drawHits() {
    hits = search();
    cur = -1;
    if (!hits.length) {
      sr.innerHTML = q.value.trim() ? '<div class="sr-e">Aucune commune trouvée</div>' : '';
      sr.classList.toggle('open', !!q.value.trim());
      return;
    }
    sr.innerHTML = hits.map(function (f, i) {
      var p = f.properties;
      return '<div class="sr-r" role="option" data-h="' + i + '"><b>' + esc(p.c) + '</b><small>' +
        esc(regionName(p.r)) + ' · ' + dot(p.g) + esc(GS[p.g] || p.g) + '</small></div>';
    }).join('');
    sr.classList.add('open');
  }
  function markHit() {
    sr.querySelectorAll('.sr-r').forEach(function (r, i) { r.classList.toggle('on', i === cur); });
  }
  function go(f) {
    choose(f);
    var l = layerOf.get(f);
    if (l) map.fitBounds(l.getBounds(), { maxZoom: 11, paddingTopLeft: [30, 70], paddingBottomRight: [330, 30] });
    q.value = f.properties.c;
    sr.classList.remove('open');
    q.blur();
  }
  q.addEventListener('input', drawHits);
  q.addEventListener('focus', function () { if (q.value.trim()) drawHits(); });
  q.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!hits.length) return;
      cur = (cur + (e.key === 'ArrowDown' ? 1 : -1) + hits.length) % hits.length;
      markHit();
    } else if (e.key === 'Enter') {
      e.preventDefault();
      var f = hits[cur >= 0 ? cur : 0];
      if (f) go(f);
    } else if (e.key === 'Escape') {
      sr.classList.remove('open');
      q.blur();
      e.stopPropagation();
    }
  });
  sr.addEventListener('click', function (e) {
    var r = e.target.closest('[data-h]');
    if (r) go(hits[+r.getAttribute('data-h')]);
  });
  document.addEventListener('click', function (e) {
    if (!e.target.closest('#srch')) sr.classList.remove('open');
  });

  function updateTabs() {
    var list = visibleFeats();
    var gset = {};
    list.forEach(function (f) { if (f.properties.g) gset[f.properties.g] = 1; });
    document.querySelector('#tabs button[data-k="g"] b').textContent = String(Object.keys(gset).length);
    ORDER.forEach(function (k) {
      document.querySelector('#tabs button[data-k="' + k + '"] b').textContent = fmt(sum(list, k));
    });
    document.querySelectorAll('#tabs button').forEach(function (b) {
      var on = b.getAttribute('data-k') === key;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
  }

  function draw() {
    buildScale();
    paint();
    updateTabs();
    drawLegend();
    document.getElementById('scope').textContent = scopeLabel();
  }

  var tabs = document.getElementById('tabs');
  tabs.innerHTML = '<button type="button" role="tab" data-k="g"><b>5</b><span>Grappes</span></button>' +
    ORDER.map(function (k) {
      return '<button type="button" role="tab" data-k="' + k + '"><b>0</b><span>' + IND[k][0] + '</span></button>';
    }).join('');
  tabs.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    key = b.getAttribute('data-k');
    draw();
  });

  function toggle(id, group) {
    document.getElementById(id).addEventListener('change', function (e) {
      if (e.target.checked) group.addTo(map); else map.removeLayer(group);
    });
  }
  toggle('lg', grpGroup);
  toggle('lr', regGroup);
  document.getElementById('lc').addEventListener('change', function (e) {
    if (e.target.checked) { baseCom.addTo(map); baseCom.bringToFront(); } else map.removeLayer(baseCom);
  });

  var lb = document.getElementById('lb'), lt = document.getElementById('lt'), mapEl = document.getElementById('map');
  function syncBase() {
    if (lb.checked && !osmOn) baseGroup.addTo(map); else map.removeLayer(baseGroup);
    if (map.hasLayer(baseCom)) baseCom.bringToFront();
    mapEl.classList.toggle('nobase', !lb.checked && !osmOn);
  }
  lb.addEventListener('change', syncBase);
  lt.addEventListener('change', function () {
    osmOn = lt.checked;
    mapEl.classList.toggle('osm', osmOn);
    if (osmOn) osm.addTo(map); else map.removeLayer(osm);
    syncBase();
    paint();
  });
  document.getElementById('ln').addEventListener('change', function (e) {
    namesOn = e.target.checked;
    syncNames();
  });

  function applyTheme(mode) {
    if (mode) document.documentElement.setAttribute('data-theme', mode);
    else document.documentElement.removeAttribute('data-theme');
    try { localStorage.setItem('procasef-theme', mode || ''); } catch (e) {}
    var dark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.hasAttribute('data-theme') &&
        window.matchMedia('(prefers-color-scheme: dark)').matches);
    document.getElementById('theme').textContent = dark ? 'Clair' : 'Sombre';
    document.getElementById('theme').setAttribute('aria-label', dark ? 'Passer au thème clair' : 'Passer au thème sombre');
  }
  document.getElementById('theme').addEventListener('click', function () {
    var cur = document.documentElement.getAttribute('data-theme');
    var dark = cur === 'dark' || (!cur && window.matchMedia('(prefers-color-scheme: dark)').matches);
    applyTheme(dark ? 'light' : 'dark');
  });
  applyTheme(document.documentElement.getAttribute('data-theme'));

  document.addEventListener('keydown', function (e) {
    var tag = (e.target.tagName || '').toLowerCase();
    if (e.key === '/' && tag !== 'input' && tag !== 'select' && tag !== 'textarea') {
      e.preventDefault();
      q.focus();
    }
    if (e.key === 'Escape') unselect();
  });
  window.addEventListener('resize', function () { map.invalidateSize(); });

  draw();
})();
