const app = {
    entries: [],
    
    async init() {
        if(localStorage.getItem('theme') === 'dark') document.body.setAttribute('data-theme', 'dark');
        
        try {
            const res = await fetch(`https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}/contents/entries`);
            const files = await res.json();
            
            const fetchPromises = files.filter(f => f.name.endsWith('.md')).map(f => 
                fetch(`entries/${f.name}`).then(r => r.text()).then(text => this.parseMD(f.name, text))
            );
            
            this.entries = await Promise.all(fetchPromises);
            this.entries.sort((a, b) => new Date(b.meta.date) - new Date(a.meta.date));
            
            this.buildSidebar();
            this.renderHome();
        } catch (err) {
            document.getElementById('content').innerHTML = `<p class="mono">Kunde inte ladda arkivet. Kontrollera inställningarna i config.js.</p>`;
        }
    },

    parseMD(filename, raw) {
        const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        let meta = { date: filename.replace('.md', ''), tags: '', mood: '' };
        let content = raw;

        if (match) {
            content = match[2];
            match[1].split('\n').forEach(line => {
                const parts = line.split(':');
                if(parts.length >= 2) meta[parts[0].trim()] = parts.slice(1).join(':').trim();
            });
        }
        return { filename, meta, content };
    },

    buildSidebar() {
        const tags = new Set();
        this.entries.forEach(e => {
            if(e.meta.tags) e.meta.tags.split(',').forEach(t => tags.add(t.trim()));
        });

        document.getElementById('tagsList').innerHTML = Array.from(tags).map(t => 
            `<li onclick="app.filterByTag('${t}')">${t}</li>`
        ).join('');

        document.getElementById('calendarList').innerHTML = this.entries.map(e => 
            `<li onclick="app.renderEntry('${e.filename}')">${e.meta.date}</li>`
        ).join('');
    },

    renderHome() {
        let html = `<h1 class="mono">Senaste inläggen</h1>`;
        this.entries.forEach(e => {
            html += `<div style="margin-bottom: 2rem; cursor: pointer; border-bottom: 1px dashed var(--border-color); padding-bottom: 1rem;" onclick="app.renderEntry('${e.filename}')">
                <p class="mono" style="color: var(--meta-color); margin-bottom: 0.5rem;">${e.meta.date}</p>
                <div style="max-height: 100px; overflow: hidden; opacity: 0.8;">${marked.parse(e.content.substring(0, 150))}...</div>
            </div>`;
        });
        document.getElementById('content').innerHTML = html;
    },

    renderEntry(filename) {
        const entry = this.entries.find(e => e.filename === filename);
        const index = this.entries.indexOf(entry);
        
        let html = `
            <div class="entry-meta mono">
                <span>${entry.meta.date}</span>
                ${entry.meta.mood ? `<span>känsla: ${entry.meta.mood}</span>` : ''}
                ${entry.meta.tags ? `<span>taggar: ${entry.meta.tags}</span>` : ''}
            </div>
            <div class="entry-body">${marked.parse(entry.content)}</div>
            <div style="margin-top: 4rem; display: flex; justify-content: space-between; border-top: 1px dashed var(--border-color); padding-top: 2rem;">
                ${index < this.entries.length - 1 ? `<button onclick="app.renderEntry('${this.entries[index+1].filename}')">< Föregående</button>` : '<div></div>'}
                ${index > 0 ? `<button onclick="app.renderEntry('${this.entries[index-1].filename}')">Nästa ></button>` : '<div></div>'}
            </div>
        `;
        document.getElementById('content').innerHTML = html;
    },

    search() {
        const query = document.getElementById('searchInput').value.toLowerCase();
        const filtered = this.entries.filter(e => 
            e.content.toLowerCase().includes(query) || e.meta.tags.toLowerCase().includes(query)
        );
        let html = `<h1 class="mono">Sökresultat</h1>`;
        filtered.forEach(e => {
            html += `<p class="mono" style="cursor:pointer;" onclick="app.renderEntry('${e.filename}')">${e.meta.date} - Läs inlägg...</p>`;
        });
        document.getElementById('content').innerHTML = html;
    },
    
    filterByTag(tag) {
        document.getElementById('searchInput').value = tag;
        this.search();
    }
};

function toggleTheme() {
    const body = document.body;
    const current = body.getAttribute('data-theme');
    const next = current === 'dark' ? 'light' : 'dark';
    body.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
}

window.onload = () => app.init();
