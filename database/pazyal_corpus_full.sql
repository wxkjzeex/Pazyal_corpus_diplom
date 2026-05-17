-- ============================================
-- БАЗА ДАННЫХ: Корпус русской речи д. Пазял
-- Версия: 2.0 (полная)
-- Кодировка: utf8mb4
-- СУБД: MySQL 8.0+
-- ============================================

-- Удаляем БД если существует (осторожно!)
DROP DATABASE IF EXISTS pazyal_corpus;

-- Создаем новую базу данных
CREATE DATABASE pazyal_corpus 
    CHARACTER SET utf8mb4 
    COLLATE utf8mb4_unicode_ci;

-- Выбираем БД
USE pazyal_corpus;

-- ============================================
-- ТАБЛИЦА 1: informant (Информанты)
-- ============================================
CREATE TABLE informant (
    informant_id INT PRIMARY KEY AUTO_INCREMENT,
    age INT NOT NULL COMMENT 'Возраст',
    gender VARCHAR(10) NOT NULL COMMENT 'Пол',
    education VARCHAR(100) NOT NULL COMMENT 'Образование',
    native_language VARCHAR(50) NOT NULL COMMENT 'Родной язык',
    russian_level VARCHAR(50) NOT NULL COMMENT 'Уровень владения русским',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Информанты';

-- ============================================
-- ТАБЛИЦА 2: record (Записи речи)
-- ============================================
CREATE TABLE record (
    record_id INT PRIMARY KEY AUTO_INCREMENT,
    informant_id INT NOT NULL,
    record_date DATE NOT NULL COMMENT 'Дата записи',
    location VARCHAR(255) NOT NULL COMMENT 'Место записи',
    topic TEXT NOT NULL COMMENT 'Тема',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (informant_id) REFERENCES informant(informant_id) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Записи речи';

-- ============================================
-- ТАБЛИЦА 3: audio_file (Аудиозаписи)
-- ============================================
CREATE TABLE audio_file (
    audio_id INT PRIMARY KEY AUTO_INCREMENT,
    record_id INT NOT NULL,
    file_path VARCHAR(500) NOT NULL COMMENT 'Путь к файлу',
    duration INT DEFAULT NULL COMMENT 'Длительность (сек)',
    file_size INT DEFAULT NULL COMMENT 'Размер (байт)',
    format VARCHAR(20) DEFAULT 'mp3' COMMENT 'Формат',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES record(record_id) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Аудиофайлы';

-- ============================================
-- ТАБЛИЦА 4: video_file (Видеозаписи)
-- ============================================
CREATE TABLE video_file (
    video_id INT PRIMARY KEY AUTO_INCREMENT,
    record_id INT NOT NULL,
    file_path VARCHAR(500) NOT NULL COMMENT 'Путь к файлу',
    duration INT DEFAULT NULL COMMENT 'Длительность (сек)',
    file_size INT DEFAULT NULL COMMENT 'Размер (байт)',
    format VARCHAR(20) DEFAULT 'mp4' COMMENT 'Формат',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES record(record_id) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Видеофайлы';

-- ============================================
-- ТАБЛИЦА 5: transcription (Транскрипции)
-- ============================================
CREATE TABLE transcription (
    transcription_id INT PRIMARY KEY AUTO_INCREMENT,
    record_id INT NOT NULL,
    content LONGTEXT NOT NULL COMMENT 'Текст транскрипции',
    transcription_date DATE COMMENT 'Дата расшифровки',
    transcriber VARCHAR(100) COMMENT 'Расшифровщик',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES record(record_id) 
        ON DELETE CASCADE ON UPDATE CASCADE,
    FULLTEXT INDEX idx_content (content)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Текстовые транскрипции';

-- ============================================
-- ТАБЛИЦА 6: metadata (Метаданные)
-- ============================================
CREATE TABLE metadata (
    meta_id INT PRIMARY KEY AUTO_INCREMENT,
    record_id INT NOT NULL,
    equipment VARCHAR(255) COMMENT 'Оборудование',
    recording_conditions TEXT COMMENT 'Условия записи',
    noise_level VARCHAR(50) COMMENT 'Уровень шума',
    speech_genre VARCHAR(100) COMMENT 'Жанр речи',
    comments TEXT COMMENT 'Комментарии',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (record_id) REFERENCES record(record_id) 
        ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Метаданные записей';

-- ============================================
-- ИНДЕКСЫ
-- ============================================
CREATE INDEX idx_informant_age ON informant(age);
CREATE INDEX idx_informant_gender ON informant(gender);
CREATE INDEX idx_informant_education ON informant(education);
CREATE INDEX idx_record_date ON record(record_date);
CREATE INDEX idx_record_informant_id ON record(informant_id);
CREATE INDEX idx_audio_record_id ON audio_file(record_id);
CREATE INDEX idx_video_record_id ON video_file(record_id);
CREATE INDEX idx_transcription_record_id ON transcription(record_id);
CREATE INDEX idx_metadata_record_id ON metadata(record_id);

-- ============================================
-- ПРЕДСТАВЛЕНИЯ (VIEWS)
-- ============================================

-- Представление 1: Полная информация о записи
CREATE VIEW v_record_full AS
SELECT 
    r.record_id, r.record_date, r.location, r.topic,
    i.informant_id, i.age, i.gender, i.education, i.native_language, i.russian_level,
    a.file_path AS audio_path, a.duration AS audio_duration, a.format AS audio_format,
    v.file_path AS video_path, v.duration AS video_duration,
    t.content AS transcription_text, t.transcriber,
    m.equipment, m.recording_conditions, m.noise_level, m.speech_genre, m.comments
FROM record r
JOIN informant i ON r.informant_id = i.informant_id
LEFT JOIN audio_file a ON r.record_id = a.record_id
LEFT JOIN video_file v ON r.record_id = v.record_id
LEFT JOIN transcription t ON r.record_id = t.record_id
LEFT JOIN metadata m ON r.record_id = m.record_id;

-- Представление 2: Статистика по информантам
CREATE VIEW v_informant_stats AS
SELECT 
    i.informant_id, i.age, i.gender, i.education, i.native_language, i.russian_level,
    COUNT(DISTINCT r.record_id) AS total_records,
    COUNT(DISTINCT a.audio_id) AS total_audio,
    COUNT(DISTINCT v.video_id) AS total_video,
    SUM(COALESCE(a.duration, 0)) AS total_duration_seconds,
    CASE 
        WHEN i.age < 30 THEN '18-29'
        WHEN i.age BETWEEN 30 AND 45 THEN '30-45'
        WHEN i.age BETWEEN 46 AND 60 THEN '46-60'
        ELSE '60+'
    END AS age_group
FROM informant i
LEFT JOIN record r ON i.informant_id = r.informant_id
LEFT JOIN audio_file a ON r.record_id = a.record_id
LEFT JOIN video_file v ON r.record_id = v.record_id
GROUP BY i.informant_id;

-- Представление 3: Материалы с аудио
CREATE VIEW v_materials_with_audio AS
SELECT 
    r.record_id, r.topic, r.record_date, i.gender, i.age,
    a.file_path AS audio_path, a.duration AS audio_duration,
    CASE WHEN t.content IS NOT NULL THEN 'Есть' ELSE 'Нет' END AS has_transcription
FROM record r
JOIN informant i ON r.informant_id = i.informant_id
JOIN audio_file a ON r.record_id = a.record_id
LEFT JOIN transcription t ON r.record_id = t.record_id
ORDER BY r.record_date DESC;

-- Представление 4: Аналитика по жанрам речи
CREATE VIEW v_speech_genre_stats AS
SELECT 
    COALESCE(m.speech_genre, 'Не указан') AS genre,
    COUNT(*) AS count,
    ROUND(AVG(i.age), 0) AS avg_age,
    COUNT(DISTINCT i.informant_id) AS unique_informants
FROM metadata m
JOIN record r ON m.record_id = r.record_id
JOIN informant i ON r.informant_id = i.informant_id
GROUP BY m.speech_genre;

-- ============================================
-- ТРИГГЕРЫ
-- ============================================

-- Триггер 1: Автофиксация даты изменения записи
DELIMITER //
CREATE TRIGGER trg_record_before_update
BEFORE UPDATE ON record
FOR EACH ROW
BEGIN
    SET NEW.updated_at = CURRENT_TIMESTAMP;
END //
DELIMITER ;

-- Триггер 2: Проверка данных информанта
DELIMITER //
CREATE TRIGGER trg_informant_before_insert
BEFORE INSERT ON informant
FOR EACH ROW
BEGIN
    IF NEW.age < 18 OR NEW.age > 100 THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Ошибка: возраст информанта должен быть от 18 до 100 лет';
    END IF;
    IF NEW.gender NOT IN ('мужской', 'женский') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Ошибка: недопустимое значение пола';
    END IF;
    IF NEW.russian_level NOT IN ('начальный', 'средний', 'хороший', 'свободное владение') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Ошибка: недопустимый уровень владения русским языком';
    END IF;
END //
DELIMITER ;

-- Триггер 3: Автофиксация даты транскрипции
DELIMITER //
CREATE TRIGGER trg_transcription_before_insert
BEFORE INSERT ON transcription
FOR EACH ROW
BEGIN
    IF NEW.transcription_date IS NULL THEN
        SET NEW.transcription_date = CURDATE();
    END IF;
    IF NEW.transcriber IS NULL OR NEW.transcriber = '' THEN
        SET NEW.transcriber = 'Не указан';
    END IF;
END //
DELIMITER ;

-- Триггер 4: Проверка аудиофайла
DELIMITER //
CREATE TRIGGER trg_audio_before_insert
BEFORE INSERT ON audio_file
FOR EACH ROW
BEGIN
    IF NEW.format NOT IN ('mp3', 'wav', 'm4a', 'ogg', 'flac') THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Ошибка: недопустимый формат аудиофайла';
    END IF;
    IF NEW.duration IS NULL OR NEW.duration < 0 THEN
        SET NEW.duration = 0;
    END IF;
END //
DELIMITER ;

-- ============================================
-- ХРАНИМЫЕ ПРОЦЕДУРЫ
-- ============================================

-- Процедура 1: Добавление полной записи
DELIMITER //
CREATE PROCEDURE sp_add_full_record(
    IN p_age INT,
    IN p_gender VARCHAR(10),
    IN p_education VARCHAR(100),
    IN p_native_language VARCHAR(50),
    IN p_russian_level VARCHAR(50),
    IN p_record_date DATE,
    IN p_location VARCHAR(255),
    IN p_topic TEXT,
    IN p_audio_path VARCHAR(500),
    IN p_audio_duration INT,
    IN p_audio_format VARCHAR(20),
    IN p_transcription TEXT,
    IN p_transcriber VARCHAR(100),
    IN p_equipment VARCHAR(255),
    IN p_recording_conditions TEXT,
    IN p_noise_level VARCHAR(50),
    IN p_speech_genre VARCHAR(100),
    IN p_comments TEXT
)
BEGIN
    DECLARE v_informant_id INT;
    DECLARE v_record_id INT;
    
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;
    
    START TRANSACTION;
    
    INSERT INTO informant (age, gender, education, native_language, russian_level)
    VALUES (p_age, p_gender, p_education, p_native_language, p_russian_level);
    SET v_informant_id = LAST_INSERT_ID();
    
    INSERT INTO record (informant_id, record_date, location, topic)
    VALUES (v_informant_id, p_record_date, p_location, p_topic);
    SET v_record_id = LAST_INSERT_ID();
    
    IF p_audio_path IS NOT NULL AND p_audio_path != '' THEN
        INSERT INTO audio_file (record_id, file_path, duration, format)
        VALUES (v_record_id, p_audio_path, p_audio_duration, p_audio_format);
    END IF;
    
    IF p_transcription IS NOT NULL AND p_transcription != '' THEN
        INSERT INTO transcription (record_id, content, transcription_date, transcriber)
        VALUES (v_record_id, p_transcription, CURDATE(), p_transcriber);
    END IF;
    
    INSERT INTO metadata (record_id, equipment, recording_conditions, noise_level, speech_genre, comments)
    VALUES (v_record_id, p_equipment, p_recording_conditions, p_noise_level, p_speech_genre, p_comments);
    
    COMMIT;
    SELECT v_record_id AS new_record_id, v_informant_id AS new_informant_id;
END //
DELIMITER ;

-- Процедура 2: Обновление метаданных
DELIMITER //
CREATE PROCEDURE sp_update_metadata(
    IN p_record_id INT,
    IN p_equipment VARCHAR(255),
    IN p_recording_conditions TEXT,
    IN p_noise_level VARCHAR(50),
    IN p_speech_genre VARCHAR(100),
    IN p_comments TEXT
)
BEGIN
    DECLARE v_meta_id INT;
    
    SELECT meta_id INTO v_meta_id FROM metadata WHERE record_id = p_record_id;
    
    IF v_meta_id IS NOT NULL THEN
        UPDATE metadata 
        SET equipment = COALESCE(p_equipment, equipment),
            recording_conditions = COALESCE(p_recording_conditions, recording_conditions),
            noise_level = COALESCE(p_noise_level, noise_level),
            speech_genre = COALESCE(p_speech_genre, speech_genre),
            comments = COALESCE(p_comments, comments)
        WHERE record_id = p_record_id;
    ELSE
        INSERT INTO metadata (record_id, equipment, recording_conditions, noise_level, speech_genre, comments)
        VALUES (p_record_id, p_equipment, p_recording_conditions, p_noise_level, p_speech_genre, p_comments);
    END IF;
    
    SELECT 'Метаданные обновлены' AS status;
END //
DELIMITER ;

-- ============================================
-- ГОТОВО
-- ============================================
SELECT '✅ База данных pazyal_corpus v2.0 создана!' AS status;
SELECT '📊 Таблиц: 6' AS info;
SELECT '👁️ Представлений: 4' AS info;
SELECT '⚡ Триггеров: 4' AS info;
SELECT '📦 Процедур: 2' AS info;