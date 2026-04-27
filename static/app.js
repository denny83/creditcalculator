let calcTimeout;
let oneTimePayments = [];
let termUnit = 'years';
let reduceType = 'payment';
let currentChart = null;
let currentSchedule = [];
let currentStartDate = '';
let showingFullSchedule = false;

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', function() {
    flatpickr("#startDate", {
        locale: "ru",
        dateFormat: "Y-m-d",
        defaultDate: null,
        onChange: () => calculate()
    });

    new QRCode(document.getElementById("qrcode"), {
        text: "https://tbank.ru/cf/1p2IAS0vEyb",
        width: 180,
        height: 180,
        colorDark: "#e2e8f0",
        colorLight: "#0f1123",
        correctLevel: QRCode.CorrectLevel.H
    });

    document.getElementById('creditAmount').addEventListener('input', calculateDebounced);
    document.getElementById('rate').addEventListener('input', calculateDebounced);
    document.getElementById('term').addEventListener('input', calculateDebounced);
    document.getElementById('startDate').addEventListener('change', calculateDebounced);
    document.getElementById('monthlyAmount').addEventListener('input', calculateDebounced);
    
    renderOneTime();
    document.getElementById('monthlyOptions').style.display = 'none';
    calculate();
});

function setTermUnit(unit) {
    termUnit = unit;
    document.querySelectorAll('.term-container .small-btn').forEach(btn => btn.classList.remove('active'));
    if (unit === 'months') {
        document.querySelector('.term-container .small-btn:first-child').classList.add('active');
    } else {
        document.querySelector('.term-container .small-btn:last-child').classList.add('active');
    }
    calculate();
}

function setReduceType(type) {
    reduceType = type;
    const btns = document.querySelectorAll('#monthlyOptions .small-switch .small-btn');
    btns.forEach(btn => btn.classList.remove('active'));
    if (type === 'payment') {
        btns[0].classList.add('active');
    } else {
        btns[1].classList.add('active');
    }
    calculate();
}

function calculateDebounced() {
    clearTimeout(calcTimeout);
    calcTimeout = setTimeout(calculate, 150);
}

function toggleMonthly() {
    const isChecked = document.getElementById('monthlyToggle').checked;
    const optionsDiv = document.getElementById('monthlyOptions');
    if (isChecked) {
        optionsDiv.style.display = 'block';
    } else {
        optionsDiv.style.display = 'none';
    }
    calculate();
}

function toggleSchedule() {
    const content = document.getElementById('scheduleContent');
    const indicator = document.getElementById('scheduleSpoilerIndicator');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        indicator.classList.add('open');
        if (currentSchedule.length > 0) {
            renderSchedule(currentSchedule, currentStartDate);
        }
    } else {
        content.style.display = 'none';
        indicator.classList.remove('open');
    }
}

function toggleAnalysis() {
    const content = document.getElementById('analysisContent');
    const indicator = document.getElementById('analysisSpoilerIndicator');
    if (content.style.display === 'none') {
        content.style.display = 'block';
        indicator.classList.add('open');
        if (currentSchedule.length > 0) {
            updateChart(currentSchedule);
        }
    } else {
        content.style.display = 'none';
        indicator.classList.remove('open');
    }
}

function getMonths() {
    let term = parseFloat(document.getElementById('term').value);
    if (isNaN(term)) return 60;
    if (termUnit === 'years') return Math.round(term * 12);
    return Math.round(term);
}

function formatMoney(amount) {
    if (isNaN(amount)) return '0';
    return new Intl.NumberFormat('ru-RU').format(Math.round(amount));
}

function formatDate(date) {
    const months = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function formatShortDate(date) {
    const months = ['янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
}

function addOneTime() {
    const id = Date.now();
    oneTimePayments.push({ id, date: '', amount: null, month: null, reduceType: 'payment' });
    renderOneTime();
}

function removeOneTime(id) {
    oneTimePayments = oneTimePayments.filter(p => p.id !== id);
    renderOneTime();
    calculate();
}

function updateOneTime(id, field, value) {
    const payment = oneTimePayments.find(p => p.id === id);
    if (payment) {
        payment[field] = value;
        if (field === 'date' && value) {
            const start = new Date(document.getElementById('startDate').value);
            const paymentDate = new Date(value);
            const diffMonths = (paymentDate.getFullYear() - start.getFullYear()) * 12 +
                               (paymentDate.getMonth() - start.getMonth());
            payment.month = diffMonths;
            if (payment.month < 1) payment.month = 1;
        }
    }
    calculateDebounced();
}

function updateOneTimeReduceType(id, type) {
    const payment = oneTimePayments.find(p => p.id === id);
    if (payment) {
        payment.reduceType = type;
        const itemDiv = document.querySelector(`.one-time-payment-item[data-id="${id}"]`);
        if (itemDiv) {
            const btns = itemDiv.querySelectorAll('.small-switch .small-btn');
            btns.forEach(btn => {
                btn.classList.remove('active');
                if ((type === 'payment' && btn.textContent === 'Платеж') ||
                    (type === 'term' && btn.textContent === 'Срок')) {
                    btn.classList.add('active');
                }
            });
        }
        calculate();
    }
}

function renderOneTime() {
    const container = document.getElementById('oneTimeList');
    if (!container) return;
    
    if (oneTimePayments.length === 0) {
        container.innerHTML = '<div class="empty-payments">Нет разовых погашений</div>';
        return;
    }

    const startDate = document.getElementById('startDate').value;
    const start = new Date(startDate);
    
    let monthOptions = '';
    for (let year = start.getFullYear(); year <= start.getFullYear() + 10; year++) {
        for (let month = 1; month <= 12; month++) {
            const date = new Date(year, month - 1);
            if (date >= start) {
                const monthStr = `${year}-${String(month).padStart(2, '0')}`;
                const monthName = date.toLocaleString('ru', { month: 'long' });
                monthOptions += `<option value="${monthStr}">${monthName} ${year}</option>`;
            }
        }
    }

    container.innerHTML = oneTimePayments.map(p => `
        <div class="one-time-payment-item" data-id="${p.id}">
            <button class="remove-btn" onclick="removeOneTime(${p.id})">✕</button>
            <div class="row-3cols">
                <div class="form-group">
                    <label>Месяц и год</label>
                    <select class="month-select-${p.id}" style="width: 100%; padding: 10px 14px; background: #1a1c3a; border: 1px solid #2d2f4a; border-radius: 10px; color: #e2e8f0; font-family: 'JetBrains Mono', monospace; appearance: none; -webkit-appearance: none;">
                        <option value="">Выберите месяц</option>
                        ${monthOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Сумма (сверх платежа)</label>
                    <input type="number" value="${p.amount || ''}" placeholder="0" oninput="updateOneTime(${p.id}, 'amount', parseFloat(this.value) || null)" style="width: 100%; padding: 10px 14px; background: #1a1c3a; border: 1px solid #2d2f4a; border-radius: 10px; color: #e2e8f0; font-family: 'JetBrains Mono', monospace;">
                </div>
                <div class="form-group">
                    <label>Что уменьшать</label>
                    <div class="small-switch">
                        <div class="small-btn ${p.reduceType === 'payment' ? 'active' : ''}" onclick="updateOneTimeReduceType(${p.id}, 'payment')">Платеж</div>
                        <div class="small-btn ${p.reduceType === 'term' ? 'active' : ''}" onclick="updateOneTimeReduceType(${p.id}, 'term')">Срок</div>
                    </div>
                </div>
            </div>
        </div>
    `).join('');

    oneTimePayments.forEach(p => {
        const select = document.querySelector(`.month-select-${p.id}`);
        if (select) {
            if (p.date) {
                select.value = p.date.slice(0, 7);
            }
            select.addEventListener('change', function(e) {
                if (e.target.value) {
                    updateOneTime(p.id, 'date', e.target.value + '-01');
                }
            });
        }
    });
}

async function calculate() {
    const amount = parseFloat(document.getElementById('creditAmount').value);
    const rate = parseFloat(document.getElementById('rate').value);
    let months = getMonths();
    const startDate = document.getElementById('startDate').value;
    // Проверка на пустые значения
    if (isNaN(amount) || amount <= 0) {
        console.log('Введите сумму кредита');
        return;
    }
    if (isNaN(rate) || rate <= 0) {
        console.log('Введите процентную ставку');
        return;
    }
    if (isNaN(months) || months <= 0) {
        console.log('Введите срок кредита');
        return;
    }
    if (!startDate) {
        console.log('Выберите дату получения');
        return;
    }
    currentStartDate = startDate;
    
    if (isNaN(amount) || isNaN(rate) || isNaN(months)) return;

    const monthlyEnabled = document.getElementById('monthlyToggle').checked;
    const monthlyAmount = parseFloat(document.getElementById('monthlyAmount').value) || 0;
    const paymentType = document.querySelector('input[name="paymentType"]:checked')?.value || 'extra';
    const globalReduceType = reduceType;

    const oneTimeData = [];
    let totalOneTimeAmount = 0;
    for (const p of oneTimePayments) {
        if (p.month !== null && p.amount && p.month > 0 && p.month <= months) {
            oneTimeData.push({ 
                month: p.month, 
                amount: p.amount,
                type: p.reduceType || 'payment'
            });
            totalOneTimeAmount += p.amount;
        }
    }

    try {
        const response = await fetch('/calc', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                amount: amount,
                rate: rate,
                months: months,
                paymentType: paymentType,
                reduceType: globalReduceType,
                monthly_enabled: monthlyEnabled,
                monthly_amount: monthlyAmount,
                one_time: oneTimeData
            })
        });
        
        const result = await response.json();
        if (result.error) throw new Error(result.error);
        
        currentSchedule = result.schedule;
        
        document.getElementById('principal').innerHTML = formatMoney(result.principal) + ' ₽';
        document.getElementById('totalInterest').innerHTML = formatMoney(result.interest) + ' ₽';
        document.getElementById('totalPaid').innerHTML = formatMoney(result.total_paid) + ' ₽';
        document.getElementById('loanTerm').innerHTML = result.months + ' мес';
        
        const closeDate = new Date(startDate);
        closeDate.setMonth(closeDate.getMonth() + result.months);
        document.getElementById('closeDate').innerHTML = formatDate(closeDate);
        
        const totalPaidVal = result.total_paid;
        const totalInterestVal = result.interest;
        const interestPercent = totalPaidVal > 0 ? (totalInterestVal / totalPaidVal * 100).toFixed(1) : 0;
        
        const interestBarFill = document.getElementById('interestBarFill');
        const interestPercentSpan = document.getElementById('interestPercent');
        if (interestBarFill) {
            interestBarFill.style.width = interestPercent + '%';
        }
        if (interestPercentSpan) {
            interestPercentSpan.textContent = interestPercent + '%';
        }
        
        const scheduleContent = document.getElementById('scheduleContent');
        if (scheduleContent && scheduleContent.style.display !== 'none') {
            renderSchedule(result.schedule, startDate);
        }
        
        updateChart(result.schedule);
        
        // Получаем базовую переплату без досрочек для сравнения
        const baseResponse = await fetch('/compare_base', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ amount, rate, months })
        });
        const baseData = await baseResponse.json();
        
        // Обновляем правый блок
        const originalInterestSpan = document.getElementById('originalInterest');
        if (originalInterestSpan) {
            originalInterestSpan.innerHTML = `Без досрочек: ${formatMoney(baseData.original_interest)} ₽`;
        }
        
        // Проверяем есть ли досрочные платежи
        const hasEarlyPayments = (monthlyEnabled && monthlyAmount > 0) || totalOneTimeAmount > 0;
        
        if (hasEarlyPayments) {
            let earlyAmountText = '';
            if (monthlyEnabled && monthlyAmount > 0) {
                earlyAmountText = `${formatMoney(monthlyAmount)} ₽/мес`;
                if (totalOneTimeAmount > 0) {
                    earlyAmountText += ` + ${formatMoney(totalOneTimeAmount)} ₽ разово`;
                }
            } else {
                earlyAmountText = `${formatMoney(totalOneTimeAmount)} ₽ разово`;
            }
            
            const interestSaved = baseData.original_interest - result.interest;
            
            document.getElementById('analysisText').innerHTML = `
                <div class="analysis-stat-card">
                    <div class="analysis-stat-label">Досрочные платежи</div>
                    <div class="analysis-stat-value">${earlyAmountText}</div>
                </div>
                <div class="analysis-stat-card">
                    <div class="analysis-stat-label">Новая переплата</div>
                    <div class="analysis-stat-value positive">${formatMoney(result.interest)} ₽</div>
                </div>
                <div class="analysis-stat-card">
                    <div class="analysis-stat-label">Экономия</div>
                    <div class="analysis-stat-value positive">${formatMoney(interestSaved)} ₽</div>
                </div>
                <div class="analysis-stat-card">
                    <div class="analysis-stat-label">Срок кредита</div>
                    <div class="analysis-stat-value">${months} → ${result.months} мес</div>
                </div>
            `;
        } else {
            document.getElementById('analysisText').innerHTML = `
                <div class="analysis-stat-card">
                    <div class="analysis-stat-label">Статус</div>
                    <div class="analysis-stat-value">Нет досрочек</div>
                </div>
            `;
        }
        
    } catch (err) {
        console.error('Error:', err);
    }
}

function updateChart(schedule) {
    const ctx = document.getElementById('chart').getContext('2d');
    const labels = schedule.map((_, i) => i + 1);
    
    const principalData = schedule.map(s => s.principal);
    const interestData = schedule.map(s => s.interest);
    
    if (currentChart) currentChart.destroy();
    
    currentChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Погашение долга',
                    data: principalData,
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 6
                },
                {
                    label: 'Проценты',
                    data: interestData,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 0,
                    pointHoverRadius: 6
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: true,
            interaction: {
                mode: 'index',
                intersect: false,
            },
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return `${context.dataset.label}: ${formatMoney(context.raw)} ₽`;
                        },
                        footer: function(tooltipItems) {
                            if (tooltipItems.length > 0) {
                                const idx = tooltipItems[0].dataIndex;
                                const item = schedule[idx];
                                return `Платеж: ${formatMoney(item.payment)} ₽ | Итого: ${formatMoney(item.total)} ₽`;
                            }
                            return '';
                        }
                    },
                    backgroundColor: '#0f1123',
                    titleColor: '#e2e8f0',
                    bodyColor: '#94a3b8',
                    borderColor: '#4f46e5',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8
                },
                legend: { 
                    position: 'bottom', 
                    labels: { color: '#94a3b8', font: { family: 'JetBrains Mono', size: 11 } } 
                }
            },
            scales: {
                y: { 
                    grid: { color: '#1e1f3a' }, 
                    ticks: { color: '#94a3b8', callback: (v) => formatMoney(v) }
                },
                x: { 
                    grid: { color: '#1e1f3a' }, 
                    ticks: { color: '#94a3b8' }
                }
            }
        }
    });
}

function showFullSchedule() {
    showingFullSchedule = true;
    renderSchedule(currentSchedule, currentStartDate);
}

function showLessSchedule() {
    showingFullSchedule = false;
    renderSchedule(currentSchedule, currentStartDate);
}

function renderSchedule(schedule, startDate) {
    const container = document.getElementById('scheduleGrid');
    const moreBtnContainer = document.getElementById('scheduleMoreBtn');
    
    if (!schedule || schedule.length === 0) {
        if (container) container.innerHTML = '<div class="empty-data">Нет данных</div>';
        if (moreBtnContainer) moreBtnContainer.innerHTML = '';
        return;
    }
    
    const start = new Date(startDate);
    
    let monthsToShow;
    
    if (!showingFullSchedule) {
        const currentYear = new Date().getFullYear();
        monthsToShow = 0;
        for (let idx = 0; idx < schedule.length; idx++) {
            const date = new Date(start);
            date.setMonth(start.getMonth() + idx + 1);
            if (date.getFullYear() === currentYear) {
                monthsToShow = idx + 1;
            }
        }
        if (monthsToShow === 0) monthsToShow = Math.min(12, schedule.length);
    } else {
        monthsToShow = schedule.length;
    }
    
    const scheduleToShow = schedule.slice(0, monthsToShow);
    
    let html = '<div class="schedule-grid">';
    for (let i = 0; i < scheduleToShow.length; i += 3) {
        html += '<div class="schedule-row">';
        for (let j = 0; j < 3; j++) {
            const idx = i + j;
            if (idx < scheduleToShow.length) {
                const p = scheduleToShow[idx];
                const date = new Date(start);
                date.setMonth(start.getMonth() + idx + 1);
                
                html += `
                    <div class="schedule-card">
                        <div class="schedule-header">
                            <span class="schedule-month">${formatShortDate(date)}</span>
                            <span class="schedule-total">${formatMoney(p.total)} ₽</span>
                        </div>
                        <div class="schedule-detail-item">
                            <span class="schedule-detail-label">Ежемесячный платеж</span>
                            <span class="schedule-detail-value">${formatMoney(p.payment)} ₽</span>
                        </div>
                        <div class="schedule-detail-item">
                            <span class="schedule-detail-label">Досрочное погашение</span>
                            <span class="schedule-detail-value">${formatMoney(p.extra)} ₽</span>
                        </div>
                        <div class="schedule-detail-item">
                            <span class="schedule-detail-label">На погашение долга</span>
                            <span class="schedule-detail-value">${formatMoney(p.principal)} ₽</span>
                        </div>
                        <div class="schedule-detail-item">
                            <span class="schedule-detail-label">На выплату процентов</span>
                            <span class="schedule-detail-value">${formatMoney(p.interest)} ₽</span>
                        </div>
                        <div class="schedule-detail-item">
                            <span class="schedule-detail-label">Остаток долга</span>
                            <span class="schedule-detail-value">${formatMoney(p.balance)} ₽</span>
                        </div>
                    </div>
                `;
            } else {
                html += '<div class="schedule-card empty-card"></div>';
            }
        }
        html += '</div>';
    }
    html += '</div>';
    if (container) container.innerHTML = html;
    
    if (moreBtnContainer) {
        if (schedule.length > monthsToShow && !showingFullSchedule) {
            moreBtnContainer.innerHTML = `<div class="schedule-more" onclick="showFullSchedule()">Еще ${schedule.length - monthsToShow} платежей ↓</div>`;
        } else if (showingFullSchedule && schedule.length > 12) {
            moreBtnContainer.innerHTML = `<div class="schedule-more" onclick="showLessSchedule()">Скрыть ↑</div>`;
        } else {
            moreBtnContainer.innerHTML = '';
        }
    }
}

function declineMonths(n) {
    if (n % 10 === 1 && n % 100 !== 11) return 'месяц';
    if (n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20)) return 'месяца';
    return 'месяцев';
}

function printSchedule() {
    if (!currentSchedule.length) {
        alert('Нет данных для печати');
        return;
    }
    
    const start = new Date(currentStartDate);
    const amount = parseFloat(document.getElementById('creditAmount').value);
    const rate = parseFloat(document.getElementById('rate').value);
    const totalInterest = document.getElementById('totalInterest').innerText;
    const closeDate = document.getElementById('closeDate').innerText;
    const totalPaid = document.getElementById('totalPaid').innerText;
    const principal = document.getElementById('principal').innerText;
    const loanTerm = document.getElementById('loanTerm').innerText;
    
    let rows = '';
    currentSchedule.forEach((p, idx) => {
        const date = new Date(start);
        date.setMonth(start.getMonth() + idx + 1);
        rows += '<tr>';
        rows += `<td style="text-align: center;">${date.toLocaleDateString('ru')}</td>`;
        rows += `<td style="text-align: right;">${formatMoney(p.payment)} ₽</td>`;
        if (p.extra > 0) {
            rows += `<td style="text-align: right; color: #10b981; font-weight: bold;">${formatMoney(p.extra)} ₽</td>`;
        } else {
            rows += `<td style="text-align: right;">${formatMoney(p.extra)} ₽</td>`;
        }
        rows += `<td style="text-align: right;">${formatMoney(p.principal)} ₽</td>`;
        rows += `<td style="text-align: right;">${formatMoney(p.interest)} ₽</td>`;
        rows += `<td style="text-align: right;">${formatMoney(p.balance)} ₽</td>`;
        rows += '</tr>';
    });
    
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>График платежей - Калькулятор для нормальных пацанов</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Courier New', 'JetBrains Mono', monospace;
                    padding: 20px;
                    background: white;
                    color: #1a1c3a;
                    font-size: 11px;
                }
                h1 {
                    font-size: 20px;
                    margin-bottom: 15px;
                    color: #1a1c3a;
                    border-bottom: 2px solid #4f46e5;
                    padding-bottom: 8px;
                }
                .summary {
                    background: #f3f4f6;
                    padding: 12px;
                    border-radius: 6px;
                    margin-bottom: 20px;
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 10px;
                }
                .summary-item {
                    text-align: center;
                }
                .summary-label {
                    font-size: 10px;
                    color: #6b7280;
                    margin-bottom: 4px;
                }
                .summary-value {
                    font-size: 14px;
                    font-weight: bold;
                    color: #1a1c3a;
                }
                table {
                    width: 100%;
                    border-collapse: collapse;
                    margin-top: 15px;
                    font-size: 10px;
                }
                th {
                    background: #4f46e5;
                    color: white;
                    padding: 8px 6px;
                    font-weight: 600;
                    text-align: center;
                }
                td {
                    border: 1px solid #d1d5db;
                    padding: 6px;
                }
                tr:nth-child(even) {
                    background: #f9fafb;
                }
                .footer {
                    margin-top: 20px;
                    text-align: center;
                    font-size: 9px;
                    color: #9ca3af;
                    border-top: 1px solid #e5e7eb;
                    padding-top: 10px;
                }
                @media print {
                    body {
                        padding: 10px;
                    }
                    th {
                        background: #4f46e5 !important;
                        color: white !important;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                }
            </style>
        </head>
        <body>
            <h1>График платежей по кредиту</h1>
            
            <div class="summary">
                <div class="summary-item">
                    <div class="summary-label">Сумма кредита</div>
                    <div class="summary-value">${principal}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Ставка</div>
                    <div class="summary-value">${rate}%</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Срок</div>
                    <div class="summary-value">${loanTerm}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Переплата</div>
                    <div class="summary-value">${totalInterest}</div>
                </div>
            </div>
            
            <div class="summary" style="background: #e0e7ff;">
                <div class="summary-item">
                    <div class="summary-label">Дата закрытия</div>
                    <div class="summary-value">${closeDate}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Всего платежей</div>
                    <div class="summary-value">${currentSchedule.length}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Всего заплатите</div>
                    <div class="summary-value">${totalPaid}</div>
                </div>
                <div class="summary-item">
                    <div class="summary-label">Досрочных платежей</div>
                    <div class="summary-value">${currentSchedule.filter(p => p.extra > 0).length}</div>
                </div>
            </div>
            
            <table>
                <thead>
                    <tr>
                        <th>Дата</th>
                        <th>Платеж</th>
                        <th>Досрочно</th>
                        <th>В погашение</th>
                        <th>Проценты</th>
                        <th>Остаток</th>
                    </tr>
                </thead>
                <tbody>
                    ${rows}
                </tbody>
            </table>
            
            <div class="footer">
                Калькулятор для нормальных пацанов | t.me/dennykaluga
            </div>
        </body>
        </html>
    `);
    printWindow.document.close();
}
