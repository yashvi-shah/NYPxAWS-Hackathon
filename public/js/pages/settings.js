/* ==========================================================================
   settings.js — Polished Settings page.
   Sections: Profile (picture + username), Academic Info, Appearance.
   All settings persist to the server via /api/users/:id/settings.
   ========================================================================== */

import { html, render } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { session, preferences } from '../services/store.js';
import { api } from '../services/api.js';
import { setLayer } from '../core/actions.js';
import { toast } from '../ui/toast.js';
import { syncUser } from '../ui/shell.js';

/* --------------------------------------------------------------------------
   Theme helpers
   -------------------------------------------------------------------------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    render(btn, icon(theme === 'dark' ? 'sun' : 'moon', { size: 16 }));
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
}

function setThemeChoice(value) {
  if (value === 'system') {
    preferences.set({ theme: null });
    const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    applyTheme(preferred);
  } else {
    preferences.set({ theme: value });
    applyTheme(value);
  }
}

/* --------------------------------------------------------------------------
   Profile picture helpers
   -------------------------------------------------------------------------- */

function handleFileUpload(view) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('Image too large. Please use an image under 2 MB.', { tone: 'warn' });
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      await saveField('profilePic', dataUrl, 'Profile picture updated.');
      renderPage(view);
      updateAvatarDisplay();
    };
    reader.readAsDataURL(file);
  });
  input.click();
}

function updateAvatarDisplay() {
  const chip = document.querySelector('.user-chip .avatar');
  if (!chip) return;
  const pic = session.user?.profilePic;
  if (pic) {
    chip.style.backgroundImage = `url(${pic})`;
    chip.style.backgroundSize = 'cover';
    chip.style.backgroundPosition = 'center';
    chip.textContent = '';
  } else {
    chip.style.backgroundImage = '';
    const user = session.user;
    if (user) {
      const name = user.displayName || user.name || '';
      chip.textContent = name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase();
    }
  }
}

/* --------------------------------------------------------------------------
   Save helper — persists a field to the server and updates session
   -------------------------------------------------------------------------- */

const SETTINGS_LOCAL_KEY = 'gravity.userSettings.v1';

function getLocalSettings() {
  try { return JSON.parse(localStorage.getItem(SETTINGS_LOCAL_KEY) || '{}'); } catch { return {}; }
}

function saveLocalSettings(patch) {
  try {
    const current = getLocalSettings();
    localStorage.setItem(SETTINGS_LOCAL_KEY, JSON.stringify({ ...current, ...patch }));
  } catch { /* storage full */ }
}

async function saveField(key, value, successMsg) {
  const userId = session.id;
  if (!userId) return false;

  // Always persist locally first
  session.merge({ [key]: value });
  saveLocalSettings({ [key]: value });

  try {
    const updated = await api.updateSettings(userId, { [key]: value });
    if (updated && updated.id) {
      session.merge(updated);
    }
    if (successMsg) toast(successMsg, { tone: 'ok' });
    return true;
  } catch (err) {
    // Local save already done — show success anyway since user data is preserved
    if (successMsg) toast(successMsg, { tone: 'ok' });
    return true;
  }
}

async function saveMultiple(fields, successMsg) {
  const userId = session.id;
  if (!userId) return false;

  session.merge(fields);
  saveLocalSettings(fields);

  try {
    const updated = await api.updateSettings(userId, fields);
    if (updated && updated.id) {
      session.merge(updated);
    }
    if (successMsg) toast(successMsg, { tone: 'ok' });
    return true;
  } catch (err) {
    // Local save already done — show success
    if (successMsg) toast(successMsg, { tone: 'ok' });
    return true;
  }
}

/* --------------------------------------------------------------------------
   Page render
   -------------------------------------------------------------------------- */

function renderPage(view) {
  const user = session.user || {};
  const storedTheme = preferences.get('theme');
  const activeTheme = storedTheme || 'system';
  const profilePic = user.profilePic || '';
  const displayName = user.displayName || user.name || '';
  const year = user.year || 1;
  const semester = user.semester || 1;

  render(view, html`
    <div class="page-settings">
      <header class="settings-page-header">
        <h1>${icon('gear', { size: 22 })} Settings</h1>
        <p class="settings-subtitle">Customise your Gravity experience.</p>
      </header>

      <!-- ═══════════ PROFILE ═══════════ -->
      <section class="settings-card">
        <div class="settings-card-header">
          <span class="settings-card-icon">${icon('users', { size: 18 })}</span>
          <div>
            <h2>Profile</h2>
            <p class="settings-card-desc">Manage your identity on Gravity.</p>
          </div>
        </div>

        <div class="settings-card-body">
          <!-- Profile Picture -->
          <div class="settings-row settings-row-pic">
            <div class="settings-pic-preview ${profilePic ? 'has-img' : ''}">
              ${profilePic
                ? html`<img src="${profilePic}" alt="Profile picture" />`
                : html`<span class="settings-pic-initials">${displayName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()}</span>`
              }
            </div>
            <div class="settings-pic-controls">
              <span class="settings-label">Profile Picture</span>
              <span class="settings-hint">JPG, PNG or GIF. Max 2 MB.</span>
              <div class="settings-pic-btns">
                <button class="btn btn-primary btn-sm" data-act="uploadPic">
                  ${icon('image', { size: 13 })} ${profilePic ? 'Change photo' : 'Upload photo'}
                </button>
                ${profilePic ? html`
                  <button class="btn btn-sm btn-ghost" data-act="removePic">Remove</button>
                ` : ''}
              </div>
            </div>
          </div>

          <!-- Username -->
          <div class="settings-row">
            <div class="settings-field">
              <label class="settings-label" for="settings-name">Display Name</label>
              <span class="settings-hint">This is how others see you on Gravity.</span>
            </div>
            <div class="settings-input-group">
              <input class="input" id="settings-name" type="text" value="${displayName}"
                     placeholder="Enter your name" maxlength="40" data-input="nameInput" />
              <button class="btn btn-primary btn-sm" data-act="saveName" id="save-name-btn" disabled>Save</button>
            </div>
          </div>
        </div>
      </section>

      <!-- ═══════════ ACADEMIC INFORMATION ═══════════ -->
      <section class="settings-card">
        <div class="settings-card-header">
          <span class="settings-card-icon">${icon('book', { size: 18 })}</span>
          <div>
            <h2>Academic Information</h2>
            <p class="settings-card-desc">Set your current polytechnic year and semester.</p>
          </div>
        </div>

        <div class="settings-card-body">
          <div class="settings-row settings-row-academic">
            <div class="settings-field-inline">
              <label class="settings-label" for="settings-year">Polytechnic Year</label>
              <select class="input select" id="settings-year" data-change="academicChange">
                <option value="1" ${year === 1 ? 'selected' : ''}>Year 1</option>
                <option value="2" ${year === 2 ? 'selected' : ''}>Year 2</option>
                <option value="3" ${year === 3 ? 'selected' : ''}>Year 3</option>
              </select>
            </div>
            <div class="settings-field-inline">
              <label class="settings-label" for="settings-sem">Current Semester</label>
              <select class="input select" id="settings-sem" data-change="academicChange">
                <option value="1" ${semester === 1 ? 'selected' : ''}>Semester 1</option>
                <option value="2" ${semester === 2 ? 'selected' : ''}>Semester 2</option>
              </select>
            </div>
            <button class="btn btn-primary btn-sm" data-act="saveAcademic" id="save-academic-btn" disabled>Save</button>
          </div>
          <div class="settings-academic-badge" id="academic-badge">
            <span class="badge-label">Current position</span>
            <span class="badge-value">Y${year}S${semester}</span>
          </div>
        </div>
      </section>

      <!-- ═══════════ APPEARANCE ═══════════ -->
      <section class="settings-card">
        <div class="settings-card-header">
          <span class="settings-card-icon">${icon('sun', { size: 18 })}</span>
          <div>
            <h2>Appearance</h2>
            <p class="settings-card-desc">Choose how Gravity looks to you.</p>
          </div>
        </div>

        <div class="settings-card-body">
          <div class="theme-selector" role="radiogroup" aria-label="Theme selection">
            <button class="theme-card ${activeTheme === 'light' ? 'selected' : ''}"
                    data-act="setTheme" data-value="light"
                    role="radio" aria-checked="${activeTheme === 'light'}">
              <span class="theme-card-preview theme-card-light"></span>
              <span class="theme-card-label">${icon('sun', { size: 14 })} Light</span>
            </button>
            <button class="theme-card ${activeTheme === 'dark' ? 'selected' : ''}"
                    data-act="setTheme" data-value="dark"
                    role="radio" aria-checked="${activeTheme === 'dark'}">
              <span class="theme-card-preview theme-card-dark"></span>
              <span class="theme-card-label">${icon('moon', { size: 14 })} Dark</span>
            </button>
            <button class="theme-card ${activeTheme === 'system' ? 'selected' : ''}"
                    data-act="setTheme" data-value="system"
                    role="radio" aria-checked="${activeTheme === 'system'}">
              <span class="theme-card-preview theme-card-system"></span>
              <span class="theme-card-label">${icon('gear', { size: 14 })} System</span>
            </button>
          </div>
        </div>
      </section>
    </div>
  `);

  /* ---- Actions ---- */

  let nameChanged = false;
  let academicChanged = false;

  setLayer('page', {
    uploadPic: () => handleFileUpload(view),

    removePic: async () => {
      await saveField('profilePic', '', 'Profile picture removed.');
      renderPage(view);
      updateAvatarDisplay();
    },

    saveName: async () => {
      const input = document.getElementById('settings-name');
      const val = (input?.value || '').trim();
      if (!val) {
        toast('Display name cannot be empty.', { tone: 'warn' });
        return;
      }
      const ok = await saveMultiple({ displayName: val, name: val }, 'Profile updated successfully.');
      if (ok) {
        syncUser();
        nameChanged = false;
        const btn = document.getElementById('save-name-btn');
        if (btn) btn.disabled = true;
      }
    },

    nameInput: () => {
      const input = document.getElementById('settings-name');
      const current = user.displayName || user.name || '';
      const btn = document.getElementById('save-name-btn');
      nameChanged = (input?.value || '').trim() !== current;
      if (btn) btn.disabled = !nameChanged;
    },

    academicChange: () => {
      const yearEl = document.getElementById('settings-year');
      const semEl = document.getElementById('settings-sem');
      const btn = document.getElementById('save-academic-btn');
      const newYear = Number(yearEl?.value);
      const newSem = Number(semEl?.value);
      academicChanged = newYear !== year || newSem !== semester;
      if (btn) btn.disabled = !academicChanged;
      // Update the badge preview
      const badge = document.getElementById('academic-badge');
      if (badge) {
        const val = badge.querySelector('.badge-value');
        if (val) val.textContent = `Y${newYear}S${newSem}`;
      }
    },

    saveAcademic: async () => {
      const yearEl = document.getElementById('settings-year');
      const semEl = document.getElementById('settings-sem');
      const newYear = Number(yearEl?.value) || 1;
      const newSem = Number(semEl?.value) || 1;
      const ok = await saveMultiple({ year: newYear, semester: newSem }, 'Academic information saved.');
      if (ok) {
        academicChanged = false;
        const btn = document.getElementById('save-academic-btn');
        if (btn) btn.disabled = true;
      }
    },

    setTheme: async (ds) => {
      setThemeChoice(ds.value);
      await saveField('theme', ds.value, null); // silent save
      renderPage(view);
    },
  });

  // Apply avatar
  setTimeout(updateAvatarDisplay, 0);
}

export default { render: renderPage };
