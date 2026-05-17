// js/materials.js - Полностью исправленная версия

// API URL
const API_URL = '/api';

let materialsData = [];
let filteredData = [];
let currentPage = 1;
let currentAudioFile = null;
let audioObjectURL = null;
const itemsPerPage = 6;
let recognition = null;
let isRecognizing = false;
let finalTranscript = '';
let recognitionTimeout = null;


document.addEventListener('DOMContentLoaded', function() {
    console.log('Страница материалов загружена');

    // Инициализируем аудиопревью
    initAudioPreview();

    // Инициализируем распознавание речи
    initSpeechRecognition();
    initTranscriptionHandlers();

    // Загружаем данные
    loadMaterials();
    loadStats();

    // Инициализируем обработчики событий
    initEventListeners();
});


// Добавьте в DOMContentLoaded:
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeAudioPlayer();
    }
});

// Инициализация обработчиков
function initEventListeners() {
    console.log('Инициализация обработчиков...');

    // Инициализируем аудиопревью
    initAudioPreview();

    // Кнопка "Добавить материал" в заголовке
    const showFormBtn = document.getElementById('showAddFormBtn');
    if (showFormBtn) {
        console.log('Кнопка "Добавить материал" найдена');
        showFormBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Клик по кнопке "Добавить материал"');
            showAddForm();
        });
    } else {
        console.error('Кнопка showAddFormBtn не найдена!');
    }

    // Кнопка в пустом состоянии
    const emptyAddBtn = document.getElementById('emptyAddBtn');
    if (emptyAddBtn) {
        emptyAddBtn.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('Клик по кнопке в пустом состоянии');
            showAddForm();
        });
    }

    // Кнопка закрытия формы
    const closeFormBtn = document.getElementById('closeFormBtn');
    if (closeFormBtn) {
        closeFormBtn.addEventListener('click', function() {
            hideAddForm();
        });
    }

    // Кнопка отмены
    const cancelFormBtn = document.getElementById('cancelFormBtn');
    if (cancelFormBtn) {
        cancelFormBtn.addEventListener('click', function() {
            hideAddForm();
        });
    }

    // Отправка формы
    const addForm = document.getElementById('addMaterialForm');
    if (addForm) {
        addForm.addEventListener('submit', handleFormSubmit);
    }

    // Поиск
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', handleSearch);
    }

    // Фильтры
    const genderFilter = document.getElementById('genderFilter');
    const ageFilter = document.getElementById('ageFilter');
    const educationFilter = document.getElementById('educationFilter');

    if (genderFilter) genderFilter.addEventListener('change', handleFilters);
    if (ageFilter) ageFilter.addEventListener('change', handleFilters);
    if (educationFilter) educationFilter.addEventListener('change', handleFilters);

    // Сброс фильтров
    const resetBtn = document.getElementById('resetFiltersBtn');
    if (resetBtn) {
        resetBtn.addEventListener('click', resetFilters);
    }

    // Пагинация
    const prevPage = document.getElementById('prevPage');
    const nextPage = document.getElementById('nextPage');

    if (prevPage) prevPage.addEventListener('click', () => changePage(-1));
    if (nextPage) nextPage.addEventListener('click', () => changePage(1));

    console.log('Обработчики инициализированы');
}

// Загрузка материалов с сервера
async function loadMaterials() {
    try {
        console.log('Загрузка материалов...');
        const response = await fetch(`${API_URL}/materials`);
        const result = await response.json();

        if (result.success) {
            materialsData = result.data;
            filteredData = [...materialsData];
            console.log(`Загружено ${materialsData.length} материалов`);
            renderMaterials();
        } else {
            console.error('Ошибка загрузки:', result.error);
        }
    } catch (error) {
        console.error('Ошибка подключения:', error);
        // Если сервер не отвечает, показываем демо-данные
        loadDemoData();
    }
}

// Загрузка статистики
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
        // Устанавливаем нулевые значения
        document.getElementById('totalRecords').textContent = '0';
        document.getElementById('totalInformants').textContent = '0';
        document.getElementById('avgAge').textContent = '0';
        document.getElementById('totalDuration').textContent = '0:00';
    }
}

// Демо-данные (если сервер недоступен)
function loadDemoData() {
    console.log('Загрузка демо-данных...');
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
}

// Показать форму добавления
function showAddForm() {
    console.log('Открытие формы...');
    const formSection = document.getElementById('addMaterialSection');
    if (formSection) {
        formSection.style.display = 'block';
        formSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        console.log('Форма открыта');
    } else {
        console.error('Элемент addMaterialSection не найден!');
    }
}

// Скрыть форму
function hideAddForm() {
    console.log('Закрытие формы...');
    const formSection = document.getElementById('addMaterialSection');
    if (formSection) {
        formSection.style.display = 'none';
        document.getElementById('addMaterialForm').reset();
        console.log('Форма закрыта');
    }
}

// Инициализация распознавания речи
function initSpeechRecognition() {
    // Проверяем поддержку
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        console.warn('Web Speech API не поддерживается в этом браузере');
        const btn = document.getElementById('startTranscribeBtn');
        if (btn) {
            btn.disabled = true;
            btn.title = 'Распознавание речи не поддерживается в вашем браузере';
            btn.innerHTML = '❌ Браузер не поддерживает';
        }
        return false;
    }

    // Создаем объект распознавания
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();

    // Настройки
    recognition.continuous = true;      // Продолжать распознавание
    recognition.interimResults = true;  // Показывать промежуточные результаты
    recognition.lang = 'ru-RU';         // Русский язык
    recognition.maxAlternatives = 1;    // Один вариант

    // Обработчики событий
    recognition.onstart = onRecognitionStart;
    recognition.onend = onRecognitionEnd;
    recognition.onerror = onRecognitionError;
    recognition.onresult = onRecognitionResult;

    console.log('✅ Web Speech API инициализирован');
    return true;
}

// Начало распознавания
function onRecognitionStart() {
    console.log('🎤 Распознавание началось');
    isRecognizing = true;
    finalTranscript = '';

    // Обновляем UI
    document.getElementById('startTranscribeBtn').style.display = 'none';
    document.getElementById('stopTranscribeBtn').style.display = 'inline-block';
    document.getElementById('liveTranscript').style.display = 'block';
    document.getElementById('transcribeStatus').textContent = '🎙️ Идет распознавание...';
    document.getElementById('transcribeStatus').style.color = '#e74c3c';

    // Показываем уведомление
    showNotification('🎤 Говорите в микрофон. Речь будет распознана.', 'info');
}

// Завершение распознавания
function onRecognitionEnd() {
    console.log('⏹️ Распознавание завершено');
    isRecognizing = false;

    // Обновляем UI
    document.getElementById('startTranscribeBtn').style.display = 'inline-block';
    document.getElementById('stopTranscribeBtn').style.display = 'none';
    document.getElementById('transcribeStatus').textContent = '✅ Распознавание завершено';
    document.getElementById('transcribeStatus').style.color = '#27ae60';

    // Копируем финальный текст в textarea
    const transcriptionField = document.getElementById('transcription');
    if (finalTranscript) {
        // Добавляем временные метки
        const timestamp = new Date().toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        const formattedText = `[${timestamp}] ${finalTranscript}`;

        if (transcriptionField.value) {
            transcriptionField.value += '\n\n' + formattedText;
        } else {
            transcriptionField.value = formattedText;
        }

        showNotification('✅ Текст распознан и добавлен в поле транскрипции', 'success');
    }

    // Скрываем live-блок через 3 секунды
    setTimeout(() => {
        if (!isRecognizing) {
            document.getElementById('liveTranscript').style.display = 'none';
            document.getElementById('liveTranscriptText').textContent = '';
            document.getElementById('transcribeStatus').textContent = '';
        }
    }, 3000);

    // Очищаем таймаут
    if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
        recognitionTimeout = null;
    }
}

// Ошибка распознавания
function onRecognitionError(event) {
    console.error('Ошибка распознавания:', event.error);
    isRecognizing = false;

    let errorMessage = '';
    switch (event.error) {
        case 'no-speech':
            errorMessage = 'Речь не обнаружена. Попробуйте еще раз.';
            break;
        case 'audio-capture':
            errorMessage = 'Нет доступа к микрофону. Разрешите использование микрофона.';
            break;
        case 'not-allowed':
            errorMessage = 'Доступ к микрофону запрещен.';
            break;
        case 'network':
            errorMessage = 'Ошибка сети. Проверьте подключение к интернету.';
            break;
        default:
            errorMessage = `Ошибка: ${event.error}`;
    }

    showNotification(`❌ ${errorMessage}`, 'error');

    // Обновляем UI
    document.getElementById('startTranscribeBtn').style.display = 'inline-block';
    document.getElementById('stopTranscribeBtn').style.display = 'none';
    document.getElementById('transcribeStatus').textContent = `❌ ${errorMessage}`;
    document.getElementById('transcribeStatus').style.color = '#e74c3c';
}

// Получение результатов
function onRecognitionResult(event) {
    let interimTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
            finalTranscript += transcript + ' ';
        } else {
            interimTranscript += transcript;
        }
    }

    // Отображаем в live-блоке
    const liveText = document.getElementById('liveTranscriptText');
    if (liveText) {
        let displayText = '';
        if (finalTranscript) {
            displayText += `<span style="color: #27ae60;">${finalTranscript}</span> `;
        }
        if (interimTranscript) {
            displayText += `<span style="color: #999; font-style: italic;">${interimTranscript}</span>`;
        }
        liveText.innerHTML = displayText || 'Ожидание речи...';
    }

    // Автоматическая остановка после паузы
    if (recognitionTimeout) {
        clearTimeout(recognitionTimeout);
    }
    recognitionTimeout = setTimeout(() => {
        if (isRecognizing) {
            console.log('⏱️ Автоматическая остановка после паузы');
            stopTranscription();
        }
    }, 5000); // 5 секунд тишины
}

// Запуск распознавания
function startTranscription() {
    console.log('Запуск распознавания...');

    // Проверяем, выбран ли аудиофайл (опционально)
    const audioInput = document.getElementById('audioFile');
    if (audioInput && audioInput.files.length > 0) {
        console.log('Аудиофайл выбран, но распознавание будет через микрофон');
        showNotification('ℹ️ Распознавание работает через микрофон. Воспроизведите аудио на устройстве.', 'info');
    }

    if (!recognition) {
        if (!initSpeechRecognition()) {
            return;
        }
    }

    try {
        recognition.start();
    } catch (error) {
        console.error('Ошибка запуска:', error);
        // Если уже запущено, останавливаем и запускаем заново
        if (error.message === 'recognition has already started') {
            recognition.stop();
            setTimeout(() => recognition.start(), 100);
        }
    }
}

// Остановка распознавания
function stopTranscription() {
    console.log('Остановка распознавания');
    if (recognition && isRecognizing) {
        recognition.stop();
    }
}

// Альтернативный метод: распознавание из аудиофайла (через AudioContext)
async function transcribeFromAudioFile(audioFile) {
    showNotification('⏳ Анализ аудиофайла...', 'info');

    try {
        // Создаем аудиоконтекст
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const arrayBuffer = await audioFile.arrayBuffer();
        const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

        // Получаем данные
        const duration = audioBuffer.duration;
        const sampleRate = audioBuffer.sampleRate;

        showNotification(`📊 Аудио загружено: ${Math.round(duration)} сек, ${sampleRate} Гц`, 'success');

        // Предлагаем использовать распознавание через микрофон
        const useMicrophone = confirm(
            `Аудиофайл "${audioFile.name}" загружен (${Math.round(duration)} сек).\n\n` +
            `Для распознавания:\n` +
            `1. Нажмите "ОК"\n` +
            `2. Разрешите доступ к микрофону\n` +
            `3. Воспроизведите аудио на устройстве\n\n` +
            `Речь будет распознана через микрофон.`
        );

        if (useMicrophone) {
            startTranscription();
        }

    } catch (error) {
        console.error('Ошибка анализа аудио:', error);
        showNotification('❌ Не удалось проанализировать аудиофайл', 'error');
    }
}

// Инициализация обработчиков для транскрибации
function initTranscriptionHandlers() {
    const startBtn = document.getElementById('startTranscribeBtn');
    const stopBtn = document.getElementById('stopTranscribeBtn');
    const audioInput = document.getElementById('audioFile');

    if (startBtn) {
        startBtn.addEventListener('click', async function() {
            // Проверяем, есть ли выбранный аудиофайл
            if (audioInput && audioInput.files.length > 0) {
                const file = audioInput.files[0];
                await transcribeFromAudioFile(file);
            } else {
                // Просто запускаем распознавание с микрофона
                startTranscription();
            }
        });
    }

    if (stopBtn) {
        stopBtn.addEventListener('click', stopTranscription);
    }

    console.log('✅ Обработчики транскрибации инициализированы');
}

// Обработка отправки формы
async function handleFormSubmit(e) {
    e.preventDefault();
    console.log('=== ОТПРАВКА ФОРМЫ ===');

    const form = e.target;
    const formData = new FormData(form);

    // Получаем значения напрямую из полей формы (более надежно)
    const age = document.getElementById('informantAge')?.value;
    const gender = document.getElementById('informantGender')?.value;
    const education = document.getElementById('informantEducation')?.value;
    const nativeLanguage = document.getElementById('nativeLanguage')?.value;
    const russianLevel = document.getElementById('russianLevel')?.value;
    const recordDate = document.getElementById('recordDate')?.value;
    const location = document.getElementById('recordLocation')?.value;
    const topic = document.getElementById('recordTopic')?.value;

    console.log('Проверка обязательных полей:');
    console.log('  age:', age);
    console.log('  gender:', gender);
    console.log('  education:', education);
    console.log('  nativeLanguage:', nativeLanguage);
    console.log('  russianLevel:', russianLevel);
    console.log('  recordDate:', recordDate);
    console.log('  location:', location);
    console.log('  topic:', topic);

    // Проверяем обязательные поля
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
        console.log('❌ Не заполнены поля:', missingNames);
        alert(`Пожалуйста, заполните обязательные поля:\n${missingNames}`);
        return;
    }

    console.log('✅ Все обязательные поля заполнены');

    // Проверяем аудиофайл
    const audioFile = formData.get('audioFile');
    if (audioFile && audioFile.name) {
        console.log('✅ Аудиофайл:', audioFile.name, `(${Math.round(audioFile.size / 1024)} КБ)`);
    } else {
        console.log('ℹ️ Аудиофайл не выбран (необязательно)');
    }

    // Блокируем кнопку
    const submitBtn = form.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = '⏳ Сохранение...';
    submitBtn.disabled = true;

    try {
        console.log('📤 Отправка на сервер...');

        const response = await fetch(`${API_URL}/materials`, {
            method: 'POST',
            body: formData
        });

        console.log('Статус ответа:', response.status);

        const result = await response.json();
        console.log('Ответ сервера:', result);

        if (result.success) {
            alert(`✅ Материал успешно сохранен!\nID записи: ${result.record_id || 'N/A'}`);
            hideAddForm();

            // Обновляем данные
            await loadMaterials();
            await loadStats();
        } else {
            console.error('❌ Ошибка сервера:', result.error);
            alert(`❌ Ошибка сохранения: ${result.error}\n\nМатериал будет сохранен локально.`);

            // Сохраняем локально
            saveMaterialLocallyFromForm();
        }
    } catch (error) {
        console.error('❌ Ошибка сети:', error);
        alert('❌ Не удалось подключиться к серверу.\n\nМатериал будет сохранен локально.');

        // Сохраняем локально
        saveMaterialLocallyFromForm();
    } finally {
        submitBtn.textContent = originalText;
        submitBtn.disabled = false;
    }
}

// Локальное сохранение с информацией об аудио
function saveMaterialLocallyFromForm() {
    console.log('💾 Сохранение локально...');

    // Получаем значения из полей
    const age = parseInt(document.getElementById('informantAge')?.value) || 0;
    const gender = document.getElementById('informantGender')?.value || 'женский';
    const education = document.getElementById('informantEducation')?.value || 'среднее';
    const nativeLanguage = document.getElementById('nativeLanguage')?.value || 'удмуртский';
    const russianLevel = document.getElementById('russianLevel')?.value || 'свободное владение';
    const recordDate = document.getElementById('recordDate')?.value || new Date().toISOString().split('T')[0];
    const location = document.getElementById('recordLocation')?.value || 'д. Пазял';
    const topic = document.getElementById('recordTopic')?.value || 'Без темы';
    const transcription = document.getElementById('transcription')?.value || '';

    // Проверяем аудиофайл
    const audioInput = document.getElementById('audioFile');
    const hasAudio = audioInput && audioInput.files.length > 0;
    let audioFileName = '';
    let audioObjectURL = null;

    if (hasAudio) {
        const file = audioInput.files[0];
        audioFileName = file.name;
        audioObjectURL = URL.createObjectURL(file);
        console.log('📁 Локально сохранен аудиофайл:', audioFileName);
    }

    // Создаем объект материала
    const newMaterial = {
        id: materialsData.length + 1,
        informant: {
            age: age,
            gender: gender,
            education: education,
            nativeLanguage: nativeLanguage,
            russianLevel: russianLevel
        },
        record: {
            date: recordDate,
            location: location,
            topic: topic,
            duration: '00:00'
        },
        transcription: {
            preview: transcription.substring(0, 150) + (transcription.length > 150 ? '...' : ''),
            full: transcription
        },
        media: {
            hasAudio: hasAudio,
            hasVideo: false,
            audioFileName: audioFileName,
            audioPath: audioObjectURL  // Сохраняем blob URL для локального плеера
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

    console.log('✅ Материал сохранен локально с аудио:', newMaterial);
    alert(`✅ Материал сохранен локально!\n\n${hasAudio ? 'Аудиозапись прикреплена.' : 'Аудиозапись не прикреплена.'}\nВсего материалов: ${materialsData.length}`);
}


// Обновление статистики локально
function updateStatsLocally() {
    const totalRecords = materialsData.length;

    // Уникальные информанты
    const uniqueInformants = new Set(
        materialsData.map(m => `${m.informant.age}-${m.informant.gender}-${m.informant.education}`)
    ).size;

    // Средний возраст
    const avgAge = materialsData.length > 0
        ? Math.round(materialsData.reduce((sum, m) => sum + m.informant.age, 0) / materialsData.length)
        : 0;

    document.getElementById('totalRecords').textContent = totalRecords;
    document.getElementById('totalInformants').textContent = uniqueInformants;
    document.getElementById('avgAge').textContent = avgAge;

    // Длительность (пока заглушка)
    document.getElementById('totalDuration').textContent = '0:00';

    console.log('📊 Статистика обновлена:', { totalRecords, uniqueInformants, avgAge });
}

// Обновление статистики локально
function updateStatsLocally() {
    const totalRecords = materialsData.length;
    const uniqueInformants = new Set(materialsData.map(m =>
        `${m.informant.age}-${m.informant.gender}-${m.informant.education}`
    )).size;
    const avgAge = materialsData.length > 0
        ? Math.round(materialsData.reduce((sum, m) => sum + m.informant.age, 0) / materialsData.length)
        : 0;

    document.getElementById('totalRecords').textContent = totalRecords;
    document.getElementById('totalInformants').textContent = uniqueInformants;
    document.getElementById('avgAge').textContent = avgAge;
}

// Поиск
function handleSearch() {
    applyFilters();
}

// Фильтры
function handleFilters() {
    applyFilters();
}

// Применение фильтров
function applyFilters() {
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    const gender = document.getElementById('genderFilter')?.value || '';
    const ageRange = document.getElementById('ageFilter')?.value || '';
    const education = document.getElementById('educationFilter')?.value || '';

    filteredData = materialsData.filter(material => {
        if (searchTerm &&
            !material.transcription.preview.toLowerCase().includes(searchTerm) &&
            !material.record.topic.toLowerCase().includes(searchTerm)) {
            return false;
        }

        if (gender && material.informant.gender !== gender) {
            return false;
        }

        if (ageRange) {
            const age = material.informant.age;
            if (ageRange === '18-35' && (age < 18 || age > 35)) return false;
            if (ageRange === '36-55' && (age < 36 || age > 55)) return false;
            if (ageRange === '56+' && age < 56) return false;
        }

        if (education && material.informant.education !== education) {
            return false;
        }

        return true;
    });

    currentPage = 1;
    renderMaterials();
    updateActiveFilters();
}

// Сброс фильтров
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

// Обновление активных фильтров
function updateActiveFilters() {
    const filtersContainer = document.getElementById('activeFilters');
    if (!filtersContainer) return;

    const searchTerm = document.getElementById('searchInput')?.value || '';
    const gender = document.getElementById('genderFilter')?.value || '';
    const ageRange = document.getElementById('ageFilter')?.value || '';
    const education = document.getElementById('educationFilter')?.value || '';

    let filtersHtml = '';

    if (searchTerm) {
        filtersHtml += `<span class="filter-tag">🔍 "${searchTerm}"</span>`;
    }
    if (gender) {
        filtersHtml += `<span class="filter-tag">👤 ${gender}</span>`;
    }
    if (ageRange) {
        filtersHtml += `<span class="filter-tag">📅 ${ageRange}</span>`;
    }
    if (education) {
        filtersHtml += `<span class="filter-tag">🎓 ${education}</span>`;
    }

    filtersContainer.innerHTML = filtersHtml;
}

// Отрисовка материалов
function renderMaterials() {
    const container = document.getElementById('materialsList');
    const emptyState = document.getElementById('emptyState');
    const pagination = document.getElementById('pagination');

    if (!container) {
        console.error('Контейнер materialsList не найден!');
        return;
    }

    if (filteredData.length === 0) {
        container.innerHTML = '';
        if (emptyState) emptyState.style.display = 'block';
        if (pagination) pagination.style.display = 'none';
        return;
    }

    if (emptyState) emptyState.style.display = 'none';

    // Пагинация
    const totalPages = Math.ceil(filteredData.length / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = Math.min(startIndex + itemsPerPage, filteredData.length);
    const pageData = filteredData.slice(startIndex, endIndex);

    let html = '';
    pageData.forEach(material => {
        html += createMaterialCard(material);
    });
    container.innerHTML = html;

    updatePagination(totalPages);

    // Обработчики для кнопок просмотра
    document.querySelectorAll('.view-material-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const id = parseInt(this.dataset.id);
            viewMaterial(id);
        });
    });
}


// Инициализация аудиоплеера в форме
function initAudioPreview() {
    const audioInput = document.getElementById('audioFile');
    const audioPreview = document.getElementById('audioPreview');
    const audioPlayer = document.getElementById('audioPlayer');
    const audioFileName = document.getElementById('audioFileName');
    const audioFileSize = document.getElementById('audioFileSize');
    const audioPlaceholder = document.getElementById('audioPlaceholder');

    if (!audioInput) return;

    audioInput.addEventListener('change', function(e) {
        const file = this.files[0];

        if (file) {
            // Очищаем старый URL
            if (audioObjectURL) {
                URL.revokeObjectURL(audioObjectURL);
            }

            // Создаем новый URL
            audioObjectURL = URL.createObjectURL(file);
            audioPlayer.src = audioObjectURL;

            // Показываем информацию
            audioFileName.textContent = file.name;
            audioFileSize.textContent = formatFileSize(file.size);
            audioPlaceholder.textContent = '✅ Файл выбран';

            // Показываем плеер
            audioPreview.style.display = 'block';

            console.log('Аудиофайл загружен для предпрослушивания:', file.name);
        } else {
            audioPreview.style.display = 'none';
            audioPlaceholder.textContent = 'Выберите аудиофайл (MP3, WAV)';
        }
    });

    // Видео
    const videoInput = document.getElementById('videoFile');
    const videoPreview = document.getElementById('videoPreview');
    const videoPlayer = document.getElementById('videoPlayer');
    const videoPlaceholder = document.getElementById('videoPlaceholder');

    if (videoInput) {
        videoInput.addEventListener('change', function(e) {
            const file = this.files[0];

            if (file) {
                const videoURL = URL.createObjectURL(file);
                videoPlayer.src = videoURL;
                videoPreview.style.display = 'block';
                videoPlaceholder.textContent = '✅ Видеофайл выбран';
                console.log('Видеофайл загружен:', file.name);
            } else {
                videoPreview.style.display = 'none';
                videoPlaceholder.textContent = 'Выберите видеофайл (MP4, AVI)';
            }
        });
    }
}

// Форматирование размера файла
function formatFileSize(bytes) {
    if (bytes === 0) return '0 Б';
    const k = 1024;
    const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

// Создание карточки материала (с кнопкой удаления)
function createMaterialCard(material) {
    const mediaIcons = [];
    if (material.media?.hasAudio) mediaIcons.push('🎵');
    if (material.media?.hasVideo) mediaIcons.push('🎥');
    if (material.transcription?.full) mediaIcons.push('📝');

    // Блок с аудиоплеером (если есть аудио)
    let audioSection = '';
    if (material.media?.hasAudio) {
        const audioPath = material.media.audioPath || '';
        const audioFileName = material.media.audioFileName || 'Аудиозапись';

        audioSection = `
            <div class="card-audio-section">
                <div class="card-audio-label">
                    <span>🎵</span>
                    <span>${audioFileName.length > 30 ? audioFileName.substring(0, 30) + '...' : audioFileName}</span>
                </div>
                <button class="play-audio-btn" onclick="openAudioPlayer('${audioPath}', '${material.record.topic.replace(/'/g, "\\'")}', '${audioFileName.replace(/'/g, "\\'")}')">
                    ▶ Прослушать запись
                </button>
            </div>
        `;
    }

    return `
        <div class="material-card" data-material-id="${material.id}">
            <div class="card-header">
                <div class="card-title">
                    <span class="card-id">#${String(material.id).padStart(3, '0')}</span>
                    <span class="card-date">${formatDate(material.record.date)}</span>
                </div>
                <div class="card-badges">
                    ${mediaIcons.map(icon => `<span class="badge-media">${icon}</span>`).join('')}
                </div>
            </div>

            <div class="card-body">
                <h4 class="card-topic">${material.record.topic}</h4>

                <div class="informant-info">
                    <span class="informant-badge">${material.informant.gender === 'женский' ? '👩' : '👨'} ${material.informant.age} лет</span>
                    <span class="informant-badge">🎓 ${material.informant.education}</span>
                    <span class="informant-badge">🗣️ ${material.informant.russianLevel}</span>
                </div>

                <div class="transcription-preview">
                    <p>${material.transcription.preview || 'Транскрипция отсутствует'}</p>
                </div>

                <div class="record-meta">
                    <span>📍 ${material.record.location}</span>
                    <span>⏱️ ${material.record.duration || '00:00'}</span>
                </div>

                ${audioSection}
            </div>

            <div class="card-footer">
                <button class="btn-view view-material-btn" data-id="${material.id}">
                    📖 Подробнее
                </button>
                <button class="btn-delete delete-material-btn" data-id="${material.id}" onclick="deleteMaterial(${material.id})">
                    🗑️ Удалить
                </button>
            </div>
        </div>
    `;
}

// Удаление материала
async function deleteMaterial(materialId) {
    console.log('Запрос на удаление материала:', materialId);

    // Находим материал для отображения информации
    const material = materialsData.find(m => m.id === materialId);
    if (!material) {
        console.error('Материал не найден:', materialId);
        showNotification('Материал не найден', 'error');
        return;
    }

    // Показываем модальное окно подтверждения
    const confirmed = await showDeleteConfirmModal(material);

    if (!confirmed) {
        console.log('Удаление отменено');
        return;
    }

    console.log('Удаление подтверждено, удаляем материал...');

    // Находим карточку и добавляем анимацию
    const card = document.querySelector(`.material-card[data-material-id="${materialId}"]`);
    if (card) {
        card.classList.add('removing');
    }

    try {
        // Пытаемся удалить с сервера
        const response = await fetch(`${API_URL}/materials/${materialId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            const result = await response.json();
            if (result.success) {
                console.log('✅ Материал удален с сервера');
                showNotification('✅ Материал успешно удален', 'success');
            }
        } else {
            console.log('ℹ️ Сервер недоступен, удаляем локально');
        }
    } catch (error) {
        console.log('ℹ️ Ошибка подключения к серверу, удаляем локально:', error.message);
    }

    // Удаляем из локального массива
    const index = materialsData.findIndex(m => m.id === materialId);
    if (index !== -1) {
        // Если есть blob URL для аудио, освобождаем память
        if (materialsData[index].media?.audioPath && materialsData[index].media.audioPath.startsWith('blob:')) {
            URL.revokeObjectURL(materialsData[index].media.audioPath);
        }

        materialsData.splice(index, 1);
        console.log('Материал удален из локального массива');
    }

    // Обновляем filteredData
    filteredData = filteredData.filter(m => m.id !== materialId);

    // Перерисовываем список
    renderMaterials();
    updateStatsLocally();

    // Если материалов не осталось, показываем пустое состояние
    if (materialsData.length === 0) {
        document.getElementById('emptyState').style.display = 'block';
        document.getElementById('pagination').style.display = 'none';
    }

    console.log(`Осталось материалов: ${materialsData.length}`);
}

// Модальное окно подтверждения удаления
function showDeleteConfirmModal(material) {
    return new Promise((resolve) => {
        const modal = document.createElement('div');
        modal.className = 'confirm-modal-overlay';
        modal.id = 'confirmDeleteModal';

        modal.innerHTML = `
            <div class="confirm-modal">
                <div class="confirm-modal-icon">🗑️</div>
                <h4>Удалить материал?</h4>
                <p>
                    <strong>#${String(material.id).padStart(3, '0')}</strong><br>
                    ${material.record.topic}<br>
                    <small>${material.informant.gender === 'женский' ? '👩' : '👨'} ${material.informant.age} лет</small>
                </p>
                <p style="color: #e74c3c; font-size: 14px;">
                    Это действие нельзя отменить.
                </p>
                <div class="confirm-modal-actions">
                    <button class="btn btn-danger" id="confirmDeleteBtn">🗑️ Удалить</button>
                    <button class="btn btn-cancel" id="cancelDeleteBtn">Отмена</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Обработчики
        document.getElementById('confirmDeleteBtn').addEventListener('click', () => {
            closeConfirmModal();
            resolve(true);
        });

        document.getElementById('cancelDeleteBtn').addEventListener('click', () => {
            closeConfirmModal();
            resolve(false);
        });

        // Закрытие по клику на фон
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeConfirmModal();
                resolve(false);
            }
        });

        // Закрытие по Escape
        const escHandler = (e) => {
            if (e.key === 'Escape') {
                closeConfirmModal();
                resolve(false);
                document.removeEventListener('keydown', escHandler);
            }
        };
        document.addEventListener('keydown', escHandler);
    });
}

// Закрытие модального окна подтверждения
function closeConfirmModal() {
    const modal = document.getElementById('confirmDeleteModal');
    if (modal) {
        modal.remove();
    }
}

// Уведомления (улучшенная версия)
function showNotification(message, type = 'info') {
    // Создаем временное уведомление
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;
    notification.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        padding: 15px 25px;
        background: ${type === 'success' ? '#27ae60' : type === 'error' ? '#e74c3c' : '#3498db'};
        color: white;
        border-radius: 8px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        z-index: 10001;
        animation: slideIn 0.3s ease-out;
    `;

    document.body.appendChild(notification);

    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease-out';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// Делаем функцию глобально доступной
window.deleteMaterial = deleteMaterial;

// Открытие модального окна с аудиоплеером
function openAudioPlayer(audioPath, topic, fileName) {
    console.log('Открытие плеера:', audioPath);

    // Создаем модальное окно
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.id = 'audioModal';

    // Формируем полный путь к аудио
    const fullAudioPath = audioPath.startsWith('/') ? audioPath : '/static/' + audioPath;

    modal.innerHTML = `
        <div class="modal-player">
            <button class="modal-close" onclick="closeAudioPlayer()">&times;</button>
            <h4>🎵 ${topic || 'Прослушивание записи'}</h4>
            <audio controls autoplay class="modal-audio-player">
                <source src="${fullAudioPath}" type="audio/mpeg">
                Ваш браузер не поддерживает аудиоплеер.
            </audio>
            <p>📁 ${fileName || 'Аудиозапись'}</p>
            <p style="margin-top: 15px; font-size: 12px;">📍 д. Пазял, Можгинский район</p>
        </div>
    `;

    document.body.appendChild(modal);

    // Закрытие по клику на фон
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            closeAudioPlayer();
        }
    });
}

// Закрытие модального плеера
function closeAudioPlayer() {
    const modal = document.getElementById('audioModal');
    if (modal) {
        // Останавливаем воспроизведение
        const audio = modal.querySelector('audio');
        if (audio) {
            audio.pause();
            audio.src = '';
        }
        modal.remove();
    }
}

// Делаем функции глобально доступными
window.openAudioPlayer = openAudioPlayer;
window.closeAudioPlayer = closeAudioPlayer;


// Форматирование даты
function formatDate(dateStr) {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// Обновление пагинации
function updatePagination(totalPages) {
    const pagination = document.getElementById('pagination');
    if (!pagination) return;

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');
    const pageInfo = document.getElementById('pageInfo');

    if (prevBtn) prevBtn.disabled = currentPage === 1;
    if (nextBtn) nextBtn.disabled = currentPage === totalPages;
    if (pageInfo) pageInfo.textContent = `Страница ${currentPage} из ${totalPages}`;
}

// Смена страницы
function changePage(delta) {
    currentPage += delta;
    renderMaterials();
    window.scrollTo({ top: 400, behavior: 'smooth' });
}

// Просмотр материала
function viewMaterial(id) {
    const material = materialsData.find(m => m.id === id);
    if (!material) {
        alert('Материал не найден');
        return;
    }

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
${material.transcription.full || 'Не добавена'}
    `);
}