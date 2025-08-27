document.addEventListener('DOMContentLoaded', function() {
    const videoUrlInput = document.getElementById('videoUrl');
    const downloadBtn = document.getElementById('downloadBtn');
    const downloadText = document.getElementById('downloadText');
    const loadingSpinner = document.getElementById('loadingSpinner');
    const status = document.getElementById('status');
    const videoContainer = document.getElementById('videoContainer');
    const clearAllBtn = document.getElementById('clearAllBtn');

    // Load saved videos when popup opens
    loadSavedVideos();
    
    // Check if there's an ongoing extraction
    checkOngoingExtraction();

    downloadBtn.addEventListener('click', async function() {
        const url = videoUrlInput.value.trim();
        if (!url) {
            showStatus('Vui lòng nhập link video!', 'error');
            return;
        }

        if (!url.includes('facebook.com')) {
            showStatus('Vui lòng nhập link Facebook hợp lệ!', 'error');
            return;
        }

        setLoading(true);
        showStatus('🔍 Khởi tạo tìm kiếm video...', 'loading');

        try {
            // Send extraction request to background script
            const result = await chrome.runtime.sendMessage({
                action: 'startVideoExtraction',
                url: url
            });
            
            if (result && result.success) {
                showStatus('🔄 Đang tìm video vui lòng không đóng popup này.', 'loading');
                
                // Check extraction status periodically
                const checkInterval = setInterval(async () => {
                    try {
                        const status = await chrome.runtime.sendMessage({
                            action: 'checkExtractionStatus'
                        });
                        
                        if (status && status.completed) {
                            clearInterval(checkInterval);
                            
                            if (status.success && status.videoUrl) {
                                await saveVideo(status.videoUrl, url);
                                showStatus('✅ Tìm thấy video thành công!', 'success');
                                loadSavedVideos();
                                videoUrlInput.value = '';
                            } else {
                                showStatus('❌ ' + (status.error || 'Không tìm thấy video.'), 'error');
                            }
                            setLoading(false);
                        }
                    } catch (error) {
                        clearInterval(checkInterval);
                        console.error('Error checking status:', error);
                        setLoading(false);
                    }
                }, 2000); // Check every 2 seconds
                
                // Timeout after 30 seconds
                setTimeout(() => {
                    clearInterval(checkInterval);
                    if (document.getElementById('downloadBtn').disabled) {
                        showStatus('❌ Timeout - quá trình tìm video mất quá lâu', 'error');
                        setLoading(false);
                    }
                }, 30000);
                
            } else {
                showStatus('❌ Lỗi khởi tạo: ' + (result?.error || 'Không thể bắt đầu tìm video'), 'error');
                setLoading(false);
            }
            
        } catch (error) {
            console.error('Popup: Error starting extraction:', error);
            showStatus('❌ Lỗi: ' + error.message, 'error');
            setLoading(false);
        }
    });

    clearAllBtn.addEventListener('click', async function() {
        if (confirm('Bạn có chắc muốn xóa tất cả video đã lưu?')) {
            await chrome.storage.local.clear();
            videoContainer.innerHTML = '';
            clearAllBtn.classList.add('hidden');
            showStatus('Đã xóa tất cả video!', 'success');
        }
    });

    // Function to check ongoing extraction
    async function checkOngoingExtraction() {
        try {
            const status = await chrome.runtime.sendMessage({
                action: 'checkExtractionStatus'
            });
            
            if (status && !status.completed) {
                // There's an ongoing extraction
                setLoading(true);
                showStatus('🔄 Có quá trình tìm video đang chạy...', 'loading');
                
                // Start checking status
                const checkInterval = setInterval(async () => {
                    try {
                        const newStatus = await chrome.runtime.sendMessage({
                            action: 'checkExtractionStatus'
                        });
                        
                        if (newStatus && newStatus.completed) {
                            clearInterval(checkInterval);
                            
                            if (newStatus.success && newStatus.videoUrl) {
                                // Note: We don't have originalUrl here, so we'll save with the video URL
                                await saveVideo(newStatus.videoUrl, newStatus.videoUrl);
                                showStatus('✅ Tìm thấy video thành công!', 'success');
                                loadSavedVideos();
                            } else {
                                showStatus('❌ ' + (newStatus.error || 'Không tìm thấy video.'), 'error');
                            }
                            setLoading(false);
                        }
                    } catch (error) {
                        clearInterval(checkInterval);
                        console.error('Error checking ongoing extraction:', error);
                        setLoading(false);
                    }
                }, 2000);
            } else {
                // No ongoing extraction - ensure UI is reset
                setLoading(false);
            }
        } catch (error) {
            console.error('Error checking ongoing extraction:', error);
            // If there's an error checking status, reset UI to allow user input
            setLoading(false);
        }
    }

    function convertToMobileUrl(url) {
        // Convert Facebook URL to mobile version
        return url.replace(/^https?:\/\/(www\.)?facebook\.com/, 'https://m.facebook.com');
    }

    function setLoading(isLoading) {
        if (isLoading) {
            downloadBtn.disabled = true;
            downloadText.textContent = 'Đang tìm...';
            loadingSpinner.classList.remove('hidden');
        } else {
            downloadBtn.disabled = false;
            downloadText.textContent = '🔍 Tìm Video';
            loadingSpinner.classList.add('hidden');
        }
    }

    function showStatus(message, type) {
        status.textContent = message;
        status.className = `status ${type}`;
        status.classList.remove('hidden');
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                status.classList.add('hidden');
            }, 3000);
        }
    }

    async function saveVideo(videoUrl, originalUrl) {
        const videoData = {
            url: videoUrl,
            originalUrl: originalUrl,
            timestamp: Date.now(),
            id: Date.now().toString()
        };

        const result = await chrome.storage.local.get(['videos']);
        const videos = result.videos || [];
        
        // Check if video already exists
        const existingIndex = videos.findIndex(v => v.url === videoUrl);
        if (existingIndex !== -1) {
            videos[existingIndex] = videoData;
        } else {
            videos.unshift(videoData);
        }
        
        // Keep only last 10 videos
        if (videos.length > 10) {
            videos.splice(10);
        }

        await chrome.storage.local.set({videos: videos});
    }

    async function loadSavedVideos() {
        const result = await chrome.storage.local.get(['videos']);
        const videos = result.videos || [];
        
        videoContainer.innerHTML = '';
        
        if (videos.length === 0) {
            clearAllBtn.classList.add('hidden');
            return;
        }

        clearAllBtn.classList.remove('hidden');
        
        videos.forEach((video, index) => {
            const videoItem = createVideoItem(video, index);
            videoContainer.appendChild(videoItem);
        });
    }

    function createVideoItem(video, index) {
        const item = document.createElement('div');
        item.className = 'video-item';
        
        item.innerHTML = `
            <video class="video-preview" controls preload="metadata">
                <source src="${video.url}" type="video/mp4">
                Video không thể phát
            </video>
            <div class="video-actions">
                <button class="button download-btn" data-url="${video.url}" data-index="${index}">
                    ⬇️ Tải về
                </button>
                <button class="button danger delete-btn" data-index="${index}">
                    🗑️ Xóa
                </button>
            </div>
        `;
        
        // Add event listeners after creating the element
        const downloadBtn = item.querySelector('.download-btn');
        const deleteBtn = item.querySelector('.delete-btn');
        
        downloadBtn.addEventListener('click', function() {
            console.log('Download button clicked for:', video.url);
            window.downloadVideo(video.url, index);
        });
        
        deleteBtn.addEventListener('click', function() {
            console.log('Delete button clicked for index:', index);
            window.deleteVideo(index);
        });
        
        return item;
    }

    // Global functions for video actions
    window.downloadVideo = async function(url, index) {
        console.log('downloadVideo called with:', url, index);
        
        try {
            console.log('Starting video download...');
            showStatus('🔄 Đang chuẩn bị tải video...', 'loading');
            
            // Method 1: Use Chrome Downloads API (recommended for extensions)
            try {
                console.log('Attempting Chrome Downloads API...');
                
                if (chrome.downloads && chrome.downloads.download) {
                    console.log('Downloads API is available');
                    
                    const downloadOptions = {
                        url: url,
                        filename: `facebook_video_${Date.now()}.mp4`,
                        saveAs: true,
                        conflictAction: 'uniquify'
                    };
                    
                    console.log('Download options:', downloadOptions);
                    
                    const downloadId = await chrome.downloads.download(downloadOptions);
                    
                    console.log('Download started with ID:', downloadId);
                    showStatus('✅ Đang tải video... Kiểm tra thư mục Downloads', 'success');
                    return;
                } else {
                    console.log('Downloads API not available');
                    throw new Error('Downloads API not available');
                }
                
            } catch (downloadError) {
                console.log('Chrome Downloads API failed:', downloadError);
                showStatus('⚠️ Downloads API failed, trying alternative...', 'loading');
            }
            
            // Method 2: Use background script to download
            try {
                console.log('Trying background script download...');
                const result = await chrome.runtime.sendMessage({
                    action: 'downloadVideo',
                    url: url,
                    filename: `facebook_video_${Date.now()}.mp4`
                });
                
                if (result && result.success) {
                    console.log('Background download initiated');
                    showStatus('✅ Đang tải video qua background...', 'success');
                    return;
                } else {
                    throw new Error('Background download failed: ' + (result?.error || 'Unknown error'));
                }
            } catch (bgError) {
                console.log('Background download failed:', bgError);
            }
            
            // Method 3: Traditional download link (fallback)
            console.log('Trying traditional download method...');
            const link = document.createElement('a');
            link.href = url;
            link.download = `facebook_video_${Date.now()}.mp4`;
            link.target = '_blank';
            
            // Add referrer policy and other attributes
            link.setAttribute('referrerpolicy', 'no-referrer');
            link.setAttribute('crossorigin', 'anonymous');
            link.style.display = 'none';
            
            console.log('Creating download link:', link);
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            console.log('Download link clicked');
            showStatus('✅ Link tải đã kích hoạt...', 'success');
            
            
            
        } catch (error) {
            console.error('Download error:', error);
            showStatus('❌ Lỗi tải video. Mở link trực tiếp...', 'error');
            
            // Final fallback: open in new tab
            console.log('Opening video in new tab due to error');
            window.open(url, '_blank');
        }
    };

    window.deleteVideo = async function(index) {
        const result = await chrome.storage.local.get(['videos']);
        const videos = result.videos || [];
        
        if (index >= 0 && index < videos.length) {
            videos.splice(index, 1);
            await chrome.storage.local.set({videos: videos});
            loadSavedVideos();
            showStatus('Đã xóa video!', 'success');
        }
    };
});
