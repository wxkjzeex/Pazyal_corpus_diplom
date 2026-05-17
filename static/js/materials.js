// ============================================
// js/materials.js — Финальная версия
// Транскрипция через Google Speech API из файла
// ============================================

const API_URL = '/api';

let materialsData = [];
let filteredData = [];
let currentPage = 1;
let currentAudioFile = null;
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
    }
});


// ============================================
// ОБРАБОТЧИКИ СОБЫТИЙ
// ============================================

function initEventListeners() {
    console.log('🔧 Инициализация обработчиков...');

    initAudioPreview();

    const showFormBtn = document.getElementById('showAddFormBtn');
    if (showFormBtn) {
        showFormBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showAddForm();
        });
    }

    const emptyAddBtn = document.getElementById('emptyAddBtn');
    if (emptyAddBtn) {
        emptyAddBtn.addEventListener('click', function(e) {
            e.preventDefault();
            showAddForm();
        });
    }

    const closeFormBtn = document.getElementById('closeFormBtn');
    if (closeFormBtn) {
        closeFormBtn.addEventListener('click', hideAddForm);
    }

    const cancelFormBtn = document.getElementById('cancelFormBtn');
    if (cancelFormBtn) {
        cancelFormBtn.addEventListener('click', hideAddForm);
    }

    const addForm = document.getElementById('addMaterialForm');
    if (addForm) {
        addForm.addEventListener('submit', handleFormSubmit);
    }

    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

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
        document.getElementById('totalRecords').textContent = '0';
        document.getElementById('totalInformants').textContent = '0';
        document.getElementById('avgAge').textContent = '0';
        document.getElementById('totalDuration').textContent = '0:00';
    }
}

function loadDemoData() {
    console.log('📦 Загрузка демо-данных...');
    materialsData = [
        {
            id: 1,
            informant: {
                age: 67,
                gender: 'женский',
                education: 'среднее',
                nativeLanguage: 'удмуртский',
                russianLevel: 'свободное владение'
            },
            record: {
                date: '2024-03-15',
                location: 'д. Пазял, дом информанта',
                topic: 'Воспоминания о детстве',
                duration: '30:15'
            },
            transcription: {
                preview: 'Ну, я вам расскажу про нашу деревню. Мы раньше совсем по-другому жили...',
                full: '[00:00] Информант: Ну, я вам расскажу про нашу деревню...'
            },
            media: {
                hasAudio: true,
                hasVideo: false
            }
        }
    ];
    filteredData = [...materialsData];
    renderMaterials();
    updateStatsLocally();
}


// ============================================
// ФОРМА ДОБАВЛЕНИЯ
// ============================================

function showAddForm() {
    const formSection = document.getElementById('addMaterialSection');
    if (formSection) {
        formSection.style.display = 'block';
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        console.log('📝 Форма открыта');
    }
}

function hideAddForm() {
    const formSection = document.getElementById('addMaterialSection');
    if (formSection) {
        formSection.style.display = 'none';
        document.getElementById('addMaterialForm').reset();

        // Скрываем превью аудио
        const audioPreview = document.getElementById('audioPreview');
        const liveTranscript = document.getElementById('liveTranscript');
        if (audioPreview) audioPreview.style.display = 'none';
        if (liveTranscript) liveTranscript.style.display = 'none';

        console.log('📝 Форма закрыта');
    }
}

async function handleFormSubmit(e) {
    e.preventDefault();
    console.log('=== ОТПРАВКА ФОРМЫ ===');

    const form = e.target;
    const formData = new FormData(form);

    const age = document.getElementById('informantAge')?.value;
    const gender = document.getElementById('informantGender')?.value;
    const education = document.getElementById('informantEducation')?.value;
    const nativeLanguage = document.getElementById('nativeLanguage')?.value;
    const russianLevel = document.getElementById('russianLevel')?.value;
    const recordDate = document.getElementById('recordDate')?.value;
    const location = document.getElementById('recordLocation')?.value;
    const topic = document.getElementById('recordTopic')?.value;

    const requiredFields = [
        { name: 'возраст', value: age },
        { name: 'пол', value: gender },
        { name: 'образование', value: education },
        { name: 'родной язык', value: nativeLanguage },
        { name: 'уровень русского', value: russianLevel },
        { name: 'дата записи', value: recordDate },
        { name: 'место записи', value: location },
        { name: 'тема', value: topic }
    ];

    const missingFields = requiredFields.filter(f => !f.value || f.value.trim() === '');
    if (missingFields.length > 0) {
        const missingNames = missingFields.map(f => f.name).join(', ');
        alert(`Пожалуйста, заполните обязательные поля:\n${missingNames}`);
        return;
    }

    const audioFile = formData.get('audioFile');
    if (audioFile && audioFile.name) {
        console.log('✅ Аудиофайл:', audioFile.name, `(${Math.round(audioFile.size / 1024)} КБ)`);
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Сохранение...';
    submitBtn.disabled = true;

    try {
        const response = await fetch(`${API_URL}/materials`, {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            alert(`✅ Материал успешно сохранен!\nID записи: ${result.record_id || 'N/A'}`);
            hideAddForm();
            await loadMaterials();
            await loadStats();
        } else {
            alert(`❌ Ошибка сохранения: ${result.error}\n\nМатериал будет сохранен локально.`);
            saveMaterialLocallyFromForm();
        }
    } catch (error) {
        alert('❌ Не удалось подключиться к серверу.\n\nМатериал будет сохранен локально.');
        saveMaterialLocallyFromForm();
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

function saveMaterialLocallyFromForm() {
    const newMaterial = {
        id: materialsData.length + 1,
        informant: {
            age: parseInt(document.getElementById('informantAge')?.value) || 0,
            gender: document.getElementById('informantGender')?.value || 'женский',
            education: document.getElementById('informantEducation')?.value || 'среднее',
            nativeLanguage: document.getElementById('nativeLanguage')?.value || 'удмуртский',
            russianLevel: document.getElementById('russianLevel')?.value || 'свободное владение'
        },
        record: {
            date: document.getElementById('recordDate')?.value || new Date().toISOString().split('T')[0],
            location: document.getElementById('recordLocation')?.value || 'д. Пазял',
            topic: document.getElementById('recordTopic')?.value || 'Без темы',
            duration: '00:00'
        },
        transcription: {
            preview: (document.getElementById('transcription')?.value || '').substring(0, 150) + '...',
            full: document.getElementById('transcription')?.value || ''
        },
        media: {
            hasAudio: document.getElementById('audioFile')?.files.length > 0,
            hasVideo: false,
            audioFileName: document.getElementById('audioFile')?.files[0]?.name || '',
            audioPath: document.getElementById('audioFile')?.files.length > 0
                ? URL.createObjectURL(document.getElementById('audioFile').files[0])
                : null
        },
        metadata: {
            equipment: document.getElementById('equipment')?.value || '',
            noiseLevel: document.getElementById('noiseLevel')?.value || 'низкий',
            transcriber: document.getElementById('transcriber')?.value || ''
        }
    };

    materialsData.push(newMaterial);
    filteredData = [...materialsData];
    hideAddForm();
    renderMaterials();
    updateStatsLocally();

    alert(`✅ Материал сохранен локально!\n\nВсего материалов: ${materialsData.length}`);
}


// ============================================
// ТРАНСКРИБАЦИЯ (GOOGLE SPEECH API ИЗ ФАЙЛА)
// ============================================

function initTranscriptionHandlers() {
    const transcribeBtn = document.getElementById('startTranscribeBtn');
    if (transcribeBtn) {
        transcribeBtn.addEventListener('click', transcribeAudioFile);
    }
    console.log('✅ Обработчики транскрибации инициализированы');
}

async function transcribeAudioFile() {
    const audioInput = document.getElementById('audioFile');
    const transcribeBtn = document.getElementById('startTranscribeBtn');
    const statusEl = document.getElementById('transcribeStatus');
    const transcriptionField = document.getElementById('transcription');
    const transcriberField = document.getElementById('transcriber');
    const liveBlock = document.getElementById('liveTranscript');
    const liveText = document.getElementById('liveTranscriptText');

    // Проверка наличия файла
    if (!audioInput || !audioInput.files || audioInput.files.length === 0) {
        showNotification('❌ Сначала выберите аудиофайл для распознавания', 'error');
        return;
    }

    const audioFile = audioInput.files[0];

    // Проверка размера
    if (audioFile.size > 10 * 1024 * 1024) {
        showNotification('❌ Файл слишком большой. Максимальный размер: 10 МБ', 'error');
        return;
    }

    // Проверка формата
    const allowedExtensions = ['.mp3', '.wav', '.flac', '.ogg', '.opus', '.webm', '.m4a', '.aac'];
    const isValidFormat = allowedExtensions.some(ext => audioFile.name.toLowerCase().endsWith(ext));
    if (!isValidFormat) {
        showNotification('❌ Неподдерживаемый формат. Используйте MP3, WAV, FLAC, OGG, M4A', 'error');
        return;
    }

    // Блокируем кнопку
    isTranscribing = true;
    transcribeBtn.disabled = true;
    transcribeBtn.innerHTML = '⏳ Идёт распознавание...';

    if (statusEl) {
        statusEl.textContent = '🎙️ Отправка аудиофайла на сервер...';
        statusEl.style.color = '#3498db';
    }

    if (liveBlock) {
        liveBlock.style.display = 'block';
        liveText.innerHTML = `
            <div class="transcribe-progress">
                <div class="progress-bar"><div class="progress-fill" style="width: 100%"></div></div>
            </div>
            <p style="text-align: center; color: #666;">📤 Отправка файла "${audioFile.name}"...</p>
        `;
    }

    try {
        const formData = new FormData();
        formData.append('audioFile', audioFile);

        if (statusEl) {
            statusEl.textContent = '🎙️ Идёт распознавание речи...';
            statusEl.style.color = '#e67e22';
        }

        if (liveText) {
            liveText.innerHTML = `
                <div class="transcribe-progress">
                    <div class="progress-bar"><div class="progress-fill" style="width: 100%"></div></div>
                </div>
                <p style="text-align: center; color: #666;">🎙️ Google Speech API обрабатывает аудио...</p>
            `;
        }

        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            if (transcriptionField) transcriptionField.value = result.transcript;
            if (transcriberField) {
                transcriberField.value = result.demo
                    ? 'Демо-режим (требуется API ключ)'
                    : 'Google Speech-to-Text API (автоматически)';
            }

            if (liveText) {
                liveText.innerHTML = `
                    <p style="color: #27ae60; font-size: 16px;">✅ Распознавание завершено!</p>
                    <div style="margin-top: 10px; color: #555;">
                        <p>📝 Фрагментов: <strong>${result.fragments}</strong></p>
                        <p>🎯 Точность: <strong>${result.confidence}%</strong></p>
                    </div>
                    ${result.demo ? `
                        <div style="background: #fff3cd; padding: 15px; border-radius: 8px; margin-top: 10px; border: 1px solid #ffc107;">
                            <p style="color: #856404; margin: 0;">⚠️ <strong>Демо-режим</strong></p>
                            <p style="color: #856404; margin: 10px 0 0 0; font-size: 13px;">Настройте GOOGLE_SPEECH_API_KEY в файле .env</p>
                        </div>
                    ` : ''}
                    <p style="margin-top: 15px; font-style: italic; color: #666;">Текст добавлен в поле транскрипции.</p>
                `;
            }

            if (statusEl) {
                statusEl.textContent = `✅ Распознано (точность: ${result.confidence}%)`;
                statusEl.style.color = '#27ae60';
            }

            showNotification(`✅ Речь распознана! Фрагментов: ${result.fragments}`, 'success');
        } else {
            throw new Error(result.error || 'Ошибка распознавания');
        }
    } catch (error) {
        console.error('❌ Ошибка транскрибации:', error);

        if (liveText) {
            liveText.innerHTML = `
                <p style="color: #e74c3c; font-size: 16px;">❌ Ошибка распознавания</p>
                <p style="color: #666;">${error.message}</p>
                <div style="margin-top: 15px; background: #fdf2f2; padding: 15px; border-radius: 8px;">
                    <p style="color: #721c24; margin: 0; font-weight: 500;">Рекомендации:</p>
                    <ul style="color: #721c24; margin: 10px 0 0 0; padding-left: 20px;">
                        <li>Проверьте формат файла (MP3, WAV, FLAC)</li>
                        <li>Размер файла не должен превышать 10 МБ</li>
                        <li>Убедитесь, что в аудио есть речь на русском языке</li>
                    </ul>
                </div>
            `;
        }

        if (statusEl) {
            statusEl.textContent = `❌ ${error.message}`;
            statusEl.style.color = '#e74c3c';
        }

        showNotification(`❌ Ошибка: ${error.message}`, 'error');
    } finally {
        isTranscribing = false;
        transcribeBtn.disabled = false;
        transcribeBtn.innerHTML = '🎤 Распознать речь из аудиофайла';

        setTimeout(() => {
            if (liveBlock && !isTranscribing) liveBlock.style.display = 'none';
            if (statusEl && statusEl.style.color === 'rgb(39, 174, 96)') statusEl.textContent = '';
        }, 10000);
    }
}


// ============================================
// АУДИОПРЕВЬЮ В ФОРМЕ
// ============================================

function initAudioPreview() {
    const audioInput = document.getElementById('audioFile');
    const audioPreview = document.getElementById('audioPreview');
    const audioPlayer = document.getElementById('audioPlayer');
    const audioFileName = document.getElementById('audioFileName');
    const audioFileSize = document.getElementById('audioFileSize');
    const audioPlaceholder = document.getElementById('audioPlaceholder');

    if (!audioInput) return;

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
            if (audioPlaceholder) audioPlaceholder.textContent = 'Выберите аудиофайл (MP3, WAV, FLAC)';
        }
    });
}

function formatFileSize(bytes) {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
// ОТРИСОВКА МАТЕРИАЛОВ
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
        btn.addEventListener('click', function() {
            viewMaterial(parseInt(this.dataset.id));
        });
    });
}

function createMaterialCard(material) {
    const mediaIcons = [];
    if (material.media?.hasAudio) mediaIcons.push('🎵');
    if (material.media?.hasVideo) mediaIcons.push('🎥');
    if (material.transcription?.full) mediaIcons.push('📝');

    let audioSection = '';
    if (material.media?.hasAudio) {
        const audioPath = material.media.audioPath || '';
        const audioFileName = material.media.audioFileName || 'Аудиозапись';
        const safeTopic = (material.record.topic || '').replace(/'/g, "\\'");
        const safeFileName = audioFileName.replace(/'/g, "\\'");

        audioSection = `
            <div class="card-audio-section">
                <div class="card-audio-label"><span>🎵</span><span>${audioFileName.substring(0, 30)}${audioFileName.length > 30 ? '...' : ''}</span></div>
                <button class="play-audio-btn" onclick="openAudioPlayer('${audioPath}', '${safeTopic}', '${safeFileName}')">▶ Прослушать запись</button>
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
                <div class="record-meta"><span>📍 ${material.record.location}</span><span>⏱️ ${material.record.duration || '00:00'}</span></div>
                ${audioSection}
            </div>
            <div class="card-footer">
                <button class="btn-view view-material-btn" data-id="${material.id}">📖 Подробнее</button>
                <button class="btn-delete" onclick="deleteMaterial(${material.id})">🗑️ Удалить</button>
            </div>
        </div>`;
}


// ============================================
// УДАЛЕНИЕ МАТЕРИАЛА
// ============================================

async function deleteMaterial(materialId) {
    const material = materialsData.find(m => m.id === materialId);
    if (!material) return;

    const confirmed = await showDeleteConfirmModal(material);
    if (!confirmed) return;

    const card = document.querySelector(`.material-card[data-material-id="${materialId}"]`);
    if (card) card.classList.add('removing');

    try {
        await fetch(`${API_URL}/materials/${materialId}`, { method: 'DELETE' });
    } catch (error) {
        console.log('Сервер недоступен, удаляем локально');
    }

    const index = materialsData.findIndex(m => m.id === materialId);
    if (index !== -1) {
        if (materialsData[index].media?.audioPath?.startsWith('blob:')) {
            URL.revokeObjectURL(materialsData[index].media.audioPath);
        }
        materialsData.splice(index, 1);
    }

    filteredData = filteredData.filter(m => m.id !== materialId);
    renderMaterials();
    updateStatsLocally();

    if (materialsData.length === 0) {
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('pagination').style.display = 'none';
    }
}

function showDeleteConfirmModal(material) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'confirm-modal-overlay';
        modal.innerHTML = `
            <div class="confirm-modal">
                <div class="confirm-modal-icon">🗑️</div>
                <h4>Удалить материал?</h4>
                <p><strong>#${String(material.id).padStart(3, '0')}</strong><br>${material.record.topic}<br><small>${material.informant.gender === 'женский' ? '👩' : '👨'} ${material.informant.age} лет</small></p>
                <p style="color: #e74c3c; font-size: 14px;">Это действие нельзя отменить.</p>
                <div class="confirm-modal-actions">
                    <button class="btn btn-danger" id="confirmDeleteBtn">🗑️ Удалить</button>
                    <button class="btn btn-cancel" id="cancelDeleteBtn">Отмена</button>
                </div>
            </div>`;
        document.body.appendChild(modal);

        document.getElementById('confirmDeleteBtn').onclick = () => { modal.remove(); resolve(true); };
        document.getElementById('cancelDeleteBtn').onclick = () => { modal.remove(); resolve(false); };
        modal.onclick = (e) => { if (e.target === modal) { modal.remove(); resolve(false); } };
        document.addEventListener('keydown', function escHandler(e) {
            if (e.key === 'Escape') { modal.remove(); resolve(false); document.removeEventListener('keydown', escHandler); }
        });
    });
}


// ============================================
// АУДИОПЛЕЕР
// ============================================

function openAudioPlayer(audioPath, topic, fileName) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'audioModal';
    const fullAudioPath = audioPath.startsWith('/') ? audioPath : '/static/' + audioPath;
    modal.innerHTML = `
        <div class="modal-player">
            <button class="modal-close" onclick="closeAudioPlayer()">&times;</button>
            <h4>🎵 ${topic || 'Прослушивание записи'}</h4>
            <audio controls autoplay><source src="${fullAudioPath}" type="audio/mpeg"></audio>
            <p>📁 ${fileName || 'Аудиозапись'}</p>
            <p style="margin-top: 15px; font-size: 12px;">📍 д. Пазял, Можгинский район</p>
        </div>`;
    document.body.appendChild(modal);
    modal.addEventListener('click', function(e) { if (e.target === modal) closeAudioPlayer(); });
}

function closeAudioPlayer() {
    const modal = document.getElementById('audioModal');
    if (modal) {
        const audio = modal.querySelector('audio');
        if (audio) { audio.pause(); audio.src = ''; }
        modal.remove();
    }
}


// ============================================
// ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
// ============================================

function updateStatsLocally() {
    const totalRecords = materialsData.length;
    const uniqueInformants = new Set(materialsData.map(m => `${m.informant.age}-${m.informant.gender}-${m.informant.education}`)).size;
    const avgAge = materialsData.length > 0 ? Math.round(materialsData.reduce((sum, m) => sum + m.informant.age, 0) / materialsData.length) : 0;
    document.getElementById('totalRecords').textContent = totalRecords;
    document.getElementById('totalInformants').textContent = uniqueInformants;
    document.getElementById('avgAge').textContent = avgAge;
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
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

function viewMaterial(id) {
    const material = materialsData.find(m => m.id === id);
    if (!material) { alert('Материал не найден'); return; }
    alert(`
📋 Материал #${String(id).padStart(3, '0')}

👤 Информант:
   Возраст: ${material.informant.age} лет
   Пол: ${material.informant.gender}
   Образование: ${material.informant.education}
   Родной язык: ${material.informant.nativeLanguage}
   Уровень русского: ${material.informant.russianLevel}

📝 Запись:
   Дата: ${formatDate(material.record.date)}
   Место: ${material.record.location}
   Тема: ${material.record.topic}

📖 Транскрипция:
${material.transcription.full || 'Не добавлена'}
    `);
}

function showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    const colors = { success: '#27ae60', error: '#e74c3c', info: '#3498db' };
    notification.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; padding: 15px 25px;
        background: ${colors[type] || colors.info}; color: white;
        border-radius: 8px; box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 10001; animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

window.deleteMaterial = deleteMaterial;
window.openAudioPlayer = openAudioPlayer;
window.closeAudioPlayer = closeAudioPlayer;