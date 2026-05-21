# app.py
import os
import uuid
import base64
from datetime import datetime
from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
import pymysql
import requests as http_requests

app = Flask(__name__)

# Конфигурация
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key')
app.config['UPLOAD_FOLDER'] = os.path.join('static', 'uploads')
app.config['MAX_CONTENT_LENGTH'] = 500 * 1024 * 1024

# CORS
CORS(app)

# Создаем папки
os.makedirs(os.path.join('static', 'uploads', 'audio'), exist_ok=True)
os.makedirs(os.path.join('static', 'uploads', 'video'), exist_ok=True)

# Mutagen для длительности
try:
    from mutagen.mp3 import MP3
    from mutagen.wave import WAVE
    from mutagen.flac import FLAC
    from mutagen.oggvorbis import OggVorbis
    MUTAGEN_OK = True
except ImportError:
    MUTAGEN_OK = False


def get_audio_duration(filepath):
    if not MUTAGEN_OK:
        return 0
    try:
        ext = os.path.splitext(filepath)[1].lower()
        if ext == '.mp3': return int(MP3(filepath).info.length)
        elif ext == '.wav': return int(WAVE(filepath).info.length)
        elif ext == '.flac': return int(FLAC(filepath).info.length)
        elif ext in ['.ogg', '.opus']: return int(OggVorbis(filepath).info.length)
        return 0
    except:
        return 0


def get_db_connection():
    return pymysql.connect(
        host=os.environ.get('DB_HOST', 'localhost'),
        user=os.environ.get('DB_USER', 'root'),
        password=os.environ.get('DB_PASSWORD', ''),
        database=os.environ.get('DB_NAME', 'pazyal_corpus'),
        port=int(os.environ.get('DB_PORT', 3306)),
        charset='utf8mb4',
        cursorclass=pymysql.cursors.DictCursor
    )


def allowed_file(filename, file_type):
    if not filename or '.' not in filename:
        return False
    ext = filename.rsplit('.', 1)[1].lower()
    if file_type == 'audio':
        return ext in {'mp3', 'wav', 'm4a', 'ogg', 'flac', 'opus', 'webm'}
    return ext in {'mp4', 'avi', 'mov', 'mkv', 'webm'}


def generate_filename(original_filename):
    ext = original_filename.rsplit('.', 1)[1].lower()
    return f"{uuid.uuid4().hex}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.{ext}"


def format_duration(seconds):
    if not seconds: return '00:00'
    h, m = divmod(seconds, 3600)
    m, s = divmod(m, 60)
    return f"{int(h)}:{str(int(m)).zfill(2)}" if h else f"{int(m)}:{str(int(s)).zfill(2)}"


# ============================================
# СТРАНИЦЫ
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
# API: ТРАНСКРИБАЦИЯ (Google Speech-to-Text)
# ============================================

@app.route('/api/transcribe', methods=['POST'])
def transcribe_audio():
    try:
        if 'audioFile' not in request.files:
            return jsonify({'success': False, 'error': 'Аудиофайл не найден'}), 400

        audio_file = request.files['audioFile']
        if not audio_file or not audio_file.filename:
            return jsonify({'success': False, 'error': 'Файл не выбран'}), 400

        print(f"🎙️ Транскрибация: {audio_file.filename}")

        api_key = os.environ.get('GOOGLE_SPEECH_API_KEY', '')
        if not api_key:
            return jsonify({
                'success': True,
                'transcript': '[Демо] API ключ не настроен',
                'confidence': 0, 'fragments': 1, 'demo': True
            })

        # Определяем кодировку
        filename = audio_file.filename.lower()
        format_map = {
            '.mp3': ('MP3', 44100), '.wav': ('LINEAR16', 44100),
            '.flac': ('FLAC', 44100), '.ogg': ('OGG_OPUS', 48000),
            '.webm': ('WEBM_OPUS', 48000), '.m4a': ('MP3', 44100),
            '.opus': ('OGG_OPUS', 48000)
        }
        encoding, sample_rate = 'MP3', 44100
        for ext, info in format_map.items():
            if filename.endswith(ext):
                encoding, sample_rate = info
                break

        # Кодируем аудио
        audio_content = audio_file.read()
        audio_base64 = base64.b64encode(audio_content).decode('utf-8')

        # Отправляем в Google
        print(f"📤 Отправка в Google (encoding={encoding})...")
        url = f"https://speech.googleapis.com/v1/speech:recognize?key={api_key}"
        resp = http_requests.post(url, json={
            "config": {
                "encoding": encoding,
                "sampleRateHertz": sample_rate,
                "languageCode": "ru-RU",
                "enableAutomaticPunctuation": True,
                "useEnhanced": True
            },
            "audio": {"content": audio_base64}
        }, timeout=120)

        if resp.status_code != 200:
            error_msg = resp.json().get('error', {}).get('message', 'Ошибка API')
            print(f"❌ Google API error: {error_msg}")
            return jsonify({'success': False, 'error': error_msg}), 500

        result = resp.json()
        transcript_parts = []

        if 'results' in result:
            for i, res in enumerate(result['results']):
                text = res['alternatives'][0]['transcript'].strip()
                if text:
                    m, s = divmod(i * 5, 60)
                    transcript_parts.append(f"[{m:02d}:{s:02d}] {text}")

        full_text = '\n'.join(transcript_parts) if transcript_parts else 'Речь не распознана'
        print(f"✅ Распознано: {len(transcript_parts)} фрагментов")

        return jsonify({
            'success': True,
            'transcript': full_text,
            'confidence': 90,
            'fragments': len(transcript_parts),
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
                i.age, i.gender, i.education, i.native_language, i.russian_level,
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
            dur = (m['audio_duration'] or 0) + (m['video_duration'] or 0)
            formatted.append({
                'id': m['record_id'],
                'informant': {
                    'age': m['age'], 'gender': m['gender'],
                    'education': m['education'], 'nativeLanguage': m['native_language'],
                    'russianLevel': m['russian_level']
                },
                'record': {
                    'date': str(m['record_date']), 'location': m['location'],
                    'topic': m['topic'], 'duration': format_duration(dur)
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
        return jsonify({'success': True, 'data': formatted})
    except Exception as e:
        print(f"❌ Ошибка: {e}")
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
        s = cursor.fetchone()
        cursor.close()
        conn.close()

        sec = s['total_seconds'] or 0
        h, m = divmod(sec // 60, 60)
        return jsonify({'success': True, 'data': {
            'totalRecords': s['total_records'] or 0,
            'totalInformants': s['total_informants'] or 0,
            'avgAge': int(s['avg_age'] or 0),
            'totalDuration': f"{h}:{str(m).zfill(2)}"
        }})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/materials/<int:record_id>', methods=['DELETE'])
def delete_material(record_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM record WHERE record_id = %s", (record_id,))
        conn.commit()
        cursor.close()
        conn.close()
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/api/materials', methods=['POST'])
def add_material():
    try:
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
            full_path = os.path.join('static', 'uploads', 'audio', filename)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            audio_file.save(full_path)
            audio_path = os.path.join('uploads', 'audio', filename).replace('\\', '/')
            audio_format = filename.rsplit('.', 1)[1].lower()
            audio_duration = get_audio_duration(full_path)

        # Сохраняем видео
        if video_file and video_file.filename and allowed_file(video_file.filename, 'video'):
            filename = generate_filename(video_file.filename)
            full_path = os.path.join('static', 'uploads', 'video', filename)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            video_file.save(full_path)
            video_path = os.path.join('uploads', 'video', filename).replace('\\', '/')

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
            '', request.form.get('comments', '')
        ))

        if video_path:
            cursor.execute(
                "INSERT INTO video_file (record_id, file_path, duration, format) VALUES (LAST_INSERT_ID(), %s, %s, %s)",
                (video_path, video_duration, video_path.rsplit('.', 1)[1].lower())
            )

        conn.commit()
        cursor.execute("SELECT @new_record_id AS new_id")
        result = cursor.fetchone()
        new_id = result['new_id'] if result else None
        cursor.close()
        conn.close()

        return jsonify({'success': True, 'record_id': new_id})
    except Exception as e:
        print(f"❌ Ошибка: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'success': False, 'error': str(e)}), 500


if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port, debug=False)