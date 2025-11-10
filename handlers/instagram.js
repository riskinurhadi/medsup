const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');
const path = require('path');

class InstagramHandler {
    constructor() {
        this.accessToken = process.env.INSTAGRAM_ACCESS_TOKEN || null;
        this.appId = process.env.INSTAGRAM_APP_ID;
        this.appSecret = process.env.INSTAGRAM_APP_SECRET;
        this.redirectUri = process.env.INSTAGRAM_REDIRECT_URI || 'http://localhost:3000/api/auth/instagram/callback';
        this.instagramAccountId = process.env.INSTAGRAM_ACCOUNT_ID;
    }

    async isAuthenticated() {
        if (!this.accessToken) {
            try {
                const tokenData = fs.readFileSync('.instagram_token', 'utf8');
                this.accessToken = tokenData.trim();
            } catch (error) {
                return false;
            }
        }
        
        try {
            const response = await axios.get(`https://graph.instagram.com/me`, {
                params: {
                    fields: 'id,username',
                    access_token: this.accessToken
                }
            });
            return response.data.id ? true : false;
        } catch (error) {
            return false;
        }
    }

    async getAuthUrl() {
        const scopes = ['instagram_basic', 'instagram_content_publish', 'pages_show_list'];
        const authUrl = `https://api.facebook.com/v18.0/dialog/oauth?` +
            `client_id=${this.appId}` +
            `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
            `&scope=${scopes.join(',')}` +
            `&response_type=code`;
        
        return authUrl;
    }

    async handleCallback(code) {
        try {
            // Exchange code for access token
            const tokenResponse = await axios.get('https://api.facebook.com/v18.0/oauth/access_token', {
                params: {
                    client_id: this.appId,
                    client_secret: this.appSecret,
                    redirect_uri: this.redirectUri,
                    code: code
                }
            });

            const shortLivedToken = tokenResponse.data.access_token;
            
            // Exchange short-lived token for long-lived token
            const longLivedResponse = await axios.get('https://graph.facebook.com/v18.0/oauth/access_token', {
                params: {
                    grant_type: 'fb_exchange_token',
                    client_id: this.appId,
                    client_secret: this.appSecret,
                    fb_exchange_token: shortLivedToken
                }
            });

            this.accessToken = longLivedResponse.data.access_token;

            // Get Instagram Business Account ID
            const accountsResponse = await axios.get(`https://graph.facebook.com/v18.0/me/accounts`, {
                params: {
                    access_token: this.accessToken
                }
            });

            if (accountsResponse.data.data && accountsResponse.data.data.length > 0) {
                const page = accountsResponse.data.data[0];
                const instagramResponse = await axios.get(
                    `https://graph.facebook.com/v18.0/${page.id}`,
                    {
                        params: {
                            fields: 'instagram_business_account',
                            access_token: this.accessToken
                        }
                    }
                );

                if (instagramResponse.data.instagram_business_account) {
                    this.instagramAccountId = instagramResponse.data.instagram_business_account.id;
                }
            }

            // Save token
            fs.writeFileSync('.instagram_token', this.accessToken);
            if (this.instagramAccountId) {
                fs.writeFileSync('.instagram_account_id', this.instagramAccountId);
            }
            
            return { success: true };
        } catch (error) {
            console.error('Instagram callback error:', error.response?.data || error.message);
            throw new Error('Failed to complete Instagram authentication');
        }
    }

    async uploadPost(filePath, caption, fileType) {
        try {
            if (!this.accessToken) {
                const tokenData = fs.readFileSync('.instagram_token', 'utf8');
                this.accessToken = tokenData.trim();
            }

            if (!this.instagramAccountId) {
                try {
                    this.instagramAccountId = fs.readFileSync('.instagram_account_id', 'utf8').trim();
                } catch (error) {
                    return {
                        success: false,
                        message: 'Instagram Account ID tidak ditemukan. Harap hubungkan ulang akun Instagram.'
                    };
                }
            }

            if (fileType === 'image') {
                // Step 1: Create media container
                const formData = new FormData();
                formData.append('image_url', `http://localhost:3000/uploads/${path.basename(filePath)}`);
                formData.append('caption', caption);
                formData.append('access_token', this.accessToken);

                // For local development, we need to upload to a publicly accessible URL first
                // In production, upload to cloud storage (S3, Cloudinary, etc.)
                const containerResponse = await axios.post(
                    `https://graph.facebook.com/v18.0/${this.instagramAccountId}/media`,
                    formData,
                    {
                        headers: formData.getHeaders()
                    }
                );

                const creationId = containerResponse.data.id;

                // Step 2: Publish the media
                await new Promise(resolve => setTimeout(resolve, 3000)); // Wait for processing

                const publishResponse = await axios.post(
                    `https://graph.facebook.com/v18.0/${this.instagramAccountId}/media_publish`,
                    {
                        creation_id: creationId,
                        access_token: this.accessToken
                    }
                );

                return {
                    success: true,
                    message: 'Foto berhasil diupload ke Instagram',
                    postId: publishResponse.data.id,
                    url: `https://www.instagram.com/p/${publishResponse.data.id}/`
                };
            } else {
                // Video upload for Instagram
                // Step 1: Create media container
                const containerResponse = await axios.post(
                    `https://graph.facebook.com/v18.0/${this.instagramAccountId}/media`,
                    {
                        media_type: 'REELS', // or 'VIDEO' for regular posts
                        video_url: `http://localhost:3000/uploads/${path.basename(filePath)}`,
                        caption: caption,
                        access_token: this.accessToken
                    }
                );

                const creationId = containerResponse.data.id;

                // Step 2: Check status and publish
                let status = 'IN_PROGRESS';
                let attempts = 0;
                while (status === 'IN_PROGRESS' && attempts < 30) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    const statusResponse = await axios.get(
                        `https://graph.facebook.com/v18.0/${creationId}`,
                        {
                            params: {
                                fields: 'status_code',
                                access_token: this.accessToken
                            }
                        }
                    );
                    status = statusResponse.data.status_code;
                    attempts++;
                }

                if (status === 'FINISHED') {
                    const publishResponse = await axios.post(
                        `https://graph.facebook.com/v18.0/${this.instagramAccountId}/media_publish`,
                        {
                            creation_id: creationId,
                            access_token: this.accessToken
                        }
                    );

                    return {
                        success: true,
                        message: 'Video berhasil diupload ke Instagram',
                        postId: publishResponse.data.id,
                        url: `https://www.instagram.com/p/${publishResponse.data.id}/`
                    };
                } else {
                    return {
                        success: false,
                        message: 'Gagal memproses video Instagram'
                    };
                }
            }
        } catch (error) {
            console.error('Instagram upload error:', error.response?.data || error.message);
            return {
                success: false,
                message: error.response?.data?.error?.message || 'Gagal upload ke Instagram'
            };
        }
    }
}

module.exports = new InstagramHandler();

