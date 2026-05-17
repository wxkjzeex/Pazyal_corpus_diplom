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
    """Распознавание речи из загруженного аудиофайла через Google Speech API"""
    try:
        print("=" * 50)
        print("🎙️ Получен запрос на транскрибацию аудиофайла")

        # Проверяем наличие файла
        if 'audioFile' not in request.files:
            return jsonify({
                'success': False,
                'error': 'Аудиофайл не найден в запросе'
            }), 400

        audio_file = request.files['audioFile']

        if not audio_file or not audio_file.filename:
            return jsonify({
                'success': False,
                'error': 'Аудиофайл не выбран'
            }), 400

        print(f"📁 Файл: {audio_file.filename}")
        print(f"📏 Размер: {audio_file.content_length} байт" if audio_file.content_length else "📏 Размер: неизвестен")
        print(f"📋 Тип: {audio_file.content_type}")

        # Определяем формат файла
        filename = audio_file.filename.lower()

        # Словарь форматов
        format_map = {
            '.mp3': {'encoding': 'MP3', 'sample_rate': 44100},
            '.wav': {'encoding': 'LINEAR16', 'sample_rate': 44100},
            '.flac': {'encoding': 'FLAC', 'sample_rate': 44100},
            '.ogg': {'encoding': 'OGG_OPUS', 'sample_rate': 48000},
            '.opus': {'encoding': 'OGG_OPUS', 'sample_rate': 48000},
            '.webm': {'encoding': 'WEBM_OPUS', 'sample_rate': 48000},
            '.m4a': {'encoding': 'MP3', 'sample_rate': 44100},
            '.aac': {'encoding': 'MP3', 'sample_rate': 44100},
        }

        # Находим формат
        encoding = None
        sample_rate_hertz = 44100

        for ext, info in format_map.items():
            if filename.endswith(ext):
                encoding = info['encoding']
                sample_rate_hertz = info['sample_rate']
                break

        if not encoding:
            return jsonify({
                'success': False,
                'error': f'Неподдерживаемый формат файла. Поддерживаются: MP3, WAV, FLAC, OGG, M4A, WEBM'
            }), 400

        print(f"🔧 Кодировка: {encoding}")
        print(f"🔧 Частота дискретизации: {sample_rate_hertz} Гц")

        # Читаем файл и кодируем в base64
        audio_content = audio_file.read()
        audio_base64 = base64.b64encode(audio_content).decode('utf-8')

        print(f"📦 Base64 длина: {len(audio_base64)} символов")

        # Проверяем размер (Google API: макс 10 МБ)
        if len(audio_content) > 10 * 1024 * 1024:
            return jsonify({
                'success': False,
                'error': 'Файл слишком большой. Максимальный размер: 10 МБ'
            }), 400

        # Проверяем наличие API ключа
        api_key = app.config.get('GOOGLE_SPEECH_API_KEY')
        if not api_key or api_key == 'ВАШ_API_КЛЮЧ_ЗДЕСЬ':
            print("⚠️ API ключ не настроен, возвращаем демо-ответ")
            # Возвращаем демо-транскрипцию для тестирования
            demo_text = f"""[00:00] (Демо-режим) Аудиофайл "{audio_file.filename}" успешно загружен.
[00:05] Формат: {encoding}, размер: {round(len(audio_content) / 1024, 1)} КБ
[00:10] Для реальной транскрибации настройте Google Speech API ключ в файле .env
[00:15] Инструкция: https://cloud.google.com/speech-to-text"""

            return jsonify({
                'success': True,
                'transcript': demo_text,
                'confidence': 100,
                'fragments': 4,
                'demo': True,
                'warning': 'Демо-режим. API ключ не настроен.'
            })

        # Формируем запрос к Google Speech API
        request_body = {
            "config": {
                "encoding": encoding,
                "sampleRateHertz": sample_rate_hertz,
                "languageCode": "ru-RU",
                "enableAutomaticPunctuation": True,
                "enableWordTimeOffsets": False,
                "model": "default",
                "useEnhanced": True
            },
            "audio": {
                "content": audio_base64
            }
        }

        print("📡 Отправка запроса к Google Speech API...")

        # Отправляем запрос
        url = f"https://speech.googleapis.com/v1/speech:recognize?key={api_key}"
        response = requests.post(
            url,
            json=request_body,
            headers={'Content-Type': 'application/json'},
            timeout=120  # Увеличенный таймаут для больших файлов
        )

        print(f"📡 Статус ответа: {response.status_code}")

        if response.status_code != 200:
            error_data = response.json() if response.text else {}
            error_msg = error_data.get('error', {}).get('message', 'Неизвестная ошибка API')
            print(f"❌ Ошибка API: {error_msg}")

            # Если ошибка из-за длительности, пробуем другой подход
            if 'duration' in error_msg.lower() or 'too long' in error_msg.lower():
                return jsonify({
                    'success': False,
                    'error': 'Аудиофайл слишком длинный. Максимальная длительность: 1 минута для синхронного распознавания.'
                }), 400

            return jsonify({
                'success': False,
                'error': f'Ошибка Google Speech API: {error_msg}'
            }), 500

        # Парсим ответ
        result = response.json()
        print("✅ Ответ получен, парсим результаты...")

        # Собираем транскрипцию
        transcript_parts = []
        confidence_total = 0
        confidence_count = 0

        if 'results' in result:
            total_results = len(result['results'])
            print(f"📝 Распознано результатов: {total_results}")

            for i, res in enumerate(result['results']):
                if 'alternatives' in res and len(res['alternatives']) > 0:
                    alt = res['alternatives'][0]
                    text = alt.get('transcript', '').strip()
                    confidence = alt.get('confidence', 0)

                    if text:
                        # Добавляем примерную временную метку
                        estimated_seconds = i * 5  # ~5 секунд на фразу
                        minutes = estimated_seconds // 60
                        seconds = estimated_seconds % 60
                        timestamp = f"[{minutes:02d}:{seconds:02d}]"

                        transcript_parts.append(f"{timestamp} {text}")
                        confidence_total += confidence
                        confidence_count += 1

                        print(f"  [{timestamp}] {text[:80]}...")

        if not transcript_parts:
            return jsonify({
                'success': False,
                'error': 'Не удалось распознать речь в аудиофайле. Возможные причины: нет речи, неразборчивая речь, шум.'
            }), 400

        full_transcript = '\n'.join(transcript_parts)
        avg_confidence = round((confidence_total / confidence_count * 100) if confidence_count > 0 else 0, 1)

        print(f"✅ Распознано {len(transcript_parts)} фрагментов")
        print(f"✅ Средняя уверенность: {avg_confidence}%")

        return jsonify({
            'success': True,
            'transcript': full_transcript,
            'confidence': avg_confidence,
            'fragments': len(transcript_parts),
            'demo': False
        })

    except requests.exceptions.Timeout:
        print("❌ Таймаут запроса к Google API")
        return jsonify({
            'success': False,
            'error': 'Превышено время ожидания. Попробуйте файл меньшего размера.'
        }), 504

    except Exception as e:
        print(f"❌ Ошибка при транскрибации: {str(e)}")
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