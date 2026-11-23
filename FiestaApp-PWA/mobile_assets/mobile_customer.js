"use strict";
(() => {
const UI = window.FiestaUI, S = UI.state, $ = UI.$, esc = UI.esc, money = UI.money, api = UI.api, toast = UI.toast;
const modalRoot = $("#modal-root");
const TRACKED_ORDERS_KEY = "fiestaapp-tracked-orders";
const ORDER_STEPS = ["Recibido", "Aceptado", "En preparación", "Enviado"];
let orderTrackingTimer = null;
function getTrackedOrders() {
  try {
    const orders = JSON.parse(localStorage.getItem(TRACKED_ORDERS_KEY) || "[]");
    return Array.isArray(orders) ? orders : [];
  } catch (_) { return []; }
}
function saveTrackedOrder(order) {
  const orders = getTrackedOrders().filter((item) => item.token !== order.token);
  orders.unshift(order);
  localStorage.setItem(TRACKED_ORDERS_KEY, JSON.stringify(orders.slice(0, 30)));
}
function renderOrderProgress(progress, cancelled) {
  return '<div class="order-tracking-progress" role="img" aria-label="' + (cancelled ? "Pedido cancelado" : "Avance del pedido") + '">' + ORDER_STEPS.map((step, index) => '<span class="order-tracking-step ' + (!cancelled && index <= progress ? "is-done" : "") + '"><i></i><small>' + step + '</small></span>').join("") + '</div>';
}
async function renderTrackedOrders() {
  clearInterval(orderTrackingTimer);
  const saved = getTrackedOrders();
  modalRoot.innerHTML = '<div class="modal-backdrop" data-modal-backdrop><section class="sheet order-tracker-sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>Mis pedidos</h2><button class="icon-button" type="button" data-close aria-label="Cerrar">×</button></div><div class="sheet-body" data-order-tracker><p class="callout">Actualizando estados…</p></div><div class="sheet-footer"><button class="btn btn-quiet" type="button" data-close>Cerrar</button><button class="btn btn-primary" type="button" data-refresh-orders>Actualizar</button></div></section></div>';
  const tracker = $("[data-order-tracker]", modalRoot);
  if (!saved.length) {
    tracker.innerHTML = '<div class="empty">Tus pedidos confirmados aparecerán aquí.</div>';
    return;
  }
  await refreshTrackedOrderStatuses(tracker, saved);
  orderTrackingTimer = setInterval(() => {
    if (!tracker.isConnected) {
      clearInterval(orderTrackingTimer);
      return;
    }
    refreshTrackedOrderStatuses(tracker, saved);
  }, 15000);
}
async function refreshTrackedOrderStatuses(tracker, saved) {
  const results = await Promise.all(saved.map(async (item) => {
    try {
      return { local: item, remote: await api("/api/public/orders/" + encodeURIComponent(item.token)) };
    } catch (error) { return { local: item, error: error.message }; }
  }));
  if (!tracker.isConnected) return;
  tracker.innerHTML = results.map(({ local, remote, error }) => {
    if (error) return '<article class="order-tracking-card"><strong>' + esc(local.store || "Pedido") + '</strong><p class="muted small">No se pudo actualizar el estado. Revisa tu conexión.</p></article>';
    const cancelled = remote.estado === "cancelado";
    const progress = renderOrderProgress(Number(remote.progreso), cancelled);
    return '<article class="order-tracking-card"><div class="order-tracking-head"><div><p class="eyebrow">Pedido #' + Number(remote.id) + '</p><h3>' + esc(remote.tienda || local.store || "Tienda") + '</h3></div><span class="order-state ' + (cancelled ? "cancelled" : "") + '">' + esc(remote.estado_label) + '</span></div>' + (cancelled ? '<p class="order-cancelled">El vendedor canceló este pedido.</p>' : progress) + '<p class="muted small">Última actualización: ' + esc(remote.updated_at || remote.created_at || "") + '</p></article>';
  }).join("");
}
function openStore(id) {
  api("/api/public/stores/" + id).then((data) => {
    S.store = data.tienda;
    S.products = data.productos;
    renderCurrentRouteIfPossible();
    renderStore();
  }).catch((error) => toast(error.message, true));
}
function renderStore() {
  const store = S.store;
  const products = S.products;
  const image = store.imagen ? '<img src="' + esc(store.imagen) + '" alt="">' : '<div class="store-thumb-placeholder" style="width:64px;height:64px">🎉</div>';
  const items = products.length ? products.map((product, index) => {
    const photo = product.imagenes && product.imagenes[0];
    const img = photo ? '<img class="product-image" src="' + esc(photo) + '" alt="' + esc(product.nombre) + '" data-product-detail="' + index + '">' : '<div class="product-image store-thumb-placeholder" data-product-detail="' + index + '">🎁</div>';
    return '<article class="product-card">' + img + '<div><h3><button class="btn-quiet" type="button" data-product-detail="' + index + '">' + esc(product.nombre) + '</button></h3><p class="product-price">' + money(product.precio) + '</p><p class="product-stock">Disponible: ' + Number(product.stock) + (product.descripcion ? ' · ' + esc(product.descripcion.slice(0, 70)) : '') + '</p></div><div class="product-actions"><input class="quantity-input" id="qty-' + index + '" type="number" min="1" max="' + Math.max(1, product.stock) + '" value="1" aria-label="Cantidad" ' + (product.stock <= 0 ? "disabled" : "") + '><button class="btn btn-primary" type="button" data-add="' + index + '" ' + (product.stock <= 0 ? "disabled" : "") + '>Agregar</button></div></article>';
  }).join("") : '<div class="empty">Esta tienda todavía no tiene productos publicados.</div>';
  const deliveryInfo = store.envio_gratis_habilitado ? '<div class="muted small" style="margin:8px 0 0">Envío gratis por cercanía: ' + esc(Number(store.radio_envio_gratis_m || 0)) + ' m · pago mínimo de compra: S/ ' + esc(Number(store.minimo_compra_envio_gratis || 0).toFixed(2)) + '</div>' : '<div class="muted small" style="margin:8px 0 0">Envío gratis no activado</div>';
  modalRoot.innerHTML = '<div class="modal-backdrop" data-modal-backdrop><section class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>Catálogo</h2><button class="icon-button" type="button" data-close aria-label="Cerrar">×</button></div><div class="sheet-body"><div class="store-detail">' + image + '<div><h3 style="margin:0 0 3px">' + esc(store.nombre) + '</h3><p class="muted small" style="margin:0">' + esc(store.categoria) + ' · ' + (store.abierta ? "Abierta" : "Cerrada") + '</p><p class="muted small" style="margin:3px 0 0">' + esc(store.direccion || "Dirección no registrada") + '</p></div></div>' + deliveryInfo + '<div class="section-head"><h2>Productos disponibles</h2><span class="muted small">' + products.length + '</span></div><div class="product-list">' + items + '</div></div></section></div>';
}
function productDetails(index, photoIndex) {
  const product = S.products[index];
  if (!product) return;
  const images = product.imagenes || [];
  const selected = Math.max(0, Math.min(photoIndex || 0, Math.max(0, images.length - 1)));
  const photo = images[selected];
  const mainImage = photo ? '<img class="detail-image" src="' + esc(photo) + '" alt="' + esc(product.nombre) + '">' : '<div class="detail-image product-placeholder">🎁</div>';
  const gallery = images.length > 1 ? '<button class="gallery-arrow left" data-photo-prev="' + index + '" data-photo-index="' + selected + '">‹</button><button class="gallery-arrow right" data-photo-next="' + index + '" data-photo-index="' + selected + '">›</button><span class="gallery-count">' + (selected + 1) + ' / ' + images.length + '</span>' : "";
  modalRoot.innerHTML = '<div class="modal-backdrop" data-modal-backdrop><section class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><button class="btn btn-quiet" data-back-store>‹ Catálogo</button><button class="icon-button" data-close aria-label="Cerrar">×</button></div><div class="sheet-body product-detail"><div class="detail-gallery" data-gallery>' + mainImage + gallery + '</div><p class="eyebrow" style="margin-top:15px">' + esc(S.store.nombre) + '</p><h2>' + esc(product.nombre) + '</h2><p class="product-price">' + money(product.precio) + '</p><p class="product-desc">' + esc(product.descripcion || "Sin descripción registrada.") + '</p><p class="product-stock">Disponible: ' + Number(product.stock) + ' unidades</p><div class="form-actions"><label class="field" style="max-width:100px">Cantidad<input id="detail-qty" type="number" min="1" max="' + Math.max(1, product.stock) + '" value="1" ' + (product.stock <= 0 ? "disabled" : "") + '></label><button class="btn btn-primary" type="button" data-add-detail="' + index + '" ' + (product.stock <= 0 ? "disabled" : "") + '>🛒 Agregar al carrito</button></div></div></section></div>';
  const box = $("[data-gallery]", modalRoot);
  if (box) {
    let startX = null;
    box.addEventListener("touchstart", (event) => { startX = event.changedTouches[0].clientX; }, { passive: true });
    box.addEventListener("touchend", (event) => {
      if (startX == null || images.length < 2) return;
      const dx = event.changedTouches[0].clientX - startX;
      if (Math.abs(dx) > 35) productDetails(index, (selected + (dx < 0 ? 1 : images.length - 1)) % images.length);
      startX = null;
    }, { passive: true });
  }
}
function add(index, quantity, detail) {
  const product = S.products[index];
  const amount = Math.floor(Number(quantity));
  if (!product || amount < 1 || amount > Number(product.stock)) return toast("La cantidad supera el stock disponible.", true);
  S.cart.push({ product_id: product.id, product_name: product.nombre, price: Number(product.precio), quantity: amount, store_id: S.store.id, store_name: S.store.nombre });
  count();
  toast(amount + " unidad(es) de «" + product.nombre + "» agregada(s).");
  if (detail) productDetails(index, 0);
  else renderStore();
}
function count() {
  const n = S.cart.length;
  const a = $("#cart-fab-count"), b = $("#nav-cart-count");
  if (a) a.textContent = n;
  if (b) b.textContent = n;
}
function closeModal() {
  clearInterval(orderTrackingTimer);
  modalRoot.innerHTML = "";
}
function renderCart() {
  count();
  if (!S.cart.length) {
    modalRoot.innerHTML = '<div class="modal-backdrop" data-modal-backdrop><section class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>Tu carrito</h2><button class="icon-button" data-close aria-label="Cerrar">×</button></div><div class="sheet-body"><div class="empty">Todavía no agregaste productos. Abre el catálogo de una tienda para empezar.</div></div></section></div>';
    return;
  }
  const total = S.cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const firstStore = S.cart[0].store_id;
  const mixed = S.cart.some((item) => item.store_id !== firstStore);
  const store = (S.data?.tiendas || []).find((item) => item.id === firstStore) || S.store;
  const delivery = store && store.envio_gratis_habilitado ? (() => {
    const distanceMeters = S.location && Number.isFinite(S.location.lat) && Number.isFinite(S.location.lng) ? Math.hypot((store.latitud - S.location.lat) * 111.32 * 1000, (store.longitud - S.location.lng) * 111.32 * 1000) : null;
    const radius = Number(store.radio_envio_gratis_m || 0);
    const minimum = Number(store.minimo_compra_envio_gratis || 0);
    if (!S.location || distanceMeters == null) return { free: false, label: "Ubicación necesaria para verificar envío gratis." };
    if (distanceMeters > radius) return { free: false, label: "Fuera del radio gratis: " + Number(radius).toFixed(0) + " m" };
    if (total < minimum) return { free: false, label: "Falta $ " + Number(minimum - total).toFixed(2) + " para envío gratis" };
    return { free: true, label: "Envío gratis" };
  })() : { free: false, label: "Sin envío gratis configurado" };
  const rows = S.cart.map((item, i) => '<div class="cart-line"><div><h3>' + esc(item.product_name) + '</h3><p>' + esc(item.store_name) + ' · ' + money(item.price) + ' c/u · ' + money(item.price * item.quantity) + '</p></div><div class="cart-controls"><button data-minus="' + i + '" aria-label="Restar">−</button><b>' + item.quantity + '</b><button data-plus="' + i + '" aria-label="Sumar">+</button><button data-remove="' + i + '" aria-label="Quitar">×</button></div></div>').join("");
  const shareLocationButton = '<button class="btn btn-soft" type="button" data-share-location="' + firstStore + '">📍 Usar mi ubicación para el pedido</button>';
  const checkoutDisabled = !S.location && S.checkoutLocationPrompted ? "disabled" : "";
  const locationWarning = !S.location && S.checkoutLocationPrompted ? '<p class="callout">Elige una dirección, pega coordenadas o usa el mapa antes de enviar el pedido.</p>' : '';
  modalRoot.innerHTML = '<div class="modal-backdrop" data-modal-backdrop><section class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>Tu carrito</h2><button class="icon-button" data-close aria-label="Cerrar">×</button></div><div class="sheet-body">' + rows + '<div class="cart-total"><span>Total</span><span>' + money(total) + '</span></div><div class="cart-total"><span>Envío</span><span>' + esc(delivery.label) + '</span></div><div class="cart-destination">El pedido se abrirá en WhatsApp con <strong>' + esc(S.cart[0].store_name) + '</strong>.' + (mixed ? ' Los productos de otras tiendas se enviarán al primer proveedor, como en escritorio.' : '') + '</div>' + locationWarning + shareLocationButton + '</div><div class="sheet-footer"><button class="btn btn-quiet" data-clear>Vaciar carrito</button><button class="btn btn-primary" data-checkout ' + checkoutDisabled + '>📲 Enviar por WhatsApp</button></div></section></div>';
}
function shareCurrentLocationToStore(storeId) {
  const store = (S.data?.tiendas || []).find((item) => item.id === storeId) || S.store || (S.cart[0] && S.data?.tiendas ? S.data.tiendas.find((item) => item.id === S.cart[0].store_id) : null);
  if (!store) return toast("Primero selecciona una tienda.", true);
  if (!navigator.geolocation) return toast("Tu navegador no admite geolocalización.", true);
  navigator.geolocation.getCurrentPosition((position) => {
    const lat = position.coords.latitude;
    const lng = position.coords.longitude;
    S.location = { lat: Number(lat), lng: Number(lng) };
    S.accuracy = position.coords.accuracy;
    S.locationLabel = "Tu ubicación actual";
    S.checkoutLocationPrompted = false;
    if (S.map) {
      renderDeliveryRoute({ lat: Number(store.latitud), lng: Number(store.longitud) }, { lat: Number(lat), lng: Number(lng) });
    }
    toast("Ubicación lista. Se compartirá con la tienda al confirmar el pedido.", false, 5000);
    updateMain();
    renderCart();
  }, () => toast("No se pudo obtener tu ubicación. Activa la geolocalización para enviar la ruta.", true));
}
async function checkout() {
  if (!S.cart.length) return;
  if (!S.location) {
    S.checkoutLocationPrompted = true;
    renderCart();
    toast("Elige primero la ubicación de entrega; después podrás enviar el pedido por WhatsApp.", true, 7000);
    return;
  }
  if (!confirm("Al continuar se actualizará el stock y se abrirá WhatsApp.")) return;
  const tab = window.open("about:blank", "_blank");
  try {
    const payload = {
      items: S.cart.map((item) => ({ product_id: item.product_id, quantity: item.quantity })),
      user_lat: S.location ? Number(S.location.lat) : null,
      user_lng: S.location ? Number(S.location.lng) : null,
    };
    const result = await api("/api/public/orders/prepare", { method: "POST", body: payload });
    saveTrackedOrder({ token: result.tracking_token, store: S.cart[0].store_name, created_at: new Date().toISOString() });
    S.cart = [];
    closeModal();
    count();
    if (tab) tab.location = result.whatsapp_url;
    else location.href = result.whatsapp_url;
    S.data = await api("/api/public/data");
    updateMain();
    if (S.store) openStore(S.store.id);
  } catch (error) {
    if (tab) tab.close();
    toast(error.message, true, 5000);
  }
}
function modalClick(event) {
  if (event.target.closest("[data-refresh-orders]")) return renderTrackedOrders();
  if (event.target.matches("[data-modal-backdrop]") || event.target.closest("[data-close]")) return closeModal();
  const address = event.target.closest("[data-address]");
  if (address) {
    const item = S.geocodes[Number(address.dataset.address)];
    if (!item) return;
    S.pending = item;
    $("#address-input").value = item.label;
    $("#suggestions").innerHTML = '<div class="callout">Dirección elegida. <button class="btn btn-soft" id="apply-address" type="button">Centrar mapa aquí</button></div>';
    $("#apply-address").addEventListener("click", () => {
      const picked = S.pending;
      $("#suggestions").hidden = true;
      UI.setLocation(picked.lat, picked.lng, picked.accuracy_m, picked.label);
    });
    return;
  }
  const detail = event.target.closest("[data-product-detail]");
  if (detail) return productDetails(Number(detail.dataset.productDetail), 0);
  const addButton = event.target.closest("[data-add]");
  if (addButton) return add(Number(addButton.dataset.add), $("#qty-" + addButton.dataset.add).value, false);
  const addDetail = event.target.closest("[data-add-detail]");
  if (addDetail) return add(Number(addDetail.dataset.addDetail), $("#detail-qty").value, true);
  const shareLocation = event.target.closest("[data-share-location]");
  if (shareLocation) return shareCurrentLocationToStore(Number(shareLocation.dataset.shareLocation));
  const back = event.target.closest("[data-back-store]");
  if (back) return renderStore();
  const next = event.target.closest("[data-photo-next], [data-photo-prev]");
  if (next) {
    const i = Number(next.dataset.photoNext || next.dataset.photoPrev);
    const photos = S.products[i].imagenes || [];
    const current = Number(next.dataset.photoIndex);
    return productDetails(i, next.hasAttribute("data-photo-next") ? (current + 1) % photos.length : (current + photos.length - 1) % photos.length);
  }
  if (event.target.closest("[data-clear]")) { S.cart = []; count(); return renderCart(); }
  const remove = event.target.closest("[data-remove]");
  if (remove) { S.cart.splice(Number(remove.dataset.remove), 1); return renderCart(); }
  const plus = event.target.closest("[data-plus]");
  if (plus) { S.cart[Number(plus.dataset.plus)].quantity += 1; return renderCart(); }
  const minus = event.target.closest("[data-minus]");
  if (minus) {
    const i = Number(minus.dataset.minus);
    if (--S.cart[i].quantity < 1) S.cart.splice(i, 1);
    return renderCart();
  }
  if (event.target.closest("[data-checkout]")) checkout();
}
async function init() {
  await UI.initMain();
  const box = $("#suggestions");
  if (box) box.addEventListener("click", modalClick);
  const storeList = $("#store-list");
  if (storeList) storeList.addEventListener("click", (event) => { const button = event.target.closest("[data-open-store]"); if (button) openStore(Number(button.dataset.openStore)); });
  const fab = $("#cart-fab");
  if (fab) fab.addEventListener("click", renderCart);
  const ordersButton = $("#orders-button");
  if (ordersButton) ordersButton.addEventListener("click", renderTrackedOrders);
  modalRoot.addEventListener("click", modalClick);
  const cartButton = $('[data-nav-action="cart"]');
  if (cartButton) cartButton.addEventListener("click", renderCart);
  const ordersNavButton = $('[data-nav-action="orders"]');
  if (ordersNavButton) ordersNavButton.addEventListener("click", renderTrackedOrders);
  count();
}
function locationChanged() {
  if (S.location) S.checkoutLocationPrompted = false;
  if ($("[data-checkout]", modalRoot)) renderCart();
}
window.FiestaCustomer = { init, openStore, locationChanged };
})();