// Основной JavaScript для главной страницы
document.addEventListener('DOMContentLoaded', function() {
    console.log('Русская речь д. Пазял');
});

// Автоматическое выделение активной страницы
document.addEventListener('DOMContentLoaded', function() {
    // Получаем текущий URL
    const currentPath = window.location.pathname;

    // Определяем текущую страницу
    let currentPage = 'index';

    if (currentPath.includes('about-village')) {
        currentPage = 'about-village';
    } else if (currentPath.includes('bilingualism')) {
        currentPage = 'bilingualism';
    } else if (currentPath.includes('materials')) {
        currentPage = 'materials';
    } else if (currentPath.includes('research')) {
        currentPage = 'research';
    }

    // Убираем active у всех ссылок
    const allLinks = document.querySelectorAll('.nav-link');
    allLinks.forEach(link => link.classList.remove('active'));

    // Добавляем active на текущую страницу
    const activeLink = document.querySelector(`[data-page="${currentPage}"]`);
    if (activeLink) {
        activeLink.classList.add('active');
    }

    console.log('Текущая страница:', currentPage);
});