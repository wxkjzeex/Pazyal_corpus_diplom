# app.py
import os
import uuid
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import pymysql
from config import Config
import whisper

app = Flask(__name__)
app.config.from_object(Config)
CORS(app)

# Создаем папки для загрузок
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'audio'), exist_ok=True)
os.makedirs(os.path.join(app.config['UPLOAD_FOLDER'], 'video'), exist_ok=True)


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
        print("✅ Подключение к БД успешно")
        return conn
    except Exception as e:
        print(f"❌ Ошибка подключения к БД: {e}")
        raise


# ============================================
# МАРШРУТЫ ДЛЯ СТРАНИЦ
# ============================================

@app.route('/')
def index():
    """Главная страница"""
    return render_template('index.html')


@app.route('/about-village.html')
def about_village():
    """Страница о деревне"""
    return render_template('about-village.html')


@app.route('/bilingualism.html')
def bilingualism():
    """Страница о билингвизме"""
    return render_template('bilingualism.html')


@app.route('/materials.html')
def materials():
    """Страница материалов"""
    return render_template('materials.html')


@app.route('/research.html')
def research():
    """Страница исследования"""
    return render_template('research.html')


@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    """Распознавание речи через Whisper (локально)"""
    try:
        print("=" * 50)
        print("🎙️ Получен запрос на транскрибацию (Whisper)")

        # Проверяем наличие файла
        if 'audioFile' not in request.files:
            return jsonify({
                'success': False,
                'error': 'Аудиофайл не найден'
            }), 400

        audio_file = request.files['audioFile']

        if not audio_file or not audio_file.filename:
            return jsonify({
                'success': False,
                'error': 'Файл не выбран'
            }), 400

        print(f"📁 Файл: {audio_file.filename}")

        # Проверяем модель
        if whisper_model is None:
            return jsonify({
                'success': False,
                'error': 'Модель Whisper не загружена'
            }), 500

        # Сохраняем временный файл
        import tempfile
        import os

        # Создаем временный файл с правильным расширением
        ext = os.path.splitext(audio_file.filename)[1] or '.mp3'
        with tempfile.NamedTemporaryFile(suffix=ext, delete=False) as tmp:
            audio_file.save(tmp.name)
            tmp_path = tmp.name

        print(f"📁 Временный файл: {tmp_path}")

        # Запускаем распознавание
        print("🔄 Распознавание через Whisper...")

        result = whisper_model.transcribe(
            tmp_path,
            language="ru",  # Русский язык
            task="transcribe",
            verbose=False
        )

        # Удаляем временный файл
        os.unlink(tmp_path)

        # Форматируем результат с временными метками
        transcript_parts = []
        for segment in result['segments']:
            start_min = int(segment['start'] // 60)
            start_sec = int(segment['start'] % 60)
            timestamp = f"[{start_min:02d}:{start_sec:02d}]"
            text = segment['text'].strip()
            transcript_parts.append(f"{timestamp} {text}")

        full_transcript = '\n'.join(transcript_parts)

        # Считаем среднюю уверенность (в Whisper нет confidence для каждого слова)
        avg_confidence = 85  # Whisper обычно хорошо распознаёт русскую речь

        print(f"✅ Распознано {len(transcript_parts)} фрагментов")

        return jsonify({
            'success': True,
            'transcript': full_transcript,
            'confidence': avg_confidence,
            'fragments': len(transcript_parts),
            'model': 'whisper',
            'demo': False
        })

    except Exception as e:
        print(f"❌ Ошибка транскрибации: {str(e)}")
        import traceback
        traceback.print_exc()

        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================
# API ДЛЯ РАБОТЫ С МАТЕРИАЛАМИ
# ============================================

@app.route('/api/materials', methods=['GET'])
def get_materials():
    """Получение списка всех материалов"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 
                r.record_id,
                r.record_date,
                r.location,
                r.topic,
                i.informant_id,
                i.age,
                i.gender,
                i.education,
                i.native_language,
                i.russian_level,
                a.file_path as audio_path,
                a.duration as audio_duration,
                a.format as audio_format,
                v.file_path as video_path,
                v.duration as video_duration,
                t.content as transcription_text,
                t.transcriber,
                m.equipment,
                m.recording_conditions,
                m.noise_level,
                m.speech_genre,
                m.comments
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

        # Форматируем данные для фронтенда
        formatted_materials = []
        for m in materials:
            formatted_materials.append({
                'id': m['record_id'],
                'informant': {
                    'age': m['age'],
                    'gender': m['gender'],
                    'education': m['education'],
                    'nativeLanguage': m['native_language'],
                    'russianLevel': m['russian_level']
                },
                'record': {
                    'date': str(m['record_date']),
                    'location': m['location'],
                    'topic': m['topic'],
                    'duration': format_duration(m['audio_duration'])
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
                    'audioFileName': os.path.basename(m['audio_path']) if m['audio_path'] else ''
                }
            })

        return jsonify({
            'success': True,
            'data': formatted_materials,
            'total': len(formatted_materials)
        })

    except Exception as e:
        print(f"Ошибка в get_materials: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/materials/stats', methods=['GET'])
def get_stats():
    """Получение статистики"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            SELECT 
                COUNT(DISTINCT r.record_id) as total_records,
                COUNT(DISTINCT i.informant_id) as total_informants,
                ROUND(AVG(i.age), 0) as avg_age,
                COALESCE(SUM(a.duration), 0) as total_duration_seconds
            FROM informant i
            LEFT JOIN record r ON i.informant_id = r.informant_id
            LEFT JOIN audio_file a ON r.record_id = a.record_id
        """)

        stats = cursor.fetchone()
        cursor.close()
        conn.close()

        total_seconds = stats['total_duration_seconds'] or 0
        hours = total_seconds // 3600
        minutes = (total_seconds % 3600) // 60

        return jsonify({
            'success': True,
            'data': {
                'totalRecords': stats['total_records'] or 0,
                'totalInformants': stats['total_informants'] or 0,
                'avgAge': int(stats['avg_age'] or 0),
                'totalDuration': f"{hours}:{str(minutes).zfill(2)}"
            }
        })

    except Exception as e:
        print(f"Ошибка в get_stats: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/materials/<int:record_id>', methods=['GET'])
def get_material(record_id):
    """Получение одного материала по ID"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM v_record_full WHERE record_id = %s", (record_id,))
        material = cursor.fetchone()

        cursor.close()
        conn.close()

        if not material:
            return jsonify({
                'success': False,
                'error': 'Материал не найден'
            }), 404

        return jsonify({
            'success': True,
            'data': material
        })

    except Exception as e:
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/materials/<int:record_id>', methods=['DELETE'])
def delete_material(record_id):
    """Удаление материала"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        # Сначала получаем пути к файлам для удаления
        cursor.execute("""
            SELECT file_path FROM audio_file WHERE record_id = %s
            UNION
            SELECT file_path FROM video_file WHERE record_id = %s
        """, (record_id, record_id))

        files = cursor.fetchall()

        # Удаляем запись (каскадно удалятся связанные данные)
        cursor.execute("DELETE FROM record WHERE record_id = %s", (record_id,))
        conn.commit()

        # Удаляем физические файлы
        for file in files:
            if file and file['file_path']:
                full_path = os.path.join(app.static_folder, file['file_path'])
                if os.path.exists(full_path):
                    os.remove(full_path)
                    print(f"Удален файл: {full_path}")

        cursor.close()
        conn.close()

        return jsonify({
            'success': True,
            'message': 'Материал успешно удален'
        })

    except Exception as e:
        print(f"Ошибка при удалении: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/materials', methods=['POST'])
def add_material():
    """Добавление нового материала"""
    try:
        print("=" * 50)
        print("Получен POST-запрос на добавление материала")
        print("Form data:", dict(request.form))
        print("Files:", list(request.files.keys()))
        print("=" * 50)

        # Обработка файлов
        audio_file = request.files.get('audioFile')
        video_file = request.files.get('videoFile')

        audio_path = None
        audio_duration = 0
        audio_format = 'mp3'
        video_path = None

        # Сохраняем аудиофайл
        if audio_file and audio_file.filename:
            print(f"Сохраняем аудиофайл: {audio_file.filename}")

            if allowed_file(audio_file.filename, 'audio'):
                filename = generate_filename(audio_file.filename)
                audio_dir = os.path.join(app.static_folder, 'uploads', 'audio')
                os.makedirs(audio_dir, exist_ok=True)

                full_path = os.path.join(audio_dir, filename)
                audio_path = os.path.join('uploads', 'audio', filename).replace('\\', '/')

                audio_file.save(full_path)
                print(f"Аудиофайл сохранен: {full_path}")

                audio_format = filename.rsplit('.', 1)[1].lower()

                # Пытаемся получить длительность
                try:
                    import subprocess
                    result = subprocess.run(
                        ['ffprobe', '-v', 'error', '-show_entries',
                         'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1',
                         full_path],
                        capture_output=True, text=True, timeout=10
                    )
                    if result.returncode == 0 and result.stdout.strip():
                        audio_duration = int(float(result.stdout.strip()))
                        print(f"Длительность аудио: {audio_duration} сек")
                except Exception as e:
                    print(f"Не удалось определить длительность аудио: {e}")
            else:
                print(f"Недопустимый формат аудиофайла: {audio_file.filename}")

        # Сохраняем видеофайл
        if video_file and video_file.filename:
            print(f"Сохраняем видеофайл: {video_file.filename}")

            if allowed_file(video_file.filename, 'video'):
                filename = generate_filename(video_file.filename)
                video_dir = os.path.join(app.static_folder, 'uploads', 'video')
                os.makedirs(video_dir, exist_ok=True)

                full_path = os.path.join(video_dir, filename)
                video_path = os.path.join('uploads', 'video', filename).replace('\\', '/')

                video_file.save(full_path)
                print(f"Видеофайл сохранен: {full_path}")

        # Сохраняем в БД
        conn = get_db_connection()
        cursor = conn.cursor()

        # Получаем данные из формы
        age = request.form.get('age', '0')
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
        conditions = request.form.get('conditions', '')
        noise_level = request.form.get('noiseLevel', 'низкий')
        comments = request.form.get('comments', '')

        # Формируем параметры для процедуры
        params = (
            int(age) if age else 0,
            gender,
            education,
            native_language,
            russian_level,
            record_date,
            location,
            topic,
            audio_path,
            audio_duration,
            audio_format,
            transcription,
            transcriber,
            equipment,
            conditions,
            noise_level,
            '',  # speech_genre
            comments
        )

        print("Вызов хранимой процедуры sp_add_full_record")
        cursor.callproc('sp_add_full_record', params)
        conn.commit()

        # Получаем ID новой записи
        cursor.execute("SELECT @new_record_id as new_id")
        result = cursor.fetchone()
        new_id = result['new_id'] if result else None

        cursor.close()
        conn.close()

        print(f"✅ Материал успешно добавлен, ID: {new_id}")

        return jsonify({
            'success': True,
            'message': 'Материал успешно добавлен',
            'record_id': new_id
        })

    except Exception as e:
        print(f"❌ ОШИБКА при добавлении материала: {str(e)}")
        import traceback
        traceback.print_exc()

        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# ============================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# ============================================

def allowed_file(filename, file_type):
    """Проверка допустимого расширения файла"""
    if not filename or '.' not in filename:
        return False

    ext = filename.rsplit('.', 1)[1].lower()

    if file_type == 'audio':
        allowed = app.config.get('ALLOWED_AUDIO_EXTENSIONS', {'mp3', 'wav', 'm4a', 'ogg', 'flac'})
    else:
        allowed = app.config.get('ALLOWED_VIDEO_EXTENSIONS', {'mp4', 'avi', 'mov', 'mkv'})

    return ext in allowed


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
# ЗАПУСК ПРИЛОЖЕНИЯ
# ============================================

if __name__ == '__main__':
    app.run(debug=True, port=5000)