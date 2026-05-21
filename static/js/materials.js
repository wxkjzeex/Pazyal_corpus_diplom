// ============================================
// js/materials.js — Финальная версия
// ============================================

const API_URL = '/api';

let materialsData = [];
let filteredData = [];
let currentPage = 1;
let audioObjectURL = null;
const itemsPerPage = 6;
let isTranscribing = false;


// ============================================
// ИНИЦИАЛИЗАЦИЯ
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 Страница материалов загружена');
    initAudioPreview();
    initTranscriptionHandlers();
    loadMaterials();
    loadStats();
    initEventListeners();
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeAudioPlayer();
        const detailModal = document.getElementById('detailModal');
        if (detailModal) detailModal.remove();
    }
});


// ============================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================

function initEventListeners() {
    console.log('🔧 Инициализация обработчиков...');

    const showFormBtn = document.getElementById('showAddFormBtn');
    if (showFormBtn) {
        showFormBtn.addEventListener('click', function(e) {
            e.preventDefault();
            resetFormState();
            showAddForm();
        });
    }

    const emptyAddBtn = document.getElementById('emptyAddBtn');
    if (emptyAddBtn) {
        emptyAddBtn.addEventListener('click', function(e) {
            e.preventDefault();
            resetFormState();
            showAddForm();
        });
    }

    const closeFormBtn = document.getElementById('closeFormBtn');
    if (closeFormBtn) closeFormBtn.addEventListener('click', hideAddForm);

    const cancelFormBtn = document.getElementById('cancelFormBtn');
    if (cancelFormBtn) cancelFormBtn.addEventListener('click', hideAddForm);

    const addForm = document.getElementById('addMaterialForm');
    if (addForm) addForm.addEventListener('submit', handleFormSubmit);

    const searchInput = document.getElementById('searchInput');
    if (searchInput) searchInput.addEventListener('input', handleSearch);

    const genderFilter = document.getElementById('genderFilter');
    const ageFilter = document.getElementById('ageFilter');
    const educationFilter = document.getElementById('educationFilter');
    if (genderFilter) genderFilter.addEventListener('change', handleFilters);
    if (ageFilter) ageFilter.addEventListener('change', handleFilters);
    if (educationFilter) educationFilter.addEventListener('change', handleFilters);

    const resetBtn = document.getElementById('resetFiltersBtn');
    if (resetBtn) resetBtn.addEventListener('click', resetFilters);

    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');
    if (prevPage) prevPage.addEventListener('click', () => changePage(-1));
    if (nextPage) nextPage.addEventListener('click', () => changePage(1));

    console.log('✅ Обработчики инициализированы');
}


// ============================================
// ЗАГРУЗКА ДАННЫХ
// ============================================

async function loadMaterials() {
    try {
        console.log('📥 Загрузка материалов...');
        const response = await fetch(`${API_URL}/materials`);
        const result = await response.json();

        if (result.success) {
            materialsData = result.data;
            filteredData = [...materialsData];
            console.log(`✅ Загружено ${materialsData.length} материалов`);
            renderMaterials();
        } else {
            console.error('Ошибка загрузки:', result.error);
        }
    } catch (error) {
        console.error('Ошибка подключения:', error);
        loadDemoData();
    }
}

async function loadStats() {
    try {
        const response = await fetch(`${API_URL}/materials/stats`);
        const result = await response.json();

        if (result.success) {
            document.getElementById('totalRecords').textContent = result.data.totalRecords || 0;
            document.getElementById('totalInformants').textContent = result.data.totalInformants || 0;
            document.getElementById('avgAge').textContent = result.data.avgAge || 0;
            document.getElementById('totalDuration').textContent = result.data.totalDuration || '0:00';
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики:', error);
    }
}

function loadDemoData() {
    console.log('📦 Загрузка демо-данных...');
    materialsData = [
        {
            id: 1,
            informant: { age: 67, gender: 'женский', education: 'среднее', nativeLanguage: 'удмуртский', russianLevel: 'свободное владение' },
            record: { date: '2024-03-15', location: 'д. Пазял, дом информанта', topic: 'Воспоминания о детстве', duration: '30:15' },
            transcription: { preview: 'Ну, я вам расскажу про нашу деревню...', full: '[00:00] Информант: Ну, я вам расскажу...' },
            media: { hasAudio: true, hasVideo: false },
            metadata: { equipment: 'Диктофон Zoom H4n', noiseLevel: 'низкий', transcriber: 'А.В. Чирков' }
        }
    ];
    filteredData = [...materialsData];
    renderMaterials();
}


// ============================================
// ФОРМА ДОБАВЛЕНИЯ
// ============================================

function showAddForm() {
    const formSection = document.getElementById('addMaterialSection');
    if (formSection) {
        formSection.style.display = 'block';
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

function hideAddForm() {
    const formSection = document.getElementById('addMaterialSection');
    if (formSection) {
        formSection.style.display = 'none';
        document.getElementById('addMaterialForm').reset();
        document.getElementById('audioPreview').style.display = 'none';
        document.getElementById('videoPreview').style.display = 'none';
        document.getElementById('liveTranscript').style.display = 'none';
    }
}

function resetFormState() {
    const form = document.getElementById('addMaterialForm');
    form.reset();
    delete form.dataset.editId;
    document.querySelector('#addMaterialSection .section-header h3').textContent = '➕ Добавление нового материала';
    document.querySelector('#addMaterialForm button[type="submit"]').textContent = '💾 Сохранить материал';
    document.getElementById('audioPreview').style.display = 'none';
    document.getElementById('videoPreview').style.display = 'none';
    document.getElementById('liveTranscript').style.display = 'none';
    document.getElementById('transcribeStatus').textContent = '';
}

async function handleFormSubmit(e) {
    e.preventDefault();
    console.log('=== ОТПРАВКА ФОРМЫ ===');

    const form = e.target;
    const formData = new FormData(form);
    const editId = form.dataset.editId;

    // Проверка полей
    const fields = ['informantAge', 'informantGender', 'informantEducation', 'nativeLanguage', 'russianLevel', 'recordDate', 'recordLocation', 'recordTopic'];
    const names = ['возраст', 'пол', 'образование', 'родной язык', 'уровень русского', 'дата записи', 'место записи', 'тема'];
    const missing = [];

    fields.forEach((id, i) => {
        const el = document.getElementById(id);
        if (!el || !el.value || el.value.trim() === '') missing.push(names[i]);
    });

    if (missing.length > 0) {
        alert(`Пожалуйста, заполните обязательные поля:\n${missing.join(', ')}`);
        return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Сохранение...';
    submitBtn.disabled = true;

    try {
        let url = `${API_URL}/materials`;
        let method = 'POST';

        if (editId) {
            // Для редактирования используем POST с _method=PUT
            url = `${API_URL}/materials/${editId}`;
            formData.append('_method', 'PUT');
        }

        const response = await fetch(url, {
            method: 'POST',  // Всегда POST, сервер сам разберет по _method
            body: formData
        });

        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Сервер вернул не JSON:', text);
            throw new Error('Сервер вернул ошибку');
        }

        const result = await response.json();

        if (result.success) {
            alert(editId ? '✅ Материал обновлен!' : '✅ Материал сохранен!');
            hideAddForm();
            resetFormState();
            await loadMaterials();
            await loadStats();
        } else {
            alert(`❌ Ошибка: ${result.error}`);
        }
    } catch (error) {
        console.error('Ошибка:', error);
        alert('❌ Не удалось сохранить материал.');
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}


// ============================================
// РЕДАКТИРОВАНИЕ МАТЕРИАЛА
// ============================================

async function editMaterial(id) {
    const material = materialsData.find(m => m.id === id);
    if (!material) {
        showNotification('Материал не найден', 'error');
        return;
    }

    document.getElementById('informantAge').value = material.informant.age;
    document.getElementById('informantGender').value = material.informant.gender;
    document.getElementById('informantEducation').value = material.informant.education;
    document.getElementById('nativeLanguage').value = material.informant.nativeLanguage;
    document.getElementById('russianLevel').value = material.informant.russianLevel;
    document.getElementById('recordDate').value = material.record.date;
    document.getElementById('recordLocation').value = material.record.location;
    document.getElementById('recordTopic').value = material.record.topic;
    document.getElementById('transcription').value = material.transcription.full || '';
    document.getElementById('transcriber').value = material.metadata?.transcriber || '';
    document.getElementById('equipment').value = material.metadata?.equipment || '';
    document.getElementById('noiseLevel').value = material.metadata?.noiseLevel || 'низкий';

    document.querySelector('#addMaterialSection .section-header h3').textContent = `✏️ Редактирование #${String(id).padStart(3, '0')}`;
    document.querySelector('#addMaterialForm button[type="submit"]').textContent = '💾 Обновить материал';
    document.getElementById('addMaterialForm').dataset.editId = id;

    showAddForm();
}


// ============================================
// ТРАНСКРИБАЦИЯ
// ============================================

function initTranscriptionHandlers() {
    const transcribeBtn = document.getElementById('startTranscribeBtn');
    if (transcribeBtn) {
        transcribeBtn.addEventListener('click', transcribeAudioFile);
    }
}

async function transcribeAudioFile() {
    const audioInput = document.getElementById('audioFile');
    const transcribeBtn = document.getElementById('startTranscribeBtn');
    const statusEl = document.getElementById('transcribeStatus');
    const transcriptionField = document.getElementById('transcription');
    const transcriberField = document.getElementById('transcriber');
    const liveBlock = document.getElementById('liveTranscript');
    const liveText = document.getElementById('liveTranscriptText');

    if (!audioInput || !audioInput.files || audioInput.files.length === 0) {
        showNotification('❌ Сначала выберите аудиофайл', 'error');
        return;
    }

    const audioFile = audioInput.files[0];

    if (audioFile.size > 10 * 1024 * 1024) {
        showNotification('❌ Файл слишком большой. Максимум 10 МБ', 'error');
        return;
    }

    isTranscribing = true;
    transcribeBtn.disabled = true;
    transcribeBtn.innerHTML = '⏳ Распознавание...';

    if (statusEl) { statusEl.textContent = '🎙️ Отправка...'; statusEl.style.color = '#3498db'; }
    if (liveBlock) { liveBlock.style.display = 'block'; liveText.innerHTML = '<p style="text-align:center;color:#666;">⏳ Идет распознавание речи...</p>'; }

    try {
        const formData = new FormData();
        formData.append('audioFile', audioFile);

        const response = await fetch('/api/transcribe', { method: 'POST', body: formData });
        const result = await response.json();

        if (result.success) {
            if (transcriptionField) transcriptionField.value = result.transcript;
            if (transcriberField) transcriberField.value = result.demo ? 'Демо-режим' : `Whisper (авто)`;

            if (liveText) {
                liveText.innerHTML = `
                    <p style="color:#27ae60;">✅ Распознано ${result.fragments} фрагментов</p>
                    <p style="color:#666;">Точность: ${result.confidence}%</p>
                    ${result.demo ? '<p style="color:#e67e22;">⚠️ Демо-режим</p>' : ''}
                `;
            }
            if (statusEl) { statusEl.textContent = '✅ Готово'; statusEl.style.color = '#27ae60'; }
            showNotification('✅ Речь распознана!', 'success');
        } else {
            throw new Error(result.error || 'Ошибка');
        }
    } catch (error) {
        console.error('❌ Ошибка:', error);
        if (liveText) liveText.innerHTML = `<p style="color:#e74c3c;">❌ ${error.message}</p>`;
        if (statusEl) { statusEl.textContent = '❌ Ошибка'; statusEl.style.color = '#e74c3c'; }
        showNotification(`❌ ${error.message}`, 'error');
    } finally {
        isTranscribing = false;
        transcribeBtn.disabled = false;
        transcribeBtn.innerHTML = '🎤 Распознать речь из аудиофайла';
        setTimeout(() => { if (liveBlock && !isTranscribing) liveBlock.style.display = 'none'; }, 8000);
    }
}


// ============================================
// АУДИО/ВИДЕО ПРЕДПРОСМОТР
// ============================================

function initAudioPreview() {
    const audioInput = document.getElementById('audioFile');
    const audioPreview = document.getElementById('audioPreview');
    const audioPlayer = document.getElementById('audioPlayer');
    const audioFileName = document.getElementById('audioFileName');
    const audioFileSize = document.getElementById('audioFileSize');
    const audioPlaceholder = document.getElementById('audioPlaceholder');

    if (audioInput) {
        audioInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                if (audioObjectURL) URL.revokeObjectURL(audioObjectURL);
                audioObjectURL = URL.createObjectURL(file);
                audioPlayer.src = audioObjectURL;
                if (audioFileName) audioFileName.textContent = file.name;
                if (audioFileSize) audioFileSize.textContent = formatFileSize(file.size);
                if (audioPlaceholder) audioPlaceholder.textContent = '✅ Файл выбран';
                if (audioPreview) audioPreview.style.display = 'block';
            } else {
                if (audioPreview) audioPreview.style.display = 'none';
                if (audioPlaceholder) audioPlaceholder.textContent = 'Выберите аудиофайл (MP3, WAV)';
            }
        });
    }

    const videoInput = document.getElementById('videoFile');
    const videoPreview = document.getElementById('videoPreview');
    const videoPlayer = document.getElementById('videoPlayer');
    const videoPlaceholder = document.getElementById('videoPlaceholder');

    if (videoInput) {
        videoInput.addEventListener('change', function() {
            const file = this.files[0];
            if (file) {
                const allowed = ['mp4', 'avi', 'mov', 'mkv', 'webm'];
                const ext = file.name.split('.').pop().toLowerCase();
                if (!allowed.includes(ext)) {
                    alert('Формат не поддерживается. Используйте MP4, AVI, MOV, MKV.');
                    this.value = '';
                    return;
                }
                if (file.size > 200 * 1024 * 1024) {
                    alert('Файл слишком большой. Максимум 200 МБ.');
                    this.value = '';
                    return;
                }
                const videoURL = URL.createObjectURL(file);
                videoPlayer.src = videoURL;
                if (videoPreview) videoPreview.style.display = 'block';
                if (videoPlaceholder) videoPlaceholder.textContent = '✅ Видеофайл выбран: ' + file.name;
            } else {
                if (videoPreview) videoPreview.style.display = 'none';
                if (videoPlaceholder) videoPlaceholder.textContent = 'Выберите видеофайл (MP4, AVI, MOV, MKV)';
            }
        });
    }
}


// ============================================
// ПОИСК И ФИЛЬТРЫ
// ============================================

function handleSearch() { applyFilters(); }
function handleFilters() { applyFilters(); }

function applyFilters() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const gender = document.getElementById('genderFilter')?.value || '';
    const ageRange = document.getElementById('ageFilter')?.value || '';
    const education = document.getElementById('educationFilter')?.value || '';

    filteredData = materialsData.filter(material => {
        if (searchTerm && !material.transcription.preview.toLowerCase().includes(searchTerm) && !material.record.topic.toLowerCase().includes(searchTerm)) return false;
        if (gender && material.informant.gender !== gender) return false;
        if (ageRange) {
            const age = material.informant.age;
            if (ageRange === '18-35' && (age < 18 || age > 35)) return false;
            if (ageRange === '36-55' && (age < 36 || age > 55)) return false;
            if (ageRange === '56+' && age < 56) return false;
        }
        if (education && material.informant.education !== education) return false;
        return true;
    });

    currentPage = 1;
    renderMaterials();
    updateActiveFilters();
}

function resetFilters() {
    document.getElementById('searchInput').value = '';
    document.getElementById('genderFilter').value = '';
    document.getElementById('ageFilter').value = '';
    document.getElementById('educationFilter').value = '';
    filteredData = [...materialsData];
    currentPage = 1;
    renderMaterials();
    updateActiveFilters();
}

function updateActiveFilters() {
    const container = document.getElementById('activeFilters');
    if (!container) return;
    const searchTerm = document.getElementById('searchInput')?.value || '';
    const gender = document.getElementById('genderFilter')?.value || '';
    const ageRange = document.getElementById('ageFilter')?.value || '';
    const education = document.getElementById('educationFilter')?.value || '';
    let html = '';
    if (searchTerm) html += `<span class="filter-tag">🔍 "${searchTerm}"</span>`;
    if (gender) html += `<span class="filter-tag">👤 ${gender}</span>`;
    if (ageRange) html += `<span class="filter-tag">📅 ${ageRange}</span>`;
    if (education) html += `<span class="filter-tag">🎓 ${education}</span>`;
    container.innerHTML = html;
}


// ============================================
// ОТРИСОВКА КАРТОЧЕК
// ============================================

function renderMaterials() {
    const container = document.getElementById('materialsList');
    const emptyState = document.getElementById('emptyState');
    const pagination = document.getElementById('pagination');

    if (!container) return;

    if (filteredData.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (pagination) pagination.style.display = 'none';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
    const pageData = filteredData.slice(startIndex, endIndex);

    container.innerHTML = pageData.map(material => createMaterialCard(material)).join('');
    updatePagination(totalPages);

    document.querySelectorAll('.view-material-btn').forEach(btn => {
        btn.addEventListener('click', function() { viewMaterial(parseInt(this.dataset.id)); });
    });
}

function createMaterialCard(material) {
    const mediaIcons = [];
    if (material.media?.hasAudio) mediaIcons.push('🎵');
    if (material.media?.hasVideo) mediaIcons.push('🎥');
    if (material.transcription?.full) mediaIcons.push('📝');

    const duration = material.record.duration || '00:00';

    // Аудиоплеер
    let audioSection = '';
    if (material.media?.hasAudio) {
        const audioPath = material.media.audioPath || '';
        const audioFileName = material.media.audioFileName || 'Аудиозапись';
        const safeTopic = (material.record.topic || '').replace(/'/g, "\\'");
        const safeFileName = audioFileName.replace(/'/g, "\\'");
        audioSection = `
            <div class="card-audio-section">
                <div class="card-audio-label"><span>🎵</span><span>${audioFileName.substring(0, 30)}${audioFileName.length > 30 ? '...' : ''}</span></div>
                <button class="play-audio-btn" onclick="openAudioPlayer('${audioPath}', '${safeTopic}', '${safeFileName}')">▶ Прослушать</button>
            </div>`;
    }

    // Видеоплеер
    let videoSection = '';
    if (material.media?.hasVideo) {
        const videoPath = material.media.videoPath || '';
        const videoFileName = material.media.videoFileName || 'Видеозапись';
        const fullVideoPath = videoPath.startsWith('/') ? videoPath : '/static/' + videoPath;
        videoSection = `
            <div class="card-video-section">
                <div class="card-video-label"><span>🎥</span><span>${videoFileName.substring(0, 30)}${videoFileName.length > 30 ? '...' : ''}</span></div>
                <video controls style="width:100%;max-height:180px;border-radius:8px;">
                    <source src="${fullVideoPath}" type="video/mp4">
                </video>
            </div>`;
    }

    return `
        <div class="material-card" data-material-id="${material.id}">
            <div class="card-header">
                <div class="card-title">
                    <span class="card-id">#${String(material.id).padStart(3, '0')}</span>
                    <span class="card-date">${formatDate(material.record.date)}</span>
                </div>
                <div class="card-badges">${mediaIcons.map(icon => `<span class="badge-media">${icon}</span>`).join('')}</div>
            </div>
            <div class="card-body">
                <h4 class="card-topic">${material.record.topic}</h4>
                <div class="informant-info">
                    <span class="informant-badge">${material.informant.gender === 'женский' ? '👩' : '👨'} ${material.informant.age} лет</span>
                    <span class="informant-badge">🎓 ${material.informant.education}</span>
                    <span class="informant-badge">🗣️ ${material.informant.russianLevel}</span>
                </div>
                <div class="transcription-preview"><p>${material.transcription.preview || 'Транскрипция отсутствует'}</p></div>
                <div class="record-meta">
                    <span>📍 ${material.record.location}</span>
                    <span>⏱️ ${duration}</span>
                </div>
                ${audioSection}
                ${videoSection}
            </div>
            <div class="card-footer">
                <button class="btn-view view-material-btn" data-id="${material.id}">📖 Подробнее</button>
                <button class="btn-edit" onclick="editMaterial(${material.id})" title="Редактировать">✏️</button>
                <button class="btn-delete" onclick="deleteMaterial(${material.id})" title="Удалить">🗑️</button>
            </div>
        </div>`;
}


// ============================================
// ДЕТАЛЬНЫЙ ПРОСМОТР
// ============================================

function viewMaterial(id) {
    const material = materialsData.find(m => m.id === id);
    if (!material) { showNotification('Материал не найден', 'error'); return; }

    const formattedDate = formatDate(material.record.date);
    const audioIcon = material.media?.hasAudio ? '✅' : '❌';
    const videoIcon = material.media?.hasVideo ? '✅' : '❌';
    const transcriptionIcon = material.transcription?.full ? '✅' : '❌';

    // Аудиоплеер в модалке
    let audioHTML = '';
    if (material.media?.hasAudio) {
        const audioPath = material.media.audioPath || '';
        const fullAudioPath = audioPath.startsWith('blob:') ? audioPath : (audioPath.startsWith('/') ? audioPath : '/static/' + audioPath);
        audioHTML = `
            <div style="margin-top:20px;padding:15px;background:#f8f9fa;border-radius:12px;">
                <h4>🎵 Аудиозапись</h4>
                <p style="font-size:13px;color:#666;">📁 ${material.media.audioFileName || ''}</p>
                <audio controls style="width:100%;"><source src="${fullAudioPath}"></audio>
            </div>`;
    }

    // Видеоплеер в модалке
    let videoHTML = '';
    if (material.media?.hasVideo) {
        const videoPath = material.media.videoPath || '';
        const fullVideoPath = videoPath.startsWith('/') ? videoPath : '/static/' + videoPath;
        videoHTML = `
            <div style="margin-top:20px;padding:15px;background:#f8f9fa;border-radius:12px;">
                <h4>🎥 Видеозапись</h4>
                <p style="font-size:13px;color:#666;">📁 ${material.media.videoFileName || ''}</p>
                <video controls style="width:100%;max-height:300px;border-radius:8px;"><source src="${fullVideoPath}" type="video/mp4"></video>
            </div>`;
    }

    // Транскрипция
    let transcriptionHTML = '';
    if (material.transcription?.full) {
        transcriptionHTML = `
            <div style="margin-top:20px;padding:15px;background:#f8f9fa;border-radius:12px;">
                <h4>📝 Транскрипция</h4>
                <div style="max-height:200px;overflow-y:auto;line-height:1.8;font-size:14px;white-space:pre-wrap;">${escapeHTML(material.transcription.full)}</div>
            </div>`;
    }

    const modal = document.createElement('div');
    modal.className = 'modal-overlay detail-modal-overlay';
    modal.id = 'detailModal';
    modal.innerHTML = `
        <div class="detail-modal">
            <button class="modal-close" onclick="this.closest('.detail-modal-overlay').remove()">&times;</button>
            <div class="detail-header">
                <span class="detail-id">#${String(id).padStart(3, '0')}</span>
                <span class="detail-date">📅 ${formattedDate}</span>
            </div>
            <h3 class="detail-topic">${material.record.topic}</h3>
            <div class="detail-section">
                <h4>👤 Информант</h4>
                <div class="detail-grid">
                    <div class="detail-item"><span class="detail-label">Возраст:</span><span>${material.informant.age} лет</span></div>
                    <div class="detail-item"><span class="detail-label">Пол:</span><span>${material.informant.gender === 'женский' ? '👩 Женский' : '👨 Мужской'}</span></div>
                    <div class="detail-item"><span class="detail-label">Образование:</span><span>${material.informant.education}</span></div>
                    <div class="detail-item"><span class="detail-label">Родной язык:</span><span>${material.informant.nativeLanguage}</span></div>
                    <div class="detail-item"><span class="detail-label">Уровень русского:</span><span>${material.informant.russianLevel}</span></div>
                </div>
            </div>
            <div class="detail-section">
                <h4>📋 Запись</h4>
                <p>📍 ${material.record.location}</p>
                <p>⏱️ ${material.record.duration || '—'}</p>
            </div>
            <div class="detail-section">
                <h4>📁 Медиа</h4>
                <p>🎵 Аудио: ${audioIcon} | 🎥 Видео: ${videoIcon} | 📝 Транскрипция: ${transcriptionIcon}</p>
            </div>
            ${audioHTML}
            ${videoHTML}
            ${transcriptionHTML}
            <div style="padding:20px;text-align:center;">
                <button class="btn btn-primary" onclick="document.getElementById('detailModal').remove()">Закрыть</button>
            </div>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) modal.remove(); });
}


// ============================================
// УДАЛЕНИЕ
// ============================================

async function deleteMaterial(materialId) {
    const material = materialsData.find(m => m.id === materialId);
    if (!material) return;

    if (!confirm(`Удалить материал #${String(materialId).padStart(3, '0')}?\n${material.record.topic}\n\nЭто действие нельзя отменить.`)) return;

    try {
        await fetch(`${API_URL}/materials/${materialId}`, { method: 'DELETE' });
    } catch (e) { console.log('Сервер недоступен, удаляем локально'); }

    materialsData = materialsData.filter(m => m.id !== materialId);
    filteredData = filteredData.filter(m => m.id !== materialId);
    renderMaterials();
    updateStatsLocally();
    showNotification('✅ Материал удален', 'success');
}


// ============================================
// АУДИОПЛЕЕР
// ============================================

function openAudioPlayer(audioPath, topic, fileName) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'audioModal';
    const fullPath = audioPath.startsWith('blob:') ? audioPath : (audioPath.startsWith('/') ? audioPath : '/static/' + audioPath);
    modal.innerHTML = `
        <div class="modal-player">
            <button class="modal-close" onclick="closeAudioPlayer()">&times;</button>
            <h4>🎵 ${topic || ''}</h4>
            <audio controls autoplay><source src="${fullPath}"></audio>
            <p>📁 ${fileName || ''}</p>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) closeAudioPlayer(); });
}

function closeAudioPlayer() {
    const modal = document.getElementById('audioModal');
    if (modal) { modal.querySelector('audio')?.pause(); modal.remove(); }
}


// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function updateStatsLocally() {
    document.getElementById('totalRecords').textContent = materialsData.length;
    document.getElementById('totalInformants').textContent = new Set(materialsData.map(m => `${m.informant.age}-${m.informant.gender}`)).size;
    document.getElementById('avgAge').textContent = materialsData.length > 0 ? Math.round(materialsData.reduce((s, m) => s + m.informant.age, 0) / materialsData.length) : 0;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatFileSize(bytes) {
    if (!bytes) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

function updatePagination(totalPages) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;
    if (totalPages <= 1) { pagination.style.display = 'none'; return; }
    pagination.style.display = 'flex';
    document.getElementById('prevPage').disabled = currentPage === 1;
    document.getElementById('nextPage').disabled = currentPage === totalPages;
    document.getElementById('pageInfo').textContent = `Страница ${currentPage} из ${totalPages}`;
}

function changePage(delta) {
    currentPage += delta;
    renderMaterials();
    window.scrollTo({ top: 400, behavior: 'smooth' });
}

function escapeHTML(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function showNotification(message, type = 'info') {
    const colors = { success: '#27ae60', error: '#e74c3c', info: '#3498db' };
    const notification = document.createElement('div');
    notification.style.cssText = `position:fixed;bottom:20px;right:20px;padding:15px 25px;background:${colors[type]};color:white;border-radius:8px;z-index:10001;`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => notification.remove(), 3000);
}

// Глобальные функции
window.deleteMaterial = deleteMaterial;
window.editMaterial = editMaterial;
window.openAudioPlayer = openAudioPlayer;
window.closeAudioPlayer = closeAudioPlayer;