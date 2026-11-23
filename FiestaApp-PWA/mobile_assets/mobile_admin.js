"use strict";
(() => {
const F = window.FiestaUI, S = F.state, $ = F.$, esc = F.esc, api = F.api, toast = F.toast;
const app = $("#app"), modal = $("#modal-root");
async function refresh() {
  S.adminData = await api("/api/admin/data");
  if (!S.productStore && S.adminData.tiendas.length) S.productStore = S.adminData.tiendas[0].id;
}
function login(message) {
  app.innerHTML = '<section class="admin-hero"><p class="eyebrow">Administración</p><h1>Panel FiestaApp</h1><p class="lead">Gestiona el directorio y las cuentas de propietarios desde el celular.</p></section><section class="admin-card login-card"><h2>Iniciar sesión</h2><form id="admin-login"><label class="field">Contraseña de administrador<input id="admin-password" type="password" autocomplete="current-password" required></label><div class="form-actions"><button class="btn btn-primary">Entrar al panel</button></div><p class="muted small">' + esc(message || "Usa la contraseña configurada en app_config.json.") + '</p></form></section>';
  $("#admin-login").addEventListener("submit", async (event) => {
    event.preventDefault();
    try { await api("/api/admin/login", { method: "POST", body: { password: $("#admin-password").value } }); await refresh(); workspace(); }
    catch (error) { toast(error.message, true); }
  });
}
function workspace() {
  const tabs = [["stores", "🏪 Tiendas"], ["products", "📦 Productos"], ["categories", "🏷 Categorías"], ["owners", "🔑 Accesos"]];
  app.innerHTML = '<section class="admin-hero"><p class="eyebrow">Administración</p><div class="hero"><div><h1>Panel FiestaApp</h1><p class="lead">Administra tiendas, productos, categorías y accesos.</p></div><button class="btn btn-quiet" id="admin-logout">Cerrar sesión</button></div></section><div class="admin-layout"><nav class="admin-card admin-tabs" id="admin-tabs">' + tabs.map((t) => '<button class="admin-tab ' + (S.adminTab === t[0] ? "is-active" : "") + '" data-tab="' + t[0] + '" type="button">' + t[1] + '</button>').join("") + '</nav><section id="admin-panel"></section></div>';
  showTab();
}
function showTab() {
  const panel = $("#admin-panel");
  if (!panel || !S.adminData) return;
  if (S.adminTab === "stores") panel.innerHTML = storesView();
  if (S.adminTab === "products") panel.innerHTML = productsView();
  if (S.adminTab === "categories") panel.innerHTML = categoriesView();
  if (S.adminTab === "owners") panel.innerHTML = ownersView();
}
function storesView() {
  const d = S.adminData, item = d.tiendas.find((x) => x.id === S.editStore) || null;
  const list = d.tiendas.map((x) => '<button class="list-item ' + (item && item.id === x.id ? "is-active" : "") + '" data-store-edit="' + x.id + '" type="button"><strong>' + esc(x.nombre) + '</strong><small>' + esc(x.categoria) + '</small></button>').join("") || '<div class="empty">No hay tiendas.</div>';
  const cats = d.categorias.map((x) => '<option value="' + esc(x.nombre) + '" ' + (item && item.categoria === x.nombre ? "selected" : "") + '>' + esc(x.nombre) + '</option>').join("");
  const image = item && item.imagen ? '<div class="preview-row"><img src="' + esc(item.imagen) + '" alt=""><span>Foto actual</span></div>' : "";
  return '<section class="admin-card"><div class="section-head"><div><p class="eyebrow">Directorio</p><h2>Tiendas</h2></div><button class="btn btn-soft" data-store-new type="button">＋ Nueva</button></div><div class="admin-content-grid"><div class="item-list">' + list + '</div><form id="store-form"><input id="store-id" type="hidden" value="' + (item ? item.id : "") + '"><div class="form-grid"><label class="field">Nombre*<input id="store-name" required maxlength="100" value="' + esc(item ? item.nombre : "") + '"></label><label class="field">Categoría*<select id="store-category" required>' + cats + '</select></label><label class="field">Latitud*<input id="store-lat" type="number" min="-90" max="90" step=".000001" required value="' + (item ? item.latitud : "-12.0864") + '"></label><label class="field">Longitud*<input id="store-lng" type="number" min="-180" max="180" step=".000001" required value="' + (item ? item.longitud : "-77.0358") + '"></label><label class="field">WhatsApp*<input id="store-wa" required maxlength="30" value="' + esc(item ? item.whatsapp : "") + '"></label><label class="field">Dirección<input id="store-address" maxlength="240" value="' + esc(item ? item.direccion : "") + '"></label><label class="field full">Foto de fachada<input id="store-image" type="file" accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"></label></div>' + image + '<div class="form-actions"><button class="btn btn-primary">Guardar tienda</button>' + (item ? '<button class="btn btn-danger" type="button" data-store-delete="' + item.id + '">Eliminar</button>' : "") + '</div></form></div></section>';
}
function productsView() {
  const d = S.adminData;
  if (!d.tiendas.some((x) => x.id === S.productStore)) S.productStore = d.tiendas.length ? d.tiendas[0].id : null;
  const shop = d.tiendas.find((x) => x.id === S.productStore);
  const list = d.productos.filter((x) => x.tienda_id === S.productStore);
  const item = list.find((x) => x.id === S.editProduct) || null;
  const shops = d.tiendas.map((x) => '<option value="' + x.id + '" ' + (shop && shop.id === x.id ? "selected" : "") + '>' + esc(x.nombre) + '</option>').join("");
  const entries = list.map((x) => '<button class="list-item ' + (item && x.id === item.id ? "is-active" : "") + '" data-product-edit="' + x.id + '" type="button"><strong>' + esc(x.nombre) + '</strong><small>' + F.money(x.precio) + ' · Stock ' + x.stock + '</small></button>').join("") || '<div class="empty">No hay productos en esta tienda.</div>';
  const images = item && item.imagenes ? item.imagenes.map((src, i) => '<div class="preview-row"><img src="' + esc(src) + '" alt=""><span>Foto ' + (i + 1) + '</span><button class="btn btn-quiet" type="button" data-image-delete="' + item.id + '" data-image-index="' + i + '">Quitar</button></div>').join("") : "";
  return '<section class="admin-card"><div class="section-head"><div><p class="eyebrow">Catálogo</p><h2>Productos</h2></div><button class="btn btn-soft" data-product-new type="button" ' + (!shop ? "disabled" : "") + '>＋ Nuevo</button></div><label class="field" style="max-width:420px">Tienda<select id="product-shop">' + shops + '</select></label><div class="admin-content-grid" style="margin-top:12px"><div class="item-list">' + entries + '</div><form id="product-form"><input id="product-id" type="hidden" value="' + (item ? item.id : "") + '"><div class="form-grid"><label class="field full">Nombre*<input id="product-name" required maxlength="100" value="' + esc(item ? item.nombre : "") + '"></label><label class="field">Precio*<input id="product-price" type="number" min="0" max="999999" step=".01" required value="' + (item ? item.precio : "0") + '"></label><label class="field">Stock<input id="product-stock" type="number" min="0" max="999999" required value="' + (item ? item.stock : "0") + '"></label><label class="field full">Descripción<textarea id="product-description" maxlength="2000">' + esc(item ? item.descripcion : "") + '</textarea></label><label class="field full">Agregar fotos<input id="product-files" type="file" multiple accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"></label></div>' + images + '<div class="form-actions"><button class="btn btn-primary" ' + (!shop ? "disabled" : "") + '>Guardar producto</button>' + (item ? '<button class="btn btn-danger" type="button" data-product-delete="' + item.id + '">Eliminar</button>' : "") + '</div></form></div></section>';
}
function categoriesView() {
  const colors = ["red", "blue", "green", "orange", "purple", "darkred", "cadetblue"];
  const icons = ["birthday-cake", "candy-cane", "gamepad", "balloon", "shopping-cart"];
  const list = S.adminData.categorias.map((x) => '<div class="category-row"><div><strong>' + esc(x.nombre) + '</strong><div class="muted small">' + esc(x.color) + ' · ' + esc(x.icono) + '</div></div><button class="btn btn-quiet danger-text" data-category-delete="' + encodeURIComponent(x.nombre) + '" type="button">Eliminar</button></div>').join("") || '<div class="empty">No hay categorías.</div>';
  return '<section class="admin-card"><p class="eyebrow">Organización</p><h2>Categorías</h2>' + list + '<form id="category-form" style="margin-top:16px"><div class="form-grid"><label class="field">Nombre*<input id="category-name" maxlength="60" required></label><label class="field">Color<select id="category-color">' + colors.map((x) => '<option>' + x + '</option>').join("") + '</select></label><label class="field">Icono<select id="category-icon">' + icons.map((x) => '<option>' + x + '</option>').join("") + '</select></label></div><div class="form-actions"><button class="btn btn-primary">Agregar categoría</button></div></form></section>';
}
function ownersView() {
  const shops = S.adminData.tiendas.map((x) => '<option value="' + x.id + '">' + esc(x.nombre) + '</option>').join("");
  const accounts = S.adminData.accesos.map((x) => '<div class="access-row"><div><strong>' + esc(x.username) + '</strong><div class="muted small">' + esc(x.store) + ' · ' + (x.active ? "Activo" : "Suspendido") + '</div></div><div class="form-actions" style="margin:0"><button class="btn btn-soft" data-owner-toggle="' + esc(x.username) + '" data-active="' + (!x.active) + '">' + (x.active ? "Suspender" : "Activar") + '</button><button class="btn btn-quiet" data-owner-reset="' + esc(x.username) + '">Restablecer</button></div></div>').join("") || '<div class="empty">No hay cuentas de propietarios.</div>';
  return '<section class="admin-card"><p class="eyebrow">Acceso de propietarios</p><h2>Crear cuenta para una tienda</h2><form id="owner-form"><div class="form-grid"><label class="field">Tienda<select id="owner-shop" required>' + shops + '</select></label><label class="field">Usuario<input id="owner-username" minlength="3" maxlength="40" required autocomplete="off"></label></div><p class="muted small">Se generará una contraseña temporal segura; guárdala y compártela con el propietario.</p><div class="form-actions"><button class="btn btn-primary" ' + (!S.adminData.tiendas.length ? "disabled" : "") + '>Crear acceso</button></div></form></section><section class="admin-card"><h2>Cuentas existentes</h2>' + accounts + '</section>';
}
async function upload(path, file) {
  if (file) await api(path + "?filename=" + encodeURIComponent(file.name), { method: "POST", body: file });
}
function secret(username, password) {
  modal.innerHTML = '<div class="modal-backdrop"><section class="sheet" role="dialog" aria-modal="true"><div class="sheet-head"><h2>Contraseña temporal</h2><button class="icon-button" data-close-secret>×</button></div><div class="sheet-body"><p>Guarda estos datos ahora; la contraseña solo se muestra en esta pantalla.</p><p><strong>Usuario:</strong> ' + esc(username) + '</p><code id="temp-password" style="display:block;overflow-wrap:anywhere;padding:13px;border-radius:12px;background:var(--surface-soft)">' + esc(password) + '</code><div class="form-actions"><button class="btn btn-primary" data-copy-secret>Copiar</button><button class="btn" data-close-secret>Listo</button></div></div></section></div>';
}
async function submit(event) {
  event.preventDefault();
  try {
    if (event.target.id === "store-form") {
      const id = Number($("#store-id").value) || null;
      const body = { nombre: $("#store-name").value.trim(), categoria: $("#store-category").value, latitud: Number($("#store-lat").value), longitud: Number($("#store-lng").value), whatsapp: $("#store-wa").value.trim(), direccion: $("#store-address").value.trim() };
      const saved = id ? (await api("/api/admin/stores/" + id, { method: "PUT", body }), { id }) : await api("/api/admin/stores", { method: "POST", body });
      await upload("/api/admin/stores/" + saved.id + "/image", $("#store-image").files[0]);
      S.editStore = saved.id;
      await refresh(); showTab(); toast("Tienda guardada."); return;
    }
    if (event.target.id === "product-form") {
      const id = Number($("#product-id").value) || null;
      const body = { tienda_id: Number($("#product-shop").value), nombre: $("#product-name").value.trim(), precio: Number($("#product-price").value), stock: Number($("#product-stock").value), descripcion: $("#product-description").value.trim() };
      const saved = id ? (await api("/api/admin/products/" + id, { method: "PUT", body }), { id }) : await api("/api/admin/products", { method: "POST", body });
      for (const file of Array.from($("#product-files").files)) await upload("/api/admin/products/" + saved.id + "/images", file);
      S.editProduct = saved.id; S.productStore = body.tienda_id;
      await refresh(); showTab(); toast("Producto guardado."); return;
    }
    if (event.target.id === "category-form") {
      await api("/api/admin/categories", { method: "POST", body: { nombre: $("#category-name").value.trim(), color: $("#category-color").value, icono: $("#category-icon").value } });
      await refresh(); showTab(); toast("Categoría agregada."); return;
    }
    if (event.target.id === "owner-form") {
      const result = await api("/api/admin/owners", { method: "POST", body: { tienda_id: Number($("#owner-shop").value), username: $("#owner-username").value.trim() } });
      await refresh(); showTab(); secret(result.username, result.temporary_password);
    }
  } catch (error) { toast(error.message, true, 5200); }
}
async function click(event) {
  const tab = event.target.closest("[data-tab]");
  if (tab) { S.adminTab = tab.dataset.tab; S.editStore = null; S.editProduct = null; workspace(); return; }
  if (event.target.closest("#admin-logout")) {
    await api("/api/admin/logout", { method: "POST" }).catch(() => {});
    return login();
  }
  const editStore = event.target.closest("[data-store-edit]");
  if (editStore) { S.editStore = Number(editStore.dataset.storeEdit); return showTab(); }
  if (event.target.closest("[data-store-new]")) { S.editStore = null; return showTab(); }
  const editProduct = event.target.closest("[data-product-edit]");
  if (editProduct) { S.editProduct = Number(editProduct.dataset.productEdit); return showTab(); }
  if (event.target.closest("[data-product-new]")) { S.editProduct = null; return showTab(); }
  const deleteStore = event.target.closest("[data-store-delete]");
  if (deleteStore) {
    if (!confirm("¿Eliminar esta tienda y todos sus productos?")) return;
    try { await api("/api/admin/stores/" + deleteStore.dataset.storeDelete, { method: "DELETE" }); S.editStore = null; await refresh(); showTab(); toast("Tienda eliminada."); } catch (error) { toast(error.message, true); }
    return;
  }
  const deleteProduct = event.target.closest("[data-product-delete]");
  if (deleteProduct) {
    if (!confirm("¿Eliminar este producto?")) return;
    try { await api("/api/admin/products/" + deleteProduct.dataset.productDelete, { method: "DELETE" }); S.editProduct = null; await refresh(); showTab(); toast("Producto eliminado."); } catch (error) { toast(error.message, true); }
    return;
  }
  const image = event.target.closest("[data-image-delete]");
  if (image) {
    try { await api("/api/admin/products/" + image.dataset.imageDelete + "/images/" + image.dataset.imageIndex, { method: "DELETE" }); await refresh(); showTab(); } catch (error) { toast(error.message, true); }
    return;
  }
  const category = event.target.closest("[data-category-delete]");
  if (category) {
    if (!confirm("¿Eliminar esta categoría?")) return;
    try { await api("/api/admin/categories/" + category.dataset.categoryDelete, { method: "DELETE" }); await refresh(); showTab(); } catch (error) { toast(error.message, true); }
    return;
  }
  const toggle = event.target.closest("[data-owner-toggle]");
  if (toggle) {
    try { await api("/api/admin/owners/status?active=" + toggle.dataset.active, { method: "PATCH", body: { username: toggle.dataset.ownerToggle } }); await refresh(); showTab(); } catch (error) { toast(error.message, true); }
    return;
  }
  const reset = event.target.closest("[data-owner-reset]");
  if (reset) {
    if (!confirm("¿Restablecer la contraseña de esta cuenta?")) return;
    try { const result = await api("/api/admin/owners/reset-password", { method: "POST", body: { username: reset.dataset.ownerReset } }); await refresh(); showTab(); secret(result.username, result.temporary_password); } catch (error) { toast(error.message, true); }
    return;
  }
  if (event.target.closest("[data-close-secret]")) modal.innerHTML = "";
  if (event.target.closest("[data-copy-secret]")) navigator.clipboard.writeText($("#temp-password").textContent).then(() => toast("Contraseña temporal copiada.")).catch(() => toast("Selecciona y copia la contraseña mostrada.", true));
}
async function init() {
  document.body.classList.add("admin-page");
  const nav = document.querySelector(".bottom-nav");
  if (nav) nav.innerHTML = '<a href="/app"><span>⌖</span>Explorar</a><a href="/admin"><span>⚙</span>Admin</a>';
  app.addEventListener("click", click);
  app.addEventListener("submit", submit);
  app.addEventListener("change", (event) => {
    if (event.target.id === "product-shop") { S.productStore = Number(event.target.value); S.editProduct = null; showTab(); }
  });
  modal.addEventListener("click", click);
  try {
    const session = await api("/api/admin/session");
    if (!session.authenticated) { login(); return; }
    await refresh(); workspace();
  } catch (error) { login(error.message); }
}
window.FiestaAdmin = { init };
})();