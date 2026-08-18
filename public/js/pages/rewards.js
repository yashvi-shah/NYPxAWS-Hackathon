/* ==========================================================================
   rewards.js — "My Rewards"
   Shows XP balance and redeemable vouchers at various XP thresholds.
   ========================================================================== */

import { html, render } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { session, levelFromXp, refreshUser } from '../services/store.js';
import { api } from '../services/api.js';
import { setLayer } from '../core/actions.js';
import { toast } from '../ui/toast.js';
import { syncUser } from '../ui/shell.js';

/* --------------------------------------------------------------------------
   Reward catalogue — tiers of vouchers students can redeem
   -------------------------------------------------------------------------- */

const REWARDS = [
  // Tier 1 — 500 XP
  { id: 'koufu-2',    name: 'Koufu $2 Voucher',    brand: 'Koufu',    xpCost: 500,  icon: '🍜', description: '$2 off any meal at Koufu food court' },
  { id: 'itea-1',     name: 'iTea $1 Off',          brand: 'iTea',     xpCost: 500,  icon: '🧋', description: '$1 off any drink at iTea' },

  // Tier 2 — 1200 XP
  { id: 'koufu-5',    name: 'Koufu $5 Voucher',    brand: 'Koufu',    xpCost: 1200, icon: '🍜', description: '$5 off any meal at Koufu food court' },
  { id: 'chagee-1',   name: 'Chagee Free Upsize',  brand: 'Chagee',   xpCost: 1200, icon: '🍵', description: 'Free upsize on any Chagee drink' },
  { id: 'itea-3',     name: 'iTea $3 Voucher',      brand: 'iTea',     xpCost: 1200, icon: '🧋', description: '$3 off any drink at iTea' },

  // Tier 3 — 2500 XP
  { id: 'luckin-5',   name: 'Luckin $5 Voucher',   brand: 'Luckin',   xpCost: 2500, icon: '☕', description: '$5 off any Luckin Coffee order' },
  { id: 'chagee-5',   name: 'Chagee $5 Voucher',   brand: 'Chagee',   xpCost: 2500, icon: '🍵', description: '$5 off any Chagee drink' },
  { id: 'koufu-10',   name: 'Koufu $10 Voucher',   brand: 'Koufu',    xpCost: 2500, icon: '🍜', description: '$10 meal voucher at Koufu' },

  // Tier 4 — 4500 XP
  { id: 'luckin-10',  name: 'Luckin $10 Voucher',  brand: 'Luckin',   xpCost: 4500, icon: '☕', description: '$10 off any Luckin Coffee order' },
  { id: 'chagee-10',  name: 'Chagee $10 Voucher',  brand: 'Chagee',   xpCost: 4500, icon: '🍵', description: '$10 voucher for Chagee' },
  { id: 'itea-bogo',  name: 'iTea Buy 1 Get 1',    brand: 'iTea',     xpCost: 4500, icon: '🧋', description: 'Buy 1 get 1 free at iTea' },

  // Tier 5 — 7000 XP
  { id: 'koufu-20',   name: 'Koufu $20 Voucher',   brand: 'Koufu',    xpCost: 7000, icon: '🍜', description: '$20 meal voucher — treat a friend!' },
  { id: 'luckin-free', name: 'Luckin Free Drink',   brand: 'Luckin',   xpCost: 7000, icon: '☕', description: 'One free drink of your choice at Luckin' },
  { id: 'chagee-free', name: 'Chagee Free Drink',  brand: 'Chagee',   xpCost: 7000, icon: '🍵', description: 'One free drink of your choice at Chagee' },

  // Tier 6 — 10000 XP
  { id: 'ultimate',   name: 'Ultimate Reward Bundle', brand: 'All',   xpCost: 10000, icon: '🎁', description: '$10 voucher from each brand — Koufu, Chagee, Luckin & iTea' },
];

const TIERS = [
  { xp: 500,   label: 'Starter' },
  { xp: 1200,  label: 'Explorer' },
  { xp: 2500,  label: 'Achiever' },
  { xp: 4500,  label: 'Champion' },
  { xp: 7000,  label: 'Legend' },
  { xp: 10000, label: 'Ultimate' },
];

/* --------------------------------------------------------------------------
   Helpers
   -------------------------------------------------------------------------- */

function getRedeemedRewards() {
  try {
    const raw = localStorage.getItem('gravity.redeemed.v1');
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveRedeemed(list) {
  try { localStorage.setItem('gravity.redeemed.v1', JSON.stringify(list)); } catch { /* ignore */ }
}

/** Track total XP spent on rewards so we can deduct on login if server didn't persist */
function getXpSpent() {
  try {
    return Number(localStorage.getItem('gravity.xpSpent.v1')) || 0;
  } catch { return 0; }
}

function addXpSpent(amount) {
  try {
    const current = getXpSpent();
    localStorage.setItem('gravity.xpSpent.v1', String(current + amount));
  } catch { /* ignore */ }
}

function currentTier(xp) {
  let tier = null;
  for (const t of TIERS) {
    if (xp >= t.xp) tier = t;
  }
  return tier;
}

function nextTier(xp) {
  for (const t of TIERS) {
    if (xp < t.xp) return t;
  }
  return null;
}

/* --------------------------------------------------------------------------
   Page render
   -------------------------------------------------------------------------- */

function renderPage(view) {
  const user = session.user || {};
  // Use server XP minus any locally tracked redemption spending (handles case where server didn't persist)
  const serverXp = user.xp || 0;
  const spent = getXpSpent();
  const xp = Math.max(0, serverXp - spent);
  const level = levelFromXp(xp);
  const redeemed = getRedeemedRewards();
  const tier = currentTier(xp);
  const next = nextTier(xp);

  const progressToNext = next
    ? Math.min(100, Math.round(((xp - (tier ? tier.xp : 0)) / (next.xp - (tier ? tier.xp : 0))) * 100))
    : 100;

  render(view, html`
    <div class="page-rewards">
      <div class="rewards-header">
        <h1>${icon('flame', { size: 22 })} My Rewards</h1>
        <p class="meta">Earn XP by completing tasks, submitting early, and helping peers. Redeem for real rewards.</p>
      </div>

      <!-- XP Summary Card -->
      <div class="rewards-summary">
        <div class="xp-card">
          <div class="xp-card-top">
            <span class="xp-amount num">${xp.toLocaleString()}</span>
            <span class="xp-label">XP Available</span>
          </div>
          <div class="xp-card-meta">
            <span>Level ${level.level}</span>
            <span>${tier ? tier.label + ' Tier' : 'Getting started'}</span>
          </div>
        </div>
        ${next ? html`
          <div class="xp-progress-wrap">
            <div class="xp-progress-header">
              <span class="meta">Next tier: <strong>${next.label}</strong></span>
              <span class="meta num">${xp.toLocaleString()} / ${next.xp.toLocaleString()} XP</span>
            </div>
            <div class="xp-progress-track">
              <div class="xp-progress-fill" style="width: ${progressToNext}%"></div>
            </div>
            <span class="xp-progress-hint">${(next.xp - xp).toLocaleString()} XP to unlock ${next.label} rewards</span>
          </div>
        ` : html`
          <div class="xp-progress-wrap">
            <p class="xp-progress-hint" style="text-align:center">You've reached the highest tier. All rewards unlocked!</p>
          </div>
        `}
      </div>

      <!-- Tier Milestones -->
      <div class="tier-milestones">
        ${TIERS.map((t) => html`
          <div class="tier-milestone ${xp >= t.xp ? 'unlocked' : 'locked'}">
            <span class="tier-dot"></span>
            <span class="tier-info">
              <span class="tier-name">${t.label}</span>
              <span class="tier-xp num">${t.xp.toLocaleString()} XP</span>
            </span>
          </div>
        `)}
      </div>

      <!-- Reward Cards -->
      <h2 class="rewards-section-title">Available Rewards</h2>
      <div class="rewards-grid">
        ${REWARDS.filter((r) => xp >= r.xpCost).map((r) => {
          const isRedeemed = redeemed.includes(r.id);
          return html`
            <div class="reward-card ${isRedeemed ? 'redeemed' : 'available'}">
              <span class="reward-icon">${r.icon}</span>
              <div class="reward-details">
                <span class="reward-name">${r.name}</span>
                <span class="reward-brand">${r.brand}</span>
                <span class="reward-desc">${r.description}</span>
              </div>
              <div class="reward-action">
                <span class="reward-cost num">${r.xpCost.toLocaleString()} XP</span>
                ${isRedeemed
                  ? html`<span class="reward-badge redeemed-badge">${icon('check', { size: 12 })} Redeemed</span>`
                  : html`<button class="btn btn-primary btn-sm" data-act="redeem" data-id="${r.id}">Redeem</button>`
                }
              </div>
            </div>
          `;
        })}
      </div>

      ${REWARDS.some((r) => xp < r.xpCost) ? html`
        <h2 class="rewards-section-title locked-title">${icon('clock', { size: 16 })} Locked Rewards</h2>
        <div class="rewards-grid locked-grid">
          ${REWARDS.filter((r) => xp < r.xpCost).map((r) => html`
            <div class="reward-card locked">
              <span class="reward-icon">${r.icon}</span>
              <div class="reward-details">
                <span class="reward-name">${r.name}</span>
                <span class="reward-brand">${r.brand}</span>
                <span class="reward-desc">${r.description}</span>
              </div>
              <div class="reward-action">
                <span class="reward-cost num">${r.xpCost.toLocaleString()} XP</span>
                <span class="reward-badge locked-badge">${icon('clock', { size: 12 })} ${(r.xpCost - xp).toLocaleString()} XP more</span>
              </div>
            </div>
          `)}
        </div>
      ` : ''}
    </div>
  `);

  setLayer('page', {
    redeem: async (ds) => {
      const reward = REWARDS.find((r) => r.id === ds.id);
      if (!reward) return;
      const user = session.user;
      if (!user || (user.xp || 0) < reward.xpCost) {
        toast('Not enough XP to redeem this reward.', { tone: 'warn' });
        return;
      }
      const current = getRedeemedRewards();
      if (current.includes(ds.id)) return;

      // Deduct XP — use dedicated redeem endpoint
      const newXp = (user.xp || 0) - reward.xpCost;
      let serverUpdated = false;
      try {
        const updated = await api.redeemReward(user.id, reward.xpCost, reward.name);
        if (updated && typeof updated.xp === 'number') {
          session.merge({ xp: updated.xp, xpHistory: updated.xpHistory, levelInfo: updated.levelInfo });
          serverUpdated = true;
        }
      } catch (err) {
        console.warn('[Rewards] Server redeem failed, trying PUT fallback:', err);
      }

      if (!serverUpdated) {
        // Fallback: try the PUT endpoint
        try {
          const updated = await api.updateUser(user.id, { xp: newXp });
          if (updated && typeof updated.xp === 'number') {
            session.merge({ xp: updated.xp, levelInfo: updated.levelInfo });
            serverUpdated = true;
          }
        } catch (err2) {
          console.warn('[Rewards] PUT fallback also failed:', err2);
        }
      }

      if (!serverUpdated) {
        // Last resort: update locally only
        session.merge({ xp: newXp });
      }
      // Always track XP spent locally for cross-session persistence
      addXpSpent(reward.xpCost);
      // Ensure session reflects the deducted XP for UI consistency
      const adjustedXp = Math.max(0, (session.user.xp || 0) - reward.xpCost);
      session.merge({ xp: adjustedXp });
      syncUser();

      current.push(ds.id);
      saveRedeemed(current);
      toast(`${reward.icon} ${reward.name} redeemed!`, { tone: 'ok', message: `${reward.xpCost} XP deducted. Show this at the counter to claim your reward.` });
      renderPage(view); // re-render to show updated state
    },
  });
}

export default { render: renderPage };
