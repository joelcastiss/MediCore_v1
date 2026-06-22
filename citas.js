/* ============================================================
   MediCore — citas.js  (Supabase)
   ============================================================ */

const MEDICOS_POR_ESPECIALIDAD = {
  'Medicina general': ['Dr. Carlos Ramírez', 'Dra. Lucía Torres', 'Dr. Andrés Vega'],
  'Pediatría':        ['Dra. María Fuentes', 'Dr. José Herrera'],
  'Cardiología':      ['Dr. Roberto Sánchez', 'Dra. Patricia Lozano'],
  'Dermatología':     ['Dra. Sofía Mendoza', 'Dr. Diego Castro'],
  'Traumatología':    ['Dr. Felipe Morales', 'Dra. Ana Quispe'],
  'Ginecología':      ['Dra. Carmen Vargas', 'Dra. Valeria Reyes'],
  'Odontología':      ['Dr. Miguel Álvarez', 'Dra. Isabel Paredes'],
};

document.addEventListener('DOMContentLoaded', async () => {
  await cargarDatosCitas();
  generarHorarios();
  renderCitas();
  updateStats();
});

async function cargarDatosCitas() {
  try {
    await Promise.all([getCitasCache(true), getPacientesCache()]);
    poblarSelectPacientes();
  } catch (e) {
    console.error('Error cargando datos de citas:', e);
    showToast('Error al conectar con la base de datos', 'error');
  }
}

function poblarSelectPacientes() {
  const pacs = getAllPacientes();
  const sel  = document.getElementById('cita-paciente');
  if (!sel) return;
  // Limpiar excepto primer option
  while (sel.options.length > 1) sel.remove(1);
  pacs.forEach(p => {
    const o = document.createElement('option');
    o.value = String(p.id);
    o.textContent = `${p.nombres} ${p.apellidos} — ${p.documento}`;
    sel.appendChild(o);
  });
}

function generarHorarios() {
  const sel = document.getElementById('cita-hora');
  if (!sel) return;
  while (sel.options.length > 1) sel.remove(1);
  for (let h = 8; h < 18; h++) {
    ['00', '30'].forEach(m => {
      const o = document.createElement('option');
      o.value = o.textContent = `${String(h).padStart(2,'0')}:${m}`;
      sel.appendChild(o);
    });
  }
}

// ─── Renderizar listado ────────────────────────────────────────
function renderCitas() {
  const q    = (document.getElementById('f-buscar')?.value || '').toLowerCase();
  const fFec = document.getElementById('f-fecha')?.value || '';
  const fEst = document.getElementById('f-estado')?.value || '';
  const fEsp = document.getElementById('f-especialidad')?.value || '';
  const fPri = document.getElementById('f-prioridad')?.value || '';

  let citas = getCitasLocal().filter(c => {
    if (fFec && c.fecha !== fFec) return false;
    if (fEst && c.estado !== fEst) return false;
    if (fEsp && c.especialidad !== fEsp) return false;
    if (fPri && c.prioridad !== fPri) return false;
    if (q) {
      const pac    = getPacienteLocal(c.paciente);
      const nombre = pac ? `${pac.nombres} ${pac.apellidos}`.toLowerCase() : '';
      if (!nombre.includes(q) && !(c.medico || '').toLowerCase().includes(q) && !(c.codigo || '').toLowerCase().includes(q)) return false;
    }
    return true;
  });

  citas.sort((a, b) => {
    const fd = (b.fecha || '').localeCompare(a.fecha || '');
    return fd !== 0 ? fd : (a.hora || '').localeCompare(b.hora || '');
  });

  const grid  = document.getElementById('cita-card-grid');
  const empty = document.getElementById('empty-citas');

  if (!citas.length) {
    grid.innerHTML = '';
    empty.style.display = 'flex';
    return;
  }
  empty.style.display = 'none';

  grid.innerHTML = citas.map(c => {
    const pac      = getPacienteLocal(c.paciente);
    const nombre   = pac ? `${pac.nombres} ${pac.apellidos}` : '(Paciente no encontrado)';
    const priClass = (c.prioridad || '').toLowerCase();
    const estClass = c.estado === 'En espera'   ? 'espera'
                   : c.estado === 'En atención' ? 'atencion'
                   : c.estado === 'No asistió'  ? 'noasistio'
                   : (c.estado || '').toLowerCase().replace(/\s+/g, '');
    const alNoNing = pac?.alergias?.length && pac.alergias[0] !== 'Ninguna';

    let acciones = `<button class="btn btn-ghost btn-sm" onclick="editarCita('${c.id}')">✏️ Editar</button>`;

    if (c.estado === 'Programada' || c.estado === 'Confirmada') {
      acciones += `<button class="btn btn-outline btn-sm" onclick="confirmarCita('${c.id}')">✅ Confirmar</button>`;
      acciones += `<button class="btn btn-outline btn-sm" onclick="enviarSala('${c.id}')">🚶 Sala de espera</button>`;
      acciones += `<button class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="pedirCancelar('${c.id}')">❌ Cancelar</button>`;
    }
    if (c.estado === 'Confirmada') {
      acciones += `<button class="btn btn-outline btn-sm" onclick="enviarSala('${c.id}')">🚶 Sala de espera</button>`;
    }

    return `<div class="cita-card ${priClass}">
      <div class="cita-main">
        <div class="cita-header">
          <span class="cita-code">${c.codigo || c.id}</span>
          <span class="badge badge-${estClass}">${c.estado}</span>
          <span class="badge badge-${priClass}">${c.prioridad}</span>
        </div>
        <div class="cita-paciente">${nombre}</div>
        <div class="cita-meta">
          <span>👨‍⚕️ ${c.medico}</span>
          <span>🏥 ${c.especialidad}</span>
          <span>📅 ${formatDate(c.fecha)}</span>
          <span>🕐 ${c.hora}</span>
          ${pac ? `<span>🎂 ${pac.edad} años</span>` : ''}
        </div>
        <div class="cita-motivo">${c.motivo}</div>
        ${alNoNing ? `<div class="cita-allergy">⚠️ Alergias: ${pac.alergias.join(', ')}</div>` : ''}
      </div>
      <div class="cita-actions">${acciones}</div>
    </div>`;
  }).join('');

  updateStats();
}

function updateStats() {
  const all  = getCitasLocal();
  const hoy  = todayStr();
  document.getElementById('st-total').textContent    = all.length;
  document.getElementById('st-hoy').textContent      = all.filter(c => c.fecha === hoy).length;
  document.getElementById('st-espera').textContent   = all.filter(c => c.estado === 'En espera').length;
  document.getElementById('st-urgentes').textContent = all.filter(c => c.prioridad === 'Urgente' && ['Programada','Confirmada','En espera'].includes(c.estado)).length;
}

function limpiarFiltros() {
  ['f-buscar','f-fecha','f-estado','f-especialidad','f-prioridad'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderCitas();
}

// ─── Abrir modal nueva cita ────────────────────────────────────
function abrirNuevaCita() {
  clearAllErrors('form-cita');
  document.getElementById('cita-codigo-edit').value = '';
  document.getElementById('modal-cita-title').textContent = 'Nueva Cita';

  // Generar código
  const citas = getCitasLocal();
  document.getElementById('cita-codigo').value = nextId('CIT', citas);

  // Limpiar campos
  ['cita-paciente','cita-especialidad','cita-medico','cita-hora','cita-prioridad','cita-motivo','cita-justificacion'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('cita-fecha').value = todayStr();
  document.getElementById('bloque-pac-info').style.display = 'none';
  document.getElementById('bloque-justificacion').style.display = 'none';
  document.getElementById('cita-medico').innerHTML = '<option value="">Seleccione especialidad primero</option>';
  openModal('modal-cita');
}

function editarCita(citaId) {
  const c = getCitasLocal().find(x => String(x.id) === String(citaId));
  if (!c) return;
  clearAllErrors('form-cita');
  document.getElementById('cita-codigo-edit').value   = c.id;
  document.getElementById('modal-cita-title').textContent = 'Editar Cita';
  document.getElementById('cita-codigo').value        = c.codigo || c.id;
  document.getElementById('cita-paciente').value      = String(c.paciente);
  document.getElementById('cita-fecha').value         = c.fecha;
  document.getElementById('cita-prioridad').value     = c.prioridad;
  document.getElementById('cita-motivo').value        = c.motivo;
  document.getElementById('cita-justificacion').value = c.justificacion || '';
  document.getElementById('bloque-justificacion').style.display = c.prioridad === 'Urgente' ? 'block' : 'none';

  onEspecialidadChange(c.especialidad);
  document.getElementById('cita-especialidad').value = c.especialidad;
  onEspecialidadChange(); // repobla médicos
  setTimeout(() => {
    document.getElementById('cita-medico').value = c.medico;
    document.getElementById('cita-hora').value   = c.hora;
  }, 50);

  onPacienteChange();
  openModal('modal-cita');
}

function onPacienteChange() {
  const pacId = document.getElementById('cita-paciente').value;
  const bloque = document.getElementById('bloque-pac-info');
  const strip  = document.getElementById('pac-info-strip');
  if (!pacId) { bloque.style.display = 'none'; return; }
  const pac = getPacienteLocal(pacId);
  if (!pac) { bloque.style.display = 'none'; return; }
  const alNoNing = pac.alergias?.length && pac.alergias[0] !== 'Ninguna';
  strip.innerHTML = `
    <div style="background:var(--blue-pale);border-radius:var(--radius);padding:.75rem 1rem;display:flex;gap:1.5rem;flex-wrap:wrap;font-size:.78rem">
      <span>👤 <b>${pac.nombres} ${pac.apellidos}</b></span>
      <span>🎂 ${pac.edad} años</span>
      <span>📄 ${pac.documento}</span>
      <span>📞 ${pac.telefono}</span>
      ${alNoNing ? `<span style="color:var(--red);font-weight:600">⚠️ Alergias: ${pac.alergias.join(', ')}</span>` : ''}
    </div>`;
  bloque.style.display = 'block';
}

function onEspecialidadChange(forceVal) {
  const esp = forceVal || document.getElementById('cita-especialidad').value;
  const sel = document.getElementById('cita-medico');
  const medicos = MEDICOS_POR_ESPECIALIDAD[esp] || [];
  sel.innerHTML = '<option value="">Seleccionar médico…</option>';
  medicos.forEach(m => {
    const o = document.createElement('option');
    o.value = o.textContent = m;
    sel.appendChild(o);
  });
  if (!esp) sel.innerHTML = '<option value="">Seleccione especialidad primero</option>';
}

function onPrioridadChange() {
  const p = document.getElementById('cita-prioridad').value;
  document.getElementById('bloque-justificacion').style.display = p === 'Urgente' ? 'block' : 'none';
}

// ─── Guardar cita ──────────────────────────────────────────────
async function guardarCita() {
  if (!validarFormCita()) return;

  const editId      = document.getElementById('cita-codigo-edit').value;
  const existing    = editId ? getCitasLocal().find(c => String(c.id) === String(editId)) : null;

  const cita = {
    id:           existing?.id ?? null,
    codigo:       document.getElementById('cita-codigo').value,
    paciente:     document.getElementById('cita-paciente').value,
    medico:       document.getElementById('cita-medico').value,
    especialidad: document.getElementById('cita-especialidad').value,
    fecha:        document.getElementById('cita-fecha').value,
    hora:         document.getElementById('cita-hora').value,
    estado:       existing?.estado ?? 'Programada',
    prioridad:    document.getElementById('cita-prioridad').value,
    motivo:       document.getElementById('cita-motivo').value.trim(),
    justificacion:document.getElementById('cita-justificacion').value.trim() || null,
    horaLlegada:       existing?.horaLlegada       ?? null,
    horaInicioAtencion:existing?.horaInicioAtencion ?? null,
    horaFin:           existing?.horaFin            ?? null,
  };

  try {
    await saveCitaDB(cita);
    closeModal('modal-cita');
    renderCitas();
    showToast(editId ? 'Cita actualizada' : 'Cita registrada', 'success');
  } catch (e) {
    showToast('Error al guardar cita: ' + e.message, 'error');
    console.error(e);
  }
}

function validarFormCita() {
  let ok = true;
  clearAllErrors('form-cita');
  const req = [
    ['cita-paciente',    'Selecciona un paciente'],
    ['cita-especialidad','Selecciona una especialidad'],
    ['cita-medico',      'Selecciona un médico'],
    ['cita-fecha',       'Ingresa la fecha'],
    ['cita-hora',        'Selecciona la hora'],
    ['cita-prioridad',   'Selecciona la prioridad'],
    ['cita-motivo',      'Ingresa el motivo'],
  ];
  req.forEach(([id, msg]) => {
    const val = document.getElementById(id)?.value?.trim();
    if (!val) { showFieldError(id, msg); ok = false; }
  });
  const motivo = document.getElementById('cita-motivo')?.value?.trim();
  if (motivo && motivo.length < 10) { showFieldError('cita-motivo', 'Mínimo 10 caracteres'); ok = false; }
  const pri = document.getElementById('cita-prioridad')?.value;
  if (pri === 'Urgente') {
    const just = document.getElementById('cita-justificacion')?.value?.trim();
    if (!just || just.length < 10) { showFieldError('cita-justificacion', 'Mínimo 10 caracteres'); ok = false; }
  }
  return ok;
}

// ─── Confirmar / Enviar sala ───────────────────────────────────
async function confirmarCita(citaId) {
  const c = getCitasLocal().find(x => String(x.id) === String(citaId));
  if (!c) return;
  try {
    c.estado = 'Confirmada';
    await saveCitaDB(c);
    showToast('Cita confirmada', 'success');
    renderCitas();
  } catch (e) {
    showToast('Error al confirmar cita', 'error');
  }
}

async function enviarSala(citaId) {
  const c = getCitasLocal().find(x => String(x.id) === String(citaId));
  if (!c) return;
  try {
    c.estado      = 'En espera';
    c.horaLlegada = new Date().toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
    await saveCitaDB(c);
    showToast('Paciente enviado a sala de espera', 'success');
    renderCitas();
  } catch (e) {
    showToast('Error al enviar a sala', 'error');
  }
}

// ─── Cancelar ─────────────────────────────────────────────────
function pedirCancelar(citaId) {
  document.getElementById('cita-cancelar-codigo').value = citaId;
  document.getElementById('motivo-cancelacion').value   = '';
  clearFieldError('motivo-cancelacion');
  openModal('modal-cancelar');
}

async function confirmarCancelacion() {
  const citaId  = document.getElementById('cita-cancelar-codigo').value;
  const motivo  = document.getElementById('motivo-cancelacion').value.trim();
  if (!motivo) { showFieldError('motivo-cancelacion', 'Ingresa el motivo de cancelación'); return; }

  const c = getCitasLocal().find(x => String(x.id) === String(citaId));
  if (!c) return;
  try {
    c.estado             = 'Cancelada';
    c.motivoCancelacion  = motivo;
    await saveCitaDB(c);
    closeModal('modal-cancelar');
    showToast('Cita cancelada', 'warn');
    renderCitas();
  } catch (e) {
    showToast('Error al cancelar cita', 'error');
  }
}