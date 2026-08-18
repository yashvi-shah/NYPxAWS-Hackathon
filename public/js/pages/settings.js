/* ==========================================================================
   settings.js — User preferences page. Theme toggle + profile picture upload.
   ========================================================================== */

import { html, render } from '../lib/dom.js';
import { icon } from '../lib/icons.js';
import { preferences, session } from '../services/store.js';
import { setLayer } from '../core/actions.js';
import { toast } from '../ui/toast.js';
import { syncUser } from '../ui/shell.js';

/* --------------------------------------------------------------------------
   Theme
   -------------------------------------------------------------------------- */

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    render(btn, icon(theme === 'dark' ? 'sun' : 'moon', { size: 16 }));
    btn.setAttribute('aria-label', theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme');
  }
}

function setTheme(value) {
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
   Profile picture
   -------------------------------------------------------------------------- */

function getProfilePic() {
  try { return localStorage.getItem('gravity.profilePic') || ''; } catch { return ''; }
}

function setProfilePic(dataUrl) {
  try { localStorage.setItem('gravity.profilePic', dataUrl); } catch { /* storage full */ }
}

function removeProfilePic() {
  try { localStorage.removeItem('gravity.profilePic'); } catch { /* ignore */ }
}

function handleFileUpload(view) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.addEventListener('change', () => {
    const file = input.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast('Image too large. Please use an image under 2MB.', { tone: 'warn' });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setProfilePic(reader.result);
      toast('Profile picture updated!', { tone: 'ok' });
      renderPage(view);
      updateAvatarEverywhere();
    };
    reader.readAsDataURL(file);
  });
  input.click();
}

function updateAvatarEverywhere() {
  // Update the sidebar user chip avatar
  const chip = document.querySelector('.user-chip .avatar');
  if (chip) {
    const pic = getProfilePic();
    if (pic) {
      chip.style.backgroundImage = `url(${pic})`;
      chip.style.backgroundSize = 'cover';
      chip.style.backgroundPosition = 'center';
      chip.textContent = '';
    } else {
      chip.style.backgroundImage = '';
      const user = session.user;
      if (user) {
        const parts = user.name.split(' ');
        chip.textContent = parts.map(p => p[0]).join('').slice(0, 2).toUpperCase();
      }
    }
  }
}

/* --------------------------------------------------------------------------
   Page render
   -------------------------------------------------------------------------- */

function renderPage(view) {
  const stored = preferences.get('theme');
  const active = stored || 'system';
  const profilePic = getProfilePic();
  const user = session.user || {};

  render(view, html`
    <div class="page-settings">
      <div class="page-header">
        <h1>${icon('gear', { size: 20 })} Settings</h1>
        <p class="meta">Customise your Gravity experience.</p>
      </div>

      <!-- Profile Picture -->
      <section class="settings-section">
        <h2 class="settings-section-title">${icon('users', { size: 16 })} Profile Picture</h2>
        <p class="meta">Upload a photo to personalise your account.</p>

        <div class="profile-pic-area">
          <div class="profile-pic-preview ${profilePic ? 'has-image' : ''}">
            ${profilePic
              ? html`<img src="${profilePic}" alt="Your profile picture" />`
              : html`<span class="profile-pic-placeholder">${user.name ? user.name.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?'}</span>`
            }
          </div>
          <div class="profile-pic-actions">
            <button class="btn btn-primary btn-sm" data-act="uploadPic">
              ${icon('image', { size: 14 })} ${profilePic ? 'Change photo' : 'Upload photo'}
            </button>
            ${profilePic ? html`
              <button class="btn btn-sm" data-act="removePic">Remove</button>
            ` : ''}
            <span class="profile-pic-hint">JPG, PNG or GIF. Max 2MB.</span>
          </div>
        </div>
      </section>

      <!-- Appearance -->
      <section class="settings-section">
        <h2 class="settings-section-title">${icon('sun', { size: 16 })} Appearance</h2>
        <p class="meta">Choose how Gravity looks. Select a theme or follow your system preference.</p>

        <div class="theme-picker" role="radiogroup" aria-label="Theme selection">
          <button class="theme-option ${active === 'light' ? 'active' : ''}"
                  data-act="setTheme" data-value="light"
                  role="radio" aria-checked="${active === 'light'}">
            <span class="theme-preview theme-preview-light">
              <span class="preview-bar"></span>
              <span class="preview-line"></span>
              <span class="preview-line short"></span>
            </span>
            <span class="theme-label">${icon('sun', { size: 14 })} Light</span>
          </button>

          <button class="theme-option ${active === 'dark' ? 'active' : ''}"
                  data-act="setTheme" data-value="dark"
                  role="radio" aria-checked="${active === 'dark'}">
            <span class="theme-preview theme-preview-dark">
              <span class="preview-bar"></span>
              <span class="preview-line"></span>
              <span class="preview-line short"></span>
            </span>
            <span class="theme-label">${icon('moon', { size: 14 })} Dark</span>
          </button>

          <button class="theme-option ${active === 'system' ? 'active' : ''}"
                  data-act="setTheme" data-value="system"
                  role="radio" aria-checked="${active === 'system'}">
            <span class="theme-preview theme-preview-system">
              <span class="preview-bar"></span>
              <span class="preview-line"></span>
              <span class="preview-line short"></span>
            </span>
            <span class="theme-label">${icon('gear', { size: 14 })} System</span>
          </button>
        </div>
      </section>
    </div>
  `);

  setLayer('page', {
    setTheme: (ds) => {
      setTheme(ds.value);
      renderPage(view);
    },
    uploadPic: () => {
      handleFileUpload(view);
    },
    removePic: () => {
      removeProfilePic();
      toast('Profile picture removed.', { tone: 'info' });
      renderPage(view);
      updateAvatarEverywhere();
    },
  });

  // Apply profile pic to sidebar on page load
  setTimeout(updateAvatarEverywhere, 0);
}

export default { render: renderPage };
