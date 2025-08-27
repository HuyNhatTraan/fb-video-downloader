// Content script for Facebook Video Downloader

let foundVideoUrls = [];
let isExtracting = false;

// Auto-inject network monitor when page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', injectNetworkMonitor);
} else {
    injectNetworkMonitor();
}

// Listen for messages from popup and background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extractVideo') {
        extractVideoFromPage(request.originalUrl)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({success: false, error: error.message}));
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'videoFound') {
        // Store found video URL
        if (!foundVideoUrls.includes(request.videoUrl)) {
            foundVideoUrls.push(request.videoUrl);
            
            // Notify background script immediately
            chrome.runtime.sendMessage({
                action: 'videoFoundFromContent',
                videoUrl: request.videoUrl,
                tabId: request.tabId
            }).catch(() => {});
        }
    }
});

// Inject script to monitor network requests immediately
function injectNetworkMonitor() {
    const script = document.createElement('script');
    script.src = chrome.runtime.getURL('injected.js');
    script.onload = function() {
        this.remove();
    };
    (document.head || document.documentElement).appendChild(script);
    
    // Also start looking for existing videos
    setTimeout(findExistingVideos, 1000);
}

// Find existing videos on page
function findExistingVideos() {
    findVideoElements().then(videoUrl => {
        if (videoUrl && !foundVideoUrls.includes(videoUrl)) {
            foundVideoUrls.push(videoUrl);
            
            // Notify background script
            chrome.runtime.sendMessage({
                action: 'videoFoundFromContent',
                videoUrl: videoUrl
            }).catch(() => {});
        }
    });
}

// Extract video from current page
async function extractVideoFromPage(originalUrl) {
    return new Promise((resolve, reject) => {
        isExtracting = true;
        foundVideoUrls = []; // Reset found URLs
        
        // Method 1: Check if we already found videos
        if (foundVideoUrls.length > 0) {
            resolve({success: true, videoUrl: foundVideoUrls[0]});
            isExtracting = false;
            return;
        }
        
        // Method 2: Look for videos in page content immediately
        findVideoInPageContent().then(videoUrl => {
            if (videoUrl) {
                resolve({success: true, videoUrl: videoUrl});
                isExtracting = false;
                return;
            }
            
            // Method 3: Inject network monitoring script
            injectNetworkMonitor();
            
            // Method 4: Wait for videos to be detected
            const timeout = setTimeout(() => {
                if (foundVideoUrls.length === 0) {
                    // Try alternative methods
                    findVideoElements()
                        .then(videoUrl => {
                            if (videoUrl) {
                                resolve({success: true, videoUrl: videoUrl});
                            } else {
                                reject(new Error('Không tìm thấy video trên trang này'));
                            }
                        })
                        .catch(() => {
                            reject(new Error('Không tìm thấy video trên trang này'));
                        });
                } else {
                    // Use the first found video URL
                    const videoUrl = foundVideoUrls[0];
                    resolve({success: true, videoUrl: videoUrl});
                }
                isExtracting = false;
            }, 8000); // Increase timeout

            // Listen for video URLs from injected script
            window.addEventListener('videoFound', (event) => {
                const videoUrl = event.detail.url;
                if (videoUrl && !foundVideoUrls.includes(videoUrl)) {
                    foundVideoUrls.push(videoUrl);
                    
                    // Notify background script
                    chrome.runtime.sendMessage({
                        action: 'videoFoundFromContent',
                        videoUrl: videoUrl
                    }).catch(() => {});
                    
                    if (isExtracting) {
                        clearTimeout(timeout);
                        resolve({success: true, videoUrl: videoUrl});
                        isExtracting = false;
                    }
                }
            });
        });
    });
}

// Find video in page content using regex
async function findVideoInPageContent() {
    return new Promise((resolve) => {
        try {
            const pageContent = document.documentElement.innerHTML;
            
            // Multiple regex patterns to find video URLs
            const videoPatterns = [
                /https:\/\/[^"]*\.fbcdn\.net[^"]*\.mp4[^"]*/g,
                /"videoUrl":"([^"]*fbcdn\.net[^"]*\.mp4[^"]*)"/g,
                /"playable_url":"([^"]*fbcdn\.net[^"]*\.mp4[^"]*)"/g,
                /"src":"([^"]*fbcdn\.net[^"]*\.mp4[^"]*)"/g,
                /"dash_manifest":"([^"]*fbcdn\.net[^"]*)"/g
            ];
            
            for (const pattern of videoPatterns) {
                const matches = pageContent.match(pattern);
                if (matches && matches.length > 0) {
                    // Get the longest/highest quality URL
                    let bestVideo = matches.reduce((prev, current) => {
                        // Clean up JSON escaping
                        const cleanCurrent = current.replace(/^"[^"]*":"/, '').replace(/"$/, '').replace(/\\u0026/g, '&').replace(/\\/g, '');
                        const cleanPrev = prev.replace(/^"[^"]*":"/, '').replace(/"$/, '').replace(/\\u0026/g, '&').replace(/\\/g, '');
                        return cleanCurrent.length > cleanPrev.length ? cleanCurrent : cleanPrev;
                    });
                    
                    // Clean up the URL
                    bestVideo = bestVideo.replace(/^"[^"]*":"/, '').replace(/"$/, '').replace(/\\u0026/g, '&').replace(/\\/g, '');
                    
                    if (bestVideo.includes('fbcdn.net') && bestVideo.includes('.mp4')) {
                        resolve(bestVideo);
                        return;
                    }
                }
            }
            
            resolve(null);
        } catch (error) {
            console.error('Error finding video in page content:', error);
            resolve(null);
        }
    });
}

// Alternative method: Find video elements in DOM
async function findVideoElements() {
    return new Promise((resolve) => {
        // Look for video elements
        const videos = document.querySelectorAll('video');
        
        for (let video of videos) {
            if (video.src && (video.src.includes('fbcdn.net') || video.src.includes('facebook.com'))) {
                resolve(video.src);
                return;
            }
            
            // Check source elements
            const sources = video.querySelectorAll('source');
            for (let source of sources) {
                if (source.src && (source.src.includes('fbcdn.net') || source.src.includes('facebook.com'))) {
                    resolve(source.src);
                    return;
                }
            }
        }
        
        // Look in page source for video URLs
        const pageContent = document.documentElement.innerHTML;
        const videoMatches = pageContent.match(/https:\/\/[^"]*\.fbcdn\.net[^"]*\.mp4[^"]*/g);
        
        if (videoMatches && videoMatches.length > 0) {
            // Find the highest quality video (usually the longest URL)
            const bestVideo = videoMatches.reduce((prev, current) => {
                return current.length > prev.length ? current : prev;
            });
            resolve(bestVideo);
            return;
        }
        
        resolve(null);
    });
}

// Monitor for video requests using MutationObserver
const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeName === 'VIDEO') {
                    const video = node;
                    if (video.src && video.src.includes('fbcdn.net')) {
                        if (!foundVideoUrls.includes(video.src)) {
                            foundVideoUrls.push(video.src);
                            
                            // Notify background script
                            chrome.runtime.sendMessage({
                                action: 'videoFoundFromContent',
                                videoUrl: video.src
                            }).catch(() => {});
                        }
                        
                        // Notify if currently extracting
                        if (isExtracting) {
                            window.dispatchEvent(new CustomEvent('videoFound', {
                                detail: {url: video.src}
                            }));
                        }
                    }
                }
            });
        }
    });
});

// Start observing
observer.observe(document.body, {
    childList: true,
    subtree: true
});

// Clean up on page unload
window.addEventListener('beforeunload', () => {
    observer.disconnect();
});