// PaddockActu : navigation par ancre, cartes d'articles, classements et calendrier.
// Sur l'accueil (index.html) tout est actif ; sur une page article seul le bloc
// "À lire aussi" est rempli. ROOT vaut '' à la racine et '../' dans articles/.
(function () {
    'use strict';

    const ROOT = document.body.dataset.root || '';
    const SITE_TITLE = document.title;

    const CATEGORY_LABELS = { motogp: 'MotoGP', moto2: 'Moto2', moto3: 'Moto3', paddock: 'Paddock' };

    // Nom français des Grands Prix, indexé par le code court de l'API.
    const GP_NAMES = {
        THA: 'Grand Prix de Thaïlande',
        BRA: 'Grand Prix du Brésil',
        USA: 'Grand Prix des États-Unis',
        AME: 'Grand Prix des Amériques',
        ARG: "Grand Prix d'Argentine",
        SPA: "Grand Prix d'Espagne",
        FRA: 'Grand Prix de France',
        CAT: 'Grand Prix de Catalogne',
        ITA: "Grand Prix d'Italie",
        HUN: 'Grand Prix de Hongrie',
        CZE: 'Grand Prix de Tchéquie',
        NED: 'Grand Prix des Pays-Bas',
        GER: "Grand Prix d'Allemagne",
        GBR: 'Grand Prix de Grande-Bretagne',
        ARA: "Grand Prix d'Aragón",
        RSM: 'Grand Prix de Saint-Marin',
        EMI: "Grand Prix d'Émilie-Romagne",
        AUT: "Grand Prix d'Autriche",
        JPN: 'Grand Prix du Japon',
        INA: "Grand Prix d'Indonésie",
        AUS: "Grand Prix d'Australie",
        MAL: 'Grand Prix de Malaisie',
        QAT: 'Grand Prix du Qatar',
        POR: 'Grand Prix du Portugal',
        VAL: 'Grand Prix de Valence',
        KAZ: 'Grand Prix du Kazakhstan',
        IND: "Grand Prix d'Inde"
    };

    const PAGES = {
        'accueil': 'page-accueil',
        'tous-les-articles': 'page-catalogue',
        'classements': 'page-classements',
        'calendrier': 'page-calendrier'
    };

    /* ---------- Utilitaires ---------- */

    function flag(iso) {
        if (!iso || iso.length !== 2) return '';
        return String.fromCodePoint(...[...iso.toUpperCase()].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
    }

    // "2026-10-02T08:00:00+09:00" -> date locale du jour au circuit (sans décalage de fuseau)
    function localDay(iso) {
        const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
        return new Date(y, m - 1, d);
    }

    function dayLabel(date) {
        const n = date.getDate();
        return n === 1 ? '1er' : String(n);
    }

    function monthLabel(date, style) {
        return date.toLocaleDateString('fr-FR', { month: style });
    }

    // "du 2 au 4 octobre" ou "du 27 février au 1er mars"
    function dateRange(startIso, endIso, monthStyle) {
        const s = localDay(startIso), e = localDay(endIso);
        if (s.getMonth() === e.getMonth()) {
            return `du ${dayLabel(s)} au ${dayLabel(e)} ${monthLabel(e, monthStyle)}`;
        }
        return `du ${dayLabel(s)} ${monthLabel(s, monthStyle)} au ${dayLabel(e)} ${monthLabel(e, monthStyle)}`;
    }

    function formatDate(iso, style) {
        return localDay(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: style || 'long', year: 'numeric' });
    }

    // Colle la ponctuation haute au mot précédent pour éviter un ":" en début de ligne
    function frenchSpacing(str) {
        return String(str).replace(/ ([:;!?])/g, '\u00a0$1');
    }

    function titleCase(str) {
        return str.toLowerCase().replace(/(^|\s|-)\S/g, c => c.toUpperCase());
    }

    async function loadJson(path) {
        const response = await fetch(ROOT + path + '?v=' + Date.now());
        if (!response.ok) throw new Error(path + ' : ' + response.status);
        return response.json();
    }

    // Calendrier et meta sont partagés entre les classements et la page calendrier
    let calendarPromise = null;
    function getCalendar() {
        if (!calendarPromise) {
            calendarPromise = loadJson('data/calendar.json')
                .then(c => (Array.isArray(c) ? c : []))
                .catch(() => []);
        }
        return calendarPromise;
    }

    // Manifeste des photos de pilotes générées par scripts/rider-images.py
    let ridersPromise = null;
    function getRiders() {
        if (!ridersPromise) ridersPromise = loadJson('data/riders.json').catch(() => ({}));
        return ridersPromise;
    }

    let metaPromise = null;
    function getMeta() {
        if (!metaPromise) metaPromise = loadJson('data/meta.json').catch(() => ({}));
        return metaPromise;
    }

    /* ---------- Navigation par ancre ---------- */

    // "#calendrier/AUT" -> { route: 'calendrier', param: 'AUT' }
    function currentRoute() {
        const [hash, param] = location.hash.replace(/^#\/?/, '').split('/');
        return { route: PAGES[hash] ? hash : 'accueil', param: param || '' };
    }

    function showPage() {
        const { route, param } = currentRoute();
        document.querySelectorAll('.page').forEach(page => {
            page.classList.toggle('hidden', page.id !== PAGES[route]);
        });
        document.querySelectorAll('.site-nav a').forEach(link => {
            link.classList.toggle('active', link.getAttribute('href') === '#' + route);
        });
        if (route === 'calendrier') showCalendarView(param);
        else document.title = SITE_TITLE;
        window.scrollTo(0, 0);
    }

    function initRouter() {
        if (!document.querySelector('.page')) return;
        window.addEventListener('hashchange', showPage);
        // Cliquer sur le lien de la page déjà affichée ne déclenche pas hashchange
        document.querySelectorAll('a[href^="#"]').forEach(link => {
            link.addEventListener('click', () => {
                if (link.getAttribute('href') === location.hash) showPage();
            });
        });
        showPage();
    }

    /* ---------- Articles ---------- */

    function sortedArticles() {
        return [...ARTICLES].sort((a, b) => b.date.localeCompare(a.date));
    }

    function articleCard(article) {
        const link = document.createElement('a');
        link.className = 'card-link';
        link.href = ROOT + 'articles/' + article.slug + '.html';
        link.dataset.tag = article.category;
        link.innerHTML = `
            <article class="card">
                <div class="card-media">
                    <img src="${article.image}" alt="" loading="lazy">
                    <span class="tag tag-${article.category}">${CATEGORY_LABELS[article.category] || article.category}</span>
                </div>
                <div class="card-content">
                    <h3></h3>
                    <p></p>
                    <time class="card-date" datetime="${article.date}">${formatDate(article.date)}</time>
                </div>
            </article>`;
        link.querySelector('h3').textContent = frenchSpacing(article.title);
        link.querySelector('p').textContent = frenchSpacing(article.excerpt);
        return link;
    }

    function renderHero(hero, article) {
        hero.innerHTML = `
            <a class="hero-link" href="${ROOT}articles/${article.slug}.html">
                <img class="hero-img" src="${article.image}" alt="">
                <div class="hero-shade"></div>
                <div class="hero-body container">
                    <span class="tag tag-${article.category}">${CATEGORY_LABELS[article.category] || article.category}</span>
                    <h1 class="hero-title"></h1>
                    <p class="hero-excerpt"></p>
                    <p class="hero-meta">${formatDate(article.date)} · Par ${article.author || 'PaddockActu'}</p>
                </div>
            </a>`;
        hero.querySelector('.hero-title').textContent = frenchSpacing(article.title);
        hero.querySelector('.hero-excerpt').textContent = frenchSpacing(article.excerpt);
    }

    function fillGrid(grid, articles) {
        grid.innerHTML = '';
        articles.forEach(article => grid.appendChild(articleCard(article)));
    }

    function initArticles() {
        const articles = sortedArticles();

        const hero = document.getElementById('hero');
        if (hero && articles.length) renderHero(hero, articles[0]);

        const home = document.getElementById('home-articles');
        if (home) fillGrid(home, articles.slice(hero ? 1 : 0, hero ? 4 : 3));

        const all = document.getElementById('all-articles');
        if (all) {
            fillGrid(all, articles);
            const empty = document.getElementById('no-articles');
            document.querySelectorAll('#article-filters .filter-btn').forEach(button => {
                button.addEventListener('click', () => {
                    document.querySelectorAll('#article-filters .filter-btn').forEach(b => b.classList.remove('active'));
                    button.classList.add('active');
                    const filter = button.dataset.filter;
                    let visible = 0;
                    all.querySelectorAll('.card-link').forEach(card => {
                        const show = filter === 'tous' || card.dataset.tag === filter;
                        card.classList.toggle('hidden', !show);
                        if (show) visible++;
                    });
                    if (empty) empty.classList.toggle('hidden', visible > 0);
                });
            });
        }

        // Bloc "À lire aussi" des pages article
        const related = document.getElementById('related-articles');
        if (related) {
            const current = related.dataset.current;
            const others = articles.filter(a => a.slug !== current).slice(0, 3);
            if (others.length) {
                fillGrid(related.querySelector('.news-grid'), others);
            } else {
                related.classList.add('hidden');
            }
        }
    }

    /* ---------- Classements ---------- */

    // Points distribués par Grand Prix (course + sprint en MotoGP)
    const POINTS_PER_ROUND = { motogp: 25 + 12, moto2: 25, moto3: 25 };

    // Où en est la saison au moment où les classements ont été relevés
    function seasonState(calendar, meta, category) {
        if (!calendar.length) return null;
        const ref = meta && meta.updated_at ? new Date(meta.updated_at) : new Date();
        const done = calendar.filter(ev => new Date(ev.date_end) <= ref).length;
        const remaining = calendar.length - done;
        return {
            done,
            total: calendar.length,
            remaining,
            pointsLeft: remaining * (POINTS_PER_ROUND[category] || 25)
        };
    }

    function riderName(rider) {
        return `<span class="flag">${flag(rider.country)}</span>${rider.full_name || ''}`;
    }

    function riderImage(rider, kind, riders) {
        if (!rider.uuid || !riders || !riders[rider.uuid]) return '';
        return `${ROOT}img/riders/${rider.uuid}-${kind}.webp`;
    }

    function riderAvatar(rider, riders) {
        const src = riderImage(rider, 'head', riders);
        if (!src) return '<span class="rider-avatar rider-avatar-empty"></span>';
        return `<img class="rider-avatar" src="${src}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">`;
    }

    // Trois derniers GP, du plus ancien au plus récent (l'API les donne du plus récent au plus ancien)
    function formChips(item) {
        const entries = Object.entries(item.last_positions || {}).reverse();
        if (!entries.length) return '';
        return entries.map(([code, pos]) => {
            const gp = GP_NAMES[code] || code;
            if (pos == null) return `<span class="form-chip is-nc" title="${gp} : non classé">NC</span>`;
            const cls = pos === 1 ? ' is-win' : pos <= 3 ? ' is-podium' : '';
            return `<span class="form-chip${cls}" title="${gp} : ${pos}${pos === 1 ? 'er' : 'e'}">${pos}</span>`;
        }).join('');
    }

    function standingsRow(item, compact, leaderPoints, riders) {
        const rider = item.rider || {};
        const tr = document.createElement('tr');
        const team = item.team ? item.team.name : '';
        const riderCell = `<span class="rider-cell">${riderAvatar(rider, riders)}<span class="rider-text">${riderName(rider)}<small class="rider-team">${team}</small></span></span>`;
        const points = item.points ?? 0;
        const gap = leaderPoints - points;
        const barWidth = leaderPoints ? Math.max(2, Math.round(points / leaderPoints * 100)) : 0;
        if (compact) {
            tr.innerHTML = `
                <td class="pos">${item.position ?? ''}</td>
                <td class="rider">${riderCell}</td>
                <td class="team hide-sm">${team}</td>
                <td class="num points">${points}</td>`;
        } else {
            tr.innerHTML = `
                <td class="pos">${item.position ?? ''}</td>
                <td class="rider-number hide-sm">${rider.number ?? ''}</td>
                <td class="rider">${riderCell}</td>
                <td class="team hide-sm">${team}</td>
                <td class="hide-md">${item.manufacturer || ''}</td>
                <td class="form hide-sm">${formChips(item)}</td>
                <td class="num hide-sm">${item.race_wins ?? 0}</td>
                <td class="num hide-sm">${item.podiums ?? 0}</td>
                <td class="num gap hide-sm">${gap > 0 ? '-' + gap : ''}</td>
                <td class="num points">
                    <span class="points-value">${points}</span>
                    <span class="points-bar"><i style="width:${barWidth}%"></i></span>
                    ${gap > 0 ? `<small class="gap-inline">-${gap}</small>` : ''}
                </td>`;
        }
        return tr;
    }

    function fillStandings(tbody, classification, compact, riders) {
        const leaderPoints = classification[0] ? (classification[0].points ?? 0) : 0;
        tbody.innerHTML = '';
        classification.forEach(item => tbody.appendChild(standingsRow(item, compact, leaderPoints, riders)));
    }

    function renderPodium(container, classification, riders) {
        if (!container) return;
        const leaderPoints = classification[0] ? (classification[0].points ?? 0) : 0;
        container.innerHTML = classification.slice(0, 3).map((item, i) => {
            const rider = item.rider || {};
            const gap = leaderPoints - (item.points ?? 0);
            const bust = riderImage(rider, 'bust', riders);
            const head = riderImage(rider, 'head', riders);
            return `
                <div class="podium-tile p${i + 1}${bust ? ' has-photo' : ''}">
                    <span class="podium-rank">${item.position ?? i + 1}</span>
                    ${head ? `<img class="podium-head" src="${head}" alt="" loading="lazy">` : ''}
                    <div class="podium-rider">
                        <span class="podium-number">${rider.number != null ? '#' + rider.number : ''}</span>
                        <strong>${riderName(rider)}</strong>
                        <span class="podium-team">${item.team ? item.team.name : ''}</span>
                    </div>
                    <div class="podium-points">
                        <b>${item.points ?? 0}</b><span>pts</span>
                        <em>${i === 0 ? 'Leader' : '-' + gap + ' pts'}</em>
                    </div>
                    ${bust ? `<img class="podium-bust" src="${bust}" alt="" loading="lazy">` : ''}
                </div>`;
        }).join('');
    }

    function renderStats(container, classification, season) {
        if (!container) return;
        const leader = classification[0] ? (classification[0].points ?? 0) : 0;
        const second = classification[1] ? (classification[1].points ?? 0) : 0;
        const tiles = [{ label: 'Écart P1 / P2', value: leader - second, unit: 'pts' }];
        if (season) {
            const inContention = classification.filter(r => (r.points ?? 0) + season.pointsLeft >= leader).length;
            tiles.push(
                { label: 'Manches restantes', value: season.remaining, unit: 'sur ' + season.total },
                { label: 'Points encore en jeu', value: season.pointsLeft, unit: 'pts' },
                { label: 'En lice pour le titre', value: inContention, unit: inContention > 1 ? 'pilotes' : 'pilote' }
            );
        }
        container.innerHTML = tiles.map(t => `
            <div class="stat-tile">
                <span class="stat-label">${t.label}</span>
                <span class="stat-value">${t.value}<small>${t.unit}</small></span>
            </div>`).join('');
    }

    function showStandingsError(tbody, columns) {
        tbody.innerHTML = `<tr><td colspan="${columns}" class="muted">Classement indisponible pour le moment.</td></tr>`;
    }

    async function loadStandings(category) {
        const tbody = document.querySelector(`#table-${category} tbody`);
        if (!tbody) return;
        const panel = document.querySelector(`.standings-panel[data-cat="${category}"]`);
        const homeTbody = document.querySelector(`#table-home-${category} tbody`);
        try {
            const [data, calendar, meta, riders] = await Promise.all([loadJson(`data/${category}.json`), getCalendar(), getMeta(), getRiders()]);
            const classification = data.classification;
            if (!classification || !classification.length) throw new Error('classement vide');
            fillStandings(tbody, classification, false, riders);
            if (panel) {
                renderPodium(panel.querySelector('.podium'), classification, riders);
                renderStats(panel.querySelector('.stat-row'), classification, seasonState(calendar, meta, category));
            }
            if (homeTbody) fillStandings(homeTbody, classification.slice(0, 3), true, riders);
        } catch (e) {
            console.warn('Classement', category, e.message);
            showStandingsError(tbody, 10);
            if (homeTbody) showStandingsError(homeTbody, 4);
        }
    }

    function initStandings() {
        const tabs = document.querySelectorAll('#standings-tabs .filter-btn');
        const homeTable = document.getElementById('table-home-motogp');
        if (!tabs.length && !homeTable) return;
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                document.querySelectorAll('.standings-panel').forEach(panel => {
                    panel.classList.toggle('hidden', panel.dataset.cat !== tab.dataset.cat);
                });
            });
        });
        ['motogp', 'moto2', 'moto3'].forEach(loadStandings);

        Promise.all([getCalendar(), getMeta()]).then(([calendar, meta]) => {
            const context = document.getElementById('standings-context');
            if (context) {
                const parts = [];
                const season = seasonState(calendar, meta, 'motogp');
                if (season) parts.push(`Après ${season.done} manche${season.done > 1 ? 's' : ''} sur ${season.total}`);
                if (meta.updated_at) parts.push('données du ' + formatDate(meta.updated_at));
                context.textContent = parts.join(' · ');
            }
            const year = document.getElementById('calendar-year');
            if (year && meta.season_year) year.textContent = meta.season_year;
        });
    }

    /* ---------- Calendrier ---------- */

    function gpName(event) {
        return GP_NAMES[event.shortname] || ('Grand Prix ' + titleCase(event.name || ''));
    }

    // "J-11", "Aujourd'hui" ou "En piste" pour un GP à venir ou en cours
    function countdownLabel(event, now) {
        const start = localDay(event.date_start);
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const days = Math.round((start - today) / 86400000);
        if (days > 0) return 'J-' + days;
        if (new Date(event.date_start) > now) return 'Aujourd\'hui';
        return 'En piste';
    }

    function nextEventIndex(calendar, now) {
        return calendar.findIndex(event => new Date(event.date_end) >= now);
    }

    function eventState(calendar, index, now) {
        const nextIndex = nextEventIndex(calendar, now);
        if (index === nextIndex) return new Date(calendar[index].date_start) <= now ? 'live' : 'next';
        if (nextIndex === -1 || index < nextIndex) return 'done';
        return 'upcoming';
    }

    const STATE_LABELS = { live: 'En cours', next: 'Prochain', done: 'Terminé', upcoming: 'À venir' };

    function countryName(iso) {
        try {
            return new Intl.DisplayNames(['fr'], { type: 'region' }).of(iso) || iso;
        } catch (e) {
            return iso || '';
        }
    }

    function articlesForGp(shortname) {
        return sortedArticles().filter(a => a.gp === shortname);
    }

    function renderNextGp(container, calendar) {
        const now = new Date();
        const next = calendar.find(event => new Date(event.date_end) >= now);
        if (!next) {
            container.innerHTML = '<p class="muted">La saison est terminée, rendez-vous l\'année prochaine.</p>';
            return;
        }
        const countdown = countdownLabel(next, now);

        container.innerHTML = `
            <a class="next-gp-link" href="#calendrier/${next.shortname}" aria-label="Fiche du Grand Prix"></a>
            <p class="next-gp-round">Manche ${next.round} sur ${calendar.length}</p>
            ${next.track_image ? `<img src="${next.track_image}" alt="" class="next-gp-track">` : ''}
            <div class="next-gp-body">
                <h3><span class="flag">${flag(next.country)}</span>${gpName(next)}</h3>
                <p class="next-gp-circuit">${next.circuit || ''}</p>
                <p class="next-gp-dates">${dateRange(next.date_start, next.date_end, 'long')}</p>
            </div>
            <div class="next-gp-countdown">${countdown}</div>`;
    }

    // "Grand Prix du Japon" -> "Japon"
    function gpShortName(event) {
        return gpName(event).replace(/^Grand Prix (du |de la |des |de |d')/, '');
    }

    function renderCalendarStats(container, calendar) {
        if (!container) return;
        const now = new Date();
        const nextIndex = nextEventIndex(calendar, now);
        const done = nextIndex === -1 ? calendar.length : nextIndex;
        const next = nextIndex === -1 ? null : calendar[nextIndex];
        const last = calendar[calendar.length - 1];
        const tiles = [
            { label: 'Manches disputées', value: done, unit: 'sur ' + calendar.length, meter: done / calendar.length },
            next
                ? { label: 'Prochain Grand Prix', value: countdownLabel(next, now), unit: gpShortName(next) }
                : { label: 'Prochain Grand Prix', value: 'Saison terminée', unit: '' },
            { label: 'Fin de saison', value: localDay(last.date_end).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }), unit: gpShortName(last) }
        ];
        container.innerHTML = tiles.map(t => `
            <div class="stat-tile">
                <span class="stat-label">${t.label}</span>
                <span class="stat-value">${t.value}<small>${t.unit}</small></span>
                ${t.meter != null ? `<span class="stat-meter"><i style="width:${Math.round(t.meter * 100)}%"></i></span>` : ''}
            </div>`).join('');
    }

    function renderCalendar(list, calendar) {
        const now = new Date();
        list.innerHTML = '';
        let currentMonth = '';
        calendar.forEach((event, index) => {
            const month = localDay(event.date_start).toLocaleDateString('fr-FR', { month: 'long' });
            if (month !== currentMonth) {
                currentMonth = month;
                const sep = document.createElement('li');
                sep.className = 'cal-month';
                sep.textContent = month;
                list.appendChild(sep);
            }
            const state = eventState(calendar, index, now);
            const label = state === 'next' ? countdownLabel(event, now) : STATE_LABELS[state];
            const count = articlesForGp(event.shortname).length;
            const li = document.createElement('li');
            li.className = 'is-' + state;
            li.innerHTML = `
                <a class="cal-link" href="#calendrier/${event.shortname}">
                    <span class="cal-round">${event.round}</span>
                    <span class="cal-dates">${dateRange(event.date_start, event.date_end, 'short')}</span>
                    <span class="cal-name">
                        <strong><span class="flag">${flag(event.country)}</span>${gpName(event)}</strong>
                        <small>${event.circuit || ''}</small>
                    </span>
                    <span class="cal-extra">${count ? `<span class="cal-articles">${count} article${count > 1 ? 's' : ''}</span>` : ''}</span>
                    <span class="status-badge">${label}</span>
                </a>`;
            list.appendChild(li);
        });
    }

    function formatKm(meters) {
        return (meters / 1000).toLocaleString('fr-FR', { minimumFractionDigits: 3, maximumFractionDigits: 3 }) + ' km';
    }

    function renderGpDetail(container, calendar, index) {
        const event = calendar[index];
        const now = new Date();
        const state = eventState(calendar, index, now);
        const label = state === 'next' ? STATE_LABELS.next + ' · ' + countdownLabel(event, now) : STATE_LABELS[state];
        const track = event.track || {};
        const laps = event.laps || {};
        const corners = (track.left_corners || 0) + (track.right_corners || 0);
        const tiles = [];
        if (track.length_m) tiles.push({ label: 'Longueur du circuit', value: formatKm(track.length_m), unit: '' });
        if (corners) tiles.push({ label: 'Virages', value: corners, unit: `${track.right_corners || 0} à droite, ${track.left_corners || 0} à gauche` });
        if (track.longest_straight_m) tiles.push({ label: 'Ligne droite', value: track.longest_straight_m, unit: 'm' });
        if (laps.motogp) tiles.push({ label: 'Tours en MotoGP', value: laps.motogp, unit: laps.motogp_sprint ? `sprint : ${laps.motogp_sprint}` : '' });
        if (laps.moto2 || laps.moto3) tiles.push({ label: 'Tours Moto2 / Moto3', value: `${laps.moto2 || '?'} / ${laps.moto3 || '?'}`, unit: '' });

        const prev = calendar[index - 1];
        const next = calendar[index + 1];
        const articles = articlesForGp(event.shortname);

        container.innerHTML = `
            <div class="gp-hero is-${state}">
                ${event.track_image ? `<img class="gp-track" src="${event.track_image}" alt="Tracé du circuit">` : ''}
                <div class="gp-hero-body">
                    <p class="next-gp-round">Manche ${event.round} sur ${calendar.length}</p>
                    <h2 class="gp-title"><span class="flag">${flag(event.country)}</span>${gpName(event)}</h2>
                    <p class="gp-circuit">${event.circuit || ''}${event.city ? ` · ${event.city}, ${countryName(event.country)}` : ''}</p>
                    <p class="gp-dates">${dateRange(event.date_start, event.date_end, 'long')} ${localDay(event.date_end).getFullYear()}</p>
                </div>
                <span class="status-badge">${label}</span>
            </div>
            ${tiles.length ? `<div class="stat-row gp-stats">${tiles.map(t => `
                <div class="stat-tile">
                    <span class="stat-label">${t.label}</span>
                    <span class="stat-value">${t.value}<small>${t.unit}</small></span>
                </div>`).join('')}</div>` : ''}
            <h2 class="section-title">Articles du Grand Prix</h2>
            ${articles.length ? '<div class="news-grid gp-articles"></div>' : '<p class="muted gp-empty">Aucun article sur ce Grand Prix pour le moment.</p>'}
            <nav class="gp-nav" aria-label="Grand Prix précédent et suivant">
                ${prev ? `<a href="#calendrier/${prev.shortname}">&larr; ${gpName(prev)}</a>` : '<span></span>'}
                ${next ? `<a href="#calendrier/${next.shortname}">${gpName(next)} &rarr;</a>` : '<span></span>'}
            </nav>`;
        if (articles.length) fillGrid(container.querySelector('.gp-articles'), articles);
        document.title = gpName(event) + ' - PaddockActu';
    }

    // Vue liste ou fiche d'un GP selon le paramètre de l'ancre
    async function showCalendarView(param) {
        const listView = document.getElementById('calendar-list-view');
        const detailView = document.getElementById('calendar-detail-view');
        if (!listView || !detailView) return;
        const calendar = await getCalendar();
        const index = param ? calendar.findIndex(ev => ev.shortname === param.toUpperCase()) : -1;
        if (index === -1) {
            listView.classList.remove('hidden');
            detailView.classList.add('hidden');
            document.title = SITE_TITLE;
            return;
        }
        listView.classList.add('hidden');
        detailView.classList.remove('hidden');
        renderGpDetail(document.getElementById('gp-detail'), calendar, index);
        window.scrollTo(0, 0);
    }

    async function initCalendar() {
        const nextGp = document.getElementById('next-gp');
        const list = document.getElementById('calendar');
        if (!nextGp && !list) return;
        try {
            const calendar = await getCalendar();
            if (!calendar.length) throw new Error('calendrier vide');
            if (nextGp) renderNextGp(nextGp, calendar);
            if (list) renderCalendar(list, calendar);
            renderCalendarStats(document.getElementById('calendar-stats'), calendar);
        } catch (e) {
            console.warn('Calendrier', e.message);
            if (nextGp) nextGp.innerHTML = '<p class="muted">Calendrier indisponible pour le moment.</p>';
            if (list) list.innerHTML = '<li class="muted">Calendrier indisponible pour le moment.</li>';
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        initRouter();
        initArticles();
        initStandings();
        initCalendar();
    });
})();
