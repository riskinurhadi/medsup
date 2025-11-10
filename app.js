// API Base URL
const API_BASE_URL = 'http://localhost:3000/api';

// State management
let authState = {
    facebook: false,
    instagram: false,
    tiktok: false
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    checkAuthStatus();
    setupEventListeners();
    setupFilePreview();
    setupCharCounter();
});

// Check authentication status
async function checkAuthStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/status`);
        const data = await response.json();
        
        authState = data;
        updateAuthButtons();
    } catch (error) {
        console.error('Error checking auth status:', error);
    }
}

// Setup event listeners
function setupEventListeners() {
    // Auth buttons
    document.getElementById('connectFacebook').addEventListener('click', () => connectPlatform('facebook'));
    document.getElementById('connectInstagram').addEventListener('click', () => connectPlatform('instagram'));
    document.getElementById('connectTikTok').addEventListener('click', () => connectPlatform('tiktok'));

    // Upload form
    document.getElementById('uploadForm').addEventListener('submit', handleUpload);
}

// Connect to platform
async function connectPlatform(platform) {
    try {
        showAuthStatus(`Mengarahkan ke ${platform}...`, 'info');
        
        const response = await fetch(`${API_BASE_URL}/auth/${platform}`, {
            method: 'POST'
        });
        
        const data = await response.json();
        
        if (data.authUrl) {
            // Open OAuth window
            const authWindow = window.open(
                data.authUrl,
                `${platform}Auth`,
                'width=600,height=700'
            );
            
            // Listen for auth completion
            const checkAuth = setInterval(async () => {
                if (authWindow.closed) {
                    clearInterval(checkAuth);
                    await checkAuthStatus();
                }
            }, 1000);
        } else {
            showAuthStatus(`Berhasil terhubung ke ${platform}!`, 'success');
            authState[platform] = true;
            updateAuthButtons();
        }
    } catch (error) {
        console.error(`Error connecting to ${platform}:`, error);
        showAuthStatus(`Error: Gagal terhubung ke ${platform}`, 'error');
    }
}

// Update auth buttons
function updateAuthButtons() {
    const platforms = ['facebook', 'instagram', 'tiktok'];
    
    platforms.forEach(platform => {
        const button = document.getElementById(`connect${platform.charAt(0).toUpperCase() + platform.slice(1)}`);
        if (authState[platform]) {
            button.classList.add('connected');
            button.innerHTML = `<span>✓</span> ${platform.charAt(0).toUpperCase() + platform.slice(1)} Terhubung`;
        } else {
            button.classList.remove('connected');
        }
    });
}

// Show auth status
function showAuthStatus(message, type) {
    const statusDiv = document.getElementById('authStatus');
    statusDiv.textContent = message;
    statusDiv.className = `auth-status ${type}`;
    
    if (type === 'success' || type === 'error') {
        setTimeout(() => {
            statusDiv.textContent = '';
            statusDiv.className = 'auth-status';
        }, 5000);
    }
}

// Setup file preview
function setupFilePreview() {
    const fileInput = document.getElementById('mediaFile');
    const preview = document.getElementById('filePreview');
    
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (file) {
            preview.style.display = 'block';
            
            if (file.type.startsWith('image/')) {
                const img = document.createElement('img');
                img.src = URL.createObjectURL(file);
                preview.innerHTML = '';
                preview.appendChild(img);
            } else if (file.type.startsWith('video/')) {
                const video = document.createElement('video');
                video.src = URL.createObjectURL(file);
                video.controls = true;
                preview.innerHTML = '';
                preview.appendChild(video);
            }
        }
    });
}

// Setup character counter
function setupCharCounter() {
    const caption = document.getElementById('caption');
    const charCount = document.getElementById('charCount');
    
    caption.addEventListener('input', () => {
        const count = caption.value.length;
        charCount.textContent = count;
        
        // Instagram limit: 2200, Facebook: 5000, TikTok: 150
        if (count > 150) {
            charCount.style.color = '#dc3545';
        } else {
            charCount.style.color = '#666';
        }
    });
}

// Handle upload
async function handleUpload(e) {
    e.preventDefault();
    
    const formData = new FormData(e.target);
    const platforms = Array.from(document.querySelectorAll('input[name="platforms"]:checked'))
        .map(cb => cb.value);
    
    if (platforms.length === 0) {
        alert('Pilih minimal satu platform!');
        return;
    }
    
    // Check if platforms are connected
    const disconnectedPlatforms = platforms.filter(p => !authState[p]);
    if (disconnectedPlatforms.length > 0) {
        alert(`Harap hubungkan terlebih dahulu: ${disconnectedPlatforms.join(', ')}`);
        return;
    }
    
    // Disable upload button
    const uploadBtn = document.getElementById('uploadBtn');
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = '<span class="loading-spinner"></span> Mengupload...';
    
    // Show progress section
    const progressSection = document.getElementById('uploadProgress');
    const progressList = document.getElementById('progressList');
    progressSection.style.display = 'block';
    progressList.innerHTML = '';
    
    // Add progress items
    platforms.forEach(platform => {
        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';
        progressItem.id = `progress-${platform}`;
        progressItem.innerHTML = `
            <span><strong>${platform.charAt(0).toUpperCase() + platform.slice(1)}:</strong> Mengupload...</span>
            <span class="loading-spinner"></span>
        `;
        progressList.appendChild(progressItem);
    });
    
    // Upload to each platform
    const results = [];
    
    for (const platform of platforms) {
        try {
            const platformFormData = new FormData();
            platformFormData.append('mediaFile', formData.get('mediaFile'));
            platformFormData.append('caption', formData.get('caption'));
            platformFormData.append('platform', platform);
            
            const response = await fetch(`${API_BASE_URL}/upload`, {
                method: 'POST',
                body: platformFormData
            });
            
            const result = await response.json();
            
            // Update progress
            const progressItem = document.getElementById(`progress-${platform}`);
            if (result.success) {
                progressItem.innerHTML = `
                    <span><strong>${platform.charAt(0).toUpperCase() + platform.slice(1)}:</strong> Berhasil!</span>
                    <span style="color: #4caf50;">✓</span>
                `;
            } else {
                progressItem.innerHTML = `
                    <span><strong>${platform.charAt(0).toUpperCase() + platform.slice(1)}:</strong> Gagal</span>
                    <span style="color: #dc3545;">✗</span>
                `;
            }
            
            results.push({
                platform,
                success: result.success,
                message: result.message,
                postId: result.postId,
                url: result.url
            });
        } catch (error) {
            console.error(`Error uploading to ${platform}:`, error);
            const progressItem = document.getElementById(`progress-${platform}`);
            progressItem.innerHTML = `
                <span><strong>${platform.charAt(0).toUpperCase() + platform.slice(1)}:</strong> Error</span>
                <span style="color: #dc3545;">✗</span>
            `;
            
            results.push({
                platform,
                success: false,
                message: error.message || 'Terjadi kesalahan'
            });
        }
    }
    
    // Show results
    showResults(results);
    
    // Re-enable upload button
    uploadBtn.disabled = false;
    uploadBtn.innerHTML = '<span>🚀</span> Upload ke Semua Platform';
}

// Show results
function showResults(results) {
    const resultsSection = document.getElementById('uploadResults');
    const resultsList = document.getElementById('resultsList');
    resultsSection.style.display = 'block';
    resultsList.innerHTML = '';
    
    results.forEach(result => {
        const resultItem = document.createElement('div');
        resultItem.className = `result-item ${result.success ? 'success' : 'error'}`;
        
        let content = `
            <div>
                <span class="platform-name">${result.platform.charAt(0).toUpperCase() + result.platform.slice(1)}:</span>
                <span>${result.message}</span>
            </div>
        `;
        
        if (result.success && result.url) {
            content += `<a href="${result.url}" target="_blank" class="result-link">Lihat Postingan</a>`;
        }
        
        resultItem.innerHTML = content;
        resultsList.appendChild(resultItem);
    });
    
    // Scroll to results
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

