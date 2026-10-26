const $ = (id) => document.getElementById(id);
const fileInput = $('file-input');
const dropZone = $('drop-zone');
const uploadEmpty = $('upload-empty');
const previewWrap = $('preview-wrap');
const preview = $('image-preview');
const analyzeButton = $('analyze-button');
const clearButton = $('clear-button');
const uploadError = $('upload-error');
const reportContent = $('report-content');
let selectedFile = null;
let selectedKind = 'photo';
let previewUrl = null;
let busy = false;

async function checkMode() {
  const dot = $('mode-dot');
  const label = $('mode-text');
  try {
    const response = await fetch('/api/health');
    const data = await response.json();
    if (data.mode === 'ai') {
      dot.className = 'mode-dot ai';
      label.textContent = `AI mode · ${data.model}`;
    } else {
      dot.className = 'mode-dot demo';
      label.textContent = 'Demo mode · no API key configured';
    }
  } catch {
    dot.className = 'mode-dot demo';
    label.textContent = 'Server unavailable · start the local server';
  }
}
checkMode();

document.querySelectorAll('.type-option').forEach((button) => {
  button.addEventListener('click', () => {
    selectedKind = button.dataset.kind;
    document.querySelectorAll('.type-option').forEach((item) => {
      const selected = item === button;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-pressed', String(selected));
    });
  });
});

function showError(message) {
  uploadError.textContent = message;
  uploadError.hidden = !message;
}
function resetReport() {
  $('results-empty').hidden = false;
  $('loading-state').hidden = true;
  reportContent.hidden = true;
  reportContent.replaceChildren();
  $('report-state').textContent = 'WAITING';
  $('report-state').classList.remove('ready');
}
function clearImage() {
  selectedFile = null;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  preview.removeAttribute('src');
  fileInput.value = '';
  uploadEmpty.hidden = false;
  previewWrap.hidden = true;
  analyzeButton.disabled = true;
  clearButton.disabled = true;
  showError('');
  resetReport();
}
function chooseFile(file) {
  if (!file) return;
  showError('');
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(file.type)) {
    showError('Please choose a JPG, PNG, or WebP image.');
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    showError('That image is too large. Please choose an image smaller than 8 MB.');
    return;
  }
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  selectedFile = file;
  previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl;
  $('file-name').textContent = file.name;
  uploadEmpty.hidden = true;
  previewWrap.hidden = false;
  analyzeButton.disabled = false;
  clearButton.disabled = false;
  resetReport();
}
fileInput.addEventListener('change', () => chooseFile(fileInput.files?.[0]));
dropZone.addEventListener('click', (event) => {
  if (event.target.closest('#replace-button')) return;
  fileInput.click();
});
dropZone.addEventListener('keydown', (event) => {
  if (event.target !== dropZone) return;
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    fileInput.click();
  }
});
$('replace-button').addEventListener('click', (event) => {
  event.stopPropagation();
  fileInput.click();
});
$('clear-button').addEventListener('click', clearImage);
for (const eventName of ['dragenter', 'dragover']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add('dragover');
  });
}
for (const eventName of ['dragleave', 'drop']) {
  dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove('dragover');
  });
}
dropZone.addEventListener('drop', (event) => chooseFile(event.dataTransfer?.files?.[0]));

function make(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = String(text);
  return element;
}
function reportItem(title, detail) {
  const item = make('div', 'report-item');
  item.append(make('strong', '', title || 'Observation'));
  item.append(make('p', '', detail || 'No additional details provided.'));
  return item;
}
function renderReport(report, mode, model) {
  reportContent.replaceChildren();
  const summary = make('div', 'report-summary');
  summary.append(make('div', 'summary-kicker', mode === 'demo' ? 'DEMONSTRATION MODE' : 'EDUCATIONAL OBSERVATION'));
  summary.append(make('h4', '', report.quality?.rating || 'Image review'));
  summary.append(make('p', '', report.quality?.reason || 'Image quality could not be described.'));
  reportContent.append(summary);

  const sections = [
    ['Visible observations', report.observations, 'No specific visible observations were returned. This does not mean the teeth are healthy.'],
    ['Possible concerns to discuss', report.possibleConcerns, 'No specific concern was identified by this response. AI can miss problems, so this does not rule anything out.']
  ];
  for (const [heading, items, emptyText] of sections) {
    const section = make('section', 'report-section');
    section.append(make('h5', '', heading));
    if (Array.isArray(items) && items.length) {
      items.slice(0, 5).forEach((item) => section.append(reportItem(item.title, item.detail)));
    } else {
      section.append(make('div', 'report-empty', emptyText));
    }
    reportContent.append(section);
  }
  const next = make('section', 'report-section');
  next.append(make('h5', '', 'Educational next steps'));
  const nextList = make('ul', 'report-bullets');
  (Array.isArray(report.nextSteps) ? report.nextSteps : []).slice(0, 5).forEach((text) => nextList.append(make('li', '', text)));
  if (!nextList.children.length) nextList.append(make('li', '', 'Ask a dentist for advice about any concern.'));
  next.append(nextList);
  reportContent.append(next);

  const limits = make('section', 'report-section');
  limits.append(make('h5', '', 'Limitations to remember'));
  const limitsList = make('ul', 'report-bullets');
  const limitationItems = Array.isArray(report.limitations) ? report.limitations : [];
  [...limitationItems, 'This AI output is not a diagnosis and may be wrong.'].slice(0, 5).forEach((text) => limitsList.append(make('li', '', text)));
  limits.append(limitsList);
  reportContent.append(limits);

  const footer = make('div', 'report-footer');
  footer.append(make('span', '', mode === 'demo' ? 'Demo placeholder · no image analysis' : `Model: ${model || 'Gemini vision model'}`));
  footer.append(make('span', '', 'No medical confidence score'));
  reportContent.append(footer);

  $('results-empty').hidden = true;
  $('loading-state').hidden = true;
  reportContent.hidden = false;
  $('report-state').textContent = 'REPORT READY';
  $('report-state').classList.add('ready');
}
analyzeButton.addEventListener('click', async () => {
  if (!selectedFile || busy) return;
  busy = true;
  analyzeButton.disabled = true;
  clearButton.disabled = true;
  showError('');
  $('results-empty').hidden = true;
  reportContent.hidden = true;
  $('loading-state').hidden = false;
  $('report-state').textContent = 'ANALYZING';
  $('report-state').classList.remove('ready');
  const formData = new FormData();
  formData.append('image', selectedFile);
  formData.append('imageKind', selectedKind);
  try {
    const response = await fetch('/api/analyze', { method: 'POST', body: formData });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'The analysis request failed. Please try again.');
    renderReport(data.report, data.mode, data.model);
  } catch (error) {
    $('loading-state').hidden = true;
    $('results-empty').hidden = false;
    $('results-title').textContent = 'Your exploration report';
    $('report-state').textContent = 'ERROR';
    showError(error.message || 'Could not connect to the server. Is it running?');
  } finally {
    busy = false;
    analyzeButton.disabled = !selectedFile;
    clearButton.disabled = !selectedFile;
  }
});

// Science fair observation log: session-only, manually entered, no health records.
const experimentBody = $('experiment-body');
let rowCounter = 0;
function addExperimentRow(values = {}) {
  rowCounter += 1;
  const row = document.createElement('tr');
  const idCell = document.createElement('td');
  const idInput = document.createElement('input');
  idInput.value = values.id || `IMG-${String(rowCounter).padStart(2, '0')}`;
  idInput.setAttribute('aria-label', 'Image ID');
  idCell.append(idInput);
  const referenceCell = document.createElement('td');
  const referenceInput = document.createElement('input');
  referenceInput.placeholder = 'Reference label';
  referenceInput.value = values.reference || '';
  referenceInput.setAttribute('aria-label', 'Reference label');
  referenceCell.append(referenceInput);
  const observationCell = document.createElement('td');
  const observationInput = document.createElement('input');
  observationInput.placeholder = 'AI observation';
  observationInput.value = values.observation || '';
  observationInput.setAttribute('aria-label', 'AI observation');
  observationCell.append(observationInput);
  const matchCell = document.createElement('td');
  const matchSelect = document.createElement('select');
  matchSelect.setAttribute('aria-label', 'Whether reference and observation match');
  [['na', 'Not assessed'], ['yes', 'Yes'], ['no', 'No']].forEach(([value, label]) => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = label;
    matchSelect.append(option);
  });
  matchSelect.value = values.match || 'na';
  matchCell.append(matchSelect);
  const deleteCell = document.createElement('td');
  const deleteButton = make('button', 'row-delete', '×');
  deleteButton.type = 'button';
  deleteButton.setAttribute('aria-label', 'Delete this record');
  deleteButton.addEventListener('click', () => { row.remove(); updateExperimentStats(); });
  deleteCell.append(deleteButton);
  row.append(idCell, referenceCell, observationCell, matchCell, deleteCell);
  row.querySelectorAll('input,select').forEach((control) => control.addEventListener('input', updateExperimentStats));
  experimentBody.append(row);
  updateExperimentStats();
}
function updateExperimentStats() {
  const rows = [...experimentBody.querySelectorAll('tr')];
  const assessed = rows.map((row) => row.cells[3].querySelector('select').value).filter((v) => v === 'yes' || v === 'no');
  const matches = assessed.filter((v) => v === 'yes').length;
  $('experiment-count').textContent = `${rows.length} record${rows.length === 1 ? '' : 's'}`;
  $('experiment-score').textContent = assessed.length ? `Match rate: ${Math.round(matches / assessed.length * 100)}% (${matches}/${assessed.length})` : 'Match rate: —';
}
$('add-row').addEventListener('click', () => addExperimentRow());
$('export-csv').addEventListener('click', () => {
  const rows = [['Image ID', 'Reference label', 'AI observation', 'Match?']];
  [...experimentBody.querySelectorAll('tr')].forEach((row) => {
    rows.push([
      row.cells[0].querySelector('input').value,
      row.cells[1].querySelector('input').value,
      row.cells[2].querySelector('input').value,
      row.cells[3].querySelector('select').selectedOptions[0].textContent
    ]);
  });
  const csv = rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'smilescan-observation-log.csv';
  link.click();
  URL.revokeObjectURL(url);
});
addExperimentRow();
addExperimentRow();
addExperimentRow();
