// ==UserScript==
// @name Scavange
// @description Send scavange if no attack incomming. Configurable via GUI
// @include https://*tribalwars*screen=place*mode=scavenge*
// @icon https://www.google.com/s2/favicons?sz=64&domain=tribalwars.com.pt
// @updateURL https://github.com/wasdfra/TWScripts/raw/master/UserScript/Scavange.user.js
// @version 2.1
// @grant GM_setValue
// @grant GM_getValue
// @run-at document-end
// ==/UserScript==

(function () {
"use strict";

// ── Constants ────────────────────────────────────────────────────────────

const CONFIG = {
  INITIAL_DELAY_MS: 1000,
  SEND_DELAY_MS: 3000,
  RELOAD_MIN_MS: 140000,
  RELOAD_MAX_MS: 820000,
  SCAVENGE_WEIGHTS: [15, 6, 3, 2],
  ALL_UNITS: [
    "spear", "sword", "axe", "archer",
    "light", "marcher", "heavy", "knight"
  ],
};

// ── Utilities ────────────────────────────────────────────────────────────

const randomInt = (min, max) =>
  Math.round(min + Math.random() * (max - min));

const storageKey = (unit) => `scavenge_unit_${unit}`;

// ── Incoming attack detection ────────────────────────────────────────────

const hasIncomingAttacks = () => {
  if (typeof game_data !== "undefined") {
    return (game_data?.village?.incoming_attacks ?? 0) > 0;
  }
  const el = document.querySelector("#incomings_amount");
  if (el) {
    const count = parseInt(el.textContent.trim(), 10);
    return !isNaN(count) && count > 0;
  }
  return false;
};

// ── Village navigation ───────────────────────────────────────────────────

const getNextVillageArrow = () => {
  // Update this selector to match your "next" arrow exactly.
  return document.querySelector(
    '#village_switch_right, .village_switch_right, [data-dir="next"].village_switch'
  );
};

const goToNextVillage = () => {
  const nextArrow = getNextVillageArrow();
  if (nextArrow) {
    console.log("[Scavenge] clicking next village arrow...");
    nextArrow.click();
    return true;
  }
  console.warn("[Scavenge] next village arrow not found");
  return false;
};

// ── Unit filter UI ───────────────────────────────────────────────────────

const UnitFilter = {
  CONTAINER_ID: "tm-unit-filter",

  render() {
    if (document.getElementById(this.CONTAINER_ID)) return;

    const container = document.createElement("div");
    container.id = this.CONTAINER_ID;
    Object.assign(container.style, {
      padding: "8px",
      margin: "8px 0",
      background: "#f0e0a0",
      border: "1px solid #804000",
      fontSize: "12px",
    });

    const title = document.createElement("strong");
    title.textContent = "Auto send in scavenge:";
    container.appendChild(title);
    container.appendChild(document.createElement("br"));

    CONFIG.ALL_UNITS.forEach((unit) => {
      container.appendChild(this._createUnitLabel(unit));
    });

    const anchor = document.querySelector(".units-entry-all")?.closest("table");
    anchor
      ? anchor.parentNode.insertBefore(container, anchor)
      : document.body.prepend(container);
  },

  _createUnitLabel(unit) {
    const label = document.createElement("label");
    Object.assign(label.style, { marginRight: "10px", whiteSpace: "nowrap" });

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.dataset.unit = unit;
    cb.checked = GM_getValue(storageKey(unit), true);
    cb.style.marginRight = "3px";
    cb.addEventListener("change", () => GM_setValue(storageKey(unit), cb.checked));

    label.appendChild(cb);
    label.append(` ${unit}`);
    return label;
  },

  getExcludedUnits() {
    return [
      ...document.querySelectorAll(`#${this.CONTAINER_ID} input[type=checkbox]`),
    ]
      .filter((cb) => !cb.checked)
      .map((cb) => cb.dataset.unit);
  },
};

// ── Troop helpers ────────────────────────────────────────────────────────

const Troops = {
  getAvailable() {
    const excluded = UnitFilter.getExcludedUnits();
    return [...document.getElementsByClassName("units-entry-all")]
      .map((el) => ({
        unit: el.getAttribute("data-unit"),
        quantity: parseInt(el.textContent.replace(/[()]/g, "").trim(), 10),
      }))
      .filter(({ unit, quantity }) =>
        !excluded.includes(unit) && quantity > 0
      );
  },

  calculateSplit(troops, scavengeWeight, totalWeight) {
    return troops.map(({ unit, quantity }) => ({
      unit,
      quantityToSend: Math.floor((quantity * scavengeWeight) / totalWeight),
    }));
  },
};

// ── Scavenge logic ───────────────────────────────────────────────────────

const Scavenge = {
  get lockedCount() {
    return document.getElementsByClassName("unlock-button").length;
  },

  get unlockedCount() {
    return CONFIG.SCAVENGE_WEIGHTS.length - this.lockedCount;
  },

  get totalWeight() {
    return CONFIG.SCAVENGE_WEIGHTS
      .slice(0, this.unlockedCount)
      .reduce((a, b) => a + b, 0);
  },

  getAvailableSlots() {
    return [...document.getElementsByClassName("free_send_button")];
  },

  send(weight, troops, button) {
    const split = Troops.calculateSplit(troops, weight, this.totalWeight);
    split.forEach(({ unit, quantityToSend }) => {
      if (quantityToSend > 0) {
        $(`[name=${unit}]`).val(String(quantityToSend)).change();
      }
    });
    button.click();
  },

  init() {
    UnitFilter.render();

    if (hasIncomingAttacks()) {
      console.log("[Scavenge] Incoming attack detected — skipping auto-send.");
      return;
    }

    const slots = this.getAvailableSlots();
    const troops = Troops.getAvailable();

    if (slots.length < this.unlockedCount) {
      console.log("[Scavenge] Not all slots are free — skipping.");
      return;
    }

    slots.forEach((button, index) => {
      const weight = CONFIG.SCAVENGE_WEIGHTS[index];
      const delay = CONFIG.SEND_DELAY_MS * (index + 1);
      setTimeout(() => this.send(weight, troops, button), delay);
    });
  },
};

// ── Reload / village-cycle scheduler ─────────────────────────────────────

const scheduleReload = () => {
  const delay = randomInt(CONFIG.RELOAD_MIN_MS, CONFIG.RELOAD_MAX_MS);
  console.log(`[Scavenge] Will switch village in ${delay / 1000}s`);
  setTimeout(() => {
    if (!goToNextVillage()) {
      console.log("[Scavenge] Reloading (next-village arrow not found)...");
      window.location.reload();
    }
  }, delay);
};

// ── Entry point ──────────────────────────────────────────────────────────

$(document).ready(() => {
  setTimeout(() => Scavenge.init(), CONFIG.INITIAL_DELAY_MS);
  scheduleReload();
});

})();