(function () {
  var state = {
    baseUrl: "",
    modal: null,
    iframe: null,
    handlers: [],
  };

  function normalizeBaseUrl(url) {
    if (!url) {
      return "";
    }
    try {
      var parsed = new URL(url, window.location.href);
      var path = parsed.pathname.replace(/\/api\/v1\/?$/, "").replace(/\/api\/?$/, "");
      var normalized = parsed.origin + path;
      return normalized.replace(/\/$/, "");
    } catch (error) {
      return String(url).replace(/\/$/, "");
    }
  }

  function resolveInvoiceUrl(invoiceId) {
    var base = state.baseUrl || "";
    if (!base) {
      base = "";
    }
    base = base.replace(/\/$/, "");
    return base + "/i/" + encodeURIComponent(invoiceId);
  }

  function ensureModal() {
    if (state.modal) {
      return;
    }
    var overlay = document.createElement("div");
    overlay.setAttribute("data-btcpay-modal", "true");
    overlay.style.position = "fixed";
    overlay.style.inset = "0";
    overlay.style.display = "none";
    overlay.style.alignItems = "center";
    overlay.style.justifyContent = "center";
    overlay.style.background = "rgba(16, 18, 23, 0.6)";
    overlay.style.zIndex = "2147483647";
    overlay.style.padding = "24px";

    var container = document.createElement("div");
    container.style.position = "relative";
    container.style.width = "min(92vw, 520px)";
    container.style.height = "min(86vh, 720px)";
    container.style.background = "#f8f2e9";
    container.style.borderRadius = "20px";
    container.style.boxShadow = "0 24px 50px rgba(16, 18, 23, 0.35)";
    container.style.overflow = "hidden";

    var iframe = document.createElement("iframe");
    iframe.setAttribute("title", "Payment request");
    iframe.style.width = "100%";
    iframe.style.height = "100%";
    iframe.style.border = "0";
    iframe.style.background = "transparent";
    iframe.allow = "clipboard-read; clipboard-write";

    container.appendChild(iframe);
    overlay.appendChild(container);
    document.body.appendChild(overlay);

    overlay.addEventListener("click", function (event) {
      if (event.target === overlay) {
        hideFrame();
      }
    });

    state.modal = overlay;
    state.iframe = iframe;
  }

  function showInvoice(invoiceId) {
    if (!invoiceId) {
      return;
    }
    ensureModal();
    if (!state.modal || !state.iframe) {
      return;
    }
    state.iframe.src = resolveInvoiceUrl(invoiceId);
    state.modal.style.display = "flex";
  }

  function hideFrame() {
    if (!state.modal) {
      return;
    }
    state.modal.style.display = "none";
  }

  function onModalReceiveMessage(callback) {
    if (typeof callback !== "function") {
      return;
    }
    state.handlers.push(callback);
  }

  function allowMessage(event) {
    if (!state.baseUrl) {
      return true;
    }
    try {
      var origin = new URL(state.baseUrl, window.location.href).origin;
      return event.origin === origin;
    } catch (error) {
      return false;
    }
  }

  window.addEventListener("message", function (event) {
    if (!allowMessage(event)) {
      return;
    }
    state.handlers.forEach(function (handler) {
      try {
        handler(event.data);
      } catch (error) {
        return;
      }
    });
  });

  window.btcpay = window.btcpay || {};
  window.btcpay.setApiUrlPrefix = function (baseUrl) {
    state.baseUrl = normalizeBaseUrl(baseUrl);
  };
  window.btcpay.showInvoice = showInvoice;
  window.btcpay.hideFrame = hideFrame;
  window.btcpay.onModalReceiveMessage = onModalReceiveMessage;
})();
