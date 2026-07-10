const admin = {
    token: localStorage.getItem('gh_token'),
    files: [],
    currentSha: null,

    init() {
        if (this.token) {
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('editor-section').style.display = 'block';
            document.getElementById('eDatum').value = new Date().toISOString().split('T')[0];
            this.fetchList();
        }
    },

    login() {
        const t = document.getElementById('ghToken').value;
        if(t) { localStorage.setItem('gh_token', t); this.token = t; this.init(); }
    },

    logout() {
        localStorage.removeItem('gh_token');
        location.reload();
    },

    async request(path, method = 'GET', body = null) {
        const headers = {
            'Authorization': `token ${this.token}`,
            'Accept': 'application/vnd.github.v3+json'
        };
        const opts = { method, headers };
        if (body) opts.body = JSON.stringify(body);
        
        const res = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/${path}`, opts);
        if(!res.ok && res.status !== 404) throw new Error('API Error');
        return res.status === 404 ? null : await res.json();
    },

    encodeB64(str) { return btoa(unescape(encodeURIComponent(str))); },
    decodeB64(str) { return decodeURIComponent(escape(atob(str))); },

    async fetchList() {
        try {
            const data = await this.request('entries');
            this.files = data.filter(f => f.name.endsWith('.md')).reverse();
            const select = document.getElementById('fileSelect');
            select.innerHTML = `<option value="new">+ Skapa nytt inlägg</option>` + 
                this.files.map(f => `<option value="${f.name}">${f.name}</option>`).join('');
        } catch (e) { this.setStatus("Kunde inte ladda filerna. Nyckeln kan vara ogiltig.", true); }
    },

    async loadFile() {
        const filename = document.getElementById('fileSelect').value;
        if(filename === 'new') {
            document.getElementById('eDatum').value = new Date().toISOString().split('T')[0];
            document.getElementById('eTitel').value = '';
            document.getElementById('eKansla').value = '';
            document.getElementById('eBody').value = '';
            document.getElementById('deleteBtn').style.display = 'none';
            this.currentSha = null;
            return;
        }

        this.setStatus("Laddar dokument...");
        const data = await this.request(`entries/${filename}`);
        this.currentSha = data.sha;
        const raw = this.decodeB64(data.content);
        
        const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        
        // Återställ fält innan vi fyller på
        document.getElementById('eTitel').value = '';
        document.getElementById('eKansla').value = '';
        
        if(match) {
            document.getElementById('eBody').value = match[2].trim();
            const meta = match[1].split('\n');
            meta.forEach(line => {
                const [k, ...v] = line.split(':');
                const key = k.trim().toLowerCase();
                const val = v.join(':').trim();
                
                if(key === 'titel') document.getElementById('eTitel').value = val;
                if(key === 'känsla' || key === 'mood') document.getElementById('eKansla').value = val;
            });
            document.getElementById('eDatum').value = filename.replace('.md', '');
        } else {
            document.getElementById('eBody').value = raw;
        }
        document.getElementById('deleteBtn').style.display = 'block';
        this.setStatus("Dokument laddat.");
    },

    async saveFile() {
        this.setStatus("Sparar till arkivet...");
        document.getElementById('saveBtn').disabled = true;

        const datum = document.getElementById('eDatum').value;
        const titel = document.getElementById('eTitel').value || datum; // Fallback till datum om titel är tom
        const kansla = document.getElementById('eKansla').value;
        const body = document.getElementById('eBody').value;
        
        const content = `---\ntitel: ${titel}\ndatum: ${datum}\nkänsla: ${kansla}\n---\n\n${body}`;
        const path = `entries/${datum}.md`;

        if(!this.currentSha) {
            const existing = await this.request(path);
            if(existing) this.currentSha = existing.sha;
        }

        const payload = {
            message: `Sparade inlägg: ${titel}`,
            content: this.encodeB64(content),
            branch: CONFIG.branch
        };
        if(this.currentSha) payload.sha = this.currentSha;

        try {
            await this.request(path, 'PUT', payload);
            this.setStatus("Inlägget är sparat!");
            setTimeout(() => location.reload(), 1500);
        } catch (e) {
            this.setStatus("Ett fel uppstod. Kontrollera behörigheter på din token.", true);
            document.getElementById('saveBtn').disabled = false;
        }
    },

    async deleteFile() {
        if(!confirm("Är du säker på att du vill radera detta inlägg för alltid?")) return;
        this.setStatus("Raderar...");
        const datum = document.getElementById('eDatum').value;
        try {
            await this.request(`entries/${datum}.md`, 'DELETE', {
                message: `Raderade inlägg ${datum}`,
                sha: this.currentSha,
                branch: CONFIG.branch
            });
            this.setStatus("Inlägget raderat.");
            setTimeout(() => location.reload(), 1500);
        } catch(e) { 
            this.setStatus("Kunde inte radera inlägget.", true); 
        }
    },

    setStatus(msg, isError=false) {
        const s = document.getElementById('status');
        s.innerText = msg;
        s.style.color = isError ? 'var(--highlight-color)' : 'var(--meta-color)';
    }
};

window.onload = () => admin.init();
