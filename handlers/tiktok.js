const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

class TikTokHandler {
    constructor() {
        this.accessToken = process.env.TIKTOK_ACCESS_TOKEN || null;
        this.clientKey = process.env.TIKTOK_CLIENT_KEY;
        this.clientSecret = process.env.TIKTOK_CLIENT_SECRET;
        this.redirectUri = process.env.TIKTOK_REDIRECT_URI || 'http://localhost:3000/api/auth/tiktok/callback';
    }

    async isAuthenticated() {
        if (!this.accessToken) {
            try {
                const tokenData = fs.readFileSync('.tiktok_token', 'utf8');
                this.accessToken = tokenData.trim();
            } catch (error) {
                return false;
            }
        }
        
        try {
            // Verify token with TikTok API
            const response = await axios.get('https://open.tiktokapis.com/v2/user/info/', {
                headers: {
                    'Authorization': `Bearer ${this.accessToken}`
                },
                params: {
                    fields: 'open_id,union_id,avatar_url,display_name'
                }
            });
            return response.data.data ? true : false;
        } catch (error) {
            return false;
        }
    }

    async getAuthUrl() {
        const scopes = ['video.upload', 'user.info.basic'];
        const state = Math.random().toString(36).substring(7);
        
        // Store state for verification
        fs.writeFileSync('.tiktok_state', state);
        
        const authUrl = `https://www.tiktok.com/v2/auth/authorize/` +
            `?client_key=${this.clientKey}` +
            `&scope=${scopes.join(',')}` +
            `&response_type=code` +
            `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
            `&state=${state}`;
        
        return authUrl;
    }

    async handleCallback(code, state) {
        try {
            // Verify state
            const storedState = fs.readFileSync('.tiktok_state', 'utf8').trim();
            if (state !== storedState) {
                throw new Error('Invalid state parameter');
            }

            // Exchange code for access token
            const tokenResponse = await axios.post('https://open.tiktokapis.com/v2/oauth/token/', {
                client_key: this.clientKey,
                client_secret: this.clientSecret,
                code: code,
                grant_type: 'authorization_code',
                redirect_uri: this.redirectUri
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });

            this.accessToken = tokenResponse.data.data.access_token;
            
            // Save token
            fs.writeFileSync('.tiktok_token', this.accessToken);
            
            return { success: true };
        } catch (error) {
            console.error('TikTok callback error:', error.response?.data || error.message);
            throw new Error('Failed to complete TikTok authentication');
        }
    }

    async uploadPost(filePath, caption, fileType) {
        try {
            if (!this.accessToken) {
                const tokenData = fs.readFileSync('.tiktok_token', 'utf8');
                this.accessToken = tokenData.trim();
            }

            if (fileType !== 'video') {
                return {
                    success: false,
                    message: 'TikTok hanya mendukung upload video'
                };
            }

            // TikTok video upload process
            // Step 1: Initialize upload
            const initResponse = await axios.post(
                'https://open.tiktokapis.com/v2/post/publish/video/init/',
                {
                    post_info: {
                        title: caption.substring(0, 150), // TikTok has 150 char limit
                        privacy_level: 'PUBLIC_TO_EVERYONE',
                        disable_duet: false,
                        disable_comment: false,
                        disable_stitch: false,
                        video_cover_timestamp_ms: 1000
                    },
                    source_info: {
                        source: 'FILE_UPLOAD',
                        video_size: fs.statSync(filePath).size,
                        chunk_size: 10000000, // 10MB chunks
                        total_chunk_count: Math.ceil(fs.statSync(filePath).size / 10000000)
                    }
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            const publishId = initResponse.data.data.publish_id;
            const uploadUrl = initResponse.data.data.upload_url;

            // Step 2: Upload video in chunks
            const videoData = fs.readFileSync(filePath);
            const chunkSize = 10000000; // 10MB
            const totalChunks = Math.ceil(videoData.length / chunkSize);

            for (let i = 0; i < totalChunks; i++) {
                const start = i * chunkSize;
                const end = Math.min(start + chunkSize, videoData.length);
                const chunk = videoData.slice(start, end);

                await axios.put(uploadUrl, chunk, {
                    headers: {
                        'Content-Type': 'video/mp4',
                        'Content-Range': `bytes ${start}-${end - 1}/${videoData.length}`
                    },
                    maxContentLength: Infinity,
                    maxBodyLength: Infinity
                });
            }

            // Step 3: Publish the video
            const publishResponse = await axios.post(
                'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
                {
                    publish_id: publishId
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.accessToken}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            // Check publish status
            let status = publishResponse.data.data.status;
            let attempts = 0;
            while (status === 'PROCESSING' && attempts < 30) {
                await new Promise(resolve => setTimeout(resolve, 3000));
                const statusResponse = await axios.post(
                    'https://open.tiktokapis.com/v2/post/publish/status/fetch/',
                    {
                        publish_id: publishId
                    },
                    {
                        headers: {
                            'Authorization': `Bearer ${this.accessToken}`,
                            'Content-Type': 'application/json'
                        }
                    }
                );
                status = statusResponse.data.data.status;
                attempts++;
            }

            if (status === 'PUBLISHED') {
                return {
                    success: true,
                    message: 'Video berhasil diupload ke TikTok',
                    postId: publishId,
                    url: `https://www.tiktok.com/@yourusername/video/${publishId}`
                };
            } else {
                return {
                    success: false,
                    message: `Status upload: ${status}`
                };
            }
        } catch (error) {
            console.error('TikTok upload error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.error?.message || 'Gagal upload ke TikTok'
            };
        }
    }
}

module.exports = new TikTokHandler();

