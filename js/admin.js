const admin = {
    token: localStorage.getItem('gh_token'),
    files: [],
    currentSha: null,

    init() {
        if (this.token) {
            document.getElementById('auth-section').style.display = 'none';
            document.getElementById('editor-section').style.display = 'block';
            document.getElementById('eDate').value = new Date().toISOString().split('T')[0];
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

    // Handle UTF-8 encoding properly for Base64 (so emojis and accents work)
    encodeB64(str) { return btoa(unescape(encodeURIComponent(str))); },
    decodeB64(str) { return decodeURIComponent(escape(atob(str))); },

    async fetchList() {
        try {
            const data = await this.request('entries');
            this.files = data.filter(f => f.name.endsWith('.md')).reverse();
            const select = document.getElementById('fileSelect');
            select.innerHTML = `<option value="new">+ New Entry</option>` + 
                this.files.map(f => `<option value="${f.name}">${f.name}</option>`).join('');
        } catch (e) { this.setStatus("Failed to load files. Token might be invalid.", true); }
    },

    async loadFile() {
        const filename = document.getElementById('fileSelect').value;
        if(filename === 'new') {
            document.getElementById('eDate').value = new Date().toISOString().split('T')[0];
            document.getElementById('eTags').value = '';
            document.getElementById('eMood').value = '';
            document.getElementById('eBody').value = '';
            document.getElementById('deleteBtn').style.display = 'none';
            this.currentSha = null;
            return;
        }

        this.setStatus("Loading...");
        const data = await this.request(`entries/${filename}`);
        this.currentSha = data.sha;
        const raw = this.decodeB64(data.content);
        
        const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        if(match) {
            document.getElementById('eBody').value = match[2].trim();
            const meta = match[1].split('\n');
            meta.forEach(line => {
                const [k, ...v] = line.split(':');
                if(k.trim() === 'tags') document.getElementById('eTags').value = v.join(':').trim();
                if(k.trim() === 'mood') document.getElementById('eMood').value = v.join(':').trim();
            });
            document.getElementById('eDate').value = filename.replace('.md', '');
        } else {
            document.getElementById('eBody').value = raw;
        }
        document.getElementById('deleteBtn').style.display = 'block';
        this.setStatus("Loaded.");
    },

    async saveFile() {
        this.setStatus("Saving...");
        document.getElementById('saveBtn').disabled = true;

        const date = document.getElementById('eDate').value;
        const tags = document.getElementById('eTags').value;
        const mood = document.getElementById('eMood').value;
        const body = document.getElementById('eBody').value;
        
        const content = `---\ndate: ${date}\ntags: ${tags}\nmood: ${mood}\n---\n\n${body}`;
        const path = `entries/${date}.md`;

        // Check if file exists to get SHA (if overwriting a new file)
        if(!this.currentSha) {
            const existing = await this.request(path);
            if(existing) this.currentSha = existing.sha;
        }

        const payload = {
            message: `Journal entry: ${date}`,
            content: this.encodeB64(content),
            branch: CONFIG.branch
        };
        if(this.currentSha) payload.sha = this.currentSha;

        try {
            await this.request(path, 'PUT', payload);
            this.setStatus("Saved successfully!");
            setTimeout(() => location.reload(), 1000);
        } catch (e) {
            this.setStatus("Error saving file.", true);
        }
    },

    async deleteFile() {
        if(!confirm("Are you sure you want to delete this entry?")) return;
        this.setStatus("Deleting...");
        const date = document.getElementById('eDate').value;
        try {
            await this.request(`entries/${date}.md`, 'DELETE', {
                message: `Delete entry ${date}`,
                sha: this.currentSha,
                branch: CONFIG.branch
            });
            this.setStatus("Deleted!");
            setTimeout(() => location.reload(), 1000);
        } catch(e) { this.setStatus("Error deleting.", true); }
    },

    setStatus(msg, isError=false) {
        const s = document.getElementById('status');
        s.innerText = msg;
        s.style.color = isError ? 'red' : 'var(--meta-color)';
    }
};

window.onload = () => admin.init();
