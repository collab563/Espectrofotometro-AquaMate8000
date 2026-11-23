"use strict";
const $ = (selector, base) => (base || document).querySelector(selector);
const esc = (value) => String(value == null ? "" : value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const money = (value) => "$ " + Number(value || 0).toFixed(2);
const DEMO_LOCATION = { lat: -12.0464, lng: -77.0428, accuracy: 1800, label: "Ubicación de prueba (demo)" };
const S = window.Fiesta = {
  data: null, category: "Todas", location: null, accuracy: null, locationLabel: "", pickDeliveryLocation: false,
  radius: 0.6, radiusEnabled: false, pending: null, map: null, markers: null, locLayer: null, routeLayer: null,
  store: null, products: [], cart: [], routeRequestId: 0, checkoutLocationPrompted: false, adminData: null, adminTab: "stores",
  editStore: null, editProduct: null, productStore: null
};
let toastTimer;
let addressSuggestionTimer = null;
let addressRequestSequence = 0;
let addressCacheQuery = "";
let addressCacheResults = [];
function toast(message, error, duration) {
  const item = $("#notice");
  item.textContent = message;
  item.classList.toggle("error", Boolean(error));
  item.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => item.classList.remove("show"), duration || 3600);
}
async function api(path, options) {
  const config = Object.assign({ credentials: "same-origin" }, options || {});
  config.headers = Object.assign({}, config.headers || {});
  if (config.body && typeof config.body === "object" && !(config.body instanceof Blob) && !(config.body instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(config.body);
  }
  const response = await fetch(path, config);
  const type = response.headers.get("content-type") || "";
  const payload = type.includes("application/json") ? await response.json() : {};
  if (!response.ok) throw new Error(payload.detail || "No se pudo completar la operación.");
  return payload;
}
function setTheme() {
  const button = $("#theme-button");
  const apply = (name) => {
    document.documentElement.dataset.theme = name;
    localStorage.setItem("fiesta-theme", name);
    button.textContent = name === "dark" ? "☀" : "☾";
  };
  apply(localStorage.getItem("fiesta-theme") || "light");
  button.addEventListener("click", () => apply(document.documentElement.dataset.theme === "dark" ? "light" : "dark"));
}
function setInstall() {
  const button = $("#install-button");
  let promptEvent = null;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent || "");
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  if (ios && !standalone) {
    button.hidden = false;
    button.textContent = "Añadir";
    button.addEventListener("click", () => toast("En Safari: toca Compartir y elige «Añadir a pantalla de inicio».", false, 6500));
  }
  addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    promptEvent = event;
    button.hidden = false;
    button.textContent = "Instalar";
  });
  button.addEventListener("click", async () => {
    if (!promptEvent) return;
    promptEvent.prompt();
    await promptEvent.userChoice;
    promptEvent = null;
    button.hidden = true;
  });
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/service-worker.js", { scope: "/" }).catch(() => {});
}
function km(a, b) {
  const rad = (x) => x * Math.PI / 180;
  const d1 = rad(b.latitud - a.lat), d2 = rad(b.longitud - a.lng);
  const value = Math.sin(d1 / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.latitud)) * Math.sin(d2 / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(value), Math.sqrt(1 - value));
}
function distance(store) { return S.location ? km(S.location, store) : null; }
function freeDelivery(store) {
  const d = distance(store), r = Number(store.radio_envio_gratis_m || 0), a = Number(S.accuracy);
  return Boolean(store.envio_gratis_habilitado && d != null && Number.isFinite(r) && r >= 0 && Number.isFinite(a) && a <= 10000 && d * 1000 + a <= r);
}
function freeDeliveryInfo(store) {
  if (!store || !store.envio_gratis_habilitado) return "";
  const minimum = Number(store.minimo_compra_envio_gratis || 0);
  const areaValue = Number.isFinite(Number(store.radio_envio_gratis_m)) ? Number(store.radio_envio_gratis_m) : 0;
  const areaText = "Envío gratis por cercanía: " + areaValue + " m";
  const minimumText = "pago mínimo de compra: S/ " + Number(minimum).toFixed(2);
  return areaText + " · " + minimumText;
}
async function renderDeliveryRoute(from, to) {
  if (!S.map || !from || !to) return;
  if (!S.routeLayer) {
    S.routeLayer = L.layerGroup().addTo(S.map);
  }
  const requestId = ++S.routeRequestId;
  S.routeLayer.clearLayers();
  const url = "https://router.project-osrm.org/route/v1/driving/" + Number(from.lng) + "," + Number(from.lat) + ";" + Number(to.lng) + "," + Number(to.lat) + "?alternatives=3&overview=full&geometries=geojson";
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("El servicio de rutas no está disponible.");
    const payload = await response.json();
    if (requestId !== S.routeRequestId || !S.map) return;
    const routes = payload.code === "Ok" ? payload.routes || [] : [];
    if (!routes.length) throw new Error("No se encontró una ruta para esos puntos.");
    const route = routes.reduce((shortest, candidate) => candidate.distance < shortest.distance ? candidate : shortest);
    const points = route.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
    const start = points[0], end = points[points.length - 1];
    L.polyline(points, { color: "#ffffff", weight: 9, opacity: 0.95, lineCap: "round", lineJoin: "round" }).addTo(S.routeLayer);
    L.polyline(points, { color: "#0878f9", weight: 6, opacity: 1, lineCap: "round", lineJoin: "round" }).addTo(S.routeLayer);
    L.marker(start).addTo(S.routeLayer).bindPopup("Tienda");
    L.marker(end).addTo(S.routeLayer).bindPopup("Entrega");
    S.map.fitBounds(L.latLngBounds(points), { padding: [30, 30], maxZoom: 17 });
  } catch (error) {
    if (requestId === S.routeRequestId) toast("No se pudo dibujar la ruta vial: " + error.message, true, 5000);
  }
}
function renderCurrentRouteIfPossible() {
  if (!S.store || !S.location) return;
  if (!Number.isFinite(Number(S.store.latitud)) || !Number.isFinite(Number(S.store.longitud))) return;
  renderDeliveryRoute({ lat: Number(S.store.latitud), lng: Number(S.store.longitud) }, S.location);
}
function clearDeliveryRoute() {
  if (S.routeLayer) S.routeLayer.clearLayers();
}
function filteredStores() {
  const query = ($("#store-query")?.value || "").trim().toLowerCase();
  return (S.data?.tiendas || []).filter((store) => {
    if (S.category !== "Todas" && S.category !== store.categoria) return false;
    const d = distance(store);
    if (S.radiusEnabled && d != null && d > S.radius) return false;
    return !query || [store.nombre, store.categoria, store.direccion].join(" ").toLowerCase().includes(query);
  });
}
function initMap() {
  const node = $("#map");
  if (!node || !window.L) {
    if (node) node.innerHTML = '<div class="empty">No se pudo cargar el mapa. Puedes explorar las tiendas en la lista.</div>';
    return;
  }
  const center = S.data.center || { lat: -12.0864, lng: -77.0358, zoom: 14 };
  S.map = L.map(node).setView([center.lat, center.lng], center.zoom || 14);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 19, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' }).addTo(S.map);
  S.markers = L.layerGroup().addTo(S.map);
  S.locLayer = L.layerGroup().addTo(S.map);
  S.routeLayer = L.layerGroup().addTo(S.map);
  S.map.on("click", (event) => {
    if (!S.pickDeliveryLocation) return;
    S.pickDeliveryLocation = false;
    const button = $("#pick-map-location-button");
    button.setAttribute("aria-pressed", "false");
    button.textContent = "⌖ Elegir punto de entrega en el mapa";
    setLocation(event.latlng.lat, event.latlng.lng, 0, "Punto de entrega elegido en el mapa");
    toast("Punto guardado. Se incluirá en el pedido al confirmarlo.");
  });
  setTimeout(() => S.map && S.map.invalidateSize(), 120);
  renderMarkers();
}
function renderMarkers(items) {
  if (!S.map || !S.markers) return;
  S.markers.clearLayers();
  (items || filteredStores()).forEach((store) => {
    const marker = L.marker([store.latitud, store.longitud]).addTo(S.markers);
    const deliveryLine = freeDeliveryInfo(store) ? '<div class="map-popup-meta">' + esc(freeDeliveryInfo(store)) + '</div>' : '';
    const popup = '<div class="map-popup"><strong>' + esc(store.nombre) + '</strong><span>' + esc(store.categoria) + ' · ' + (store.abierta ? "Abierta" : "Cerrada") + '</span>' + deliveryLine + '<button type="button" data-map-store="' + store.id + '">Ver catálogo</button></div>';
    marker.bindPopup(popup);
    marker.on("popupopen", () => {
      const button = $('.map-popup [data-map-store="' + store.id + '"]');
      if (button) button.addEventListener("click", () => window.FiestaCustomer.openStore(store.id));
    });
  });
  S.locLayer.clearLayers();
  if (S.location) {
    L.circle([S.location.lat, S.location.lng], { radius: Math.max(S.radius, .1) * 1000, color: "#1976d2", fillColor: "#1976d2", fillOpacity: .1 }).addTo(S.locLayer);
    L.marker([S.location.lat, S.location.lng]).addTo(S.locLayer).bindPopup(esc(S.locationLabel || "Tu ubicación"));
  }
}
function updateMain() {
  if (!S.data) return;
  const strip = $("#category-strip");
  if (!strip) return;
  const categories = ["Todas"].concat(S.data.categorias.map((item) => item.nombre));
  strip.innerHTML = categories.map((name) => '<button class="chip ' + (S.category === name ? "is-active" : "") + '" data-category="' + esc(name) + '" type="button">' + esc(name) + '</button>').join("");
  const stores = filteredStores();
  $("#map-count").textContent = stores.length + (stores.length === 1 ? " tienda" : " tiendas");
  $("#store-list").innerHTML = stores.length ? stores.map((store) => {
    const d = distance(store);
    const img = store.imagen ? '<img class="store-thumb" src="' + esc(store.imagen) + '" alt="Fachada de ' + esc(store.nombre) + '" loading="lazy">' : '<div class="store-thumb store-thumb-placeholder">🎉</div>';
    const deliveryBadge = freeDeliveryInfo(store) ? '<div><span class="badge">' + esc(freeDeliveryInfo(store)) + '</span></div>' : '';
    return '<article class="store-card"><div class="store-card-main">' + img + '<div><h3 class="store-name">' + esc(store.nombre) + '</h3><p class="store-meta">' + esc(store.categoria) + (store.direccion ? ' · ' + esc(store.direccion) : '') + '</p><span class="store-status ' + (store.abierta ? '' : 'closed') + '">' + (store.abierta ? '● Abierta' : '● Cerrada') + '</span>' + deliveryBadge + '</div><div class="store-actions">' + (d == null ? '' : '<span class="distance">' + d.toFixed(1) + ' km</span>') + '<button class="btn btn-soft" data-open-store="' + store.id + '" type="button">Catálogo</button></div></div></article>';
  }).join("") : '<div class="empty">No encontramos tiendas con esos filtros. Cambia la categoría o el radio.</div>';
  renderMarkers(stores);
  updateCartCount();
  if (S.map && matchMedia("(max-width: 680px)").matches) setTimeout(() => S.map && S.map.invalidateSize(), 80);
}
function setLocation(lat, lng, accuracy, label) {
  S.location = { lat: Number(lat), lng: Number(lng) };
  S.accuracy = accuracy != null && Number.isFinite(Number(accuracy)) ? Number(accuracy) : null;
  S.locationLabel = label || "Tu ubicación";
  const status = $("#location-status");
  if (status) status.textContent = "📍 " + S.locationLabel + (S.accuracy == null ? "" : " · precisión " + Math.round(S.accuracy) + " m");
  if (S.map) S.map.setView([S.location.lat, S.location.lng], Math.max(14, S.map.getZoom()));
  renderCurrentRouteIfPossible();
  updateMain();
  if (window.FiestaCustomer && window.FiestaCustomer.locationChanged) window.FiestaCustomer.locationChanged();
}
function locate() {
  if (!navigator.geolocation) {
    setLocation(DEMO_LOCATION.lat, DEMO_LOCATION.lng, DEMO_LOCATION.accuracy, DEMO_LOCATION.label);
    toast("No hay geolocalización disponible en este equipo; se aplicó una ubicación de prueba para mostrar la ruta.", false, 6000);
    return;
  }
  $("#location-status").textContent = "Solicitando tu ubicación…";
  navigator.geolocation.getCurrentPosition(
    (position) => {
      const accuracy = Number(position.coords.accuracy || 0);
      if (accuracy > 10000) {
        setLocation(DEMO_LOCATION.lat, DEMO_LOCATION.lng, DEMO_LOCATION.accuracy, DEMO_LOCATION.label);
        toast("La precisión fue demasiado baja; se aplicó una ubicación de prueba para mostrar la ruta del mapa.", false, 6000);
        return;
      }
      setLocation(position.coords.latitude, position.coords.longitude, accuracy, "Tu ubicación");
    },
    (error) => {
      setLocation(DEMO_LOCATION.lat, DEMO_LOCATION.lng, DEMO_LOCATION.accuracy, DEMO_LOCATION.label);
      const message = error.code === 1 ? "No se concedió permiso para la ubicación; se usó una ubicación de prueba para esta vista." : "No se pudo obtener tu ubicación con precisión; se usó una ubicación de prueba para la ruta.";
      $("#location-status").textContent = "📍 " + DEMO_LOCATION.label;
      toast(message, false, 6000);
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
  );
}
function normalizeAddressPrefix(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
}
function addressMatchesQuery(label, query) {
  const queryTokens = normalizeAddressPrefix(query).match(/[a-z0-9]+/g) || [];
  const addressTokens = new Set(normalizeAddressPrefix(label).match(/[a-z0-9]+/g) || []);
  return queryTokens.every((queryToken) => Array.from(addressTokens).some((addressToken) => addressToken.startsWith(queryToken)));
}
function addressQueryCanReuseResults(previousQuery, currentQuery) {
  const previousTokens = new Set(normalizeAddressPrefix(previousQuery).match(/[a-z0-9]+/g) || []);
  const currentTokens = new Set(normalizeAddressPrefix(currentQuery).match(/[a-z0-9]+/g) || []);
  return previousTokens.size > 0 && Array.from(previousTokens).every((oldToken) => Array.from(currentTokens).some((newToken) => oldToken.startsWith(newToken) || newToken.startsWith(oldToken)));
}
function validateCoordinatePair(latitude, longitude) {
  const lat = Number(latitude), lng = Number(longitude);
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 ? { lat, lng } : null;
}
function parseCoordinatePairText(value) {
  let text = String(value || "").replace(/```|`/g, "").trim();
  text = text.replace(/^.*?coordenadas(?:\s+para\s+copiar)?\s*:\s*/i, "").trim().replace(/^[()[\]\s]+|[()[\]\s]+$/g, "");
  const match = text.match(/^([+-]?(?:\d+(?:\.\d*)?|\.\d+))\s*(?:,|;|\s)\s*([+-]?(?:\d+(?:\.\d*)?|\.\d+))$/);
  return match ? validateCoordinatePair(match[1], match[2]) : null;
}
function parseLocationCoordinates(value) {
  const text = String(value || "").trim();
  if (!text) return null;
  try {
    const url = new URL(text.includes("://") ? text : "https://" + text);
    const latitude = url.searchParams.get("mlat") || url.searchParams.get("lat");
    const longitude = url.searchParams.get("mlon") || url.searchParams.get("lon");
    if (latitude != null && longitude != null) {
      const pair = validateCoordinatePair(latitude, longitude);
      if (pair) return pair;
    }
    const query = url.searchParams.get("q") || url.searchParams.get("query");
    const queryPair = query && parseCoordinatePairText(query);
    if (queryPair) return queryPair;
    const matches = [text.match(/@([+-]?\d+(?:\.\d+)?),\s*([+-]?\d+(?:\.\d+)?)/), url.hash.match(/(?:^|[#&])map=\d+\/([+-]?\d+(?:\.\d+)?)\/([+-]?\d+(?:\.\d+)?)/)];
    for (const match of matches) {
      if (match) {
        const pair = validateCoordinatePair(match[1], match[2]);
        if (pair) return pair;
      }
    }
  } catch (_) {}
  return parseCoordinatePairText(text);
}
function renderCoordinateSuggestion(coordinates) {
  const label = "Coordenadas: " + coordinates.lat.toFixed(6) + ", " + coordinates.lng.toFixed(6);
  renderAddressSuggestions([{ label, lat: coordinates.lat, lng: coordinates.lng, accuracy_m: 0 }]);
}
function renderAddressSuggestions(results) {
  const box = $("#suggestions");
  S.geocodes = results;
  if (!results.length) {
    box.innerHTML = '<div class="callout">No encontramos direcciones con todas esas palabras.</div>';
    return;
  }
  box.innerHTML = results.map((item, index) => '<button type="button" class="suggestion" data-address="' + index + '">' + esc(item.label) + '</button>').join("");
  $("#location-status").textContent = "Selecciona una dirección para centrar el mapa.";
}
async function searchAddress(event, queryOverride, preserveSuggestions) {
  if (event && event.preventDefault) event.preventDefault();
  clearTimeout(addressSuggestionTimer);
  const query = String(queryOverride == null ? $("#address-input").value : queryOverride).trim();
  const box = $("#suggestions");
  const coordinates = parseLocationCoordinates(query);
  if (coordinates) {
    addressRequestSequence += 1;
    $("#address-search-button").disabled = false;
    renderCoordinateSuggestion(coordinates);
    return;
  }
  if (query.length < 2) return toast("Escribe al menos 2 caracteres para buscar.", true);
  const requestSequence = ++addressRequestSequence;
  $("#address-search-button").disabled = true;
  if (!preserveSuggestions) {
    $("#location-status").textContent = "Buscando direcciones…";
    box.hidden = false;
    box.innerHTML = '<div class="callout">Consultando Photon / OpenStreetMap…</div>';
  }
  try {
    const result = await api("/api/geocode?q=" + encodeURIComponent(query));
    if (requestSequence !== addressRequestSequence) return;
    addressCacheQuery = query;
    addressCacheResults = result.results;
    renderAddressSuggestions(result.results.filter((item) => addressMatchesQuery(item.label, query)));
  } catch (error) {
    if (requestSequence === addressRequestSequence) box.innerHTML = '<div class="callout">' + esc(error.message) + '</div>';
  }
  finally {
    if (requestSequence === addressRequestSequence) $("#address-search-button").disabled = false;
  }
}
function scheduleAddressSuggestions() {
  clearTimeout(addressSuggestionTimer);
  const query = $("#address-input").value.trim();
  addressRequestSequence += 1;
  const coordinates = parseLocationCoordinates(query);
  if (coordinates) {
    $("#address-search-button").disabled = false;
    renderCoordinateSuggestion(coordinates);
    return;
  }
  if (query.length < 2) {
    $("#suggestions").hidden = true;
    $("#suggestions").innerHTML = "";
    S.geocodes = [];
    $("#address-search-button").disabled = false;
    return;
  }
  const canReuse = addressCacheResults.length > 0 && addressQueryCanReuseResults(addressCacheQuery, query);
  if (canReuse) renderAddressSuggestions(addressCacheResults.filter((item) => addressMatchesQuery(item.label, query)));
  else {
    $("#suggestions").hidden = false;
    $("#suggestions").innerHTML = '<div class="callout">Buscando sugerencias…</div>';
    S.geocodes = [];
  }
  addressSuggestionTimer = setTimeout(() => searchAddress(null, query, canReuse), 180);
}
function renderHome() {
  const title = esc(S.data.titulo || "Directorio de Fiestas y Eventos");
  appRoot.innerHTML = '<section class="hero"><div><p class="eyebrow">Celebra a tu manera</p><h1>' + title + '</h1><p class="lead">Encuentra tiendas cerca de ti, revisa sus productos y prepara tu pedido por WhatsApp.</p></div><div class="hero-actions"><button class="btn btn-quiet" id="orders-button" type="button">Mis pedidos</button><button class="btn btn-soft" id="cart-fab">🛒 Ver carrito <span class="cart-count" id="cart-fab-count">0</span></button></div></section>' +
    '<section class="toolbar-card"><form id="address-form" class="address-row"><input class="search-field" id="address-input" type="search" placeholder="Dirección o coordenadas" autocomplete="street-address"><button class="btn btn-primary" id="address-search-button">Buscar</button><button class="btn btn-location" id="locate-button" type="button">📍 Usar mi ubicación</button></form><button class="btn btn-soft map-pick-button" id="pick-map-location-button" type="button" aria-pressed="false">⌖ Elegir punto de entrega en el mapa</button><div id="suggestions" class="suggestions" hidden></div><div class="location-tools"><span id="location-status" class="location-status">📍 Sin ubicación activa</span><label class="checkline"><input id="radius-enabled" type="checkbox"> Filtrar por radio</label><label class="radius-control">Radio <input id="radius-range" type="range" min=".5" max="50" step=".5"><b id="radius-value"></b></label></div><p class="muted small" style="margin:8px 0 0">Las direcciones se consultan en Photon con datos de OpenStreetMap; FiestaApp no guarda la ubicación.</p></section>' +
    '<div id="category-strip" class="category-strip" aria-label="Categorías"></div><div class="explore-grid"><section class="map-card"><div class="map-title"><h2>Mapa de proveedores</h2><span id="map-count"></span></div><div id="map"></div></section><section class="store-column"><div class="section-head"><div><p class="eyebrow">Directorio</p><h2>Tiendas</h2></div></div><input id="store-query" class="search-field store-search" type="search" placeholder="Buscar tienda, categoría o dirección"><div id="store-list" class="store-list"></div></section></div>';
  $("#radius-enabled").checked = S.radiusEnabled;
  $("#radius-range").value = S.radius;
  $("#radius-value").textContent = Number(S.radius).toFixed(1) + " km";
  $("#address-form").addEventListener("submit", searchAddress);
  $("#address-input").addEventListener("input", scheduleAddressSuggestions);
  $("#locate-button").addEventListener("click", locate);
  $("#pick-map-location-button").addEventListener("click", (event) => {
    S.pickDeliveryLocation = !S.pickDeliveryLocation;
    event.currentTarget.setAttribute("aria-pressed", String(S.pickDeliveryLocation));
    event.currentTarget.textContent = S.pickDeliveryLocation ? "Toca el mapa para marcar la entrega" : "⌖ Elegir punto de entrega en el mapa";
    if (S.pickDeliveryLocation) {
      toast("Desplázate al mapa y toca el punto exacto de entrega.", false, 5000);
      $(".map-card").scrollIntoView({ behavior: "smooth", block: "center" });
    }
  });
  $("#radius-enabled").addEventListener("change", (event) => { S.radiusEnabled = event.target.checked; updateMain(); });
  $("#radius-range").addEventListener("input", (event) => { S.radius = Number(event.target.value); $("#radius-value").textContent = S.radius.toFixed(1) + " km"; updateMain(); });
  $("#store-query").addEventListener("input", updateMain);
  $("#category-strip").addEventListener("click", (event) => { const b = event.target.closest("[data-category]"); if (b) { S.category = b.dataset.category; updateMain(); } });
  updateMain();
  initMap();
}
async function initMain() {
  try {
    S.data = await api("/api/public/data");
    S.radius = Number(S.data.radius_km || .6);
    S.radiusEnabled = Boolean(S.data.radius_filter_enabled);
    renderHome();
  } catch (error) {
    appRoot.innerHTML = '<section class="admin-card"><h1>FiestaApp</h1><p>' + esc(error.message) + '</p><button class="btn btn-primary" onclick="location.reload()">Reintentar</button></section>';
  }
}
function initChrome() {
  setTheme();
  setInstall();
}
window.FiestaUI = { $, esc, money, toast, api, state: S, initMain, initChrome, searchAddress, setLocation, updateMain };