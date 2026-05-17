# config.py
import os
from dotenv import load_dotenv

load_dotenv()


class Config:
    # Настройки приложения
    SECRET_KEY = os.environ.get('SECRET_KEY') or 'dev-secret-key-change-in-production'

    # Настройки базы данных
    DB_HOST = os.environ.get('DB_HOST') or 'localhost'
    DB_USER = os.environ.get('DB_USER') or 'root'
    DB_PASSWORD = os.environ.get('DB_PASSWORD') or ''  # Ваш пароль от MySQL
    DB_NAME = os.environ.get('DB_NAME') or 'pazyal_corpus'
    DB_PORT = int(os.environ.get('DB_PORT') or 3306)

    # Настройки загрузки файлов
    UPLOAD_FOLDER = os.path.join('static', 'uploads')
    MAX_CONTENT_LENGTH = 500 * 1024 * 1024  # 500 MB
    ALLOWED_AUDIO_EXTENSIONS = {'mp3', 'wav', 'm4a', 'ogg', 'flac'}
    ALLOWED_VIDEO_EXTENSIONS = {'mp4', 'avi', 'mov', 'mkv'}