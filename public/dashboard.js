// Dashboard Controller
class DashboardController {
    constructor() {
        this.uploadedVideo = null;
        this.videoUrl = null;
        this.avatarFile = null;
        this.avatarUrl = null;
        this.init();
    }

    init() {
        this.migrateStorageKey();
        this.setupUpload();
        this.setupAvatarUpload();
        this.setupMobileNav();
        this.loadCalls();

        // Re-render do gráfico em mobile (rotação / resize)
        let resizeTimer = null;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(() => this.renderActivityChart(), 120);
        });
    }

    migrateStorageKey() {
        // Rebrand: migra chave antiga -> nova (sem perder dados)
        const oldKey = 'privecall_calls';
        const newKey = 'callsimulador_calls';
        const old = localStorage.getItem(oldKey);
        const cur = localStorage.getItem(newKey);
        if (old && !cur) {
            localStorage.setItem(newKey, old);
        }
    }

    updateStats() {
        // Atualiza estatísticas baseadas nas calls criadas
        const calls = this.getCallsFromStorage();
        const totalAccesses = calls.length;
        
        // Calcula acessos do mês (últimos 30 dias)
        const now = new Date();
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        const monthAccesses = calls.filter(call => {
            const callDate = new Date(call.createdAt);
            return callDate >= monthAgo;
        }).length;

        // Média diária (últimos 30 dias)
        const dailyAverage = monthAccesses > 0 ? Math.round((monthAccesses / 30) * 10) / 10 : 0;

        document.getElementById('totalAccesses').textContent = totalAccesses;
        document.getElementById('monthAccesses').textContent = monthAccesses;
        document.getElementById('dailyAverage').textContent = dailyAverage;
    }

    getCallsFromStorage() {
        const stored = localStorage.getItem('callsimulador_calls');
        return stored ? JSON.parse(stored) : [];
    }

    async fetchCallsFromServer() {
        try {
            const resp = await fetch('/api/calls');
            const data = await resp.json();
            if (!resp.ok) throw new Error(data?.error || 'Erro ao listar calls');
            return Array.isArray(data?.calls) ? data.calls : [];
        } catch (e) {
            console.warn('Falha ao buscar calls do servidor, usando localStorage:', e?.message || e);
            return this.getCallsFromStorage();
        }
    }

    saveCallToStorage(callData) {
        const calls = this.getCallsFromStorage();
        calls.unshift({
            ...callData,
            createdAt: new Date().toISOString()
        });
        localStorage.setItem('callsimulador_calls', JSON.stringify(calls));
    }

    setupUpload() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('videoFile');
        const createBtn = document.getElementById('createCallBtn');
        const removeBtn = document.getElementById('removeVideoBtn');
        const preview = document.getElementById('videoPreview');
        const progressBar = document.getElementById('progressBar');
        const progressFill = document.getElementById('progressFill');

        // Click no upload area
        uploadArea.addEventListener('click', () => {
            fileInput.click();
        });

        // Drag and drop
        uploadArea.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('dragover');
        });

        uploadArea.addEventListener('dragleave', () => {
            uploadArea.classList.remove('dragover');
        });

        uploadArea.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('dragover');
            
            const files = e.dataTransfer.files;
            if (files.length > 0 && files[0].type.startsWith('video/')) {
                this.handleFile(files[0]);
            }
        });

        // File input change
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.handleFile(e.target.files[0]);
            }
        });

        // Remove video
        removeBtn.addEventListener('click', () => {
            this.uploadedVideo = null;
            this.videoUrl = null;
            preview.classList.remove('show');
            createBtn.disabled = true;
            fileInput.value = '';
        });

        // Create call
        createBtn.addEventListener('click', () => {
            this.createCall();
        });
    }

    async handleFile(file) {
        // Valida tamanho (500MB)
        if (file.size > 500 * 1024 * 1024) {
            alert('Vídeo muito grande! Máximo: 500MB');
            return;
        }

        this.uploadedVideo = file;
        
        // Mostra preview
        const preview = document.getElementById('videoPreview');
        const previewVideo = document.getElementById('previewVideo');
        const videoName = document.getElementById('videoName');
        const videoSize = document.getElementById('videoSize');
        const createBtn = document.getElementById('createCallBtn');
        const progressBar = document.getElementById('progressBar');
        const progressFill = document.getElementById('progressFill');

        // Cria URL local para preview
        this.videoUrl = URL.createObjectURL(file);
        previewVideo.src = this.videoUrl;
        
        videoName.textContent = file.name;
        videoSize.textContent = this.formatFileSize(file.size);
        
        preview.classList.add('show');
        progressBar.classList.add('show');
        progressFill.style.width = '0%';

        // Upload do arquivo
        await this.uploadVideo(file);
    }

    async uploadVideo(file) {
        const formData = new FormData();
        formData.append('video', file);

        const progressBar = document.getElementById('progressBar');
        const progressFill = document.getElementById('progressFill');
        const createBtn = document.getElementById('createCallBtn');

        try {
            const xhr = new XMLHttpRequest();

            xhr.upload.addEventListener('progress', (e) => {
                if (e.lengthComputable) {
                    const percent = (e.loaded / e.total) * 100;
                    progressFill.style.width = percent + '%';
                }
            });

            xhr.addEventListener('load', () => {
                if (xhr.status === 200) {
                    const response = JSON.parse(xhr.responseText);
                    this.videoUrl = response.videoUrl;
                    progressBar.classList.remove('show');
                    createBtn.disabled = false;
                } else {
                    alert('Erro ao fazer upload do vídeo');
                    progressBar.classList.remove('show');
                }
            });

            xhr.addEventListener('error', () => {
                alert('Erro ao fazer upload do vídeo');
                progressBar.classList.remove('show');
            });

            xhr.open('POST', '/api/upload-video');
            xhr.send(formData);

        } catch (error) {
            console.error('Erro no upload:', error);
            alert('Erro ao fazer upload do vídeo');
        }
    }

    setupMobileNav() {
        const sidebar = document.getElementById('sidebar');
        const backdrop = document.getElementById('sidebarBackdrop');
        const menuBtn = document.getElementById('menuBtn');
        if (!sidebar || !backdrop || !menuBtn) return;

        const open = () => {
            sidebar.classList.add('open');
            backdrop.classList.add('show');
        };
        const close = () => {
            sidebar.classList.remove('open');
            backdrop.classList.remove('show');
        };

        menuBtn.addEventListener('click', open);
        backdrop.addEventListener('click', close);
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') close();
        });
    }

    setupAvatarUpload() {
        const avatarInput = document.getElementById('avatarFile');
        const selectBtn = document.getElementById('selectAvatarBtn');
        const removeBtn = document.getElementById('removeAvatarBtn');
        const previewImg = document.getElementById('avatarPreviewImg');
        const previewFallback = document.getElementById('avatarPreviewFallback');

        if (!avatarInput || !selectBtn || !removeBtn) return;

        const updateFallback = (name) => {
            const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
            const a = parts[0]?.[0] || '';
            const b = parts.length > 1 ? (parts[parts.length - 1]?.[0] || '') : '';
            previewFallback.textContent = ((a + b) || '?').toUpperCase();
        };

        updateFallback(document.getElementById('callerNameInput')?.value || 'Bia');
        document.getElementById('callerNameInput')?.addEventListener('input', (e) => {
            updateFallback(e.target.value);
        });

        selectBtn.addEventListener('click', () => avatarInput.click());

        removeBtn.addEventListener('click', () => {
            this.avatarFile = null;
            this.avatarUrl = null;
            avatarInput.value = '';
            previewImg.style.display = 'none';
            previewImg.src = '';
            previewFallback.style.display = 'inline';
        });

        avatarInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;
            if (!file.type.startsWith('image/')) {
                alert('Selecione uma imagem (PNG/JPG).');
                return;
            }
            if (file.size > 10 * 1024 * 1024) {
                alert('Imagem muito grande! Máximo: 10MB');
                return;
            }

            this.avatarFile = file;

            // preview local
            const localUrl = URL.createObjectURL(file);
            previewImg.src = localUrl;
            previewImg.style.display = 'block';
            previewFallback.style.display = 'none';

            // upload
            try {
                const formData = new FormData();
                formData.append('avatar', file);
                const resp = await fetch('/api/upload-avatar', { method: 'POST', body: formData });
                const data = await resp.json();
                if (!resp.ok) throw new Error(data?.error || 'Erro ao enviar avatar');
                this.avatarUrl = data.avatarUrl;
            } catch (err) {
                console.error(err);
                alert('Erro ao fazer upload do avatar');
                this.avatarUrl = null;
            }
        });
    }

    async createCall() {
        if (!this.videoUrl) {
            alert('Nenhum vídeo selecionado');
            return;
        }

        const title = (document.getElementById('callTitleInput')?.value || '').trim();
        const callerName = (document.getElementById('callerNameInput')?.value || '').trim();
        const callerAvatarUrl = this.avatarUrl;

        const createBtn = document.getElementById('createCallBtn');
        createBtn.disabled = true;
        createBtn.textContent = 'Criando...';

        try {
            const response = await fetch('/api/create-call', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ videoUrl: this.videoUrl, callerName, callerAvatarUrl, title })
            });

            const data = await response.json();

            if (response.ok) {
                // Fallback local + recarrega da fonte persistida (servidor)
                this.saveCallToStorage(data);
                await this.loadCalls();
                
                // Limpa o upload
                this.uploadedVideo = null;
                this.videoUrl = null;
                document.getElementById('videoPreview').classList.remove('show');
                document.getElementById('videoFile').value = '';
                const titleInput = document.getElementById('callTitleInput');
                if (titleInput) titleInput.value = '';
                createBtn.textContent = 'Criar Call com este Vídeo';
                
                // Mostra links
                this.showCallLinks(data);
            } else {
                alert('Erro: ' + data.error);
            }
        } catch (error) {
            alert('Erro ao criar call: ' + error.message);
        } finally {
            createBtn.disabled = false;
        }
    }

    addCallToList(callData, prepend = true) {
        const callsList = document.getElementById('callsList');
        
        // Remove mensagem vazia se existir
        if (callsList.querySelector('p')) {
            callsList.innerHTML = '';
        }

        const callItem = document.createElement('div');
        callItem.className = 'call-item';
        
        const baseUrl = window.location.origin;
        const callDate = callData.createdAt 
            ? new Date(callData.createdAt).toLocaleString('pt-BR')
            : new Date().toLocaleString('pt-BR');

        const title = (callData.title || '').trim();
        const titleHtml = title
            ? `<div style="color:#fff;font-weight:700;margin-bottom:6px;">${this.escapeHtml(title)}</div>`
            : '';

        callItem.innerHTML = `
            <div class="call-info">
                ${titleHtml}
                <div class="call-id">ID: ${callData.callId.substring(0, 8)}...</div>
                <div class="call-date">Criado em: ${callDate}</div>
            </div>
            <div class="call-actions">
                ${callData.ringUrl ? `<button class="btn btn-secondary btn-small" onclick="window.open('${baseUrl}${callData.ringUrl}', '_blank')">Simulador</button>` : ''}
                <button class="btn btn-primary btn-small" onclick="window.open('${baseUrl}${callData.hostUrl}', '_blank')">
                    Host
                </button>
                <button class="btn btn-secondary btn-small" data-action="rename">Renomear</button>
                <button class="btn btn-secondary btn-small" onclick="copyToClipboard('${baseUrl}${(callData.ringUrl || callData.url)}')">
                    Copiar Link
                </button>
            </div>
        `;

        callItem.querySelector('[data-action="rename"]')?.addEventListener('click', async () => {
            const newTitle = prompt('Nome da call:', callData.title || '');
            if (newTitle === null) return;
            try {
                const resp = await fetch(`/api/call/${encodeURIComponent(callData.callId)}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ title: newTitle })
                });
                const payload = await resp.json();
                if (!resp.ok) throw new Error(payload?.error || 'Erro ao renomear');
                await this.loadCalls();
            } catch (e) {
                alert(e?.message || 'Erro ao renomear');
            }
        });

        if (prepend) {
            callsList.insertBefore(callItem, callsList.firstChild);
        } else {
            callsList.appendChild(callItem);
        }
    }

    showCallLinks(callData) {
        const baseUrl = window.location.origin;
        const ringLink = callData.ringUrl ? `${baseUrl}${callData.ringUrl}` : null;
        const guestLink = `${baseUrl}${callData.url}`;
        const hostLink = `${baseUrl}${callData.hostUrl}`;
        const videoOnlyLink = callData.videoUrlPage ? `${baseUrl}${callData.videoUrlPage}` : null;

        const message = `
Call criada com sucesso

Link Simulador (envie pro lead): ${ringLink || guestLink}
Link Cliente (modo WebRTC): ${guestLink}
Link Host: ${hostLink}
${videoOnlyLink ? `Link Vídeo Direto: ${videoOnlyLink}` : ''}
        `;
        
        alert(message);
        
        // Copia o simulador por padrão (melhor pro lead)
        navigator.clipboard.writeText(ringLink || guestLink);
    }

    async loadCalls() {
        const calls = await this.fetchCallsFromServer();
        // mantém uma cópia local para stats/gráfico (e fallback offline)
        localStorage.setItem('callsimulador_calls', JSON.stringify(calls));
        const callsList = document.getElementById('callsList');
        
        if (calls.length === 0) {
            callsList.innerHTML = '<p style="color: #888; text-align: center; padding: 20px;">Nenhuma call criada ainda</p>';
            this.updateStats();
            this.renderActivityChart();
            return;
        }

        callsList.innerHTML = '';
        calls.forEach(call => {
            this.addCallToList(call, false);
        });

        this.updateStats();
        this.renderActivityChart();
    }

    escapeHtml(str) {
        return String(str)
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#039;');
    }

    renderActivityChart() {
        const canvas = document.getElementById('activityChart');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Responsivo + retina
        const parent = canvas.parentElement;
        const cssWidth = Math.max(280, parent?.clientWidth || 600);
        const cssHeight = 300;
        const dpr = window.devicePixelRatio || 1;
        canvas.style.width = cssWidth + 'px';
        canvas.style.height = cssHeight + 'px';
        canvas.width = Math.floor(cssWidth * dpr);
        canvas.height = Math.floor(cssHeight * dpr);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        const calls = this.getCallsFromStorage();

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const days = 30;
        const buckets = Array.from({ length: days }, (_, i) => {
            const d = new Date(today.getTime() - (days - 1 - i) * 24 * 60 * 60 * 1000);
            return { date: d, count: 0 };
        });

        const start = buckets[0].date.getTime();
        const end = today.getTime() + 24 * 60 * 60 * 1000;

        for (const c of calls) {
            const t = new Date(c.createdAt).getTime();
            if (Number.isNaN(t) || t < start || t >= end) continue;
            const dayIndex = Math.floor((t - start) / (24 * 60 * 60 * 1000));
            if (dayIndex >= 0 && dayIndex < days) buckets[dayIndex].count += 1;
        }

        const values = buckets.map(b => b.count);
        const maxVal = Math.max(3, ...values);

        // Layout
        const w = cssWidth;
        const h = cssHeight;
        const padL = 14;
        const padR = 14;
        const padT = 16;
        const padB = 28;
        const plotW = w - padL - padR;
        const plotH = h - padT - padB;

        // Background
        ctx.clearRect(0, 0, w, h);
        const bg = ctx.createLinearGradient(0, 0, 0, h);
        bg.addColorStop(0, 'rgba(255,255,255,0.03)');
        bg.addColorStop(1, 'rgba(255,255,255,0.01)');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, w, h);

        // Grid lines
        ctx.strokeStyle = 'rgba(255,255,255,0.07)';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 3; i++) {
            const y = padT + (plotH * i) / 3;
            ctx.beginPath();
            ctx.moveTo(padL, y);
            ctx.lineTo(padL + plotW, y);
            ctx.stroke();
        }

        // Points
        const pts = values.map((v, i) => {
            const x = padL + (plotW * i) / (days - 1);
            const y = padT + plotH * (1 - v / maxVal);
            return { x, y, v };
        });

        // Line + gradient fill
        const lineGrad = ctx.createLinearGradient(padL, padT, padL + plotW, padT);
        lineGrad.addColorStop(0, '#667eea');
        lineGrad.addColorStop(1, '#764ba2');

        const fillGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
        fillGrad.addColorStop(0, 'rgba(102,126,234,0.32)');
        fillGrad.addColorStop(1, 'rgba(118,75,162,0.02)');

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = lineGrad;
        ctx.stroke();

        ctx.lineTo(pts[pts.length - 1].x, padT + plotH);
        ctx.lineTo(pts[0].x, padT + plotH);
        ctx.closePath();
        ctx.fillStyle = fillGrad;
        ctx.fill();

        // Dot last point
        const last = pts[pts.length - 1];
        ctx.beginPath();
        ctx.arc(last.x, last.y, 4, 0, Math.PI * 2);
        ctx.fillStyle = '#2bffae';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0,0,0,0.55)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Labels (min, max)
        ctx.fillStyle = 'rgba(255,255,255,0.65)';
        ctx.font = '12px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif';
        ctx.fillText(`0`, padL, h - 10);
        ctx.fillText(`${maxVal}`, padL, padT + 12);

        // Simple bottom markers (7d)
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        for (let i = 0; i < days; i += 7) {
            const x = padL + (plotW * i) / (days - 1);
            ctx.fillRect(x, padT + plotH + 6, 1, 6);
        }
    }

    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
    }
}

function copyToClipboard(text) {
    navigator.clipboard.writeText(text).then(() => {
        alert('Link copiado!');
    });
}

// Inicializa dashboard
window.addEventListener('DOMContentLoaded', () => {
    new DashboardController();
});

