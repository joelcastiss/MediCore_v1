/* ============================================================
   MediCore — sala-espera.js  (Supabase)
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  await cargarDatosSala();
  renderSala();
  poblarFiltroMedico();
  // Auto-refresh cada 60 segundos
  setInterval(async () => {
    await getCitasCache(true);
    renderSala();
  }, 60000);
});

async function cargarDatosSala() {
  try {
    await Promise.all([getCitasCache(true), getPacientesCache()]);
  } catch (e) {
    console.error('Error cargando sala de espera:', e);
    showToast('Error al conectar con la base de datos', 'error');
  }
}

function poblarFiltroMedico() {
  const sel = document.getElementById('f-medico');
  if (!sel) return;
  const medicos = [...new Set(getCitasLocal().map(c => c.medico).filter(Boolean))].sort();
  while (sel.options.length > 1) sel.remove(1);
  medicos.forEach(m => {
    const o = document.createElement('option');
    o.value = o.textContent = m;
    sel.appendChild(o);
  });
}

// ─── Ordenar pacientes por prioridad y hora ───────────────────
function ordenarPorPrioridad(citas) {
  const pOrder = { Urgente: 0, Preferencial: 1, Normal: 2 };
  return [...citas].sort((a, b) => {
    const pd = (pOrder[a.prioridad] ?? 2) - (pOrder[b.prioridad] ?? 2);
    if (pd !== 0) return pd;
    return (a.horaLlegada || a.hora || '').localeCompare(b.horaLlegada || b.hora || '');
  });
}

// ─── Renderizar sala ──────────────────────────────────────────
function renderSala() {
  const fMedico = document.getElementById('f-medico')?.value || '';
  const fEsp    = document.getElementById('f-especialidad')?.value || '';
  const fEst    = document.getElementById('f-estado-sala')?.value || '';
  const hoy     = todayStr();

  // Solo citas de hoy que estén en sala o atendidas hoy
  let citas = getCitasLocal().filter(c => {
    if (c.fecha !== hoy) return false;
    if (!['En espera', 'En atención', 'Atendida', 'No asistió'].includes(c.estado)) return false;
    if (fMedico && c.medico !== fMedico) return false;
    if (fEsp && c.especialidad !== fEsp) return false;
    if (fEst && c.estado !== fEst) return false;
    return true;
  });

  citas = ordenarPorPrioridad(citas);

  const lista = document.getElementById('sala-lista');
  const empty = document.getElementById('empty-sala');

  const enSala = citas.filter(c => ['En espera', 'En atención'].includes(c.estado));
  if (!enSala.length && !fEst) {
    lista.innerHTML = '';
    empty.style.display = 'flex';
  } else {
    empty.style.display = 'none';
    lista.innerHTML = citas.map((c, i) => buildTurnoCard(c, i + 1)).join('');
  }

  updateStatsSala(citas);
  renderTicker(citas);
  renderResumen(citas);
  renderProximos(citas);
}

function buildTurnoCard(c, turno) {
  const pac = getPacienteLocal(c.paciente);
  const nombre = pac ? `${pac.nombres} ${pac.apellidos}` : '(Paciente)';
  const priClass = (c.prioridad || 'Normal').toLowerCase();
  const estClass = c.estado === 'En atención' ? 'en-atencion'
                 : c.estado === 'Atendida'    ? 'atendido'
                 : c.estado === 'No asistió'  ? 'noasistio'
                 : 'en-espera';
  const alNoNing = pac?.alergias?.length && pac.alergias[0] !== 'Ninguna';

  let acciones = '';
  if (c.estado === 'En espera') {
    acciones += `<button class="btn btn-outline btn-sm" onclick="iniciarAtencion('${c.id}')">🩺 Atender</button>`;
    acciones += `<button class="btn btn-ghost btn-sm" onclick="pedirNoAsistio('${c.id}')" style="color:var(--gray-400)">Ausente</button>`;
  }
  if (c.estado === 'En atención') {
    acciones += `<button class="btn btn-success btn-sm" onclick="pedirAtendido('${c.id}')">✅ Finalizar</button>`;
  }

  return `<div class="turno-card ${priClass} ${estClass}">
    <div class="turno-num ${priClass}">${turno}</div>
    <div class="turno-body">
      <div class="turno-header">
        <span class="turno-nombre">${nombre}</span>
        <span class="badge badge-${estClass.replace('-','')}">${c.estado}</span>
        <span class="badge badge-${priClass}">${c.prioridad}</span>
      </div>
      <div class="turno-meta">
        <span>👨‍⚕️ ${c.medico}</span>
        <span>🏥 ${c.especialidad}</span>
        <span>⏰ ${c.hora}</span>
        ${pac ? `<span>🎂 ${pac.edad} años</span>` : ''}
      </div>
      <div class="turno-motivo">${c.motivo}</div>
      ${alNoNing ? `<div class="turno-allergy">⚠️ Alergias: ${pac.alergias.join(', ')}</div>` : ''}
      ${c.prioridad === 'Urgente' && c.justificacion ? `<div class="turno-justif">🚨 ${c.justificacion}</div>` : ''}
      <div class="turno-tiempos">
        ${c.horaLlegada ? `<span class="turno-tiempo-chip llegada">🕐 Llegada: ${c.horaLlegada}</span>` : ''}
        ${c.horaInicioAtencion ? `<span class="turno-tiempo-chip atencion">⏱️ Inicio: ${c.horaInicioAtencion}</span>` : ''}
      </div>
    </div>
    <div class="turno-acciones">${acciones}</div>
  </div>`;
}

function updateStatsSala(citas) {
  document.getElementById('st-urgentes').textContent   = citas.filter(c => c.prioridad === 'Urgente' && c.estado === 'En espera').length;
  document.getElementById('st-preferencial').textContent = citas.filter(c => c.prioridad === 'Preferencial' && c.estado === 'En espera').length;
  document.getElementById('st-espera').textContent     = citas.filter(c => c.estado === 'En espera').length;
  document.getElementById('st-atencion').textContent   = citas.filter(c => c.estado === 'En atención').length;
  document.getElementById('st-atendidos').textContent  = citas.filter(c => c.estado === 'Atendida').length;
}

function renderTicker(citas) {
  const enAtencion = citas.find(c => c.estado === 'En atención');
  const numEl = document.getElementById('ticker-num');
  const pacEl = document.getElementById('ticker-pac');
  const espEl = document.getElementById('ticker-esp');
  if (enAtencion) {
    const pac = getPacienteLocal(enAtencion.paciente);
    numEl.textContent = enAtencion.codigo || enAtencion.id;
    pacEl.textContent = pac ? `${pac.nombres} ${pac.apellidos}` : '—';
    espEl.textContent = enAtencion.especialidad;
  } else {
    numEl.textContent = '—';
    pacEl.textContent = 'Ninguno en atención';
    espEl.textContent = '—';
  }
}

function renderResumen(citas) {
  const el = document.getElementById('resumen-dia');
  if (!el) return;
  const items = [
    ['Total en sala', citas.length],
    ['En espera',     citas.filter(c => c.estado === 'En espera').length],
    ['En atención',   citas.filter(c => c.estado === 'En atención').length],
    ['Atendidos',     citas.filter(c => c.estado === 'Atendida').length],
    ['No asistieron', citas.filter(c => c.estado === 'No asistió').length],
    ['Urgentes',      citas.filter(c => c.prioridad === 'Urgente').length],
  ];
  el.innerHTML = items.map(([label, val]) => `
    <div class="resumen-item">
      <span class="resumen-label">${label}</span>
      <span class="resumen-val">${val}</span>
    </div>`).join('');
}

function renderProximos(citas) {
  const el = document.getElementById('proximos-lista');
  if (!el) return;
  const proximos = citas.filter(c => c.estado === 'En espera').slice(0, 3);
  if (!proximos.length) {
    el.innerHTML = '<div style="font-size:.75rem;color:var(--gray-400);text-align:center;padding:.5rem 0">Sin pacientes en espera</div>';
    return;
  }
  el.innerHTML = proximos.map(c => {
    const pac = getPacienteLocal(c.paciente);
    const nombre = pac ? `${pac.nombres} ${pac.apellidos}` : '—';
    return `<div style="display:flex;align-items:center;gap:.75rem;padding:.55rem 0;border-bottom:1px solid var(--gray-100);">
      <div style="width:32px;height:32px;border-radius:50%;background:var(--blue-pale);color:var(--blue);display:flex;align-items:center;justify-content:center;font-size:.8rem;font-weight:700;flex-shrink:0;">
        ${(pac?.nombres || '?')[0].toUpperCase()}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.78rem;font-weight:600;color:var(--gray-900);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${nombre}</div>
        <div style="font-size:.65rem;color:var(--gray-400);">${c.especialidad} · ${c.hora}</div>
      </div>
      <span class="badge badge-${c.prioridad.toLowerCase()}" style="font-size:.55rem;">${c.prioridad}</span>
    </div>`;
  }).join('');
}

// ─── Acciones ─────────────────────────────────────────────────
async function iniciarAtencion(citaId) {
  const c = getCitasLocal().find(x => String(x.id) === String(citaId));
  if (!c) return;
  try {
    c.estado             = 'En atención';
    c.horaInicioAtencion = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    await saveCitaDB(c);
    showToast('Atención iniciada', 'success');
    renderSala();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

function pedirNoAsistio(citaId) {
  document.getElementById('noasistio-codigo').value = citaId;
  openModal('modal-noasistio');
}

async function confirmarNoAsistio() {
  const citaId = document.getElementById('noasistio-codigo').value;
  const c = getCitasLocal().find(x => String(x.id) === String(citaId));
  if (!c) return;
  try {
    c.estado = 'No asistió';
    await saveCitaDB(c);
    closeModal('modal-noasistio');
    showToast('Marcado como No asistió', 'warn');
    renderSala();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}

function pedirAtendido(citaId) {
  document.getElementById('atendido-codigo').value = citaId;
  document.getElementById('btn-ir-historial').style.display = 'none';
  openModal('modal-a-historial');
}

async function confirmarAtendido() {
  const citaId = document.getElementById('atendido-codigo').value;
  const c = getCitasLocal().find(x => String(x.id) === String(citaId));
  if (!c) return;
  try {
    c.estado  = 'Atendida';
    c.horaFin = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    await saveCitaDB(c);

    // Mostrar botón de ir a historial
    const btnHist = document.getElementById('btn-ir-historial');
    if (btnHist) {
      btnHist.href = `historial.html?cita=${c.id}`;
      btnHist.style.display = 'inline-flex';
    }

    showToast('Cita marcada como Atendida', 'success');
    renderSala();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
}
