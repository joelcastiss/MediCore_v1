/* ============================================================
   MediCore — historial.js  (Supabase)
   ============================================================ */

let _citaSeleccionada = null; // cita actualmente seleccionada en el sidebar

document.addEventListener('DOMContentLoaded', async () => {
  await cargarDatosHistorial();
  updateStats();
  renderCitasAtendidas();

  // Si llegamos con ?cita=ID en la URL, pre-seleccionar
  const params = new URLSearchParams(window.location.search);
  const citaParam = params.get('cita');
  if (citaParam) seleccionarCita(citaParam);
});

async function cargarDatosHistorial() {
  try {
    await Promise.all([
      getCitasCache(true),
      getPacientesCache(),
      getHistorialCache(true),
    ]);
  } catch (e) {
    console.error('Error cargando datos historial:', e);
    showToast('Error al conectar con la base de datos', 'error');
  }
}

// ─── Stats ────────────────────────────────────────────────────
function updateStats() {
  const hist  = getHistorialLocal();
  const citas = getCitasLocal();
  const atendidas = citas.filter(c => c.estado === 'Atendida');
  const sinHist   = atendidas.filter(c => !hist.find(h => String(h.citaCodigo) === String(c.id)));

  document.getElementById('st-hist').textContent      = hist.length;
  document.getElementById('st-pendientes').textContent = sinHist.length;
  document.getElementById('st-con-meds').textContent  = hist.filter(h => h.medicamentos?.length).length;
  const pacs = new Set(hist.map(h => h.paciente));
  document.getElementById('st-pacs-hist').textContent = pacs.size;
}

// ─── Sidebar: lista de citas atendidas ────────────────────────
function renderCitasAtendidas() {
  const q      = (document.getElementById('search-citas-at')?.value || '').toLowerCase();
  const hist   = getHistorialLocal();
  const citas  = getCitasLocal()
    .filter(c => c.estado === 'Atendida')
    .filter(c => {
      if (!q) return true;
      const pac    = getPacienteLocal(c.paciente);
      const nombre = pac ? `${pac.nombres} ${pac.apellidos}`.toLowerCase() : '';
      return nombre.includes(q) || (c.codigo || String(c.id)).toLowerCase().includes(q);
    })
    .sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  const el = document.getElementById('lista-citas-atendidas');
  if (!citas.length) {
    el.innerHTML = '<div style="font-size:.75rem;color:var(--gray-400);padding:1rem 0;text-align:center">Sin citas atendidas</div>';
    return;
  }

  el.innerHTML = citas.map(c => {
    const pac     = getPacienteLocal(c.paciente);
    const nombre  = pac ? `${pac.nombres} ${pac.apellidos}` : '(Sin datos)';
    const tieneH  = hist.some(h => String(h.citaCodigo) === String(c.id));
    const selClass = _citaSeleccionada && String(_citaSeleccionada.id) === String(c.id) ? 'selected' : '';
    return `<div class="cita-atendida-item ${selClass} ${tieneH ? 'has-hist' : ''}" onclick="seleccionarCita('${c.id}')">
      <div class="cai-icon">📋</div>
      <div class="cai-main">
        <div class="cai-nombre">${nombre}</div>
        <div class="cai-meta">${c.especialidad} · ${formatDate(c.fecha)}</div>
        <div class="cai-meta" style="color:var(--blue);font-size:.63rem">${c.codigo || c.id}</div>
      </div>
      <div class="cai-badge">
        ${tieneH ? '<span style="font-size:.65rem;color:var(--green);font-weight:700">✓ Registrado</span>'
                 : '<span style="font-size:.65rem;color:var(--orange);font-weight:600">Pendiente</span>'}
      </div>
    </div>`;
  }).join('');
}

// ─── Seleccionar cita → mostrar historial o form ──────────────
function seleccionarCita(citaId) {
  const c = getCitasLocal().find(x => String(x.id) === String(citaId));
  if (!c) return;
  _citaSeleccionada = c;
  renderCitasAtendidas(); // actualiza clase "selected"

  const hist = getHistorialLocal().find(h => String(h.citaCodigo) === String(c.id));
  const main = document.getElementById('main-historial');

  if (hist) {
    renderVerHistorial(hist, c, main);
  } else {
    renderFormHistorial(c, main);
  }
}

// ─── Vista: historial ya registrado ──────────────────────────
function renderVerHistorial(hist, cita, container) {
  const pac = getPacienteLocal(cita.paciente);
  const nombre = pac ? `${pac.nombres} ${pac.apellidos}` : '—';
  container.innerHTML = `
    <div class="hist-card">
      <div class="hist-card-header">
        <div>
          <div class="hist-code">${hist.codigo || hist.id}</div>
          <div class="hist-fecha">${formatDate(hist.fecha)} · ${hist.especialidad}</div>
        </div>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap">
          <button class="btn btn-outline btn-sm" onclick="abrirEditarHistorial('${hist.id}')">✏️ Editar</button>
        </div>
      </div>

      <div style="background:var(--blue-pale);border-radius:var(--radius);padding:.75rem 1rem;margin-bottom:1rem;font-size:.78rem;display:flex;gap:1.5rem;flex-wrap:wrap">
        <span>👤 <b>${nombre}</b></span>
        <span>👨‍⚕️ ${hist.medico}</span>
        <span>🏥 ${hist.especialidad}</span>
        ${pac ? `<span>🎂 ${pac.edad} años</span>` : ''}
      </div>

      <div class="hist-section">
        <div class="hist-section-title">Síntomas</div>
        <div class="hist-section-body">${hist.sintomas}</div>
      </div>
      <hr class="hist-divider"/>
      <div class="hist-section">
        <div class="hist-section-title">Diagnóstico</div>
        <div class="hist-section-body">${hist.diagnostico}</div>
      </div>
      <hr class="hist-divider"/>
      <div class="hist-section">
        <div class="hist-section-title">Tratamiento</div>
        <div class="hist-section-body">${hist.tratamiento}</div>
      </div>

      ${hist.medicamentos?.length ? `
      <hr class="hist-divider"/>
      <div class="hist-section">
        <div class="hist-section-title">Medicamentos Recetados</div>
        ${hist.medicamentos.map(m => `
          <div class="med-item">
            <div class="med-nombre">💊 ${m.nombre}</div>
            <div class="med-detalle">${m.dosis} · ${m.frecuencia} · ${m.duracion}</div>
          </div>`).join('')}
      </div>` : ''}

      ${hist.observaciones ? `
      <hr class="hist-divider"/>
      <div class="hist-section">
        <div class="hist-section-title">Observaciones</div>
        <div class="hist-section-body">${hist.observaciones}</div>
      </div>` : ''}

      ${hist.proxCita ? `
      <hr class="hist-divider"/>
      <div>
        <div class="hist-section-title" style="margin-bottom:.4rem">Próxima Cita</div>
        <span class="prox-cita-chip">📅 ${formatDate(hist.proxCita)}</span>
      </div>` : ''}
    </div>`;
}

// ─── Vista: form para registrar historial ─────────────────────
function renderFormHistorial(cita, container) {
  const pac = getPacienteLocal(cita.paciente);
  const nombre = pac ? `${pac.nombres} ${pac.apellidos}` : '—';
  container.innerHTML = `
    <div class="card">
      <div class="card-title" style="margin-bottom:1rem">Registrar Historial Clínico</div>
      <div style="background:var(--blue-pale);border-radius:var(--radius);padding:.75rem 1rem;margin-bottom:1rem;font-size:.78rem;display:flex;gap:1.5rem;flex-wrap:wrap">
        <span>👤 <b>${nombre}</b></span>
        <span>👨‍⚕️ ${cita.medico}</span>
        <span>🏥 ${cita.especialidad}</span>
        <span>📅 ${formatDate(cita.fecha)}</span>
      </div>
      <button class="btn btn-primary" onclick="abrirModalHistorial('${cita.id}')">📋 Abrir Formulario</button>
    </div>`;
}

// ─── Modal: abrir para nueva consulta ─────────────────────────
function abrirModalHistorial(citaId) {
  const c = getCitasLocal().find(x => String(x.id) === String(citaId));
  if (!c) return;
  const pac = getPacienteLocal(c.paciente);

  clearAllErrors('form-historial');
  document.getElementById('hist-cita-codigo').value    = c.id;
  document.getElementById('modal-hist-title').textContent = 'Registrar Consulta Médica';
  document.getElementById('modal-hist-sub').textContent   = pac ? `${pac.nombres} ${pac.apellidos}` : '';
  document.getElementById('hist-medico').value         = c.medico;
  document.getElementById('hist-especialidad').value   = c.especialidad;
  document.getElementById('hist-fecha').value          = formatDate(c.fecha);
  document.getElementById('hist-prox-cita').value      = '';
  document.getElementById('hist-observaciones').value  = '';

  // Código nuevo
  const hists = getHistorialLocal();
  document.getElementById('hist-codigo').value = nextId('HIST', hists);

  ['hist-sintomas','hist-diagnostico','hist-tratamiento'].forEach(id => {
    document.getElementById(id).value = '';
    const cnt = document.getElementById(id + '-cnt');
    if (cnt) cnt.textContent = `0 / ${document.getElementById(id).maxLength}`;
  });

  // Strip paciente en modal
  if (pac) {
    document.getElementById('hist-pac-strip').innerHTML = `
      <div style="background:var(--blue-pale);border-radius:var(--radius);padding:.75rem 1rem;font-size:.78rem;display:flex;gap:1.5rem;flex-wrap:wrap">
        <span>👤 <b>${pac.nombres} ${pac.apellidos}</b></span>
        <span>🎂 ${pac.edad} años</span>
        <span>📄 ${pac.documento}</span>
        ${renderAlergias(pac.alergias)}
      </div>`;
  }

  limpiarMeds();
  setupCounters();
  openModal('modal-historial');
}

// ─── Modal: abrir para editar ─────────────────────────────────
function abrirEditarHistorial(histId) {
  const hist = getHistorialLocal().find(h => String(h.id) === String(histId));
  if (!hist) return;
  const cita = getCitasLocal().find(c => String(c.id) === String(hist.citaCodigo));

  abrirModalHistorial(hist.citaCodigo); // llena campos básicos

  // Sobrescribir con datos existentes
  setTimeout(() => {
    document.getElementById('hist-cita-codigo').value  = hist.id; // usar id para distinguir edición
    document.getElementById('hist-codigo').value       = hist.codigo || hist.id;
    document.getElementById('hist-sintomas').value     = hist.sintomas;
    document.getElementById('hist-diagnostico').value  = hist.diagnostico;
    document.getElementById('hist-tratamiento').value  = hist.tratamiento;
    document.getElementById('hist-observaciones').value = hist.observaciones || '';
    document.getElementById('hist-prox-cita').value    = hist.proxCita || '';
    document.getElementById('modal-hist-title').textContent = 'Editar Consulta Médica';

    // Medicamentos
    limpiarMeds();
    (hist.medicamentos || []).forEach(m => agregarMed(m));
    setupCounters();
  }, 50);
}

// ─── Medicamentos ─────────────────────────────────────────────
let _medCount = 0;
function limpiarMeds() {
  _medCount = 0;
  document.getElementById('med-lista').innerHTML = '';
}

function agregarMed(med = {}) {
  _medCount++;
  const id = `med-${_medCount}`;
  const div = document.createElement('div');
  div.id = id;
  div.className = 'med-row';
  div.style.marginBottom = '.5rem';
  div.innerHTML = `
    <div class="form-group" style="margin:0">
      <input type="text" class="form-control" placeholder="Medicamento *" value="${med.nombre || ''}" data-field="nombre"/>
    </div>
    <div class="form-group" style="margin:0">
      <input type="text" class="form-control" placeholder="Dosis (ej: 500mg)" value="${med.dosis || ''}" data-field="dosis"/>
    </div>
    <div class="form-group" style="margin:0">
      <input type="text" class="form-control" placeholder="Frecuencia (ej: c/8h)" value="${med.frecuencia || ''}" data-field="frecuencia"/>
    </div>
    <div class="form-group" style="margin:0">
      <input type="text" class="form-control" placeholder="Duración (ej: 7 días)" value="${med.duracion || ''}" data-field="duracion"/>
    </div>
    <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('${id}').remove()" style="color:var(--red);flex-shrink:0">✕</button>`;
  document.getElementById('med-lista').appendChild(div);
}

function getMedicamentos() {
  const meds = [];
  document.getElementById('med-lista').querySelectorAll('[id^="med-"]').forEach(row => {
    const nombre    = row.querySelector('[data-field="nombre"]')?.value?.trim();
    const dosis     = row.querySelector('[data-field="dosis"]')?.value?.trim();
    const frecuencia= row.querySelector('[data-field="frecuencia"]')?.value?.trim();
    const duracion  = row.querySelector('[data-field="duracion"]')?.value?.trim();
    if (nombre) meds.push({ nombre, dosis, frecuencia, duracion });
  });
  return meds;
}

// ─── Contadores de caracteres ─────────────────────────────────
function setupCounters() {
  ['hist-sintomas','hist-diagnostico','hist-tratamiento','hist-observaciones'].forEach(id => {
    const el  = document.getElementById(id);
    const cnt = document.getElementById(id + '-cnt');
    if (!el || !cnt) return;
    const update = () => cnt.textContent = `${el.value.length} / ${el.maxLength}`;
    el.removeEventListener('input', update);
    el.addEventListener('input', update);
    update();
  });
}

// ─── Guardar historial ────────────────────────────────────────
async function guardarHistorial() {
  if (!validarFormHistorial()) return;

  const citaIdRaw = document.getElementById('hist-cita-codigo').value;
  // Detectar si es edición: el campo guarda hist.id cuando editamos
  const existingHist = getHistorialLocal().find(h => String(h.id) === String(citaIdRaw));
  const cita = existingHist
    ? getCitasLocal().find(c => String(c.id) === String(existingHist.citaCodigo))
    : getCitasLocal().find(c => String(c.id) === String(citaIdRaw));

  if (!cita) { showToast('Cita no encontrada', 'error'); return; }

  const hist = {
    id:           existingHist?.id ?? null,
    codigo:       document.getElementById('hist-codigo').value,
    citaCodigo:   cita.id,
    paciente:     cita.paciente,
    medico:       cita.medico,
    especialidad: cita.especialidad,
    fecha:        cita.fecha,
    sintomas:     document.getElementById('hist-sintomas').value.trim(),
    diagnostico:  document.getElementById('hist-diagnostico').value.trim(),
    tratamiento:  document.getElementById('hist-tratamiento').value.trim(),
    medicamentos: getMedicamentos(),
    observaciones:document.getElementById('hist-observaciones').value.trim() || null,
    proxCita:     document.getElementById('hist-prox-cita').value || null,
  };

  try {
    await saveHistorialDB(hist);
    closeModal('modal-historial');
    updateStats();
    renderCitasAtendidas();
    seleccionarCita(cita.id); // refresca vista
    showToast('Historial guardado', 'success');
  } catch (e) {
    showToast('Error al guardar historial: ' + e.message, 'error');
    console.error(e);
  }
}

function validarFormHistorial() {
  let ok = true;
  clearAllErrors('form-historial');
  [
    ['hist-sintomas',    'Describe los síntomas (mín. 10 caracteres)'],
    ['hist-diagnostico', 'Ingresa el diagnóstico (mín. 10 caracteres)'],
    ['hist-tratamiento', 'Ingresa el tratamiento (mín. 10 caracteres)'],
  ].forEach(([id, msg]) => {
    const val = document.getElementById(id)?.value?.trim();
    if (!val || val.length < 10) { showFieldError(id, msg); ok = false; }
  });
  const proxCita = document.getElementById('hist-prox-cita')?.value;
  if (proxCita && new Date(proxCita) <= new Date()) {
    showFieldError('hist-prox-cita', 'La próxima cita debe ser una fecha futura');
    ok = false;
  }
  return ok;
}