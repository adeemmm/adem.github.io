// Safehouse / Shop: the cosmetics modal shown in the lobby.
// Displays the player's gold and lifetime stats, and lets them buy and equip
// skins. All validation happens on the server (server/sim/Progression.js);
// this file only renders the profile it is given and sends requests.
import * as THREE from "three";
import { ROLE_TOY, ROLE_GUARD } from "./shared/constants.js";
import { SKINS } from "./shared/cosmetics.js";
import { createPlayerModel, disposeModel } from "./models.js";

const PREVIEW_SIZE = 160;

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * Renders every skin once with a small throwaway WebGL renderer and returns
 * { skinId: dataURL }. Using the real models means previews can never drift
 * from what appears in game.
 */
function renderPreviews() {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setSize(PREVIEW_SIZE, PREVIEW_SIZE);
  const scene = new THREE.Scene();
  scene.add(new THREE.HemisphereLight(0xffffff, 0x444466, 1.6));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(2, 4, -3);
  scene.add(key);
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50);

  const images = {};
  for (const [id, skin] of Object.entries(SKINS)) {
    const model = createPlayerModel(skin.role, 2, id);
    // Previews show the character only: no flashlight beam or spotlight.
    model.traverse((o) => { if (o.userData.beam || o.isSpotLight) o.visible = false; });
    scene.add(model);
    const tall = skin.role === ROLE_GUARD;
    camera.position.set(tall ? -2.6 : -1.7, tall ? 2.4 : 1.5, tall ? -5.4 : -3.4);   // front three-quarter view
    camera.lookAt(0, tall ? 1.3 : 0.8, 0);
    renderer.render(scene, camera);
    images[id] = renderer.domElement.toDataURL("image/png");
    scene.remove(model);
    disposeModel(model);
  }
  renderer.dispose();
  renderer.forceContextLoss();
  return images;
}

export class ShopUI {
  /**
   * root: the (hidden) overlay element. send(action, skinId) issues a shop
   * request; onToggle(open) lets the game release the mouse / pause input.
   */
  constructor(root, { send, onToggle = () => {} }) {
    this.root = root;
    this.send = send;
    this.onToggle = onToggle;
    this.profile = null;
    this.previews = null;
    this.cards = new Map();   // skin id -> { card, button, tag }

    const panel = el("div", "panel shop-panel");
    const header = el("div", "shop-header");
    header.append(el("h2", "", "SAFEHOUSE"));
    this.closeButton = el("button", "shop-close", "Close (B)");
    this.closeButton.addEventListener("click", () => this.close());
    header.append(this.closeButton);

    this.gold = el("div", "shop-gold");
    this.stats = el("div", "shop-stats");
    this.notice = el("p", "shop-notice");
    this.grid = el("div", "shop-grid");
    panel.append(header, this.gold, this.stats, this.notice, this.grid);
    root.append(panel);
  }

  get isOpen() { return !this.root.hidden; }

  open() {
    if (this.isOpen) return;
    if (!this.previews) { this.previews = renderPreviews(); this.buildCards(); }
    this.notice.textContent = "";
    this.root.hidden = false;
    this.render();
    this.onToggle(true);
  }

  close() {
    if (!this.isOpen) return;
    this.root.hidden = true;
    this.onToggle(false);
  }

  toggle() { if (this.isOpen) this.close(); else this.open(); }

  /** New profile (or an error / notice) from the server. */
  setProfile(message) {
    if (message.error) { this.notice.textContent = message.error; this.notice.className = "shop-notice error"; return; }
    this.profile = message;
    if (message.notice) { this.notice.textContent = message.notice; this.notice.className = "shop-notice"; }
    if (this.isOpen) this.render();
  }

  buildCards() {
    for (const role of [ROLE_TOY, ROLE_GUARD]) {
      this.grid.append(el("h3", "shop-section", role === ROLE_TOY ? "Toy skins" : "Guard skins"));
      const row = el("div", "shop-row");
      for (const [id, skin] of Object.entries(SKINS)) {
        if (skin.role !== role) continue;
        const card = el("div", "shop-card");
        const img = el("img");
        img.src = this.previews[id];
        img.alt = skin.name;
        img.width = img.height = PREVIEW_SIZE;
        const tag = el("div", "shop-tag");
        const button = el("button");
        button.addEventListener("click", () => this.send(button.dataset.action, id));
        card.append(img, el("div", "shop-name", skin.name), el("div", "shop-blurb", skin.blurb), tag, button);
        row.append(card);
        this.cards.set(id, { card, button, tag });
      }
      this.grid.append(row);
    }
  }

  render() {
    const p = this.profile;
    const guest = !p || p.guest;
    this.gold.textContent = guest ? "Playing as a guest" : `${p.gold} gold`;
    this.stats.textContent = guest
      ? "Enter a name on the main menu to earn gold and keep your unlocks."
      : `${p.username} · ${p.totalDeposits} loot deposited · ${p.totalArrests} arrests made`;

    for (const [id, { card, button, tag }] of this.cards) {
      const skin = SKINS[id];
      const owned = !guest && p.unlocked.includes(id);
      const equipped = !guest && (skin.role === ROLE_GUARD ? p.guardSkin : p.toySkin) === id;
      card.classList.toggle("equipped", equipped);
      card.classList.toggle("locked", !owned);
      tag.textContent = owned ? (equipped ? "Equipped" : "Owned") : `${skin.price} gold`;
      if (equipped) {
        button.textContent = "Equipped"; button.disabled = true; button.dataset.action = "";
      } else if (owned) {
        button.textContent = "Equip"; button.disabled = false; button.dataset.action = "equip";
      } else {
        const affordable = !guest && p.gold >= skin.price;
        button.textContent = affordable ? `Buy · ${skin.price}` : (guest ? "Locked" : `Need ${skin.price - p.gold} more`);
        button.disabled = !affordable;
        button.dataset.action = "buy";
      }
    }
  }
}
