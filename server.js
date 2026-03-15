const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const bodyParser = require('body-parser');
const http = require('http');
const { Server } = require('socket.io');
const session = require('express-session');
const passport = require('passport');
const SteamStrategy = require('passport-steam').Strategy;
const DiscordStrategy = require('passport-discord').Strategy;
const multer = require('multer');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const PORT = process.env.PORT || 3000;


const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const STEAM_API_KEY = process.env.STEAM_API_KEY || 'F312EA5B0451B3BA3841F41C7CAC87D7';

const io = new Server(server, {
    maxHttpBufferSize: 1e7,
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const uploadDir = path.join(__dirname, 'public', 'uploads', 'avatars');
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `avatar_${Date.now()}${ext}`);
    }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

passport.serializeUser((user, done) => done(null, user));
passport.deserializeUser((obj, done) => done(null, obj));

passport.use(new SteamStrategy({
    returnURL: `${BASE_URL}/auth/steam/return`,
    realm: `${BASE_URL}/`,
    apiKey: STEAM_API_KEY
}, (identifier, profile, done) => {
    const avatar = profile.photos && profile.photos.length > 0 ? profile.photos[profile.photos.length - 1].value : null;
    db.run(`INSERT INTO users (username, steam_id, avatar) 
            VALUES (?, ?, ?) 
            ON CONFLICT(steam_id) DO UPDATE SET username=excluded.username, avatar=excluded.avatar`,
    [profile.displayName, profile.id, avatar], (err) => {
        return done(null, profile);
    });
}));

passport.use(new DiscordStrategy({
    clientID: process.env.DISCORD_CLIENT_ID || '1475431938268598404',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || 'qTks3sHwtwgcu6y4G8Lw1MyPt94oNS7G',
    callbackURL: `${BASE_URL}/auth/discord/callback`,
    scope: ['identify', 'email']
}, (accessToken, refreshToken, profile, done) => {
    const avatar = profile.avatar
        ? `https://cdn.discordapp.com/avatars/${profile.id}/${profile.avatar}.png`
        : null;
    db.run(`INSERT INTO users (username, discord_tag, avatar) 
            VALUES (?, ?, ?) 
            ON CONFLICT(username) DO UPDATE SET discord_tag=excluded.discord_tag, avatar=excluded.avatar`,
    [profile.username, `${profile.username}#${profile.discriminator}`, avatar], (err) => {
        return done(null, {
            id: profile.id,
            name: profile.username,
            avatar: avatar,
            email: profile.email,
            provider: 'discord'
        });
    });
}));

app.set('trust proxy', 1); 

app.use(session({
    secret: process.env.SESSION_SECRET || 'gglink-secret-key',
    resave: true,
    saveUninitialized: true,
    cookie: {
        secure: process.env.NODE_ENV === 'production', 
        sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
        maxAge: 7 * 24 * 60 * 60 * 1000 
    }
}));
app.use(passport.initialize());
app.use(passport.session());
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const db = new sqlite3.Database('./database.sqlite');

const BASE_USERS = [
    { username: 'CyberViper', email: 'viper@gglink.com', password: '123456', discord_tag: 'CyberViper#1337', avatar: null },
    { username: 'NightOwl', email: 'owl@gglink.com', password: '123456', discord_tag: 'NightOwl#4200', avatar: null },
    { username: 'K1rman', email: 'fokich42@gmail.com', password: '123456', discord_tag: 'PhantomX#9999', avatar: null },
    { username: 'ShadowBlade', email: 'shadow@gglink.com', password: '123456', discord_tag: 'ShadowBlade#5555', avatar: null },
    { username: 'IceQueen', email: 'ice@gglink.com', password: '123456', discord_tag: 'IceQueen#7777', avatar: null }
];

const BASE_PLAYERS = [
    { nickname: 'CyberViper', game: 'Valorant', rank: 'Immortal 3', role: 'Duelist', description: 'Агрессивный дуэлянт, 3000+ часов в шутерах.', trust_score: 98, hours_played: 3200 },
    { nickname: 'NightOwl', game: 'CS2', rank: 'Global Elite', role: 'AWPer', description: 'Снайпер старой школы. Играю с 1.6', trust_score: 95, hours_played: 5400 },
    { nickname: 'K1rman', game: 'CS2', rank: 'Supreme', role: 'Mid', description: 'просто самый главный загадочный тип окэи', trust_score: 92, hours_played: 4100 },
    { nickname: 'ShadowBlade', game: 'Valorant', rank: 'Diamond 2', role: 'Controller', description: 'Смоки, флеши, контроль карты — моя специализация.', trust_score: 90, hours_played: 1800 },
    { nickname: 'IceQueen', game: 'CS2', rank: 'Supreme', role: 'Support', description: 'Командный игрок. Коммуникация превыше всего.', trust_score: 97, hours_played: 2600 }
];

const BASE_TOURNAMENTS = [
    { title: 'GGLINK Championship S1', game: 'Valorant', prize_pool: '$5,000', date: '15.03.2025', slots: '16/32', description: 'Первый сезон официального чемпионата GGLINK по Valorant.' },
    { title: 'CS2 Major Qualifier', game: 'CS2', prize_pool: '$10,000', date: '22.03.2025', slots: '8/16', description: 'Квалификация на мейджор.' },
    { title: 'Dota 2 Cup #3', game: 'Dota 2', prize_pool: '$3,000', date: '01.04.2025', slots: '12/16', description: 'Третий розыгрыш кубка по Dota 2.' },
    { title: 'Valorant Night Series', game: 'Valorant', prize_pool: '$1,500', date: '10.04.2025', slots: '20/32', description: 'Ночной турнир для полуночников.' },
    { title: 'Pro League Season 2', game: 'CS2', prize_pool: '$25,000', date: '20.04.2025', slots: '4/8', description: 'Элитная лига для профессиональных команд.' }
];

const BASE_CLANS = [
    { name: 'ОКЭИ', leader: 'CyberViper', game: 'Valorant', members_count: 5, min_rank: 'Immortal', region: 'EU', description: 'Да да, то самое' },
    { name: 'OSS', leader: 'NightOwl', game: 'CS2', members_count: 12, min_rank: 'Global Elite', region: 'CIS', description: 'Ветераны сцены.' },
    { name: 'Dota 2 Asia Champions', leader: 'IceQueen', game: 'Dota 2', members_count: 8, min_rank: '7000 MMR', region: 'EU', description: 'Ищем активных игроков.' },
    { name: 'Vorpal Swords', leader: 'ShadowBlade', game: 'Valorant', members_count: 3, min_rank: 'Diamond', region: 'NA', description: 'Поколение чудес' }
];

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT,
        email TEXT UNIQUE,
        password TEXT,
        steam_id TEXT UNIQUE,
        avatar TEXT,
        discord_tag TEXT,
        description TEXT,
        age INTEGER,
        country TEXT,
        languages TEXT,
        play_time TEXT,
        has_mic INTEGER DEFAULT 0,
        looking_for_team INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    const newCols = ['age INTEGER', 'country TEXT', 'languages TEXT', 'play_time TEXT', 'has_mic INTEGER DEFAULT 0', 'looking_for_team INTEGER DEFAULT 0'];
    newCols.forEach(col => {
        const colName = col.split(' ')[0];
        db.run(`ALTER TABLE users ADD COLUMN ${col}`, (err) => {});
    });

    db.run(`CREATE TABLE IF NOT EXISTS clans (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE, leader TEXT, game TEXT, members_count INTEGER DEFAULT 1, min_rank TEXT, region TEXT, avatar_url TEXT, description TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS players (id INTEGER PRIMARY KEY AUTOINCREMENT, nickname TEXT UNIQUE, game TEXT, rank TEXT, role TEXT, description TEXT, trust_score INTEGER DEFAULT 98, hours_played INTEGER DEFAULT 1200)`);
    db.run(`CREATE TABLE IF NOT EXISTS messages (id INTEGER PRIMARY KEY AUTOINCREMENT, room_id TEXT NOT NULL, sender TEXT NOT NULL, content TEXT NOT NULL, type TEXT DEFAULT 'text', timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);
    db.run(`CREATE TABLE IF NOT EXISTS tournaments (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, game TEXT, prize_pool TEXT, date TEXT, slots TEXT, description TEXT)`);
    db.run(`CREATE TABLE IF NOT EXISTS friends (id INTEGER PRIMARY KEY AUTOINCREMENT, from_user_id INTEGER, to_user_id INTEGER, status TEXT DEFAULT 'pending', created_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(from_user_id, to_user_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS clan_members (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, clan_id INTEGER, role TEXT DEFAULT 'member', joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, clan_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS tournament_participants (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, tournament_id INTEGER, joined_at DATETIME DEFAULT CURRENT_TIMESTAMP, UNIQUE(user_id, tournament_id))`);
    db.run(`CREATE TABLE IF NOT EXISTS visit_logs (id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, page TEXT, user_agent TEXT, username TEXT, timestamp DATETIME DEFAULT CURRENT_TIMESTAMP)`);

    BASE_USERS.forEach(u => {
        db.run(`INSERT OR IGNORE INTO users (username, email, password, discord_tag, avatar) VALUES (?, ?, ?, ?, ?)`,
            [u.username, u.email, u.password, u.discord_tag, u.avatar]);
    });
    BASE_PLAYERS.forEach(p => {
        db.run(`INSERT OR IGNORE INTO players (nickname, game, rank, role, description, trust_score, hours_played) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [p.nickname, p.game, p.rank, p.role, p.description, p.trust_score, p.hours_played]);
    });
    BASE_TOURNAMENTS.forEach(t => {
        db.run(`INSERT OR IGNORE INTO tournaments (title, game, prize_pool, date, slots, description) VALUES (?, ?, ?, ?, ?, ?)`,
            [t.title, t.game, t.prize_pool, t.date, t.slots, t.description]);
    });
    BASE_CLANS.forEach(c => {
        db.run(`INSERT OR IGNORE INTO clans (name, leader, game, members_count, min_rank, region, description) VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [c.name, c.leader, c.game, c.members_count, c.min_rank, c.region, c.description], function(err) {
                if (!err && this.lastID) {
                    const clanId = this.lastID;
                    db.get("SELECT id FROM users WHERE username = ?", [c.leader], (err, user) => {
                        if (user) db.run("INSERT OR IGNORE INTO clan_members (user_id, clan_id, role) VALUES (?, ?, 'leader')", [user.id, clanId]);
                    });
                }
            });
    });
});


app.use((req, res, next) => {
    if (req.method === 'GET' && !req.path.startsWith('/api/') && !req.path.startsWith('/socket.io') &&
        !req.path.match(/\.(js|css|png|jpg|svg|ico|woff|woff2|ttf|map)$/)) {
        const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || '127.0.0.1';
        const ua = req.headers['user-agent'] || '';
        const username = (req.session && req.session.userId) ? 'user_' + req.session.userId : 'guest';
        db.run("INSERT INTO visit_logs (ip, page, user_agent, username) VALUES (?, ?, ?, ?)", [ip, req.path, ua, username]);
    }
    next();
});

app.get('/auth/steam', passport.authenticate('steam'));
app.get('/auth/steam/return',
    passport.authenticate('steam', { failureRedirect: '/auth.html?error=steam_failed' }),
    (req, res) => {
        const avatar = req.user.photos && req.user.photos.length > 0
            ? req.user.photos[req.user.photos.length - 1].value : null;
        db.get("SELECT * FROM users WHERE steam_id = ?", [req.user.id], (err, user) => {
            if (user) req.session.userId = user.id;
            const userData = {
                id: user ? user.id : req.user.id,
                username: req.user.displayName,
                avatar: avatar,
                provider: 'steam'
            };
            res.redirect(`/auth-success.html?user=${encodeURIComponent(JSON.stringify(userData))}`);
        });
    }
);

app.get('/auth/discord', passport.authenticate('discord'));
app.get('/auth/discord/callback',
    passport.authenticate('discord', { failureRedirect: '/auth.html?error=discord_failed' }),
    (req, res) => {
        db.get("SELECT * FROM users WHERE username = ?", [req.user.name], (err, user) => {
            if (user) req.session.userId = user.id;
            const userData = {
                id: user ? user.id : req.user.id,
                username: req.user.name,
                avatar: req.user.avatar,
                email: req.user.email,
                provider: 'discord'
            };
            res.redirect(`/auth-success.html?user=${encodeURIComponent(JSON.stringify(userData))}`);
        });
    }
);

app.get('/logout', (req, res) => { req.logout(() => { req.session.destroy(); res.redirect('/'); }); });
app.get('/auth/logout', (req, res) => { req.logout(() => { req.session.destroy(); res.redirect('/'); }); });


app.get('/api/me', (req, res) => {
    if (!req.session.userId && !req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const userId = req.session.userId;
    const steamId = req.isAuthenticated() ? req.user.id : null;
    let query, params;
    if (userId) { query = "SELECT * FROM users WHERE id = ?"; params = [userId]; }
    else { query = "SELECT * FROM users WHERE steam_id = ?"; params = [steamId]; }
    db.get(query, params, (err, user) => {
        if (!user) return res.status(404).json({ error: "User not found" });
        db.get("SELECT * FROM players WHERE nickname = ?", [user.username], (err, player) => {
            delete user.password;
            res.json({ user, player });
        });
    });
});

app.post('/api/me/update', (req, res) => {
    if (!req.session.userId && !req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const { nickname, description, game, rank, role, discord_tag, age, country, languages, play_time, has_mic, looking_for_team } = req.body;
    const userId = req.session.userId;
    
    db.get("SELECT username FROM users WHERE id = ?", [userId], (err, userRow) => {
        const realNickname = userRow ? userRow.username : nickname;
        
        if (userId) {
            db.run(`UPDATE users SET discord_tag = ?, description = ?, age = ?, country = ?, languages = ?, play_time = ?, has_mic = ?, looking_for_team = ? WHERE id = ?`,
                [discord_tag || '', description || '', age || null, country || '', languages || '', play_time || '', has_mic ? 1 : 0, looking_for_team ? 1 : 0, userId]);
        }
        
        db.run(`INSERT INTO players (nickname, game, rank, role, description) VALUES (?, ?, ?, ?, ?) 
                ON CONFLICT(nickname) DO UPDATE SET game=excluded.game, rank=excluded.rank, role=excluded.role, description=excluded.description`,
        [realNickname, game, rank, role, description], (err) => {
            if (err) return res.status(500).json({ error: "DB error" });
            res.json({ success: true });
        });
    });
});


app.post('/api/me/avatar', upload.single('avatar'), (req, res) => {
    if (!req.session.userId && !req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    if (!req.file) return res.status(400).json({ error: "No file" });
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    const userId = req.session.userId;
    if (userId) {
        db.run("UPDATE users SET avatar = ? WHERE id = ?", [avatarUrl, userId], (err) => {
            if (err) return res.status(500).json({ error: "DB error" });
            res.json({ success: true, avatar: avatarUrl });
        });
    } else {
        res.json({ success: true, avatar: avatarUrl });
    }
});

app.get('/api/players', (req, res) => {
    const excludeUserId = req.query.exclude;
    let query = `SELECT p.*, u.avatar as user_avatar, u.id as user_id, u.discord_tag, u.age, u.country, u.languages, u.play_time, u.has_mic, u.looking_for_team
                 FROM players p LEFT JOIN users u ON p.nickname = u.username GROUP BY p.nickname ORDER BY p.id DESC`;
    if (excludeUserId) {
        query = `SELECT p.*, u.avatar as user_avatar, u.id as user_id, u.discord_tag, u.age, u.country, u.languages, u.play_time, u.has_mic, u.looking_for_team
                 FROM players p LEFT JOIN users u ON p.nickname = u.username WHERE (u.id IS NULL OR u.id != ?) GROUP BY p.nickname ORDER BY p.id DESC`;
        db.all(query, [excludeUserId], (err, rows) => { res.json(rows || []); });
    } else {
        db.all(query, (err, rows) => { res.json(rows || []); });
    }
});

app.get('/api/players/:id', (req, res) => {
    const id = req.params.id;
    db.get(`SELECT p.*, u.avatar as user_avatar, u.id as user_id, u.discord_tag, u.age, u.country, u.languages, u.play_time, u.has_mic, u.looking_for_team, u.created_at 
            FROM players p LEFT JOIN users u ON p.nickname = u.username WHERE p.id = ?`, [id], (err, row) => {
        if (row) return res.json(row);

        db.get(`SELECT p.*, u.avatar as user_avatar, u.id as user_id, u.discord_tag, u.age, u.country, u.languages, u.play_time, u.has_mic, u.looking_for_team, u.created_at 
                FROM users u JOIN players p ON p.nickname = u.username WHERE u.id = ?`, [id], (err2, row2) => {
            if (!row2) return res.status(404).json({ error: "Player not found" });
            res.json(row2);
        });
    });
});


app.get('/api/clans', (req, res) => { db.all("SELECT * FROM clans ORDER BY id DESC", (err, rows) => { res.json(rows || []); }); });

app.get('/api/clans/:id', (req, res) => {
    db.get("SELECT * FROM clans WHERE id = ?", [req.params.id], (err, row) => {
        if (!row) return res.status(404).json({ error: "Clan not found" });
        res.json(row);
    });
});

app.get('/api/clans/:id/members', (req, res) => {
    db.all(`SELECT u.id, u.username, cm.role FROM clan_members cm JOIN users u ON cm.user_id = u.id WHERE cm.clan_id = ?`, [req.params.id], (err, rows) => { res.json(rows || []); });
});

app.post('/api/clans/:id/leave', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    db.run("DELETE FROM clan_members WHERE user_id = ? AND clan_id = ?", [req.session.userId, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: "DB error" });
        db.run("UPDATE clans SET members_count = (SELECT COUNT(*) FROM clan_members WHERE clan_id = ?) WHERE id = ?", [req.params.id, req.params.id]);
        res.json({ success: true });
    });
});

app.put('/api/clans/:id', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const { description, min_rank, region } = req.body;
    db.get("SELECT username FROM users WHERE id = ?", [req.session.userId], (err, user) => {
        if (!user) return res.status(401).json({ error: "User not found" });
        db.get("SELECT * FROM clans WHERE id = ? AND leader = ?", [req.params.id, user.username], (err, clan) => {
            if (!clan) return res.status(403).json({ error: "Only the leader can edit the clan" });
            db.run("UPDATE clans SET description = ?, min_rank = ?, region = ? WHERE id = ?",
                [description || clan.description, min_rank || clan.min_rank, region || clan.region, req.params.id], function(err) {
                if (err) return res.status(500).json({ error: "DB error" });
                res.json({ success: true });
            });
        });
    });
});

app.get('/api/tournaments', (req, res) => { db.all("SELECT * FROM tournaments ORDER BY id DESC", (err, rows) => { res.json(rows || []); }); });

app.get('/api/users', (req, res) => { db.all("SELECT id, username, avatar FROM users ORDER BY id DESC", (err, rows) => { res.json(rows || []); }); });

app.get('/api/me/clans', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const userId = req.session.userId;
    db.all(`SELECT c.*, cm.role as member_role FROM clan_members cm JOIN clans c ON cm.clan_id = c.id WHERE cm.user_id = ?`, [userId], (err, rows) => {
        db.get("SELECT username FROM users WHERE id = ?", [userId], (err2, user) => {
            if (user) {
                db.all("SELECT * FROM clans WHERE leader = ?", [user.username], (err3, leaderClans) => {
                    const allClans = [...(rows || [])];
                    (leaderClans || []).forEach(lc => { if (!allClans.find(c => c.id === lc.id)) { lc.member_role = 'leader'; allClans.push(lc); } });
                    res.json(allClans);
                });
            } else { res.json(rows || []); }
        });
    });
});

app.get('/api/me/tournaments', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    db.all(`SELECT t.*, tp.joined_at as signed_up_at FROM tournament_participants tp JOIN tournaments t ON tp.tournament_id = t.id WHERE tp.user_id = ?`, [req.session.userId], (err, rows) => { res.json(rows || []); });
});

app.post('/api/tournaments/:id/join', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    db.run("INSERT OR IGNORE INTO tournament_participants (user_id, tournament_id) VALUES (?, ?)", [req.session.userId, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: "DB error" });
        res.json({ success: true });
    });
});

app.post('/api/clans/:id/join', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    db.run("INSERT OR IGNORE INTO clan_members (user_id, clan_id) VALUES (?, ?)", [req.session.userId, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: "DB error" });
        db.run("UPDATE clans SET members_count = (SELECT COUNT(*) FROM clan_members WHERE clan_id = ?) WHERE id = ?", [req.params.id, req.params.id]);
        res.json({ success: true });
    });
});


app.post('/api/friends/add', (req, res) => {
    if (!req.session.userId && !req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const fromId = req.session.userId;
    const { to_user_id } = req.body;
    if (!fromId || !to_user_id) return res.status(400).json({ error: "Missing data" });
    if (fromId == to_user_id) return res.status(400).json({ error: "Нельзя добавить себя" });
    db.get("SELECT * FROM friends WHERE (from_user_id=? AND to_user_id=?) OR (from_user_id=? AND to_user_id=?)",
        [fromId, to_user_id, to_user_id, fromId], (err, row) => {
        if (row) {
            if (row.status === 'accepted') return res.json({ success: false, message: "Уже в друзьях" });
            if (row.status === 'pending') return res.json({ success: false, message: "Запрос уже отправлен" });
        }
        db.run("INSERT INTO friends (from_user_id, to_user_id, status) VALUES (?, ?, 'pending')", [fromId, to_user_id], function(err) {
            if (err) return res.status(500).json({ error: "DB error" });
            res.json({ success: true, message: "Запрос отправлен" });
        });
    });
});

app.post('/api/friends/accept', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const { friend_request_id } = req.body;
    db.run("UPDATE friends SET status='accepted' WHERE id=? AND to_user_id=?", [friend_request_id, req.session.userId], function(err) {
        if (err) return res.status(500).json({ error: "DB error" });
        res.json({ success: true });
    });
});

app.post('/api/friends/decline', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const { friend_request_id } = req.body;
    db.run("DELETE FROM friends WHERE id=? AND to_user_id=?", [friend_request_id, req.session.userId], function(err) {
        if (err) return res.status(500).json({ error: "DB error" });
        res.json({ success: true });
    });
});

app.get('/api/friends/list', (req, res) => {
    if (!req.session.userId && !req.isAuthenticated()) return res.status(401).json({ error: "Unauthorized" });
    const userId = req.session.userId;
    db.all(`SELECT f.id as request_id, f.status, f.from_user_id, f.to_user_id, u.id as user_id, u.username, u.avatar 
            FROM friends f JOIN users u ON (CASE WHEN f.from_user_id = ? THEN f.to_user_id ELSE f.from_user_id END) = u.id
            WHERE (f.from_user_id = ? OR f.to_user_id = ?) AND f.status = 'accepted'`,
        [userId, userId, userId], (err, rows) => { res.json(rows || []); });
});

app.get('/api/friends/requests', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    db.all(`SELECT f.id as request_id, u.id as user_id, u.username, u.avatar 
            FROM friends f JOIN users u ON f.from_user_id = u.id WHERE f.to_user_id = ? AND f.status = 'pending'`,
        [req.session.userId], (err, rows) => { res.json(rows || []); });
});

app.get('/api/friends/status/:userId', (req, res) => {
    if (!req.session.userId) return res.status(401).json({ error: "Unauthorized" });
    const myId = req.session.userId;
    const otherId = req.params.userId;
    db.get("SELECT * FROM friends WHERE (from_user_id=? AND to_user_id=?) OR (from_user_id=? AND to_user_id=?)",
        [myId, otherId, otherId, myId], (err, row) => {
        if (!row) return res.json({ status: 'none' });
        res.json({ status: row.status, direction: row.from_user_id == myId ? 'sent' : 'received', request_id: row.id });
    });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));
app.get('/auth', (req, res) => res.sendFile(path.join(__dirname, 'public', 'auth.html')));
app.get('/profile', (req, res) => res.sendFile(path.join(__dirname, 'public', 'profile.html')));
app.get('/browse', (req, res) => res.sendFile(path.join(__dirname, 'public', 'brows.html')));
app.get('/messages', (req, res) => res.sendFile(path.join(__dirname, 'public', 'message.html')));
app.get('/games', (req, res) => res.sendFile(path.join(__dirname, 'public', 'games.html')));
app.get('/clans', (req, res) => res.sendFile(path.join(__dirname, 'public', 'clans.html')));
app.get('/clan_create', (req, res) => res.sendFile(path.join(__dirname, 'public', 'clan_create.html')));
app.get('/clan_info', (req, res) => res.sendFile(path.join(__dirname, 'public', 'clan_info.html')));
app.get('/tournament', (req, res) => res.sendFile(path.join(__dirname, 'public', 'tournament.html')));
app.get('/admin', (req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));


const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin13242145@gmail.com';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'kfNVodw23fJvn';

app.post('/api/admin/login', (req, res) => {
    const { email, password } = req.body;
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        return res.json({ success: true });
    }
    res.status(401).json({ error: 'Неверные данные' });
});

function requireAdmin(req, res, next) {
    if (req.session && req.session.isAdmin) return next();
    res.status(403).json({ error: 'Forbidden' });
}

app.get('/api/admin/full-users', requireAdmin, (req, res) => {
    db.all(`SELECT u.*, p.game, p.rank, p.role FROM users u LEFT JOIN players p ON u.username = p.nickname ORDER BY u.id DESC`, (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        res.json((rows || []).map(u => ({ ...u, status: 'active', ip_address: '127.0.0.1' })));
    });
});

app.get('/api/admin/visit-logs', requireAdmin, (req, res) => {
    db.all("SELECT * FROM visit_logs ORDER BY timestamp DESC LIMIT 200", (err, rows) => { res.json(rows || []); });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
    db.all("SELECT * FROM visit_logs ORDER BY timestamp DESC LIMIT 200", (err, rows) => { res.json({ logs: rows || [] }); });
});

app.delete('/api/admin/users/:id', requireAdmin, (req, res) => {
    const userId = req.params.id;
    // First get the username to delete from players table too
    db.get("SELECT username FROM users WHERE id = ?", [userId], (err, user) => {
        if (err) return res.status(500).json({ error: 'DB error' });
        const username = user ? user.username : null;
        // Delete from all related tables
        db.serialize(() => {
            if (username) {
                db.run("DELETE FROM players WHERE nickname = ?", [username]);
                db.run("DELETE FROM messages WHERE sender = ?", [username]);
            }
            db.run("DELETE FROM friends WHERE from_user_id = ? OR to_user_id = ?", [userId, userId]);
            db.run("DELETE FROM clan_members WHERE user_id = ?", [userId]);
            db.run("DELETE FROM users WHERE id = ?", [userId], function(err2) {
                if (err2) return res.status(500).json({ error: 'DB error' });
                res.json({ success: true, deleted_username: username });
            });
        });
    });
});

app.put('/api/admin/users/:id', requireAdmin, (req, res) => {
    const { username, email, discord_tag, password, age, country, languages, play_time, has_mic, looking_for_team, game, rank, role } = req.body;
    db.get("SELECT username FROM users WHERE id = ?", [req.params.id], (err, oldUser) => {
        const oldUsername = oldUser ? oldUser.username : null;
        let userQuery, userParams;
        if (password && password.trim() !== '') {
            userQuery = 'UPDATE users SET username = ?, email = ?, discord_tag = ?, password = ?, age = ?, country = ?, languages = ?, play_time = ?, has_mic = ?, looking_for_team = ? WHERE id = ?';
            userParams = [username, email, discord_tag, password, age || null, country || '', languages || '', play_time || '', has_mic ? 1 : 0, looking_for_team ? 1 : 0, req.params.id];
        } else {
            userQuery = 'UPDATE users SET username = ?, email = ?, discord_tag = ?, age = ?, country = ?, languages = ?, play_time = ?, has_mic = ?, looking_for_team = ? WHERE id = ?';
            userParams = [username, email, discord_tag, age || null, country || '', languages || '', play_time || '', has_mic ? 1 : 0, looking_for_team ? 1 : 0, req.params.id];
        }
        db.run(userQuery, userParams, function(err) {
            if (err) return res.status(500).json({ error: err.message });
            
            // Если username изменился — удаляем старую запись в players ПЕРЕД вставкой новой
            if (oldUsername && oldUsername !== username) {
                db.run("DELETE FROM players WHERE nickname = ?", [oldUsername], () => {
                    db.run(`INSERT INTO players (nickname, game, rank, role) VALUES (?, ?, ?, ?) 
                            ON CONFLICT(nickname) DO UPDATE SET game=excluded.game, rank=excluded.rank, role=excluded.role`,
                    [username, game || '', rank || '', role || ''], (err2) => {
                        res.json({ success: true });
                    });
                });
            } else {
                db.run(`INSERT INTO players (nickname, game, rank, role) VALUES (?, ?, ?, ?) 
                        ON CONFLICT(nickname) DO UPDATE SET game=excluded.game, rank=excluded.rank, role=excluded.role`,
                [username, game || '', rank || '', role || ''], (err2) => {
                    res.json({ success: true });
                });
            }
        });
    });
});


app.put('/api/admin/clans/:id', requireAdmin, (req, res) => {
    const { name, game, description } = req.body;
    db.run('UPDATE clans SET name = ?, game = ?, description = ? WHERE id = ?', [name, game, description, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

app.put('/api/admin/tournaments/:id', requireAdmin, (req, res) => {
    const { title, game, date, prize_pool, slots, description } = req.body;
    db.run('UPDATE tournaments SET title = ?, game = ?, date = ?, prize_pool = ?, slots = ?, description = ? WHERE id = ?',
        [title, game, date, prize_pool, slots, description, req.params.id], function(err) {
        if (err) return res.status(500).json({ error: err.message });
        res.json({ updated: this.changes });
    });
});

app.delete('/api/admin/clans/:id', requireAdmin, (req, res) => {
    db.run("DELETE FROM clans WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json({ success: true });
    });
});

app.delete('/api/admin/tournaments/:id', requireAdmin, (req, res) => {
    db.run("DELETE FROM tournaments WHERE id = ?", [req.params.id], function(err) {
        if (err) return res.status(500).json({ error: 'DB error' });
        res.json({ success: true });
    });
});

app.get('/api/admin/messages', requireAdmin, (req, res) => {
    db.all("SELECT * FROM messages ORDER BY timestamp DESC LIMIT 100", (err, rows) => { res.json(rows || []); });
});


app.post('/api/login', (req, res) => {
    const { email, password } = req.body;
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
        req.session.isAdmin = true;
        db.get("SELECT * FROM users WHERE email = ?", [email], (err, user) => {
            if (user) {
                req.session.userId = user.id;
                return res.json({ success: true, username: user.username, email: user.email, id: user.id, avatar: user.avatar, isAdmin: true });
            }
            db.run("INSERT OR IGNORE INTO users (username, email, password) VALUES (?, ?, ?)", ['Admin', email, password], function(err2) {
                req.session.userId = this.lastID || 0;
                res.json({ success: true, username: 'Admin', email, id: this.lastID, isAdmin: true });
            });
        });
        return;
    }
    db.get(`SELECT * FROM users WHERE email = ? AND password = ?`, [email, password], (err, user) => {
        if (err || !user) return res.status(401).json({ error: "Неверный email или пароль" });
        req.session.userId = user.id;
        res.json({ success: true, username: user.username, email: user.email, id: user.id, avatar: user.avatar, isAdmin: false });
    });
});

app.post('/api/register', (req, res) => {
    const { username, email, password, discord_tag } = req.body;
    if (!username || !email || !password) return res.status(400).json({ error: "Заполните все поля" });
    db.run(`INSERT INTO users (username, email, password, discord_tag) VALUES (?, ?, ?, ?)`, [username, email, password, discord_tag], function(err) {
        if (err) return res.status(400).json({ error: "Email уже зарегистрирован" });
        const newUserId = this.lastID;
        db.run(`INSERT OR IGNORE INTO players (nickname) VALUES (?)`, [username]);
        req.session.userId = newUserId;
        res.json({ success: true, id: newUserId });
    });
});

app.post('/api/clans', (req, res) => {
    const { name, game, min_rank, region, description, avatar_url } = req.body;
    const userId = req.session.userId;
    db.get("SELECT username FROM users WHERE id = ?", [userId], (err, user) => {
        const leader = user ? user.username : 'anon';
        db.run(`INSERT INTO clans (name, leader, game, min_rank, region, description, avatar_url) VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [name, leader, game, min_rank, region, description, avatar_url || null], function(err) {
            if (err) return res.status(400).json({ error: "Клан с таким именем уже существует" });
            const clanId = this.lastID;
            if (userId) db.run("INSERT OR IGNORE INTO clan_members (user_id, clan_id, role) VALUES (?, ?, 'leader')", [userId, clanId]);
            res.json({ success: true, id: clanId });
        });
    });
});


// ===== SOCKET.IO =====
io.on('connection', (socket) => {
    console.log('User connected:', socket.id);
    socket.on('join_room', (roomId) => {
        socket.join(String(roomId));
        db.all("SELECT * FROM messages WHERE room_id = ? ORDER BY timestamp ASC LIMIT 100", [String(roomId)], (err, rows) => {
            socket.emit('chat_history', rows || []);
        });
    });
    socket.on('send_message', (data) => {
        const { roomId, sender, content, type } = data;
        db.run("INSERT INTO messages (room_id, sender, content, type) VALUES (?, ?, ?, ?)", [String(roomId), sender, content, type || 'text'], function(err) {
            if (!err) {
                const msg = { id: this.lastID, room_id: roomId, sender, content, type: type || 'text', timestamp: new Date().toISOString() };
                io.to(String(roomId)).emit('receive_message', msg);
            }
        });
    });
    socket.on('disconnect', () => { console.log('User disconnected:', socket.id); });
});


server.listen(PORT, '0.0.0.0', () => console.log(`GGLINK running on port ${PORT}`));
