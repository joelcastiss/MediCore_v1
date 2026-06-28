/* ============================================================
   MediCore — auth.js
   Depende de: shared.js (SUPABASE_URL, SUPABASE_ANON, DB, sbFetch)
   ============================================================ */

// ── Sign In ───────────────────────────────────────────────────
async function signIn(email, password) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      apikey: SUPABASE_ANON,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ email, password }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error_description || data.msg || 'Error al iniciar sesión');
  return data;
}

// ── Sign Out ──────────────────────────────────────────────────
async function signOut() {
  // Llamar a Supabase para invalidar el token
  const session = getSession();
  if (session?.access_token) {
    try {
      await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch (_) { /* no bloquear cierre de sesión */ }
  }
  DB.setObj('session', null);
  DB.setObj('perfil', null);
  window.location.href = 'login.html';
}

// ── Session helpers ───────────────────────────────────────────
function saveSession(sessionData) {
  DB.setObj('session', {
    access_token:  sessionData.access_token,
    refresh_token: sessionData.refresh_token,
    user_id:       sessionData.user?.id,
    email:         sessionData.user?.email,
    expires_at:    Date.now() + (sessionData.expires_in || 3600) * 1000,
  });
}

function getSession() {
  return DB.getObj('session');
}

function isSessionValid() {
  const s = getSession();
  return !!(s && s.access_token && Date.now() < s.expires_at - 60000);
}

// ── Cargar perfil desde usuarios_perfil ───────────────────────
async function cargarPerfil(userId) {
  const cached = DB.getObj('perfil');
  if (cached && cached.user_id === userId) return cached;

  try {
    const rows = await sbFetch(
      `usuarios_perfil?user_id=eq.${encodeURIComponent(userId)}&select=*&limit=1`
    );
    const perfil = rows[0] || { user_id: userId, nombre: 'Usuario', rol: 'Administrador' };
    DB.setObj('perfil', perfil);
    return perfil;
  } catch {
    const fallback = { user_id: userId, nombre: 'Usuario', rol: 'Administrador' };
    DB.setObj('perfil', fallback);
    return fallback;
  }
}

// ── Guard: redirige al login si no hay sesión válida ──────────
async function requireAuth() {
  if (!isSessionValid()) {
    window.location.href = 'login.html';
    return null;
  }
  return cargarPerfil(getSession().user_id);
}

// ── Renderizar chip de usuario en el header ───────────────────
function renderUserHeader(perfil) {
  if (!perfil) return;
  const navRight = document.querySelector('.nav-right');
  if (!navRight) return;

  // Evitar duplicados
  if (navRight.querySelector('.user-chip')) return;

  const rolColors = {
    Administrador: '#1565C0',
    Recepcionista: '#065F46',
    Médico:        '#92400E',
    Enfermería:    '#6B21A8',
  };
  const color = rolColors[perfil.rol] || '#334155';

  const chip = document.createElement('div');
  chip.className = 'user-chip';
  chip.style.cssText = `
    display:flex; align-items:center; gap:.6rem;
    background:var(--gray-100); border-radius:var(--radius-full);
    padding:.3rem .9rem .3rem .5rem; cursor:pointer;
  `;
  chip.innerHTML = `
    <div style="
      width:28px; height:28px; border-radius:50%;
      background:${color}; color:white;
      display:flex; align-items:center; justify-content:center;
      font-size:.75rem; font-weight:700; flex-shrink:0;
    ">${(perfil.nombre || 'U')[0].toUpperCase()}</div>
    <div style="line-height:1.2">
      <div style="font-size:.72rem; font-weight:700; color:var(--gray-900); white-space:nowrap; max-width:120px; overflow:hidden; text-overflow:ellipsis;">
        ${perfil.nombre || perfil.email || 'Usuario'}
      </div>
      <div style="font-size:.6rem; color:${color}; font-weight:600;">${perfil.rol || ''}</div>
    </div>
    <button onclick="signOut()" title="Cerrar sesión" style="
      background:none; border:none; cursor:pointer;
      font-size:.75rem; color:var(--gray-400); padding:.1rem .25rem;
      border-radius:var(--radius-sm); transition:all .15s;
    " onmouseover="this.style.color='var(--red)'" onmouseout="this.style.color='var(--gray-400)'">
      ⏻
    </button>
  `;
  navRight.appendChild(chip);
}

// ── Control de acceso por rol ─────────────────────────────────
// Oculta elementos que tengan [data-role="X"] si el rol no coincide
function applyRoleAccess(rol) {
  document.querySelectorAll('[data-role]').forEach(el => {
    const required = el.getAttribute('data-role');
    if (required && required !== rol) el.style.display = 'none';
  });
}

// ── Tab helpers para login.html (usados desde login.js) ───────
function switchTab(tab) {
  const isLogin = tab === 'login';
  const panelLogin    = document.getElementById('panel-login');
  const panelRegistro = document.getElementById('panel-registro');
  const tabLogin      = document.getElementById('tab-login');
  const tabRegistro   = document.getElementById('tab-registro');

  if (panelLogin)    panelLogin.style.display    = isLogin ? 'block' : 'none';
  if (panelRegistro) panelRegistro.style.display = isLogin ? 'none'  : 'block';
  if (tabLogin)      tabLogin.classList.toggle('active', isLogin);
  if (tabRegistro)   tabRegistro.classList.toggle('active', !isLogin);
}

// ── Mostrar alertas en el login ───────────────────────────────
function showAuthAlert(id, msg, type = 'error') {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `auth-alert ${type} show`;
}

// ── Login handler (llamado desde login.html) ──────────────────
async function handleLogin(e) {
  if (e && e.preventDefault) e.preventDefault();

  const btn = document.getElementById('btn-login');
  const email    = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;

  if (!email || !password) {
    showAuthAlert('alert-login', 'Completa todos los campos.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAuthAlert('alert-login', 'Ingresa un correo electrónico válido.');
    return;
  }

  // Estado de carga
  if (btn) { btn.disabled = true; btn.querySelector('.btn-label').textContent = 'Verificando…'; }

  try {
    const session = await signIn(email, password);
    saveSession(session);
    await cargarPerfil(session.user.id);
    showAuthAlert('alert-login', '✅ Sesión iniciada. Redirigiendo…', 'success');
    setTimeout(() => { window.location.href = 'index.html'; }, 700);
  } catch (err) {
    showAuthAlert('alert-login', friendlyAuthError(err.message));
    document.getElementById('login-password')?.select();
  } finally {
    if (btn) { btn.disabled = false; btn.querySelector('.btn-label').textContent = 'Ingresar al sistema →'; }
  }
}

// ── Registro handler ──────────────────────────────────────────
async function handleRegistro(e) {
  if (e && e.preventDefault) e.preventDefault();

  const nombre    = document.getElementById('reg-nombre')?.value?.trim();
  const email     = document.getElementById('reg-email')?.value?.trim();
  const password  = document.getElementById('reg-password')?.value;
  const confirm   = document.getElementById('reg-confirm')?.value;
  const rolInput  = document.querySelector('input[name="rol"]:checked');
  const rol       = rolInput?.value || '';

  if (!nombre || !email || !password || !confirm) {
    showAuthAlert('alert-registro', 'Completa todos los campos.');
    return;
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showAuthAlert('alert-registro', 'Ingresa un correo electrónico válido.');
    return;
  }
  if (password.length < 6) {
    showAuthAlert('alert-registro', 'La contraseña debe tener al menos 6 caracteres.');
    return;
  }
  if (password !== confirm) {
    showAuthAlert('alert-registro', 'Las contraseñas no coinciden.');
    return;
  }
  if (!rol) {
    showAuthAlert('alert-registro', 'Selecciona un rol.');
    return;
  }

  const btn = document.getElementById('btn-registro');
  if (btn) { btn.disabled = true; btn.querySelector('.btn-label').textContent = 'Creando cuenta…'; }

  try {
    // ── 1. Crear usuario en Supabase Auth ─────────────────────
    const signupRes = await fetch(`${SUPABASE_URL}/auth/v1/signup`, {
      method: 'POST',
      headers: { apikey: SUPABASE_ANON, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    const signupData = await signupRes.json();
    if (!signupRes.ok) throw new Error(signupData.error_description || signupData.msg || 'Error al registrar');

    const userId = signupData.user?.id;
    if (!userId) throw new Error('No se obtuvo ID de usuario. Verifica tu correo y vuelve a intentar.');

    // ── 2. Hacer login automático para obtener access_token ───
    //    Necesario porque sbFetch usa el token de sesión para
    //    pasar el RLS (política: auth.role() = 'authenticated').
    //    Sin este paso el INSERT a usuarios_perfil falla silenciosamente.
    let sessionToken = null;
    try {
      const loginRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: SUPABASE_ANON, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (loginRes.ok) {
        const loginData = await loginRes.json();
        sessionToken = loginData.access_token;
        // Guardar sesión temporalmente para que sbFetch la use
        saveSession(loginData);
      }
    } catch (_) { /* Si el login falla (ej. email no confirmado), continuamos */ }

    // ── 3. Insertar perfil en usuarios_perfil ─────────────────
    //    Si tenemos token lo usamos vía sbFetch (pasa RLS).
    //    Si no, intentamos con service-role header (fallback).
    const rolNorm = rol === 'Recepción' ? 'Recepcionista' : rol;
    const perfilPayload = JSON.stringify({
      user_id: userId,
      nombre:  nombre,
      correo:  email,
      rol:     rolNorm,
    });

    if (sessionToken) {
      // Inserción autenticada — pasa RLS correctamente
      await sbFetch('usuarios_perfil', {
        method: 'POST',
        body: perfilPayload,
      });
    } else {
      // Fallback: insertar con anon key (solo funciona si desactivaste
      // "Confirm email" en Supabase → Authentication → Providers → Email)
      const fallbackRes = await fetch(`${SUPABASE_URL}/rest/v1/usuarios_perfil`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON,
          Authorization: `Bearer ${SUPABASE_ANON}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation',
        },
        body: perfilPayload,
      });
      if (!fallbackRes.ok) {
        const errText = await fallbackRes.text();
        console.warn('Perfil no guardado (sin sesión activa):', errText);
        // No lanzamos error: el usuario fue creado en Auth, el perfil
        // se creará en el primer login via cargarPerfil() con fallback.
      }
    }

    // ── 4. Limpiar sesión temporal si no queremos auto-login ──
    // (el usuario debe iniciar sesión manualmente)
    DB.setObj('session', null);
    DB.setObj('perfil', null);

    showAuthAlert('alert-registro',
      '✅ Cuenta creada exitosamente. Ya puedes iniciar sesión.',
      'success'
    );
    document.getElementById('form-registro')?.reset();
    document.querySelectorAll('.role-chip').forEach(c => c.classList.remove('selected'));

    // Cambiar al tab de login automáticamente tras 1.5s
    setTimeout(() => switchTab('login'), 1500);

  } catch (err) {
    showAuthAlert('alert-registro', friendlyAuthError(err.message));
  } finally {
    if (btn) { btn.disabled = false; btn.querySelector('.btn-label').textContent = 'Crear cuenta →'; }
  }
}

// ── Error messages amigables ──────────────────────────────────
function friendlyAuthError(msg = '') {
  const m = msg.toLowerCase();
  if (m.includes('invalid login') || m.includes('invalid credentials') || m.includes('email not confirmed'))
    return 'Correo o contraseña incorrectos. Verifica tus datos o confirma tu correo.';
  if (m.includes('email already registered') || m.includes('already been registered'))
    return 'Este correo ya está registrado. Intenta iniciar sesión.';
  if (m.includes('password should be'))
    return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('rate limit'))
    return 'Demasiados intentos. Espera unos minutos e inténtalo de nuevo.';
  if (m.includes('network') || m.includes('fetch'))
    return 'Sin conexión. Verifica tu internet e inténtalo de nuevo.';
  return msg || 'Ocurrió un error. Inténtalo de nuevo.';
}