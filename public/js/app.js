/* ============================================================
   DRONETECH — Student Registration Portal
   Vanilla JS: form validation, API submission, ambient FX.
   All pointer effects are transform-only, batched through one
   requestAnimationFrame loop, and disabled for touch devices
   or users who prefer reduced motion.
   ============================================================ */
(() => {
  "use strict";

  var reduceMotionMQ = window.matchMedia("(prefers-reduced-motion: reduce)");
  var coarsePointerMQ = window.matchMedia("(hover: none), (pointer: coarse)");
  function motionOK() {
    return !reduceMotionMQ.matches;
  }
  function pointerIsFine() {
    return motionOK() && !coarsePointerMQ.matches;
  }

  function $(sel, root) {
    return (root || document).querySelector(sel);
  }

  /* ==========================================================
     1. API health indicator
     ========================================================== */
  var chip = $("#health-chip");
  var chipText = chip ? $(".chip-text", chip) : null;

  function pingHealth() {
    if (!chip) return;
    fetch("/api/health", { cache: "no-store" })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return {};
          })
          .then(function (body) {
            var up = res.ok && body.db !== "down";
            chip.dataset.state = up ? "ok" : "down";
            chipText.textContent = up ? "API ONLINE" : "API DEGRADED";
          });
      })
      .catch(function () {
        chip.dataset.state = "down";
        chipText.textContent = "API OFFLINE";
      });
  }
  pingHealth();
  window.setInterval(pingHealth, 30000);

  /* ==========================================================
     2. Validation (mirrors the server exactly)
     ========================================================== */
  var NAME_RE = /^[\p{L}]+(?:\s+[\p{L}]+)*$/u;
  var SAP_RE = /^[0-9]{9}$/;
  var PHONE_RE = /^[987][0-9]{9}$/;
  var EMAIL_RE = /^[^\s@]{1,64}@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;

  function normalize(key, raw) {
    var value = String(raw || "").trim();
    if (key === "name") return value.replace(/\s+/g, " ");
    if (key === "collegeEmail") return value.toLowerCase();
    return value;
  }

  function validateField(key, value) {
    switch (key) {
      case "name":
        if (!value) return "Full name is required.";
        if (value.length < 2) return "Please enter your full name (at least 2 letters).";
        if (value.length > 80) return "Please keep the name under 80 characters.";
        if (!NAME_RE.test(value)) return "Name may contain letters and spaces only.";
        return null;
      case "sapId":
        if (!value) return "SAP ID is required.";
        if (!SAP_RE.test(value)) return "SAP ID must contain exactly 9 digits.";
        return null;
      case "phone":
        if (!value) return "Phone number is required.";
        if (!PHONE_RE.test(value)) return "Phone number must be 10 digits and start with 9, 8, or 7.";
        return null;
      case "collegeEmail":
        if (!value) return "College email is required.";
        if (value.length > 254 || !EMAIL_RE.test(value))
          return "Enter a valid email address (e.g., student@college.edu).";
        return null;
      default:
        return null;
    }
  }

  /* ==========================================================
     3. Form wiring
     ========================================================== */
  var form = $("#reg-form");
  var submitBtn = $("#submit-btn");
  var btnLabel = submitBtn ? $(".btn-label", submitBtn) : null;
  var statusEl = $("#form-status");
  var successPanel = $("#success-panel");
  var successHeading = $("#success-heading");

  var FIELDS = {
    name: { input: $("#f-name"), error: $("#e-name") },
    sapId: { input: $("#f-sap"), error: $("#e-sap") },
    phone: { input: $("#f-phone"), error: $("#e-phone") },
    collegeEmail: { input: $("#f-email"), error: $("#e-email") },
  };
  var touched = {};
  var submitting = false;

  function showFieldError(key, message) {
    var field = FIELDS[key];
    if (!field) return;
    var wrapper = field.input.closest(".field");
    if (message) {
      wrapper.classList.add("invalid");
      field.error.textContent = message;
      field.input.setAttribute("aria-invalid", "true");
    } else {
      wrapper.classList.remove("invalid");
      field.error.textContent = "";
      field.input.removeAttribute("aria-invalid");
    }
  }

  function revalidate(key) {
    var value = normalize(key, FIELDS[key].input.value);
    showFieldError(key, validateField(key, value));
  }

  Object.keys(FIELDS).forEach(function (key) {
    var input = FIELDS[key].input;
    input.addEventListener("blur", function () {
      touched[key] = true;
      revalidate(key);
    });
    // Revalidate live only once the user has already seen an error there,
    // so correcting input feels responsive but first typing stays calm.
    input.addEventListener("input", function () {
      if (touched[key]) revalidate(key);
    });
  });

  function shake(wrapper) {
    if (!wrapper || !motionOK()) return;
    wrapper.classList.remove("shake");
    void wrapper.offsetWidth; // restart the animation
    wrapper.classList.add("shake");
    window.setTimeout(function () {
      wrapper.classList.remove("shake");
    }, 400);
  }

  var ICONS = {
    info:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
    error:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
    success:
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.801 10A10 10 0 1 1 17 3.335"/><path d="m9 11 3 3L22 4"/></svg>',
  };

  function setStatus(kind, message) {
    statusEl.dataset.kind = kind;
    statusEl.innerHTML = ICONS[kind] || "";
    var span = document.createElement("span");
    span.textContent = message; // textContent: never inject server HTML
    statusEl.appendChild(span);
    statusEl.hidden = false;
  }

  function hideStatus() {
    statusEl.hidden = true;
    statusEl.textContent = "";
  }

  function collectPayload() {
    var payload = {};
    Object.keys(FIELDS).forEach(function (key) {
      payload[key] = normalize(key, FIELDS[key].input.value);
    });
    return payload;
  }

  function setLoading(isLoading) {
    submitting = isLoading;
    submitBtn.disabled = isLoading;
    submitBtn.classList.toggle("loading", isLoading);
    submitBtn.setAttribute("aria-busy", isLoading ? "true" : "false");
    btnLabel.textContent = isLoading ? "Submitting registration…" : "Register";
  }

  function applyServerErrors(errors) {
    var first = null;
    Object.keys(FIELDS).forEach(function (key) {
      touched[key] = true;
      var message = errors && errors[key] ? errors[key] : null;
      showFieldError(key, message);
      if (message && !first) first = FIELDS[key];
    });
    if (first) {
      shake(first.input.closest(".field"));
      first.input.focus();
    }
  }

  function onSuccess(data, payload) {
    $("#s-name").textContent = (data && data.name) || payload.name;
    $("#s-ref").textContent = (data && data.reference) || "—";
    $("#s-sap").textContent = payload.sapId;
    $("#s-email").textContent = payload.collegeEmail;

    form.hidden = true;
    hideStatus();
    form.reset();
    Object.keys(FIELDS).forEach(function (key) {
      touched[key] = false;
      showFieldError(key, null);
    });
    successPanel.hidden = false;
    successHeading.focus();
  }

  function submitRegistration(payload) {
    setLoading(true);
    setStatus("info", "Submitting registration…");

    var controller = new AbortController();
    var timer = window.setTimeout(function () {
      controller.abort();
    }, 15000);

    fetch("/api/registrations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
      .then(function (res) {
        return res
          .json()
          .catch(function () {
            return null;
          })
          .then(function (data) {
            if (res.status === 201 && data && data.ok) {
              onSuccess(data.data || {}, payload);
              return;
            }
            if ((res.status === 400 || res.status === 409) && data && data.errors) {
              applyServerErrors(data.errors);
              setStatus("error", data.message || "Please correct the highlighted fields.");
              return;
            }
            setStatus(
              "error",
              (data && data.message) ||
                "Our registration service is temporarily unavailable. Please try again later."
            );
          });
      })
      .catch(function (err) {
        if (err && err.name === "AbortError") {
          setStatus("error", "The request timed out. Please check your connection and try again.");
        } else {
          setStatus(
            "error",
            "Network error — the server could not be reached. Make sure it is running and try again."
          );
        }
      })
      .then(function () {
        window.clearTimeout(timer);
        setLoading(false);
      });
  }

  form.addEventListener("submit", function (event) {
    event.preventDefault(); // never allow a full page reload
    if (submitting) return; // guard double submissions

    var firstInvalid = null;
    Object.keys(FIELDS).forEach(function (key) {
      touched[key] = true;
      var message = validateField(key, normalize(key, FIELDS[key].input.value));
      showFieldError(key, message);
      if (message && !firstInvalid) firstInvalid = FIELDS[key];
    });

    if (firstInvalid) {
      shake(firstInvalid.input.closest(".field"));
      firstInvalid.input.focus();
      setStatus("error", "Please correct the highlighted fields and try again.");
      return;
    }

    submitRegistration(collectPayload());
  });

  $("#btn-again").addEventListener("click", function () {
    successPanel.hidden = true;
    form.hidden = false;
    hideStatus();
    FIELDS.name.input.focus();
  });

  /* ==========================================================
     4. Cursor FX: glow follow + card tilt + parallax
     One rAF loop, transform-only writes.
     ========================================================== */
  var card = $("#card");
  var glow = $("#glow");
  var parallaxEls = Array.prototype.slice.call(document.querySelectorAll("[data-depth]"));

  var pointer = {
    x: window.innerWidth / 2,
    y: window.innerHeight * 0.4,
    active: false,
  };

  if (pointerIsFine() && card && glow) {
    var glowPos = { x: pointer.x, y: pointer.y };
    var tilt = { rx: 0, ry: 0 };
    var glare = { mx: 50, my: -20 };

    window.addEventListener(
      "pointermove",
      function (e) {
        pointer.x = e.clientX;
        pointer.y = e.clientY;
        if (!pointer.active) {
          pointer.active = true;
          glow.style.opacity = "1";
        }
      },
      { passive: true }
    );

    var fxRunning = true;
    document.addEventListener("visibilitychange", function () {
      fxRunning = !document.hidden;
      if (fxRunning) requestAnimationFrame(fxTick);
    });

    function fxTick() {
      if (!fxRunning) return;

      var nx = (pointer.x / window.innerWidth) * 2 - 1; // -1 .. 1
      var ny = (pointer.y / window.innerHeight) * 2 - 1;

      // glow: ease toward the cursor
      glowPos.x += (pointer.x - glowPos.x) * 0.11;
      glowPos.y += (pointer.y - glowPos.y) * 0.11;
      glow.style.transform = "translate3d(" + glowPos.x + "px," + glowPos.y + "px,0)";

      // restrained 3D tilt on the card
      tilt.rx += (-ny * 2.6 - tilt.rx) * 0.07;
      tilt.ry += (nx * 3.4 - tilt.ry) * 0.07;
      card.style.transform =
        "perspective(950px) rotateX(" + tilt.rx.toFixed(3) + "deg) rotateY(" + tilt.ry.toFixed(3) + "deg)";

      // glare position on the card surface
      var rect = card.getBoundingClientRect();
      var tx = ((pointer.x - rect.left) / rect.width) * 100;
      var ty = ((pointer.y - rect.top) / rect.height) * 100;
      glare.mx += (tx - glare.mx) * 0.12;
      glare.my += (ty - glare.my) * 0.12;
      card.style.setProperty("--mx", glare.mx.toFixed(2) + "%");
      card.style.setProperty("--my", glare.my.toFixed(2) + "%");

      // gentle parallax on decorative layers
      for (var i = 0; i < parallaxEls.length; i++) {
        var el = parallaxEls[i];
        var depth = parseFloat(el.getAttribute("data-depth")) || 0.3;
        el.style.transform = "translate3d(" + (nx * depth * 22).toFixed(2) + "px," + (ny * depth * 18).toFixed(2) + "px,0)";
      }

      requestAnimationFrame(fxTick);
    }
    requestAnimationFrame(fxTick);
  }

  /* ==========================================================
     5. Ambient particle network (drone swarm)
     ========================================================== */
  var canvas = $("#net");
  if (canvas && motionOK()) {
    var ctx = canvas.getContext("2d");
    var DPR = Math.min(window.devicePixelRatio || 1, 1.75);
    var nodes = [];
    var W = 0;
    var H = 0;
    var netRunning = true;
    var lastT = 0;

    function buildNodes() {
      var count = Math.max(26, Math.min(72, Math.round((W * H) / 26000)));
      nodes = [];
      for (var i = 0; i < count; i++) {
        var speed = 7 + Math.random() * 13;
        var angle = Math.random() * Math.PI * 2;
        nodes.push({
          x: Math.random() * W,
          y: Math.random() * H,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 1 + Math.random() * 1.3,
          violet: Math.random() < 0.3,
        });
      }
    }

    function resize() {
      W = window.innerWidth;
      H = window.innerHeight;
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
      canvas.style.width = W + "px";
      canvas.style.height = H + "px";
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      buildNodes();
    }
    window.addEventListener("resize", resize, { passive: true });
    resize();

    document.addEventListener("visibilitychange", function () {
      netRunning = !document.hidden;
      if (netRunning) {
        lastT = 0;
        requestAnimationFrame(netTick);
      }
    });

    var LINK_DIST = 130;
    var MOUSE_DIST = 165;

    function netTick(t) {
      if (!netRunning) return;
      var dt = lastT ? Math.min((t - lastT) / 1000, 0.05) : 0.016;
      lastT = t;
      ctx.clearRect(0, 0, W, H);

      var i;
      var j;
      var n;
      var m;
      var dx;
      var dy;
      var d;
      var a;

      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        n.x += n.vx * dt;
        n.y += n.vy * dt;
        if (n.x < -20) n.x = W + 20;
        else if (n.x > W + 20) n.x = -20;
        if (n.y < -20) n.y = H + 20;
        else if (n.y > H + 20) n.y = -20;
      }

      // links between swarm nodes
      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        for (j = i + 1; j < nodes.length; j++) {
          m = nodes[j];
          dx = n.x - m.x;
          dy = n.y - m.y;
          d = Math.sqrt(dx * dx + dy * dy);
          if (d < LINK_DIST) {
            a = (1 - d / LINK_DIST) * 0.26;
            ctx.strokeStyle = "rgba(110, 165, 255," + a.toFixed(3) + ")";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(m.x, m.y);
            ctx.stroke();
          }
        }
        // link to the cursor reads as the swarm "tracking" the user
        if (pointer.active) {
          dx = n.x - pointer.x;
          dy = n.y - pointer.y;
          d = Math.sqrt(dx * dx + dy * dy);
          if (d < MOUSE_DIST) {
            a = (1 - d / MOUSE_DIST) * 0.34;
            ctx.strokeStyle = "rgba(56, 224, 248," + a.toFixed(3) + ")";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(n.x, n.y);
            ctx.lineTo(pointer.x, pointer.y);
            ctx.stroke();
          }
        }
      }

      for (i = 0; i < nodes.length; i++) {
        n = nodes[i];
        ctx.fillStyle = n.violet ? "rgba(167, 139, 250, 0.85)" : "rgba(125, 211, 252, 0.85)";
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      requestAnimationFrame(netTick);
    }
    requestAnimationFrame(netTick);
  }
})();
