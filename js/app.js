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
            
            // Sortera nyast först
            this.entries.sort((a, b) => new Date(b.meta.datum) - new Date(a.meta.datum));
            
            this.buildSidebar();
            this.renderHome();
        } catch (err) {
            document.getElementById('content').innerHTML = `<p class="mono">Kunde inte ladda arkivet. Kontrollera config.js.</p>`;
        }
    },

    parseMD(filename, raw) {
        const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
        
        // Standardvärden
        let meta = { 
            titel: 'Namnlöst inlägg', 
            datum: filename.replace('.md', ''), 
            känsla: '' 
        };
        let content = raw;

        if (match) {
            content = match[2];
            match[1].split('\n').forEach(line => {
                const parts = line.split(':');
                if(parts.length >= 2) {
                    const key = parts[0].trim().toLowerCase();
                    const val = parts.slice(1).join(':').trim();
                    
                    if(key === 'titel') meta.titel = val;
                    if(key === 'datum' || key === 'date') meta.datum = val;
                    if(key === 'känsla' || key === 'mood') meta.känsla = val;
                }
            });
        }
        
        // Om titeln är tom, använd datumet
        if(!meta.titel || meta.titel === '') meta.titel = meta.datum;

        return { filename, meta, content };
    },

    buildSidebar() {
        // Bygg kalender. Markera index 0 som [NYAST]
        document.getElementById('calendarList').innerHTML = this.entries.map((e, index) => {
            const latestClass = index === 0 ? 'class="latest"' : '';
            return `<li ${latestClass} onclick="app.renderEntry('${e.filename}')">${e.meta.datum}</li>`;
        }).join('');
    },

    renderHome() {
        let html = ``;
        this.entries.forEach(e => {
            html += `
            <div class="feed-item" onclick="app.renderEntry('${e.filename}')">
                <h2>${e.meta.titel}</h2>
                <div class="feed-meta mono">Publicerat: ${e.meta.datum}</div>
                <div class="feed-preview">${marked.parse(e.content.substring(0, 180))}...</div>
            </div>`;
        });
        document.getElementById('content').innerHTML = html;
    },

    renderEntry(filename) {
        const entry = this.entries.find(e => e.filename === filename);
        
        let html = `
            <h1 class="entry-title">${entry.meta.titel}</h1>
            <div class="entry-meta mono">
                <span>Datum: ${entry.meta.datum}</span>
                ${entry.meta.känsla ? `<span>Känsla: ${entry.meta.känsla}</span>` : ''}
            </div>
            <div class="entry-body">${marked.parse(entry.content)}</div>
        `;
        document.getElementById('content').innerHTML = html;
        window.scrollTo(0,0);
    },

    search() {
        const query = document.getElementById('searchInput').value.toLowerCase();
        const filtered = this.entries.filter(e => 
            e.content.toLowerCase().includes(query) || 
            e.meta.titel.toLowerCase().includes(query)
        );
        
        let html = `<h2 class="mono" style="margin-bottom: 2rem;">Sökresultat</h2>`;
        filtered.forEach(e => {
            html += `
            <div class="feed-item" onclick="app.renderEntry('${e.filename}')">
                <h2>${e.meta.titel}</h2>
                <div class="feed-meta mono">${e.meta.datum}</div>
            </div>`;
        });
        document.getElementById('content').innerHTML = html;
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
