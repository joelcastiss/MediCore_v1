/* ============================================================
   MediCore — login.js
   Inicialización de la página de login.
   Las funciones handleLogin() y handleRegistro() vienen de auth.js
   ============================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // Si ya hay sesión válida, ir al dashboard
  if (typeof isSessionValid === 'function' && isSessionValid()) {
    window.location.href = 'index.html';
    return;
  }

  // Enviar con Enter en campos de login
  document.getElementById('login-password')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('login-email')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('login-password')?.focus();
  });

  // Enviar con Enter en confirmación de contraseña
  document.getElementById('reg-confirm')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleRegistro();
  });

  // Limpiar alertas al escribir
  ['login-email','login-password'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      const el = document.getElementById('alert-login');
      if (el) el.className = 'auth-alert';
    });
  });
  ['reg-nombre','reg-email','reg-password','reg-confirm'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => {
      const el = document.getElementById('alert-registro');
      if (el) el.className = 'auth-alert';
    });
  });

  // Focus inicial
  setTimeout(() => document.getElementById('login-email')?.focus(), 100);
});
