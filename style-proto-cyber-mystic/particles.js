// --- START OF FILE matrix_rain.js (Версия 3 - Стойкие символы, Отступы) ---

function getCssVariable(varName, fallbackValue) {
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
    return value || fallbackValue;
}
function getCssVariableNumber(varName, fallbackValue) {
    const value = parseFloat(getCssVariable(varName, fallbackValue));
    return isNaN(value) ? fallbackValue : value;
}

function startMatrix() {
    const canvas = document.getElementById('matrix-canvas');
    if (!canvas) {
        console.error('Canvas element "matrix-canvas" not found.');
        return;
    }
    const ctx = canvas.getContext('2d');

    let width = canvas.width = window.innerWidth;
    let height = canvas.height = window.innerHeight;

    // --- Читаем настройки из CSS ---
    const symbols = '0123456789';
    const fontSize = getCssVariableNumber('--matrix-font-size', 20);
    const spacingFactor = getCssVariableNumber('--matrix-column-spacing-factor', 1.3);
    const columnWidth = fontSize * spacingFactor; // Ширина колонки с учетом отступа
    const dropSpeed = getCssVariableNumber('--matrix-drop-interval', 45);
    const resetChance = 0.98; // Вероятность НЕ сбрасывать
    const fadeFactor = getCssVariableNumber('--matrix-fade-speed', 0.07);

    const matrixColors = [
        getCssVariable('--matrix-color-1', '#00F0FF'),
        getCssVariable('--matrix-color-2', '#A0A0B8'),
        getCssVariable('--matrix-color-3', 'rgba(200, 250, 255, 0.7)')
    ];
    const validMatrixColors = matrixColors.filter(color => !!color);
    if (validMatrixColors.length === 0) validMatrixColors.push('#00F0FF');

    let columns = Math.floor(width / columnWidth); // Рассчитываем кол-во колонок с отступом

    // --- ИЗМЕНЕНО: Храним объект {y: позиция, symbol: символ} ---
    const drops = [];
    function initializeDrops(numCols) {
        drops.length = 0; // Очищаем массив
        for (let i = 0; i < numCols; i++) {
            drops[i] = {
                y: Math.floor(Math.random() * (height / fontSize)), // Случайная начальная Y
                symbol: symbols[Math.floor(Math.random() * symbols.length)] // Случайный начальный символ
            };
        }
    }
    initializeDrops(columns); // Первая инициализация

    const bgColor = getCssVariable('--bg-color-dark', '#0A0E1A');
    let bgColorFade;
    const rgbMatch = bgColor.match(/\d+/g);
     if (bgColor.startsWith('rgba')) {
        bgColorFade = bgColor.replace(/[\d\.]+\)$/, `${fadeFactor})`);
    } else if (rgbMatch && rgbMatch.length >= 3) {
         bgColorFade = `rgba(${rgbMatch[0]}, ${rgbMatch[1]}, ${rgbMatch[2]}, ${fadeFactor})`;
    } else {
        bgColorFade = `rgba(10, 14, 26, ${fadeFactor})`;
    }


    let intervalId = null;

    function draw() {
        // Эффект затухания
        ctx.fillStyle = bgColorFade;
        ctx.fillRect(0, 0, width, height);

        ctx.font = `${fontSize}px monospace`;

        for (let i = 0; i < drops.length; i++) {
            const drop = drops[i]; // Получаем объект капли

            // --- ИСПОЛЬЗУЕМ СЛУЧАЙНЫЙ ЦВЕТ ---
            ctx.fillStyle = validMatrixColors[Math.floor(Math.random() * validMatrixColors.length)];

            // --- ИСПОЛЬЗУЕМ СОХРАНЕННЫЙ СИМВОЛ ---
            const text = drop.symbol;
            ctx.fillText(text, i * columnWidth, drop.y * fontSize); // Рисуем с учетом columnWidth

            // Двигаем каплю вниз
            drop.y++;

            // Если капля ушла за край + случайный шанс
            if (drop.y * fontSize > height && Math.random() > resetChance) {
                drop.y = 0; // Возвращаем наверх
                // --- МЕНЯЕМ СИМВОЛ ТОЛЬКО ПРИ СБРОСЕ ---
                drop.symbol = symbols[Math.floor(Math.random() * symbols.length)];
            }
        }
    }

    function run() {
        if (intervalId) clearInterval(intervalId);

        width = canvas.width = window.innerWidth;
        height = canvas.height = window.innerHeight;
        columns = Math.floor(width / columnWidth); // Пересчитываем колонки

        initializeDrops(columns); // Переинициализируем массив drops

        intervalId = setInterval(draw, dropSpeed);
        console.log(`Matrix rain (v3) started with ${columns} columns.`);
    }

    let resizeTimeout;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(run, 250);
    });

    run();
}
// --- END OF FILE matrix_rain.js (Версия 3) ---