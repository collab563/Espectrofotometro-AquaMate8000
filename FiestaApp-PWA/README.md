# 🎈 FiestaApp — Directorio Local de Proveedores de Eventos

Aplicación de escritorio en **Python** que combina un **mapa interactivo** (OpenStreetMap + Folium) con un **catálogo de tiendas** organizadas por categoría, **carrito de pedido** y **envío directo por WhatsApp**. Todo **gratuito, local y sin límites de API**.

![stack](https://img.shields.io/badge/Python-3.9%2B-blue) ![GUI](https://img.shields.io/badge/GUI-PyQt6-green) ![Map](https://img.shields.io/badge/Map-Folium%2BOSM-orange) ![DB](https://img.shields.io/badge/DB-SQLite-lightgrey)

---

## ✨ Features

- 🗺️ **Mapa interactivo** basado en OpenStreetMap — sin API keys, sin costos, sin límites.
- 🏷️ **Filtros por categoría** (Torterías, Dulcerías, Jugueterías, Decoraciones, etc.).
- 📍 **Marcadores clickeables** que cargan el catálogo de la tienda.
- 🛒 **Carrito de pedido** con cálculo de total automático.
- 📲 **Envío del pedido por WhatsApp** con mensaje pre-formateado (número, lista, total).
- 🔐 **Panel de administración** protegido por PIN — CRUD completo de tiendas, productos y categorías.
- 🌙 **Modo oscuro/claro** con un solo click — persistente entre sesiones.
- ⚡ **Generación de mapa en hilo** — la UI nunca se congela.
- 💾 **Configuración persistente** (`app_config.json`) — tema, ubicación, título, PIN admin.

---

## 🚀 Instalación

```bash
# 1. Clonar / descomprimir
cd FiestaApp

# 2. (Recomendado) crear entorno virtual
python -m venv venv
# Windows:
venv\Scripts\activate
# Linux/macOS:
source venv/bin/activate

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Ejecutar
python main.py
```

> Requisitos: **Python 3.9+**.

## Portal de propietarios

El portal permite a cada dueño iniciar sesión desde un navegador, editar la información y ubicación de su tienda, administrar productos y subir fotos JPG, PNG o WEBP. También puede alternar el estado de su tienda entre abierta y cerrada; ese estado aparece en el popup y el marcador rojo del mapa. En el panel general abre **Administración → Accesos** para crear una cuenta, suspenderla o restablecer su contraseña. Se genera una contraseña temporal que se muestra una sola vez; el dueño puede cambiarla desde su portal.

El portal del propietario incluye una bandeja de pedidos con filtros y estados Recibido, Aceptado, En preparación, Enviado y Cancelado. Los compradores pueden consultar el avance desde «Mis pedidos»; el seguimiento se vincula mediante un token privado guardado en el dispositivo del comprador.

La ubicación automática usa el proveedor de Windows y puede ser aproximada. La app rechaza ubicaciones con más de 10 km de imprecisión. También permite buscar una dirección en Perú: las sugerencias se consultan en Photon con datos de OpenStreetMap, la consulta requiere Internet y no se guarda en FiestaApp. Al elegir un resultado y pulsar **Centrar mapa**, el mapa y el filtro por radio usan ese punto. Puedes cambiar el endpoint compatible con Photon mediante `FIESTA_GEOCODER_URL`.

Inicia el servidor desde la carpeta del proyecto, en otra terminal:

```powershell
.\venv\Scripts\python.exe -m uvicorn owner_api:app --host 127.0.0.1 --port 8000
```

Abre `http://127.0.0.1:8000`. Para que otros dispositivos de la misma red entren, inicia Uvicorn con `--host 0.0.0.0` y usa en ellos la dirección IP local de esta computadora. El servidor y FiestaApp deben ejecutarse en el mismo equipo y desde la carpeta del proyecto para compartir `fiesta_app.db`; ese equipo debe permanecer encendido mientras se use el portal. El acceso público por Internet requiere alojar el servidor en un equipo siempre disponible y configurar HTTPS, dominio, firewall y copias de seguridad. La app de escritorio abierta en otra computadora todavía usa su propia base SQLite y no sincroniza con el servidor.

En un despliegue HTTPS, define una clave estable y privada en `FIESTA_SESSION_SECRET` y establece `FIESTA_COOKIE_SECURE=1`. Sin una clave estable, al reiniciar el servidor las sesiones activas caducan. Las imágenes subidas se guardan en `uploads/`; respalda esa carpeta junto con `fiesta_app.db`. No publiques el servidor directamente en Internet sin HTTPS y una configuración de producción.

---

## 📦 Estructura del Proyecto

```
FiestaApp/
├── main.py            # Ventana principal, UI completa (PyQt6)
├── database.py        # SQLite + CRUD para administración
├── map_engine.py      # Generador del mapa HTML (Folium)
├── theme.py           # Temas claro/oscuro (Qt stylesheets)
├── config.py          # Configuración persistente (JSON)
├── requirements.txt   # Dependencias
├── README.md          # Este archivo
├── fiesta_app.db      # (generado al primer arranque)
├── app_config.json    # (generado al primer arranque)
└── map_view.html      # (generado al usar el mapa)
```

---

## 🛠️ Uso

### Vista principal
1. Arranca la app → verás el mapa con todas las tiendas.
2. Click en un **marcador del mapa** → aparece el catálogo de la tienda.
3. Selecciona productos del catálogo y presiona **🛒 Agregar al carrito**.
4. Cuando tengas tu pedido, presiona **📲 Enviar pedido por WhatsApp**.

### Filtros
- Los botones superiores filtran el mapa y el listado por categoría.

### Administración
1. Menú **Administración → 🔐 Panel Admin**.
2. Contraseña por defecto: **`admin123`** (cámbiala en `app_config.json`).
3. Tres pestañas:
   - **Tiendas**: crear/editar/eliminar.
   - **Productos**: crear/editar/eliminar por tienda.
   - **Categorías**: agregar/eliminar (no se puede eliminar si hay tiendas usándola).

### Modo oscuro
- **Ver → 🌙 Modo Oscuro**. Se guarda automáticamente.

---

## 🔧 Configuración (`app_config.json`)

```json
{
  "theme": "light",
  "map_center_lat": -12.0864,
  "map_center_lng": -77.0358,
  "map_zoom": 14,
  "app_title": "🎈 Directorio de Fiestas y Eventos",
  "auto_open_whatsapp": true,
  "admin_password": "admin123"
}
```

> Cambia `map_center_lat` y `map_center_lng` para apuntar a tu ciudad.

---

## 🧰 Stack tecnológico (justificación)

| Componente      | Elección        | Por qué                                                                 |
|-----------------|-----------------|-------------------------------------------------------------------------|
| GUI             | **PyQt6**       | La más madura y potente para Python desktop. WebEngine permite HTML/JS. |
| Mapa            | **Folium + OSM**| 100% gratuito, sin tokens, sin límites. Renderiza en HTML estándar.     |
| Base de datos   | **SQLite**      | Local, cero-config, embebida. Ideal para apps单机.                     |
| Mensajería      | **WhatsApp Web**| `webbrowser.open("https://wa.me/...")` — sin librerías adicionales.     |
| Puente JS-Py    | **QtWebChannel**| Permite que los botones del HTML llamen funciones Python reales.        |

---

## 🔄 Endurecimientos aplicados vs. código original

1. ✅ Marcadores funcionales (puente JS ↔ Python via `QtWebChannel`, no `select:` URL).
2. ✅ Manejo de errores y `try/except` en DB y mapa.
3. ✅ Generación de mapa en hilo (`QThread`) — UI nunca se congela.
4. ✅ Coordenadas del centro configurables.
5. ✅ CRUD completo para administración sin tocar código.
6. ✅ Modo oscuro/claro persistente.
7. ✅ Carrito de compras con cálculo de total y formato WhatsApp enriquecido.
8. ✅ Context managers para SQLite — cierre automático de conexiones.

---

## 📜 Licencia
Copyright (c) 2026 Wendel Ernesto Leon Alvarado

Este software es propiedad intelectual del autor y se encuentra protegido por
leyes de derechos de autor y propiedad intelectual.

Todos los derechos están reservados.

La presente solución se entrega únicamente para uso autorizado del cliente y
para la operación del sistema contratado. Queda prohibida la copia,
redistribución, reventa, sublicencia, modificación o uso fuera del alcance
pactado sin autorización previa y por escrito.

Para consultar la versión formal de la licencia, revisar:
- [LICENSE](LICENSE)
- [CONTRATO_LICENCIA_DE_USO.md](CONTRATO_LICENCIA_DE_USO.md)

> Este proyecto no utiliza una licencia de código abierto como MIT, sino una
> licencia de uso comercial restringido orientada a protección del software y
> del cliente autorizado.



## Aplicación móvil instalable (PWA)

El proyecto conserva la aplicación de escritorio en PyQt6 y el portal de propietarios. La nueva PWA ofrece el directorio público con mapa y filtros, búsqueda de dirección y ubicación, catálogo con fotos, carrito y pedidos por WhatsApp. El panel web de /admin cubre el CRUD de tiendas, productos y categorías, además de la creación, suspensión y restablecimiento de accesos de propietarios.

### Ejecutar y acceder

La PWA usa el mismo servidor FastAPI, la misma base SQLite y la carpeta uploads/. Inicia Uvicorn desde la carpeta del proyecto para que todos usen fiesta_app.db:

~~~powershell
.\venv\Scripts\python.exe -m uvicorn owner_api:app --host 0.0.0.0 --port 8000
~~~

- App para clientes: https://tu-dominio/app
- Administración general: https://tu-dominio/admin
- Portal de propietarios: https://tu-dominio/

En una red local de confianza también puedes entrar con http://IP-DE-LA-COMPUTADORA:8000; geolocalización y la instalación PWA requieren HTTPS fuera de localhost. Para que los celulares accedan desde cualquier lugar, aloja el servidor en un equipo persistente con dominio y HTTPS. La computadora local debe permanecer encendida si el servidor corre allí.

### Instalar en el celular

- Android: abre /app en Chrome y usa «Instalar aplicación» o «Añadir a pantalla de inicio».
- iPhone: abre /app en Safari, toca Compartir y elige «Añadir a pantalla de inicio».

La PWA se conecta al servidor para consultar tiendas, productos y stock. El mapa, la geolocalización, Photon y WhatsApp también requieren Internet. El service worker guarda la interfaz para volver a abrirla, pero no guarda datos privados ni hace pedidos sin conexión.

Al seleccionar una tienda con una ubicación de cliente activa, el mapa solicita una ruta vial a OSRM y dibuja en azul la alternativa de menor distancia entre las rutas devueltas. El servicio público requiere Internet y es de mejor esfuerzo; se puede configurar un endpoint OSRM compatible con `FIESTA_ROUTING_URL`. En escritorio, busca y selecciona una dirección si el proveedor de ubicación del equipo informa una precisión demasiado baja.

Si la dirección del cliente no es exacta, puede elegir «Elegir punto de entrega en el mapa» y hacer clic o tocar el punto preciso. Esa ubicación se incluye en el enlace del mapa que recibe la tienda al confirmar el pedido.

El buscador también acepta coordenadas pegadas en formato `latitud, longitud` o enlaces de OpenStreetMap; FiestaApp las detecta localmente y propone centrar el mapa en ese punto.

### Configuración para publicar

Antes de abrir el servidor a Internet, configura una clave de sesión privada y estable, fuerza cookies seguras detrás de HTTPS y cambia la contraseña de administración predeterminada:

~~~powershell
$env:FIESTA_SESSION_SECRET = "una-clave-larga-aleatoria-y-privada"
$env:FIESTA_COOKIE_SECURE = "1"
$env:FIESTA_ADMIN_PASSWORD = "una-contrasena-larga-y-unica"
~~~

FIESTA_ADMIN_PASSWORD solo cambia la contraseña del panel web; el programa de escritorio conserva la contraseña guardada en app_config.json. También puedes cambiar esa contraseña en el archivo para que ambos accesos usen la misma. Respalda fiesta_app.db y uploads/ juntos. No publiques la aplicación sin HTTPS ni dejes expuesta la contraseña predeterminada admin123. Configura también límite de solicitudes en el proxy para /api/public/orders/prepare, ya que cada pedido confirmado actualiza el stock.