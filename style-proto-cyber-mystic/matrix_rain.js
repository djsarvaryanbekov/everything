// --- START OF FILE matrix_rain.js (Версия 5 - ОТЛАДКА) ---

function getCssVariable(varName, fallbackValue) {
	// <<<< НОВАЯ, более надежная версия функции >>>>
	try {
		if (typeof window !== 'undefined' && typeof document !== 'undefined') {
			const value = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
			if (value && value !== 'initial' && value !== 'inherit') {
				console.log(`CSS Var ${varName} = ${value}`); // <<< Лог для проверки
				return value;
			} else {
				console.warn(`CSS Var ${varName} is empty or invalid, using fallback: ${fallbackValue}`);
			}
		}
	} catch (e) { console.warn(`Error reading CSS variable ${varName}:`, e); }
	return fallbackValue;
}

function getCssVariableNumber(varName, fallbackValue) {
	const value = parseFloat(getCssVariable(varName, String(fallbackValue)));
	const result = isNaN(value) ? fallbackValue : value;
	console.log(`CSS Var Number ${varName} = ${result} (Input: ${value}, Fallback: ${fallbackValue})`); // <<< Лог
	return result;
}

function startMatrix() {
	console.log("startMatrix function called"); // <<< Лог старта
	const canvas = document.getElementById('matrix-canvas');
	if (!canvas) { console.error('Canvas not found'); return; }
	if (!canvas.getContext) { console.error("Canvas 2D context not supported."); return; }
	const ctx = canvas.getContext('2d');
	if (!ctx) { console.error('Failed to get 2D context'); return; }
	console.log("Canvas and context obtained"); // <<< Лог

	let width, height, columns, drops = [], intervalId = null;

	const katakana = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン';
	const latinAndDigits = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
	const symbols = katakana + latinAndDigits;

	let fontSize, columnWidth, dropSpeed, resetChance, fadeFactor;
	let validMatrixRainColors = [];
	let bgColorFade;

	function updateSettingsAndDimensions() {
		console.log("Updating settings and dimensions..."); // <<< Лог
		width = canvas.width = window.innerWidth;
		height = canvas.height = window.innerHeight;

		fontSize = getCssVariableNumber('--matrix-font-size', 28);
		const spacingFactor = getCssVariableNumber('--matrix-column-spacing-factor', 1.7);
		// <<<< ДОБАВЛЕНА ЗАЩИТА >>>
		columnWidth = (fontSize > 0 && spacingFactor > 0) ? Math.max(1, fontSize * spacingFactor) : 20; // Запасная ширина колонки 20
		dropSpeed = Math.max(16, getCssVariableNumber('--matrix-drop-interval', 65)); // Мин. интервал ~60fps
		resetChance = 0.985;
		fadeFactor = Math.max(0.01, Math.min(1, getCssVariableNumber('--matrix-fade-speed', 0.05)));

		// Читаем RGB значения и opacity отдельно
		const colorRgbs = [
			getCssVariable('--matrix-rain-color-1-rgb', '0, 240, 255'),
			getCssVariable('--matrix-rain-color-2-rgb', '170, 160, 190'),
			getCssVariable('--matrix-rain-color-3-rgb', '180, 160, 110')
		];
		const symbolOpacity = Math.max(0.01, Math.min(1, getCssVariableNumber('--matrix-symbol-opacity', 0.65))); // Гарантируем хоть какую-то видимость

		validMatrixRainColors = colorRgbs
			.filter(rgb => typeof rgb === 'string' && rgb.includes(','))
			.map(rgb => `rgba(${rgb}, ${symbolOpacity})`);

		if (validMatrixRainColors.length === 0) {
			validMatrixRainColors.push(`rgba(0, 240, 255, ${symbolOpacity})`);
			console.warn("Using fallback matrix rain colors.");
		}

		columns = columnWidth > 0 ? Math.floor(width / columnWidth) : 0;

		initializeDrops(columns);

		const bgColor = getCssVariable('--bg-color-dark', '#0A0E1A');
		const rgbMatch = bgColor.match(/\d+/g);
		const safeFadeFactor = Math.max(0.01, Math.min(1, fadeFactor));
		if (bgColor.startsWith('rgba')) {
			bgColorFade = bgColor.replace(/[\d\.]+\)$/, `${safeFadeFactor})`);
		} else if (rgbMatch && rgbMatch.length >= 3) {
			bgColorFade = `rgba(${rgbMatch[0]}, ${rgbMatch[1]}, ${rgbMatch[2]}, ${safeFadeFactor})`;
		} else {
			bgColorFade = `rgba(10, 14, 26, ${safeFadeFactor})`;
		}

		// <<<< ВЫВОДИМ РЕЗУЛЬТАТЫ РАСЧЕТОВ >>>>
		console.log(`Settings: Font=${fontSize}px, Columns=${columns}, ColWidth=${columnWidth.toFixed(1)}px, Speed=${dropSpeed}ms, Fade=${safeFadeFactor.toFixed(2)}`);
		console.log(`Colors: ${validMatrixRainColors.join(', ')}`);
		console.log(`Fade Bg: ${bgColorFade}`);
	}

	function initializeDrops(numCols) {
		drops.length = 0;
		for (let i = 0; i < numCols; i++) {
			// <<<< Защита от деления на 0 >>>>
			const startY = (fontSize > 0) ? Math.floor(Math.random() * (height / fontSize)) : Math.floor(Math.random() * height);
			drops.push(startY);
		}
		if (drops.length === 0 && numCols > 0) { drops.push(0); }
		console.log(`Initialized ${drops.length} drops`); // <<< Лог
	}

	function draw() {
		if (!ctx || width <= 0 || height <= 0 || !bgColorFade || columns <= 0) { // Добавил columns <= 0
			console.log("Draw skipped: No context or invalid dimensions/config.");
			return;
		}

		ctx.fillStyle = bgColorFade;
		ctx.fillRect(0, 0, width, height);

		if (fontSize <= 0) return;

		ctx.font = `${fontSize}px monospace`;

		for (let i = 0; i < drops.length; i++) {
			if (typeof drops[i] === 'undefined') continue;

			if (validMatrixRainColors.length > 0) {
				ctx.fillStyle = validMatrixRainColors[Math.floor(Math.random() * validMatrixRainColors.length)];
			} else {
				ctx.fillStyle = 'rgba(0, 240, 255, 0.6)'; // Резервный цвет
			}

			const text = symbols[Math.floor(Math.random() * symbols.length)];
			// <<<< Используем безопасный fallback для ширины текста >>>>
			let textWidth;
			try {
				textWidth = ctx.measureText(text).width;
			} catch (e) {
				textWidth = fontSize * 0.6; // Примерная оценка, если measureText падает
			}


			ctx.fillText(text, i * columnWidth + (columnWidth - textWidth) / 2, drops[i] * fontSize);

			drops[i]++;

			if (drops[i] * fontSize > height && Math.random() > resetChance) {
				drops[i] = 0;
			}
		}
		//console.log("Frame drawn"); // <<< Слишком часто будет вызываться, убрал
	}

	function run() {
		console.log("run function called"); // <<< Лог
		if (intervalId) clearInterval(intervalId);
		try {
			updateSettingsAndDimensions();
			if (columns > 0) {
				// <<<< Очищаем холст перед первым запуском интервала >>>>
				ctx.fillStyle = getCssVariable('--bg-color-dark', '#0A0E1A'); // Используем базовый фон
				ctx.fillRect(0, 0, width, height);

				intervalId = setInterval(draw, dropSpeed);
				console.log(`Matrix rain (v5 - DEBUG) started with ${columns} columns.`);
			} else {
				console.log("Matrix rain not started: No columns fit.");
				if (ctx) ctx.clearRect(0, 0, width, height);
			}
		} catch (e) {
			console.error("Error during Matrix rain run setup:", e);
		}
	}

	let resizeTimeout;
	window.addEventListener('resize', () => {
		clearTimeout(resizeTimeout);
		resizeTimeout = setTimeout(run, 300); // Увеличил задержку ресайза
	});

	if (canvas && ctx) {
		console.log("Initial run starting..."); // <<< Лог
		run();
	} else {
		console.error("Cannot start Matrix Rain: Canvas or context not available.");
	}
}
// --- END OF FILE matrix_rain.js (Версия 5 - ОТЛАДКА) ---