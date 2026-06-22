/* ============================================================
   MediCore - pacientes.js
   Logica del modulo Pacientes alineada con pacientes.html
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  if (typeof isSessionValid === 'function' && !isSessionValid()) return;

  bindPacienteUI();
  await cargarPacientes();
  renderStats();
  renderTable();
  renderRecientes();
});

function bindPacienteUI() {
  document.querySelectorAll('[data-paciente-nuevo]').forEach(btn => {
    btn.addEventListener('click', abrirNuevo);
  });

  document.getElementById('btn-guardar-paciente')?.addEventListener('click', guardarPaciente);

  document.querySelectorAll('.alergia-pill input[type="checkbox"]').forEach(cb => {
    cb.addEventListener('change', () => onAlergiaChange(cb));
  });
}

async function cargarPacientes() {
  try {
    await getPacientesCache(true);
  } catch (e) {
    showToast('Error al conectar con la base de datos', 'error');
    console.error(e);
  }
}

function getPacientesFiltrados() {
  const q = (document.getElementById('search-pac')?.value || '').trim().toLowerCase();
  const filtroAlergia = document.getElementById('filter-alergia')?.value || '';

  return getAllPacientes().filter(p => {
    const texto = `${p.codigo} ${p.nombres} ${p.apellidos} ${p.documento}`.toLowerCase();
    const tieneAlergias = Array.isArray(p.alergias) && p.alergias.length > 0 && p.alergias[0] !== 'Ninguna';
    if (q && !texto.includes(q)) return false;
    if (filtroAlergia === 'si' && !tieneAlergias) return false;
    if (filtroAlergia === 'no' && tieneAlergias) return false;
    return true;
  });
}

function renderStats() {
  const pacs = getAllPacientes();
  const menores = pacs.filter(p => isMinor(p.fechaNacimiento)).length;
  const adultos = pacs.length - menores;
  const conAlergias = pacs.filter(p => p.alergias?.length && p.alergias[0] !== 'Ninguna').length;

  animateCount(document.getElementById('st-total'), pacs.length);
  animateCount(document.getElementById('st-adultos'), adultos);
  animateCount(document.getElementById('st-menores'), menores);
  animateCount(document.getElementById('st-alergias'), conAlergias);
}

function renderTable() {
  const tbody = document.getElementById('tbody-pac');
  const empty = document.getElementById('empty-pac');
  const tabla = document.getElementById('tabla-pacientes');
  if (!tbody) return;

  const pacs = getPacientesFiltrados();
  if (!pacs.length) {
    tbody.innerHTML = '';
    if (empty) empty.style.display = 'block';
    if (tabla) tabla.style.display = 'none';
    return;
  }

  if (empty) empty.style.display = 'none';
  if (tabla) tabla.style.display = 'table';

  tbody.innerHTML = pacs.map(p => {
    const fullName = `${p.nombres} ${p.apellidos}`.trim();
    const edad = p.edad ?? calcAge(p.fechaNacimiento);
    return `
      <tr>
        <td class="td-code">${p.codigo}</td>
        <td class="td-main">${fullName || '-'}</td>
        <td>${p.tipoDoc || 'DNI'} ${p.documento || ''}</td>
        <td>${edad ?? '-'}${isMinor(p.fechaNacimiento) ? ' <span class="badge badge-preferencial">Menor</span>' : ''}</td>
        <td>${p.telefono || '-'}</td>
        <td>${renderAlergias(p.alergias)}</td>
        <td>
          <div class="actions">
            <button type="button" class="btn btn-outline btn-sm" onclick="seleccionarPaciente('${p.id}')">Ver</button>
            <button type="button" class="btn btn-ghost btn-sm" onclick="abrirEditar('${p.id}')">Editar</button>
            <button type="button" class="btn btn-ghost btn-sm" style="color:var(--red)" onclick="pedirEliminar('${p.id}')">Eliminar</button>
          </div>
        </td>
      </tr>`;
  }).join('');
}

function renderRecientes() {
  const el = document.getElementById('lista-recientes');
  if (!el) return;

  const pacs = [...getAllPacientes()].slice(-8).reverse();
  if (!pacs.length) {
    el.innerHTML = '<div style="font-size:.75rem;color:var(--gray-400);padding:1rem;text-align:center">Sin pacientes registrados</div>';
    return;
  }

  el.innerHTML = pacs.map(p => {
    const initials = `${(p.nombres || ' ')[0]}${(p.apellidos || ' ')[0]}`.toUpperCase();
    return `
      <div class="patient-list-item" data-paciente-id="${p.id}" onclick="seleccionarPaciente('${p.id}')">
        <div class="pli-avatar">${initials}</div>
        <div style="flex:1;min-width:0">
          <div class="pli-name">${p.nombres} ${p.apellidos}</div>
          <div class="pli-meta">${p.tipoDoc || 'DNI'} ${p.documento || ''}</div>
        </div>
        <span class="pli-code">${p.codigo}</span>
      </div>`;
  }).join('');
}

function seleccionarPaciente(pacId) {
  document.querySelectorAll('.patient-list-item').forEach(el => {
    el.classList.toggle('selected', String(el.dataset.pacienteId) === String(pacId));
  });

  const pac = getPacienteLocal(pacId);
  if (!pac) return;

  const contacto = pac.contactoEmerg || {};
  document.getElementById('det-titulo').textContent = `${pac.nombres} ${pac.apellidos}`;
  document.getElementById('det-codigo').textContent = pac.codigo;

  const det = document.getElementById('det-contenido');
  if (det) {
    det.innerHTML = `
      <div class="detail-grid">
        <div class="detail-item"><label>Documento</label><span>${pac.tipoDoc || 'DNI'} ${pac.documento || '-'}</span></div>
        <div class="detail-item"><label>Fecha de nacimiento</label><span>${formatDate(pac.fechaNacimiento)}</span></div>
        <div class="detail-item"><label>Edad</label><span>${pac.edad ?? calcAge(pac.fechaNacimiento) ?? '-'} anios</span></div>
        <div class="detail-item"><label>Telefono</label><span>${pac.telefono || '-'}</span></div>
        <div class="detail-item"><label>Correo</label><span>${pac.correo || '-'}</span></div>
        <div class="detail-item"><label>Direccion</label><span>${pac.direccion || '-'}</span></div>
        <div class="detail-item"><label>Contacto emergencia</label><span>${contacto.nombre || '-'} ${contacto.parentesco ? `(${contacto.parentesco})` : ''}</span></div>
        <div class="detail-item"><label>Telefono emergencia</label><span>${contacto.telefono || '-'}</span></div>
      </div>
      <div style="margin-top:1rem">
        <div class="section-label">Alergias</div>
        <div>${renderAlergias(pac.alergias)}</div>
      </div>`;
  }

  const editBtn = document.getElementById('det-btn-editar');
  if (editBtn) editBtn.onclick = () => abrirEditar(pac.id);
  openModal('modal-detalle');
}

function generarCodigoPaciente(editId = '') {
  if (editId) return getPacienteLocal(editId)?.codigo || `PAC-${String(editId).padStart(3, '0')}`;
  return nextId('PAC-', getAllPacientes(), 'codigo');
}

function abrirNuevo() {
  clearAllErrors('form-paciente');
  document.getElementById('form-paciente')?.reset();
  document.getElementById('pac-codigo-edit').value = '';
  document.getElementById('pac-codigo').value = generarCodigoPaciente();
  document.getElementById('modal-pac-title').textContent = 'Nuevo Paciente';
  document.getElementById('bloque-apoderado').style.display = 'none';
  resetAlergiasUI();
  openModal('modal-nuevo');
}

function abrirEditar(pacId) {
  const pac = getPacienteLocal(pacId);
  if (!pac) return;

  clearAllErrors('form-paciente');
  document.getElementById('form-paciente')?.reset();
  document.getElementById('modal-pac-title').textContent = 'Editar Paciente';

  setValue('pac-codigo-edit', pac.id);
  setValue('pac-codigo', pac.codigo);
  setValue('pac-nombres', pac.nombres);
  setValue('pac-apellidos', pac.apellidos);
  setValue('pac-tipo-doc', pac.tipoDoc || 'DNI');
  setValue('pac-doc', pac.documento);
  setValue('pac-nacimiento', pac.fechaNacimiento || '');
  setValue('pac-telefono', pac.telefono);
  setValue('pac-email', pac.correo || '');
  setValue('pac-direccion', pac.direccion || '');
  setValue('pac-emerg-nombre', pac.contactoEmerg?.nombre || '');
  setValue('pac-emerg-parentesco', pac.contactoEmerg?.parentesco || '');
  setValue('pac-emerg-tel', pac.contactoEmerg?.telefono || '');

  resetAlergiasUI();
  const valoresBase = ['Ninguna', 'Penicilina', 'Ibuprofeno', 'Paracetamol', 'Mariscos', 'Lactosa', 'Polen'];
  const alergias = Array.isArray(pac.alergias) ? pac.alergias : [];
  alergias.forEach(alergia => {
    const base = document.querySelector(`.alergia-pill input[value="${cssEscape(alergia)}"]`);
    if (base) {
      base.checked = true;
    } else if (alergia && !valoresBase.includes(alergia)) {
      const otro = document.querySelector('.alergia-pill input[value="Otro"]');
      if (otro) otro.checked = true;
      setValue('pac-alergia-otro', alergia);
    }
  });

  onTipoDocChange();
  onNacimientoChange();
  updateAlergiasUI();
  openModal('modal-nuevo');
}

function setValue(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value ?? '';
}

function cssEscape(value) {
  if (window.CSS?.escape) return CSS.escape(value);
  return String(value).replace(/["\\]/g, '\\$&');
}

function onTipoDocChange() {
  const tipo = document.getElementById('pac-tipo-doc')?.value || '';
  const doc = document.getElementById('pac-doc');
  const hint = document.getElementById('doc-hint');
  if (!doc || !hint) return;

  if (tipo === 'DNI') {
    doc.maxLength = 8;
    hint.textContent = 'Debe tener 8 digitos';
  } else if (tipo === 'Pasaporte') {
    doc.maxLength = 12;
    hint.textContent = 'Ingresa de 6 a 12 caracteres';
  } else if (tipo === 'Carnet de extranjeria') {
    doc.maxLength = 12;
    hint.textContent = 'Ingresa de 9 a 12 caracteres';
  } else {
    doc.maxLength = 15;
    hint.textContent = 'Seleccione el tipo de documento primero';
  }
}

function onNacimientoChange() {
  const fecha = document.getElementById('pac-nacimiento')?.value;
  const edad = calcAge(fecha);
  const display = document.getElementById('pac-edad-display');
  const bloqueApoderado = document.getElementById('bloque-apoderado');

  if (display) display.textContent = edad === null ? '-' : `${edad} anios`;
  if (bloqueApoderado) bloqueApoderado.style.display = isMinor(fecha) ? 'block' : 'none';
}

function onAlergiaChange(changed) {
  if (changed?.value === 'Ninguna' && changed.checked) {
    document.querySelectorAll('.alergia-pill input[type="checkbox"]').forEach(cb => {
      if (cb.value !== 'Ninguna') cb.checked = false;
    });
  }

  if (changed?.value !== 'Ninguna' && changed?.checked) {
    const ninguna = document.querySelector('.alergia-pill input[value="Ninguna"]');
    if (ninguna) ninguna.checked = false;
  }

  updateAlergiasUI();
}

function resetAlergiasUI() {
  document.querySelectorAll('.alergia-pill input[type="checkbox"]').forEach(cb => { cb.checked = false; });
  setValue('pac-alergia-otro', '');
  updateAlergiasUI();
}

function updateAlergiasUI() {
  const checks = [...document.querySelectorAll('.alergia-pill input[type="checkbox"]:checked')];
  const otro = checks.some(cb => cb.value === 'Otro');
  const bloqueOtro = document.getElementById('bloque-otro-alergia');
  const resumen = document.getElementById('alergias-resumen');
  const resumenTexto = document.getElementById('alergias-resumen-texto');

  if (bloqueOtro) bloqueOtro.style.display = otro ? 'block' : 'none';
  if (resumen && resumenTexto) {
    const valores = getAlergiasSeleccionadas(false);
    resumen.style.display = valores.length ? 'block' : 'none';
    resumenTexto.textContent = valores.join(', ');
  }
}

function getAlergiasSeleccionadas(includeOtro = true) {
  const checks = [...document.querySelectorAll('.alergia-pill input[type="checkbox"]:checked')];
  const valores = checks.map(cb => cb.value).filter(v => v !== 'Otro');
  const otroChecked = checks.some(cb => cb.value === 'Otro');
  const otroTexto = document.getElementById('pac-alergia-otro')?.value?.trim();
  if (includeOtro && otroChecked && otroTexto) valores.push(otroTexto);
  if (!includeOtro && otroChecked) valores.push(otroTexto || 'Otro');
  return valores;
}

async function guardarPaciente() {
  if (!validarFormPaciente()) return;

  const editId = document.getElementById('pac-codigo-edit')?.value || '';
  const payload = {
    codigo: document.getElementById('pac-codigo')?.value || generarCodigoPaciente(editId),
    nombres: document.getElementById('pac-nombres').value.trim(),
    apellidos: document.getElementById('pac-apellidos').value.trim(),
    tipo_documento: document.getElementById('pac-tipo-doc').value,
    documento: document.getElementById('pac-doc').value.trim(),
    fecha_nacimiento: document.getElementById('pac-nacimiento').value,
    telefono: document.getElementById('pac-telefono').value.trim(),
    correo: document.getElementById('pac-email')?.value?.trim() || null,
    direccion: document.getElementById('pac-direccion')?.value?.trim() || null,
    alergias: getAlergiasSeleccionadas(true),
    contacto_emergencia_nombre: document.getElementById('pac-emerg-nombre').value.trim(),
    contacto_emergencia_parentesco: document.getElementById('pac-emerg-parentesco').value,
    contacto_emergencia_telefono: document.getElementById('pac-emerg-tel').value.trim(),
  };

  try {
    let saved;
    if (editId) {
      [saved] = await sbFetch(`pacientes?id=eq.${encodeURIComponent(editId)}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
    } else {
      [saved] = await sbFetch('pacientes', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
    }

    await getPacientesCache(true);
    closeModal('modal-nuevo');
    renderStats();
    renderTable();
    renderRecientes();
    showToast(editId ? 'Paciente actualizado' : 'Paciente registrado', 'success');
    if (saved?.id) seleccionarPaciente(saved.id);
  } catch (e) {
    showToast('Error al guardar paciente: ' + e.message, 'error');
    console.error(e);
  }
}

function validarFormPaciente() {
  let ok = true;
  clearAllErrors('form-paciente');

  const required = [
    ['pac-nombres', 'Ingresa los nombres'],
    ['pac-apellidos', 'Ingresa los apellidos'],
    ['pac-tipo-doc', 'Selecciona el tipo de documento'],
    ['pac-doc', 'Ingresa el numero de documento'],
    ['pac-nacimiento', 'Ingresa la fecha de nacimiento'],
    ['pac-telefono', 'Ingresa el telefono'],
    ['pac-emerg-nombre', 'Ingresa el contacto de emergencia'],
    ['pac-emerg-parentesco', 'Selecciona el parentesco'],
    ['pac-emerg-tel', 'Ingresa el telefono de emergencia'],
  ];

  required.forEach(([id, msg]) => {
    const val = document.getElementById(id)?.value?.trim();
    if (!val) { showFieldError(id, msg); ok = false; }
  });

  const tipoDoc = document.getElementById('pac-tipo-doc')?.value;
  const doc = document.getElementById('pac-doc')?.value?.trim();
  if (tipoDoc === 'DNI' && doc && !/^\d{8}$/.test(doc)) {
    showFieldError('pac-doc', 'El DNI debe tener 8 digitos');
    ok = false;
  }
  if (tipoDoc && tipoDoc !== 'DNI' && doc && doc.length < 6) {
    showFieldError('pac-doc', 'El documento debe tener al menos 6 caracteres');
    ok = false;
  }

  const fecha = document.getElementById('pac-nacimiento')?.value;
  if (fecha && new Date(fecha + 'T00:00:00') > new Date()) {
    showFieldError('pac-nacimiento', 'La fecha no puede ser futura');
    ok = false;
  }

  const tel = document.getElementById('pac-telefono')?.value?.trim();
  if (tel && !/^\d{9}$/.test(tel)) {
    showFieldError('pac-telefono', 'El telefono debe tener 9 digitos');
    ok = false;
  }

  const telEmerg = document.getElementById('pac-emerg-tel')?.value?.trim();
  if (telEmerg && !/^\d{9}$/.test(telEmerg)) {
    showFieldError('pac-emerg-tel', 'El telefono debe tener 9 digitos');
    ok = false;
  }

  const email = document.getElementById('pac-email')?.value?.trim();
  if (email && !Validate.email(email)) {
    showFieldError('pac-email', 'Ingresa un correo valido');
    ok = false;
  }

  const alergias = getAlergiasSeleccionadas(true);
  const otroChecked = document.querySelector('.alergia-pill input[value="Otro"]')?.checked;
  if (!alergias.length && !otroChecked) {
    showFieldError('alergias', 'Selecciona al menos una opcion');
    ok = false;
  }
  if (otroChecked && !document.getElementById('pac-alergia-otro')?.value?.trim()) {
    showFieldError('pac-alergia-otro', 'Especifica la alergia');
    ok = false;
  }

  if (isMinor(fecha)) {
    if (!document.getElementById('pac-apoderado')?.value?.trim()) {
      showFieldError('pac-apoderado', 'Ingresa el nombre del apoderado');
      ok = false;
    }
    if (!document.getElementById('pac-parentesco-apoderado')?.value) {
      showFieldError('pac-parentesco-apoderado', 'Selecciona el parentesco');
      ok = false;
    }
  }

  return ok;
}

async function pedirEliminar(pacId) {
  const pac = getPacienteLocal(pacId);
  if (!pac) return;
  if (!confirm(`Eliminar a ${pac.nombres} ${pac.apellidos}?`)) return;

  try {
    await sbFetch(`pacientes?id=eq.${encodeURIComponent(pacId)}`, { method: 'DELETE' });
    await getPacientesCache(true);
    renderStats();
    renderTable();
    renderRecientes();
    closeModal('modal-detalle');
    showToast('Paciente eliminado', 'warn');
  } catch (e) {
    showToast('Error al eliminar paciente: ' + e.message, 'error');
    console.error(e);
  }
}
