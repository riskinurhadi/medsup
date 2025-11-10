const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Serve static files
app.use(express.static(__dirname));

// Multer configuration for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir);
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 100 * 1024 * 1024 // 100MB limit
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif|mp4|mov|avi/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Hanya file gambar (JPEG, PNG, GIF) atau video (MP4, MOV, AVI) yang diizinkan!'));
        }
    }
});

// Import platform handlers
const facebookHandler = require('./handlers/facebook');
const instagramHandler = require('./handlers/instagram');
const tiktokHandler = require('./handlers/tiktok');

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Auth status
app.get('/api/auth/status', async (req, res) => {
    try {
        const status = {
            facebook: await facebookHandler.isAuthenticated(),
            instagram: await instagramHandler.isAuthenticated(),
            tiktok: await tiktokHandler.isAuthenticated()
        };
        res.json(status);
    } catch (error) {
        console.error('Error checking auth status:', error);
        res.status(500).json({ error: 'Error checking authentication status' });
    }
});

// Facebook auth
app.post('/api/auth/facebook', async (req, res) => {
    try {
        const authUrl = await facebookHandler.getAuthUrl();
        res.json({ authUrl });
    } catch (error) {
        console.error('Facebook auth error:', error);
        res.status(500).json({ error: 'Error initiating Facebook authentication' });
    }
});

// Facebook callback
app.get('/api/auth/facebook/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (code) {
            await facebookHandler.handleCallback(code);
            res.send('<script>window.close();</script>');
        } else {
            res.status(400).send('Authorization failed');
        }
    } catch (error) {
        console.error('Facebook callback error:', error);
        res.status(500).send('Error completing Facebook authentication');
    }
});

// Instagram auth
app.post('/api/auth/instagram', async (req, res) => {
    try {
        const authUrl = await instagramHandler.getAuthUrl();
        res.json({ authUrl });
    } catch (error) {
        console.error('Instagram auth error:', error);
        res.status(500).json({ error: 'Error initiating Instagram authentication' });
    }
});

// Instagram callback
app.get('/api/auth/instagram/callback', async (req, res) => {
    try {
        const { code } = req.query;
        if (code) {
            await instagramHandler.handleCallback(code);
            res.send('<script>window.close();</script>');
        } else {
            res.status(400).send('Authorization failed');
        }
    } catch (error) {
        console.error('Instagram callback error:', error);
        res.status(500).send('Error completing Instagram authentication');
    }
});

// TikTok auth
app.post('/api/auth/tiktok', async (req, res) => {
    try {
        const authUrl = await tiktokHandler.getAuthUrl();
        res.json({ authUrl });
    } catch (error) {
        console.error('TikTok auth error:', error);
        res.status(500).json({ error: 'Error initiating TikTok authentication' });
    }
});

// TikTok callback
app.get('/api/auth/tiktok/callback', async (req, res) => {
    try {
        const { code, state } = req.query;
        if (code) {
            await tiktokHandler.handleCallback(code, state);
            res.send('<script>window.close();</script>');
        } else {
            res.status(400).send('Authorization failed');
        }
    } catch (error) {
        console.error('TikTok callback error:', error);
        res.status(500).send('Error completing TikTok authentication');
    }
});

// Upload endpoint
app.post('/api/upload', upload.single('mediaFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ 
                success: false, 
                message: 'File tidak ditemukan' 
            });
        }

        const { platform, caption } = req.body;
        const filePath = req.file.path;
        const fileType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';

        let result;
        
        switch (platform) {
            case 'facebook':
                result = await facebookHandler.uploadPost(filePath, caption, fileType);
                break;
            case 'instagram':
                result = await instagramHandler.uploadPost(filePath, caption, fileType);
                break;
            case 'tiktok':
                result = await tiktokHandler.uploadPost(filePath, caption, fileType);
                break;
            default:
                return res.status(400).json({ 
                    success: false, 
                    message: 'Platform tidak valid' 
                });
        }

        // Clean up uploaded file
        fs.unlinkSync(filePath);

        res.json(result);
    } catch (error) {
        console.error('Upload error:', error);
        
        // Clean up file on error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            success: false, 
            message: error.message || 'Terjadi kesalahan saat upload' 
        });
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    console.error('Server error:', error);
    res.status(500).json({ 
        success: false, 
        message: error.message || 'Internal server error' 
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server berjalan di http://localhost:${PORT}`);
    console.log('📱 Media Sosial Agent siap digunakan!');
});

