# app.py
import os
import uuid
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import pymysql
from config import Config

app = Flask(__name__)
app.config.from_object(Config)
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024  # 500 MB
CORS(app)

# Создаем папки для загрузок
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'audio'), exist_ok=True)
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'video'), exist_ok=True)

# ============================================
# ЗАГРУЗКА МОДЕЛЕЙ
# ============================================

# Whisper
whisper_model = None
try:
    import whisper

    print("🔄 Загрузка модели Whisper (small)...")
    whisper_model = whisper.load_model("small")
    print("✅ Whisper загружен")
except ImportError:
    print("⚠️ Whisper не установлен: pip install openai-whisper")
except Exception as e:
    print(f"⚠️ Ошибка загрузки Whisper: {e}")

# Mutagen для длительности
try:
    from mutagen.mp3 import MP3
    from mutagen.wave import WAVE
    from mutagen.flac import FLAC
    from mutagen.oggvorbis import OggVorbis

    MUTAGEN_AVAILABLE = True
    print("✅ Mutagen загружен")
except ImportError:
    MUTAGEN_AVAILABLE = False
    MP3 = WAVE = FLAC = OggVorbis = None
    print("⚠️ Mutagen не установлен: pip install mutagen")


def get_audio_duration(filepath):
    """Получение длительности аудиофайла"""
    if not MUTAGEN_AVAILABLE:
        return 0
    try:
        ext = os.path.splitext(filepath)[1].lower()
        if ext == '.mp3':
            return int(MP3(filepath).info.length)
        elif ext == '.wav':
            return int(WAVE(filepath).info.length)
        elif ext == '.flac':
            return int(FLAC(filepath).info.length)
        elif ext in ['.ogg', '.opus']:
            return int(OggVorbis(filepath).info.length)
        return 0
    except Exception as e:
        print(f"⚠️ Не удалось определить длительность: {e}")
        return 0


# ============================================
# ПОДКЛЮЧЕНИЕ К БАЗЕ ДАННЫХ
# ============================================

def get_db_connection():
    """Создает и возвращает соединение с БД"""
    try:
        conn = pymysql.connect(
            host=app.config['DB_HOST'],
            user=app.config['DB_USER'],
            password=app.config['DB_PASSWORD'],
            database=app.config['DB_NAME'],
            port=app.config['DB_PORT'],
            charset='utf8mb4',
            cursorclass=pymysql.cursors.DictCursor,
            ssl=None,
            autocommit=False
        )
        return conn
    except Exception as e:
        print(f"❌ Ошибка подключения к БД: {e}")
        raise


def allowed_file(filename, file_type):
    """Проверка допустимого расширения файла"""
    if not filename or '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    if file_type == 'audio':
        return ext in {'mp3', 'wav', 'm4a', 'ogg', 'flac', 'opus'}
    return ext in {'mp4', 'avi', 'mov', 'mkv', 'webm'}


def generate_filename(original_filename):
    """Генерация уникального имени файла"""
    ext = original_filename.rsplit('.', 1)[1].lower()
    return f"{uuid.uuid4().hex}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}"


def format_duration(seconds):
    """Форматирование длительности"""
    if not seconds:
        return '00:00'
    hours = seconds // 3600
    minutes = (seconds % 3600) // 60
    if hours > 0:
        return f"{hours}:{str(minutes).zfill(2)}"
    return f"{minutes}:{str(seconds % 60).zfill(2)}"


# ============================================
# МАРШРУТЫ ДЛЯ СТРАНИЦ
# ============================================

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/about-village.html')
def about_village():
    return render_template('about-village.html')


@app.route('/bilingualism.html')
def bilingualism():
    return render_template('bilingualism.html')


@app.route('/materials.html')
def materials():
    return render_template('materials.html')


@app.route('/research.html')
def research():
    return render_template('research.html')


# ============================================
# API: ТРАНСКРИБАЦИЯ
# ============================================

@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    """Распознавание речи через Whisper (локально)"""
    try:
        if 'audioFile' not in request.files:
            return jsonify({'success': False, 'error': 'Аудиофайл не найден'}), 400

        audio_file = request.files['audioFile']
        if not audio_file or not audio_file.filename:
            return jsonify({'success': False, 'error': 'Файл не выбран'}), 400

        print(f"📁 Транскрибация файла: {audio_file.filename}")

        if whisper_model is None:
            return jsonify({
                'success': True,
                'transcript': '[Демо-режим] Whisper не загружен.\nУстановите: pip install openai-whisper',
                'confidence': 0, 'fragments': 1, 'demo': True
            })

        import tempfile
        ext = os.path.splitext(audio_file.filename)[1] or '.mp3'
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name

        result = whisper_model.transcribe(tmp_path, language="ru", task="transcribe", verbose=False)
        os.unlink(tmp_path)

        transcript_parts = []
        for segment in result['segments']:
            m, s = divmod(int(segment['start']), 60)
            transcript_parts.append(f"[{m:02d}:{s:02d}] {segment['text'].strip()}")

        return jsonify({
            'success': True,
            'transcript': '\n'.join(transcript_parts),
            'confidence': 85,
            'fragments': len(transcript_parts),
            'model': 'whisper',
            'demo': False
        })

    except Exception as e:
        print(f"❌ Ошибка транскрибации: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================
# API: МАТЕРИАЛЫ
# ============================================

@app.route('/api/materials', methods=['GET'])
def get_materials():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                r.record_id, r.record_date, r.location, r.topic,
                i.informant_id, i.age, i.gender, i.education,
                i.native_language, i.russian_level,
                a.file_path AS audio_path, a.duration AS audio_duration,
                v.file_path AS video_path, v.duration AS video_duration,
                t.content AS transcription_text, t.transcriber,
                m.equipment, m.noise_level
            FROM record r
            JOIN informant i ON r.informant_id = i.informant_id
            LEFT JOIN audio_file a ON r.record_id = a.record_id
            LEFT JOIN video_file v ON r.record_id = v.record_id
            LEFT JOIN transcription t ON r.record_id = t.record_id
            LEFT JOIN metadata m ON r.record_id = m.record_id
            ORDER BY r.record_date DESC, r.record_id DESC
        """)
        materials = cursor.fetchall()
        cursor.close()
        conn.close()

        formatted = []
        for m in materials:
            total_dur = (m['audio_duration'] or 0) + (m['video_duration'] or 0)
            formatted.append({
                'id': m['record_id'],
                'informant': {
                    'age': m['age'], 'gender': m['gender'],
                    'education': m['education'], 'nativeLanguage': m['native_language'],
                    'russianLevel': m['russian_level']
                },
                'record': {
                    'date': str(m['record_date']), 'location': m['location'],
                    'topic': m['topic'], 'duration': format_duration(total_dur),
                    'duration_seconds': total_dur
                },
                'transcription': {
                    'preview': (m['transcription_text'][:150] + '...') if m['transcription_text'] else '',
                    'full': m['transcription_text'] or ''
                },
                'media': {
                    'hasAudio': m['audio_path'] is not None,
                    'hasVideo': m['video_path'] is not None,
                    'audioPath': m['audio_path'],
                    'videoPath': m['video_path'],
                    'audioFileName': os.path.basename(m['audio_path']) if m['audio_path'] else '',
                    'videoFileName': os.path.basename(m['video_path']) if m['video_path'] else ''
                },
                'metadata': {
                    'equipment': m['equipment'] or '',
                    'noiseLevel': m['noise_level'] or '',
                    'transcriber': m['transcriber'] or ''
                }
            })
        return jsonify({'success': True, 'data': formatted, 'total': len(formatted)})
    except Exception as e:
        print(f"❌ Ошибка get_materials: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/materials/<int:record_id>', methods=['PUT', 'POST'])
def update_material(record_id):
    """Обновление существующего материала"""
    try:
        print(f"📝 Обновление материала #{record_id}")

        conn = get_db_connection()
        cursor = conn.cursor()

        # Получаем данные из формы
        age = int(request.form.get('age', 0) or 0)
        gender = request.form.get('gender', '')
        education = request.form.get('education', '')
        native_language = request.form.get('nativeLanguage', 'удмуртский')
        russian_level = request.form.get('russianLevel', '')
        record_date = request.form.get('recordDate', datetime.now().strftime('%Y-%m-%d'))
        location = request.form.get('location', 'д. Пазял')
        topic = request.form.get('topic', '')
        transcription = request.form.get('transcription', '')
        transcriber = request.form.get('transcriber', '')
        equipment = request.form.get('equipment', '')
        noise_level = request.form.get('noiseLevel', 'низкий')
        conditions = request.form.get('conditions', '')
        comments = request.form.get('comments', '')

        # Обновляем информанта (находим через record)
        cursor.execute("""
            UPDATE informant i
            JOIN record r ON i.informant_id = r.informant_id
            SET i.age = %s, i.gender = %s, i.education = %s,
                i.native_language = %s, i.russian_level = %s
            WHERE r.record_id = %s
        """, (age, gender, education, native_language, russian_level, record_id))

        # Обновляем запись
        cursor.execute("""
            UPDATE record 
            SET record_date = %s, location = %s, topic = %s
            WHERE record_id = %s
        """, (record_date, location, topic, record_id))

        # Обновляем или создаем транскрипцию
        if transcription:
            cursor.execute("SELECT transcription_id FROM transcription WHERE record_id = %s", (record_id,))
            existing = cursor.fetchone()

            if existing:
                cursor.execute("""
                    UPDATE transcription 
                    SET content = %s, transcriber = %s, updated_at = CURRENT_TIMESTAMP
                    WHERE record_id = %s
                """, (transcription, transcriber, record_id))
            else:
                cursor.execute("""
                    INSERT INTO transcription (record_id, content, transcription_date, transcriber)
                    VALUES (%s, %s, CURDATE(), %s)
                """, (record_id, transcription, transcriber))

        # Обновляем или создаем метаданные
        cursor.execute("SELECT meta_id FROM metadata WHERE record_id = %s", (record_id,))
        existing_meta = cursor.fetchone()

        if existing_meta:
            cursor.execute("""
                UPDATE metadata 
                SET equipment = %s, noise_level = %s, recording_conditions = %s, comments = %s
                WHERE record_id = %s
            """, (equipment, noise_level, conditions, comments, record_id))
        else:
            cursor.execute("""
                INSERT INTO metadata (record_id, equipment, noise_level, recording_conditions, comments)
                VALUES (%s, %s, %s, %s, %s)
            """, (record_id, equipment, noise_level, conditions, comments))

        # Обработка новых файлов (если загружены)
        audio_file = request.files.get('audioFile')
        video_file = request.files.get('videoFile')

        if audio_file and audio_file.filename and allowed_file(audio_file.filename, 'audio'):
            # Удаляем старый аудиофайл
            cursor.execute("SELECT file_path FROM audio_file WHERE record_id = %s", (record_id,))
            old_audio = cursor.fetchone()
            if old_audio and old_audio['file_path']:
                old_path = os.path.join(app.static_folder, old_audio['file_path'])
                if os.path.exists(old_path):
                    os.remove(old_path)

            # Сохраняем новый
            filename = generate_filename(audio_file.filename)
            full_path = os.path.join(app.static_folder, 'uploads', 'audio', filename)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            audio_file.save(full_path)
            audio_path = os.path.join('uploads', 'audio', filename).replace('\\', '/')
            audio_duration = get_audio_duration(full_path)
            audio_format = filename.rsplit('.', 1)[1].lower()

            cursor.execute("DELETE FROM audio_file WHERE record_id = %s", (record_id,))
            cursor.execute(
                "INSERT INTO audio_file (record_id, file_path, duration, format) VALUES (%s, %s, %s, %s)",
                (record_id, audio_path, audio_duration, audio_format)
            )

        if video_file and video_file.filename and allowed_file(video_file.filename, 'video'):
            # Удаляем старое видео
            cursor.execute("SELECT file_path FROM video_file WHERE record_id = %s", (record_id,))
            old_video = cursor.fetchone()
            if old_video and old_video['file_path']:
                old_path = os.path.join(app.static_folder, old_video['file_path'])
                if os.path.exists(old_path):
                    os.remove(old_path)

            # Сохраняем новое
            filename = generate_filename(video_file.filename)
            full_path = os.path.join(app.static_folder, 'uploads', 'video', filename)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            video_file.save(full_path)
            video_path = os.path.join('uploads', 'video', filename).replace('\\', '/')

            cursor.execute("DELETE FROM video_file WHERE record_id = %s", (record_id,))
            cursor.execute(
                "INSERT INTO video_file (record_id, file_path, duration, format) VALUES (%s, %s, %s, %s)",
                (record_id, video_path, 0, video_path.rsplit('.', 1)[1].lower())
            )

        conn.commit()
        cursor.close()
        conn.close()

        print(f"✅ Материал #{record_id} обновлен")

        return jsonify({'success': True, 'message': 'Материал обновлен', 'record_id': record_id})

    except Exception as e:
        print(f"❌ Ошибка обновления материала: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/api/materials/stats', methods=['GET'])
def get_stats():
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                COUNT(DISTINCT r.record_id) AS total_records,
                COUNT(DISTINCT i.informant_id) AS total_informants,
                ROUND(AVG(i.age), 0) AS avg_age,
                COALESCE(SUM(a.duration), 0) + COALESCE(SUM(v.duration), 0) AS total_seconds
            FROM informant i
            LEFT JOIN record r ON i.informant_id = r.informant_id
            LEFT JOIN audio_file a ON r.record_id = a.record_id
            LEFT JOIN video_file v ON r.record_id = v.record_id
        """)
        stats = cursor.fetchone()
        cursor.close()
        conn.close()

        total_sec = stats['total_seconds'] or 0
        hours, minutes = divmod(total_sec // 60, 60)

        return jsonify({'success': True, 'data': {
            'totalRecords': stats['total_records'] or 0,
            'totalInformants': stats['total_informants'] or 0,
            'avgAge': int(stats['avg_age'] or 0),
            'totalDuration': f"{hours}:{str(minutes).zfill(2)}"
        }})
    except Exception as e:
        print(f"❌ Ошибка get_stats: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/materials/<int:record_id>', methods=['DELETE'])
def delete_material(record_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Получаем пути к файлам
        cursor.execute("SELECT file_path FROM audio_file WHERE record_id = %s", (record_id,))
        audio_files = cursor.fetchall()
        cursor.execute("SELECT file_path FROM video_file WHERE record_id = %s", (record_id,))
        video_files = cursor.fetchall()

        # Удаляем запись (каскад)
        cursor.execute("DELETE FROM record WHERE record_id = %s", (record_id,))
        conn.commit()
        cursor.close()
        conn.close()

        # Удаляем файлы
        for f in audio_files + video_files:
            if f and f['file_path']:
                full_path = os.path.join(app.static_folder, f['file_path'])
                if os.path.exists(full_path):
                    os.remove(full_path)

        return jsonify({'success': True, 'message': 'Материал удален'})
    except Exception as e:
        print(f"❌ Ошибка удаления: {e}")
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/materials', methods=['POST'])
def add_material():
    try:
        print("=" * 50)
        print("📤 POST-запрос на добавление материала")
        print("Form:", dict(request.form))
        print("Files:", list(request.files.keys()))

        audio_file = request.files.get('audioFile')
        video_file = request.files.get('videoFile')

        audio_path = None
        audio_duration = 0
        audio_format = 'mp3'
        video_path = None
        video_duration = 0

        # Сохраняем аудио
        if audio_file and audio_file.filename and allowed_file(audio_file.filename, 'audio'):
            filename = generate_filename(audio_file.filename)
            full_path = os.path.join(app.static_folder, 'uploads', 'audio', filename)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            audio_file.save(full_path)
            audio_path = os.path.join('uploads', 'audio', filename).replace('\\', '/')
            audio_format = filename.rsplit('.', 1)[1].lower()
            audio_duration = get_audio_duration(full_path)
            print(f"✅ Аудио: {audio_path} ({audio_duration}с)")

        # Сохраняем видео
        if video_file and video_file.filename and allowed_file(video_file.filename, 'video'):
            filename = generate_filename(video_file.filename)
            full_path = os.path.join(app.static_folder, 'uploads', 'video', filename)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            video_file.save(full_path)
            video_path = os.path.join('uploads', 'video', filename).replace('\\', '/')
            print(f"✅ Видео: {video_path}")

        # Сохраняем в БД
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.callproc('sp_add_full_record', (
            int(request.form.get('age', 0) or 0),
            request.form.get('gender', ''),
            request.form.get('education', ''),
            request.form.get('nativeLanguage', 'удмуртский'),
            request.form.get('russianLevel', ''),
            request.form.get('recordDate', datetime.now().strftime('%Y-%m-%d')),
            request.form.get('location', 'д. Пазял'),
            request.form.get('topic', ''),
            audio_path, audio_duration, audio_format,
            request.form.get('transcription', ''),
            request.form.get('transcriber', ''),
            request.form.get('equipment', ''),
            request.form.get('conditions', ''),
            request.form.get('noiseLevel', 'низкий'),
            '',
            request.form.get('comments', '')
        ))

        # Если есть видео — добавляем отдельно
        if video_path:
            cursor.execute(
                "INSERT INTO video_file (record_id, file_path, duration, format) "
                "VALUES (LAST_INSERT_ID(), %s, %s, %s)",
                (video_path, video_duration, video_path.rsplit('.', 1)[1].lower())
            )

        conn.commit()
        cursor.execute("SELECT @new_record_id AS new_id")
        result = cursor.fetchone()
        new_id = result['new_id'] if result else None
        cursor.close()
        conn.close()

        print(f"✅ Материал добавлен, ID: {new_id}")
        return jsonify({'success': True, 'message': 'Материал добавлен', 'record_id': new_id})

    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


# ============================================
# ЗАПУСК
# ============================================

if __name__ == '__main__':
    app.run(debug=True, port=5000)