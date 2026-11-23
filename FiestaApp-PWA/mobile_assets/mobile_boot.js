"use strict";
(() => {
  window.FiestaUI.initChrome();
  if (window.location.pathname.replace(/\/+$/, "") === "/admin") window.FiestaAdmin.init();
  else window.FiestaCustomer.init();
})();