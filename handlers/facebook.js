const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

class FacebookHandler {
    constructor() {
        this.accessToken = process.env.FACEBOOK_ACCESS_TOKEN || null;
        this.appId = process.env.FACEBOOK_APP_ID;
        this.appSecret = process.env.FACEBOOK_APP_SECRET;
        this.redirectUri = process.env.FACEBOOK_REDIRECT_URI || 'http://localhost:3000/api/auth/facebook/callback';
        this.pageId = process.env.FACEBOOK_PAGE_ID;
    }

    async isAuthenticated() {
        if (!this.accessToken) {
            // Try to load from file
            try {
                const tokenData = fs.readFileSync('.facebook_token', 'utf8');
                this.accessToken = tokenData.trim();
            } catch (error) {
                return false;
            }
        }
        
        // Verify token is still valid
        try {
            const response = await axios.get(`https://graph.facebook.com/v18.0/me`, {
                params: {
                    access_token: this.accessToken
                }
            });
            return response.data.id ? true : false;
        } catch (error) {
            return false;
        }
    }

    async getAuthUrl() {
        const scopes = ['pages_manage_posts', 'pages_read_engagement', 'pages_show_list'];
        const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
            `client_id=${this.appId}` +
            `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
            `&scope=${scopes.join(',')}` +
            `&response_type=code`;
        
        return authUrl;
    }

    async handleCallback(code) {
        try {
            // Exchange code for access token
            const tokenResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
                params: {
                    client_id: this.appId,
                    client_secret: this.appSecret,
                    redirect_uri: this.redirectUri,
                    code: code
                }
            });

            this.accessToken = tokenResponse.data.access_token;
            
            // Get page access token
            const pagesResponse = await axios.get(`https://graph.facebook.com/v18.0/me/accounts`, {
                params: {
                    access_token: this.accessToken
                }
            });

            if (pagesResponse.data.data && pagesResponse.data.data.length > 0) {
                const page = this.pageId ? 
                    pagesResponse.data.data.find(p => p.id === this.pageId) :
                    pagesResponse.data.data[0];
                
                this.accessToken = page.access_token;
            }

            // Save token
            fs.writeFileSync('.facebook_token', this.accessToken);
            
            return { success: true };
        } catch (error) {
            console.error('Facebook callback error:', error.response?.data || error.message);
            throw new Error('Failed to complete Facebook authentication');
        }
    }

    async uploadPost(filePath, caption, fileType) {
        try {
            if (!this.accessToken) {
                const tokenData = fs.readFileSync('.facebook_token', 'utf8');
                this.accessToken = tokenData.trim();
            }

            if (fileType === 'image') {
                // Upload photo to Facebook Page
                const formData = new FormData();
                formData.append('source', fs.createReadStream(filePath));
                formData.append('message', caption);
                formData.append('access_token', this.accessToken);

                const response = await axios.post(
                    `https://graph.facebook.com/v18.0/${this.pageId}/photos`,
                    formData,
                    {
                        headers: formData.getHeaders()
                    }
                );

                return {
                    success: true,
                    message: 'Foto berhasil diupload ke Facebook',
                    postId: response.data.id,
                    url: `https://www.facebook.com/${response.data.id}`
                };
            } else {
                // Upload video to Facebook Page
                // Step 1: Initialize upload
                const initResponse = await axios.post(
                    `https://graph.facebook.com/v18.0/${this.pageId}/videos`,
                    {
                        upload_phase: 'start',
                        file_size: fs.statSync(filePath).size,
                        access_token: this.accessToken
                    }
                );

                const uploadSessionId = initResponse.data.upload_session_id;
                const videoId = initResponse.data.video_id;

                // Step 2: Upload video chunks (simplified - in production, use proper chunking)
                const videoData = fs.readFileSync(filePath);
                await axios.post(
                    `https://graph-video.facebook.com/v18.0/${this.pageId}/videos`,
                    videoData,
                    {
                        params: {
                            upload_phase: 'transfer',
                            upload_session_id: uploadSessionId,
                            access_token: this.accessToken
                        },
                        headers: {
                            'Content-Type': 'application/octet-stream'
                        },
                        maxContentLength: Infinity,
                        maxBodyLength: Infinity
                    }
                );

                // Step 3: Finish upload
                await axios.post(
                    `https://graph.facebook.com/v18.0/${this.pageId}/videos`,
                    {
                        upload_phase: 'finish',
                        upload_session_id: uploadSessionId,
                        description: caption,
                        access_token: this.accessToken
                    }
                );

                return {
                    success: true,
                    message: 'Video berhasil diupload ke Facebook',
                    postId: videoId,
                    url: `https://www.facebook.com/${videoId}`
                };
            }
        } catch (error) {
            console.error('Facebook upload error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.error?.message || 'Gagal upload ke Facebook'
            };
        }
    }
}

module.exports = new FacebookHandler();

