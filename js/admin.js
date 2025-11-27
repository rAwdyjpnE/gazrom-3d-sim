// js/admin.js
import { tickets } from './tickets.js';

const API_BASE_URL = 'http://127.0.0.1:5000';
const studentList = document.getElementById('student-list');
const reviewArea = document.getElementById('review-area');

async function gradeSubmission(studentId, ticketId) {
    const scoreInputs = document.querySelectorAll('.score-input');
    const scores = { '3d_practice': 0 };
    let totalScore = 0;

    scoreInputs.forEach(input => {
        const score = parseInt(input.value, 10) || 0;
        totalScore += score;
        scores[input.dataset.questionId] = score;
    });

    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/grade`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ studentId, score: { total: totalScore, details: scores } })
        });
        if (!response.ok) throw new Error('Server error on grading');
        alert(`Оценка ${totalScore} для ${studentId} сохранена!`);
        updateStudentList();
        reviewArea.innerHTML = `<h2>Оценка сохранена.</h2><p>Выберите другого студента для проверки.</p>`;
    } catch (error) {
        console.error('[admin] Ошибка сохранения оценки:', error);
        alert('Ошибка сохранения оценки!');
    }
}

function displayReviewData(studentId, submission) {
    const ticket = tickets.find(t => t.id === submission.ticketId);
    if (!ticket) return reviewArea.innerHTML = `<h2>Ошибка: Билет №${submission.ticketId} не найден!</h2>`;

    let html = `<h2>Проверка: ${studentId} - ${ticket.title}</h2><p style="color: var(--c-text-secondary);">${ticket.scenario}</p>`;
    ticket.questions.forEach(q => {
        html += `<div class="panel-group" style="border: 1px solid var(--c-border); padding: 12px; border-radius: 6px;">
            <h3>Вопрос: ${q.text}</h3>
            <div class="review-columns" style="display: grid; grid-template-columns: 1fr 1fr 100px; gap: 16px; align-items: center;">
                <div><h4>Ответ студента:</h4><textarea readonly>${submission.answers[q.id] || ''}</textarea></div>
                <div><h4>Эталонный ответ:</h4><p>${ticket.answers[q.id] || 'Нет эталона'}</p></div>
                <div><h4>Баллы:</h4><input type="number" class="score-input" data-question-id="${q.id}" min="0" max="15" value="0"></div>
            </div>
        </div>`;
    });
    
    reviewArea.innerHTML = html + `<button id="gradeBtn" class="btn-full" style="margin-top: 20px;">Сохранить оценку</button>`;
    document.getElementById('gradeBtn').addEventListener('click', () => gradeSubmission(studentId, ticket.id));
}

async function loadReview(studentId) {
    try {
        const url = new URL(`${API_BASE_URL}/api/admin/review`);
        url.searchParams.append('student_id', studentId);
        const response = await fetch(url);
        if (!response.ok) throw new Error('Failed to fetch review data');
        displayReviewData(studentId, await response.json());
    } catch (error) {
        console.error('[admin] Ошибка загрузки:', error);
        reviewArea.innerHTML = `<h2>Не удалось загрузить ответы для ${studentId}</h2><p>${error.message}</p>`;
    }
}

async function updateStudentList() {
    try {
        const response = await fetch(`${API_BASE_URL}/api/admin/submissions`);
        if (!response.ok) return;
        const submissions = await response.json();
        
        if (Object.keys(submissions).length === 0) return studentList.innerHTML = '<p style="color: var(--c-text-secondary); padding: 10px;">Нет отправленных работ.</p>';

        studentList.innerHTML = '';
        for (const studentId in submissions) {
            const submission = submissions[studentId];
            const studentElement = document.createElement('div');
            studentElement.className = 'student-item';
            studentElement.dataset.id = studentId;
            
            let statusText = `Завершено (Балл: ${submission.score?.total || 'N/A'})`;
            if (submission.status === 'pending_review') {
                statusText = `Ожидает проверки (Билет №${submission.ticketId})`;
                studentElement.classList.add('pending');
                studentElement.onclick = () => loadReview(studentId);
            }
            
            studentElement.innerHTML = `<span>${studentId}</span><span class="status">${statusText}</span>`;
            studentList.appendChild(studentElement);
        }
    } catch (error) {
        console.error('[admin] Ошибка обновления списка студентов:', error);
    }
}

console.log('[admin] Панель админа инициализирована, запущен поллинг статусов');
updateStudentList();
setInterval(updateStudentList, 5000);