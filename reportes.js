// ─── Estado global del reporte ───────────────────────────
let periodoActivo = 'mes';
let fechaDesde = null;
let fechaHasta = null;

// Datos cargados desde Supabase
let _rCitas     = [];
let _rPacientes = [];
let _rHistorial = [];

document.addEventListener('DOMContentLoaded', async () => {
  initPeriodo();
  await cargarDatos();
  generarReporte();
});

async function cargarDatos() {
  try {
    [_rCitas, _rPacientes, _rHistorial] = await Promise.all([
      getCitasCache(),
      getPacientesCache(),
      getHistorialCache(),
    ]);
  } catch (e) {
    console.error('Error cargando datos para reportes:', e);
    showToast('Error al cargar datos', 'error');
  }
}

function initPeriodo() {
  const hoy   = new Date();
  const desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  document.getElementById('r-desde').value = desde.toISOString().split('T')[0];
  document.getElementById('r-hasta').value = hoy.toISOString().split('T')[0];
}

function setPeriodo(p, btn) {
  periodoActivo = p;
  document.querySelectorAll('.period-tab').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  const hoy = new Date();
  let desde, hasta = hoy;
  if      (p === 'hoy')    { desde = hoy; hasta = hoy; }
  else if (p === 'semana') { desde = new Date(hoy); desde.setDate(desde.getDate() - 6); }
  else if (p === 'mes')    { desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1); }
  else                     { desde = null; hasta = null; }
  fechaDesde = desde ? desde.toISOString().split('T')[0] : null;
  fechaHasta = hasta ? hasta.toISOString().split('T')[0] : null;
  if (desde) document.getElementById('r-desde').value = fechaDesde;
  if (hasta) document.getElementById('r-hasta').value = fechaHasta;
  generarReporte();
}

function aplicarFiltroFecha() {
  fechaDesde = document.getElementById('r-desde').value || null;
  fechaHasta = document.getElementById('r-hasta').value || null;
  generarReporte();
}

function getCitasFiltradas() {
  return _rCitas.filter(c => {
    if (periodoActivo === 'todo') return true;
    if (fechaDesde && c.fecha < fechaDesde) return false;
    if (fechaHasta && c.fecha > fechaHasta) return false;
    return true;
  });
}

function generarReporte() {
  const citas = getCitasFiltradas();
  const hist  = _rHistorial;
  const pacs  = _rPacientes;

  // KPI
  document.getElementById('kpi-pacs').textContent        = pacs.length;
  document.getElementById('kpi-atendidas').textContent   = citas.filter(c => c.estado === 'Atendida').length;
  document.getElementById('kpi-programadas').textContent = citas.filter(c => ['Programada', 'Confirmada'].includes(c.estado)).length;
  document.getElementById('kpi-canceladas').textContent  = citas.filter(c => ['Cancelada', 'No asistió'].includes(c.estado)).length;
  document.getElementById('kpi-hist').textContent        = hist.length;

  renderBarChart('chart-especialidades', contarPor(citas, 'especialidad'), '#1565C0');
  renderDonut('donut-svg', 'donut-legend', contarPor(citas, 'estado'), [
    '#1565C0', '#10B981', '#06B6D4', '#F59E0B', '#6366F1', '#EF4444', '#94A3B8'
  ]);
  renderRanking('chart-medicos', contarPor(citas.filter(c => c.estado === 'Atendida'), 'medico'));
  renderBarChart('chart-prioridades', contarPor(citas, 'prioridad'),
    { Urgente: '#EF4444', Preferencial: '#F59E0B', Normal: '#1565C0' });
  renderTopPacientes('chart-top-pacs', citas, pacs);
  renderAlergiasChart('chart-alergias', pacs);
  renderTablaDetalle();
}

// Botón actualizar recarga datos desde Supabase
async function actualizarReporte() {
  await cargarDatos();
  generarReporte();
  showToast('Datos actualizados', 'success');
}

// ─── Helpers de conteo ─────────────────────────────────────────
function contarPor(arr, campo) {
  const m = {};
  arr.forEach(x => { const v = x[campo] || 'Sin dato'; m[v] = (m[v] || 0) + 1; });
  return Object.entries(m).sort((a, b) => b[1] - a[1]);
}

// ─── Bar chart manual ─────────────────────────────────────────
function renderBarChart(containerId, data, color = '#1565C0') {
  const el = document.getElementById(containerId);
  if (!data.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">📊</div><div class="empty-sub">Sin datos</div></div>';
    return;
  }
  const max    = Math.max(...data.map(d => d[1]));
  const colors = typeof color === 'object' ? color : null;
  el.innerHTML = data.slice(0, 8).map(([label, val]) => {
    const pct = max > 0 ? (val / max * 100).toFixed(1) : 0;
    const c   = colors ? (colors[label] || '#1565C0') : color;
    return `<div class="bar-row">
      <div class="bar-label" title="${label}">${label.length > 18 ? label.slice(0, 17) + '…' : label}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%;background:${c}"></div></div>
      <div class="bar-val">${val}</div>
    </div>`;
  }).join('');
}

// ─── Donut SVG ─────────────────────────────────────────────────
function renderDonut(svgId, legendId, data, colors) {
  const svgEl    = document.getElementById(svgId);
  const legendEl = document.getElementById(legendId);
  if (!data.length) {
    svgEl.innerHTML = '<div class="empty-icon" style="font-size:2rem;opacity:.3">📊</div>';
    legendEl.innerHTML = '';
    return;
  }
  const total = data.reduce((s, [, v]) => s + v, 0);
  if (!total) {
    svgEl.innerHTML = '';
    legendEl.innerHTML = '<div style="font-size:.75rem;color:var(--gray-400)">Sin datos</div>';
    return;
  }
  const R = 60, cx = 70, cy = 70, strokeW = 22;
  const circ = 2 * Math.PI * R;
  let offset = 0, paths = '';
  data.forEach(([label, val], i) => {
    const pct    = val / total;
    const dash   = (pct * circ).toFixed(2);
    const gap    = (circ - pct * circ).toFixed(2);
    const rotate = (offset / total * 360 - 90).toFixed(2);
    paths += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="none"
      stroke="${colors[i % colors.length]}" stroke-width="${strokeW}"
      stroke-dasharray="${dash} ${gap}"
      transform="rotate(${rotate} ${cx} ${cy})"/>`;
    offset += val;
  });
  svgEl.innerHTML = `<svg width="140" height="140" viewBox="0 0 140 140">
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="none" stroke="var(--gray-100)" stroke-width="${strokeW}"/>
    ${paths}
    <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="18" font-weight="800" fill="var(--gray-900)">${total}</text>
    <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="9" fill="var(--gray-400)">TOTAL</text>
  </svg>`;
  legendEl.innerHTML = data.slice(0, 7).map(([label, val], i) => `
    <div class="legend-item">
      <div class="legend-dot" style="background:${colors[i % colors.length]}"></div>
      <span class="legend-label">${label.length > 20 ? label.slice(0, 19) + '…' : label}</span>
      <span class="legend-val">${val}</span>
    </div>`).join('');
}

// ─── Ranking médicos ───────────────────────────────────────────
function renderRanking(containerId, data) {
  const el = document.getElementById(containerId);
  if (!data.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">👨‍⚕️</div><div class="empty-sub">Sin atenciones registradas</div></div>';
    return;
  }
  const posClasses = ['gold', 'silver', 'bronze'];
  el.innerHTML = data.slice(0, 8).map(([label, val], i) => `
    <div class="rank-item">
      <div class="rank-pos ${posClasses[i] || ''}">${i + 1}</div>
      <div class="rank-name">${label}</div>
      <div class="rank-val">${val} consulta${val !== 1 ? 's' : ''}</div>
    </div>`).join('');
}

// ─── Top pacientes ─────────────────────────────────────────────
function renderTopPacientes(containerId, citas, pacs) {
  const el  = document.getElementById(containerId);
  const map = {};
  citas.filter(c => c.estado === 'Atendida').forEach(c => { map[c.paciente] = (map[c.paciente] || 0) + 1; });
  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (!sorted.length) {
    el.innerHTML = '<div class="empty-state"><div class="empty-icon">👥</div><div class="empty-sub">Sin datos</div></div>';
    return;
  }
  const posClasses = ['gold', 'silver', 'bronze'];
  el.innerHTML = sorted.map(([cod, val], i) => {
    const pac    = pacs.find(p => String(p.id) === String(cod) || String(p.codigo) === String(cod));
    const nombre = pac ? `${pac.nombres} ${pac.apellidos}` : 'Paciente eliminado';
    return `<div class="rank-item">
      <div class="rank-pos ${posClasses[i] || ''}">${i + 1}</div>
      <div class="rank-name">${nombre}</div>
      <div class="rank-val">${val} consulta${val !== 1 ? 's' : ''}</div>
    </div>`;
  }).join('');
}

// ─── Alergias ──────────────────────────────────────────────────
function renderAlergiasChart(containerId, pacs) {
  const map = {};
  pacs.forEach(p => {
    (p.alergias || []).forEach(a => {
      if (a !== 'Ninguna' && a) {
        const k = a.startsWith('Otro:') ? 'Otro' : a;
        map[k] = (map[k] || 0) + 1;
      }
    });
  });
  const data   = Object.entries(map).sort((a, b) => b[1] - a[1]);
  const colors = ['#1565C0', '#EF4444', '#F59E0B', '#10B981', '#06B6D4', '#6366F1', '#EC4899'];
  renderBarChart(containerId, data, Object.fromEntries(data.map(([k], i) => [k, colors[i % colors.length]])));
}

// ─── Tabla detalle ─────────────────────────────────────────────
function renderTablaDetalle() {
  const q   = (document.getElementById('r-buscar').value || '').toLowerCase();
  const fE  = document.getElementById('r-estado-tabla').value;
  const citas = getCitasFiltradas().filter(c => {
    const pac    = getPacienteLocal(c.paciente);
    const nombre = pac ? `${pac.nombres} ${pac.apellidos}`.toLowerCase() : '';
    if (q && !nombre.includes(q) && !(c.codigo || '').toLowerCase().includes(q) && !(c.medico || '').toLowerCase().includes(q)) return false;
    if (fE && c.estado !== fE) return false;
    return true;
  }).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));

  const tbody = document.getElementById('tbody-reporte');
  if (!citas.length) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:2rem;color:var(--gray-400)">Sin resultados</td></tr>`;
    return;
  }
  tbody.innerHTML = citas.map(c => {
    const pac      = getPacienteLocal(c.paciente);
    const nombre   = pac ? `${pac.nombres} ${pac.apellidos}` : '—';
    const estClass = c.estado === 'En espera'   ? 'espera'
                   : c.estado === 'En atención' ? 'atencion'
                   : c.estado === 'No asistió'  ? 'noasistio'
                   : (c.estado || '').toLowerCase().replace(' ', '');
    return `<tr>
      <td class="td-code">${c.codigo}</td>
      <td class="td-main">${nombre}</td>
      <td>${c.medico}</td>
      <td>${c.especialidad}</td>
      <td>${formatDate(c.fecha)}</td>
      <td>${c.hora}</td>
      <td><span class="badge badge-${estClass}">${c.estado}</span></td>
      <td><span class="badge badge-${(c.prioridad || 'normal').toLowerCase()}">${c.prioridad}</span></td>
    </tr>`;
  }).join('');
}

// ─── Exportar CSV ──────────────────────────────────────────────
function exportarCSV() {
  const citas  = getCitasFiltradas();
  const pacs   = _rPacientes;
  const header = ['Código', 'Paciente', 'DNI', 'Médico', 'Especialidad', 'Fecha', 'Hora', 'Estado', 'Prioridad', 'Motivo'];
  const rows   = citas.map(c => {
    const pac    = pacs.find(p => String(p.id) === String(c.paciente) || String(p.codigo) === String(c.paciente));
    const nombre = pac ? `${pac.nombres} ${pac.apellidos}` : '—';
    const dni    = pac?.documento || '—';
    return [c.codigo, nombre, dni, c.medico, c.especialidad, c.fecha, c.hora, c.estado, c.prioridad, `"${(c.motivo || '').replace(/"/g, "'")}"`];
  });
  const csv  = [header, ...rows].map(r => r.join(',')).join('\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url;
  a.download = `medicore_reporte_${todayStr()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Reporte CSV exportado exitosamente', 'success');
}