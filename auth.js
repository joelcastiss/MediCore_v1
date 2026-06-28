/* ============================================================
   MediCore — auth.js  (CORREGIDO)
   Maneja login, registro y sesión usando Supabase Auth REST API.
   Depende de: shared.js (SUPABASE_URL, SUPABASE_ANON, DB, showToast)
   ============================================================ */

const AUTH_URL = `${SUPABASE_URL}/auth/v1`;

// ── Helpers de UI ──────────────────────────────────────────────
function setAlert(id, msg, type) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = msg;
  el.className = `auth-alert ${type} show`;
}
function clearAlert(id) {
  const el = document.getElementById(id);
  if (el) el.className = 'auth-alert';
}
function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('loading', loading);
}

// ── Sesión ─────────────────────────────────────────────────────
function isSessionValid() {
  const session = DB.getObj('session');
  if (!session?.access_token || !session?.expires_at) return false;
  return Date.now() < session.expires_at * 1000;
}

function getSession() {
  return DB.getObj('session');
}

function getCurrentUser() {
  return DB.getObj('current_user');
}

function cerrarSesion() {
  DB.setObj('session', null);
  DB.setObj('current_user', null);
  window.location.href = 'login.html';
}

// ── Guardar sesión tras login/registro ────────────────────────
async function guardarSesion(data) {
  // data viene de la Auth API de Supabase
  const session = data.session ?? data;
  const user    = data.user ?? session?.user ?? null;

  if (!session?.access_token) throw new Error('No se recibió token de sesión.');
  if (!user?.id)              throw new Error('No se obtuvo ID de usuario. Verifica tu correo y vuelve a intentar.');

  DB.setObj('session', {
    access_token:  session.access_token,
    refresh_token: session.refresh_token ?? null,
    expires_at:    session.expires_at    ?? Math.floor(Date.now() / 1000) + 3600,
  });

  // Cargar o crear perfil en usuarios_perfil
  let perfil = await getUsuarioPerfil(user.id);

  if (!perfil) {
    // El perfil aún no existe (puede pasar justo después del registro)
    // Intentar crearlo con datos básicos
    try {
      perfil = await crearPerfilUsuario(user.id, user.email, user.user_metadata);
    } catch (e) {
      console.warn('No se pudo crear perfil automáticamente:', e.message);
      // Perfil mínimo en memoria para no romper el flujo
      perfil = {
        user_id: user.id,
        nombre:  user.user_metadata?.nombre ?? user.email,
        rol:     user.user_metadata?.rol    ?? 'Recepción',
        email:   user.email,
      };
    }
  }

  DB.setObj('current_user', {
    id:     user.id,
    email:  user.email,
    nombre: perfil?.nombre ?? user.user_metadata?.nombre ?? user.email,
    rol:    perfil?.rol    ?? user.user_metadata?.rol    ?? 'Recepción',
  });
}

// ── Crear perfil en tabla usuarios_perfil ─────────────────────
async function crearPerfilUsuario(userId, email, metadata = {}) {
  const session = DB.getObj('session');
  const headers = {
    'apikey':        SUPABASE_ANON,
    'Authorization': session?.access_token
                       ? `Bearer ${session.access_token}`
                       : `Bearer ${SUPABASE_ANON}`,
    'Content-Type':  'application/json',
    'Prefer':        'return=representation',
  };

  const payload = {
    user_id: userId,
    nombre:  metadata?.nombre ?? email,
    rol:     metadata?.rol    ?? 'Recepción',
    email:   email,
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/usuarios_perfil`, {
    method:  'POST',
    headers,
    body:    JSON.stringify(payload),
  });

  if (!res.ok) {
    const errText = await res.text();
    // Si es conflicto (perfil ya existe), no es error fatal
    if (res.status === 409 || errText.includes('duplicate')) {
      const rows = await fetch(
        `${SUPABASE_URL}/rest/v1/usuarios_perfil?user_id=eq.${userId}&select=*&limit=1`,
        { headers }
      ).then(r => r.json());
      return rows[0] ?? null;
    }
    throw new Error(`Error al crear perfil: ${errText}`);
  }

  const result = await res.json();
  return Array.isArray(result) ? result[0] : result;
}

// ── LOGIN ──────────────────────────────────────────────────────
async function handleLogin() {
  clearAlert('alert-login');

  const email    = document.getElementById('login-email')?.value?.trim();
  const password = document.getElementById('login-password')?.value;

  // Validación básica
  let ok = true;
  clearAllErrors('panel-login');
  if (!email)    { showFieldError('login-email',    'Ingresa tu correo');     ok = false; }
  if (!password) { showFieldError('login-password', 'Ingresa tu contraseña'); ok = false; }
  if (!ok) return;

  setLoading('btn-login', true);

  try {
    const res = await fetch(`${AUTH_URL}/token?grant_type=password`, {
      method:  'POST',
      headers: {
        'apikey':       SUPABASE_ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = traducirError(data.error_description ?? data.msg ?? data.error ?? 'Error al iniciar sesión');
      setAlert('alert-login', msg, 'error');
      return;
    }

    await guardarSesion(data);
    window.location.href = 'index.html';

  } catch (e) {
    console.error('Login error:', e);
    setAlert('alert-login', e.message || 'Error de conexión. Intenta de nuevo.', 'error');
  } finally {
    setLoading('btn-login', false);
  }
}

// ── REGISTRO ───────────────────────────────────────────────────
async function handleRegistro() {
  clearAlert('alert-registro');

  const nombre   = document.getElementById('reg-nombre')?.value?.trim();
  const email    = document.getElementById('reg-email')?.value?.trim();
  const password = document.getElementById('reg-password')?.value;
  const confirm  = document.getElementById('reg-confirm')?.value;
  const rolInput = document.querySelector('input[name="rol"]:checked');
  const rol      = rolInput?.value ?? '';

  // Validación
  let ok = true;
  clearAllErrors('panel-registro');

  if (!nombre || nombre.length < 3) {
    showFieldError('reg-nombre', 'Ingresa tu nombre completo (mín. 3 caracteres)'); ok = false;
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    showFieldError('reg-email', 'Ingresa un correo válido'); ok = false;
  }
  if (!password || password.length < 6) {
    showFieldError('reg-password', 'La contraseña debe tener al menos 6 caracteres'); ok = false;
  }
  if (password !== confirm) {
    showFieldError('reg-confirm', 'Las contraseñas no coinciden'); ok = false;
  }
  if (!rol) {
    showFieldError('reg-rol', 'Selecciona un rol'); ok = false;
  }
  if (!ok) return;

  setLoading('btn-registro', true);

  try {
    // 1. Crear usuario en Supabase Auth
    const res = await fetch(`${AUTH_URL}/signup`, {
      method:  'POST',
      headers: {
        'apikey':       SUPABASE_ANON,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        password,
        data: { nombre, rol },   // user_metadata
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      const msg = traducirError(data.error_description ?? data.msg ?? data.error ?? 'Error al registrar');
      setAlert('alert-registro', msg, 'error');
      return;
    }

    // 2. Verificar si Supabase requiere confirmación de correo
    const user    = data.user ?? data;
    const session = data.session ?? null;

    const requiereConfirmacion =
      !session?.access_token &&
      (user?.confirmation_sent_at || user?.email_confirmed_at === null || !user?.email_confirmed_at);

    if (requiereConfirmacion) {
      // Supabase tiene "Confirm email" activo — informar al usuario
      setAlert(
        'alert-registro',
        '✅ Cuenta creada. Revisa tu correo y confirma tu cuenta antes de iniciar sesión.',
        'success'
      );
      // Limpiar campos
      ['reg-nombre','reg-email','reg-password','reg-confirm'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
      document.querySelectorAll('.role-chip').forEach(c => c.classList.remove('selected'));
      setTimeout(() => switchTab('login'), 4000);
      return;
    }

    // 3. Si no requiere confirmación, guardar sesión y redirigir
    await guardarSesion(data);
    window.location.href = 'index.html';

  } catch (e) {
    console.error('Registro error:', e);
    setAlert('alert-registro', e.message || 'Error de conexión. Intenta de nuevo.', 'error');
  } finally {
    setLoading('btn-registro', false);
  }
}

// ── Traducir errores comunes de Supabase ──────────────────────
function traducirError(msg) {
  if (!msg) return 'Error desconocido. Intenta de nuevo.';
  const m = msg.toLowerCase();
  if (m.includes('invalid login credentials') || m.includes('invalid_credentials'))
    return 'Correo o contraseña incorrectos.';
  if (m.includes('email not confirmed'))
    return 'Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada.';
  if (m.includes('user already registered') || m.includes('already been registered'))
    return 'Ya existe una cuenta con este correo. Intenta iniciar sesión.';
  if (m.includes('password should be at least'))
    return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('unable to validate email'))
    return 'El correo ingresado no es válido.';
  if (m.includes('email rate limit'))
    return 'Demasiados intentos. Espera unos minutos y vuelve a intentarlo.';
  if (m.includes('signup is disabled'))
    return 'El registro está deshabilitado en este momento. Contacta al administrador.';
  if (m.includes('network') || m.includes('fetch'))
    return 'Error de conexión. Verifica tu internet e intenta de nuevo.';
  return msg;
}

// ── Cambio de tab login ↔ registro ────────────────────────────
function switchTab(tab) {
  const isLogin = tab === 'login';
  document.getElementById('panel-login').style.display    = isLogin ? '' : 'none';
  document.getElementById('panel-registro').style.display = isLogin ? 'none' : '';
  document.getElementById('tab-login').classList.toggle('active', isLogin);
  document.getElementById('tab-registro').classList.toggle('active', !isLogin);
  clearAlert(isLogin ? 'alert-registro' : 'alert-login');

  if (isLogin) {
    setTimeout(() => document.getElementById('login-email')?.focus(), 100);
  } else {
    setTimeout(() => document.getElementById('reg-nombre')?.focus(), 100);
  }
}

// ── Proteger páginas internas ─────────────────────────────────
function requireAuth() {
  if (!isSessionValid()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// ── Mostrar nombre de usuario en el nav ───────────────────────
function renderNavUser() {
  const user = getCurrentUser();
  if (!user) return;
  const nameEl = document.getElementById('nav-user-name');
  const rolEl  = document.getElementById('nav-user-rol');
  if (nameEl) nameEl.textContent = user.nombre ?? user.email ?? '';
  if (rolEl)  rolEl.textContent  = user.rol ?? '';
}
