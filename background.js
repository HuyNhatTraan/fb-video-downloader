// Background script for Facebook Video Downloader

let foundVideos = new Map(); // Store found videos by tab ID
let extractionPromises = new Map(); // Store extraction promises by tab ID
let currentExtraction = null; // Store current extraction status

chrome.runtime.onInstalled.addListener(() => {
    console.log('Facebook Video Downloader installed');
    resetUserAgent(); // Ensure clean state on installation
});

// Listen for web requests to capture video URLs
chrome.webRequest.onBeforeRequest.addListener(
    function(details) {
        // Check if this is a video request from Facebook CDN
        if (details.url.includes('fbcdn.net') && 
            (details.url.includes('.mp4') || details.type === 'media')) {
            
            // Store video URL for this tab
            if (!foundVideos.has(details.tabId)) {
                foundVideos.set(details.tabId, []);
            }
            const tabVideos = foundVideos.get(details.tabId);
            if (!tabVideos.includes(details.url)) {
                tabVideos.push(details.url);
                
                // If there's a pending extraction promise, resolve it
                if (extractionPromises.has(details.tabId)) {
                    const resolve = extractionPromises.get(details.tabId);
                    extractionPromises.delete(details.tabId);
                    resolve({success: true, videoUrl: details.url});
                }
            }
            
            // Also send to content script if it exists
            chrome.tabs.sendMessage(details.tabId, {
                action: 'videoFound',
                videoUrl: details.url,
                requestId: details.requestId
            }).catch(() => {
                // Ignore errors if content script is not ready
            });
        }
        return {cancel: false};
    },
    {
        urls: ["https://*.fbcdn.net/*"],
        types: ["media", "xmlhttprequest", "other"]
    }
);

// Handle messages from content scripts and popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startVideoExtraction') {
        // Start video extraction in background
        startBackgroundExtraction(request.url)
            .then(result => sendResponse(result))
            .catch(error => sendResponse({success: false, error: error.message}));
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'checkExtractionStatus') {
        // Return current extraction status
        // If no extraction is running, return completed: true
        sendResponse(currentExtraction || {completed: true});
        return;
    }
    
    if (request.action === 'extractVideoBackground') {
        // Handle video extraction in background tab
        const tabId = sender.tab?.id || request.tabId;
        
        // Check if we already have a video for this tab
        if (foundVideos.has(tabId) && foundVideos.get(tabId).length > 0) {
            const videoUrl = foundVideos.get(tabId)[0];
            sendResponse({success: true, videoUrl: videoUrl});
            return;
        }
        
        // Wait for video to be found
        const promise = new Promise((resolve) => {
            extractionPromises.set(tabId, resolve);
            
            // Timeout after 10 seconds
            setTimeout(() => {
                if (extractionPromises.has(tabId)) {
                    extractionPromises.delete(tabId);
                    resolve({success: false, error: 'Timeout - không tìm thấy video'});
                }
            }, 10000);
        });
        
        promise.then(result => sendResponse(result));
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'setUserAgent') {
        // In Manifest V3, we can't directly modify user agent
        // This would need to be handled differently or through declarativeNetRequest
        sendResponse({success: true});
    }
    
    if (request.action === 'saveVideo') {
        // Handle video saving
        chrome.storage.local.get(['videos']).then(result => {
            const videos = result.videos || [];
            const videoData = {
                url: request.videoUrl,
                originalUrl: request.originalUrl,
                timestamp: Date.now(),
                id: Date.now().toString()
            };
            
            videos.unshift(videoData);
            
            // Keep only last 10 videos
            if (videos.length > 10) {
                videos.splice(10);
            }
            
            chrome.storage.local.set({videos: videos}).then(() => {
                sendResponse({success: true});
            });
        });
        
        return true; // Keep message channel open for async response
    }
    
    if (request.action === 'clearTabVideos') {
        // Clear stored videos for a tab
        const tabId = request.tabId;
        if (foundVideos.has(tabId)) {
            foundVideos.delete(tabId);
        }
        if (extractionPromises.has(tabId)) {
            extractionPromises.delete(tabId);
        }
        sendResponse({success: true});
    }
});

// Function to start background extraction
async function startBackgroundExtraction(url) {
    try {
        console.log('Background: Starting extraction for:', url);
        
        // Initialize extraction status
        currentExtraction = {
            completed: false,
            success: false,
            videoUrl: null,
            error: null,
            startTime: Date.now()
        };
        
        // Set mobile User-Agent for extraction
        await setMobileUserAgent();
        
        // Convert to mobile URL
        const mobileUrl = url.replace(/^https?:\/\/(www\.)?facebook\.com/, 'https://m.facebook.com');
        
        // Create background tab
        const tab = await chrome.tabs.create({
            url: mobileUrl,
            active: false
        });
        
        console.log('Background: Created tab with ID:', tab.id);
        
        // Clear any previous videos for this tab
        if (foundVideos.has(tab.id)) {
            foundVideos.delete(tab.id);
        }
        
        // Set up extraction timeout and monitoring
        setTimeout(async () => {
            try {
                const result = await chrome.tabs.sendMessage(tab.id, {
                    action: 'extractVideo',
                    originalUrl: url
                });
                
                console.log('Background: Extraction result:', result);
                
                // Update extraction status
                if (result && result.success && result.videoUrl) {
                    currentExtraction = {
                        completed: true,
                        success: true,
                        videoUrl: result.videoUrl,
                        error: null
                    };
                } else {
                    currentExtraction = {
                        completed: true,
                        success: false,
                        videoUrl: null,
                        error: result?.error || 'Không tìm thấy video'
                    };
                }
                
            } catch (error) {
                console.error('Background: Extraction error:', error);
                currentExtraction = {
                    completed: true,
                    success: false,
                    videoUrl: null,
                    error: error.message
                };
            } finally {
                // Reset User-Agent back to default after extraction
                await resetUserAgent();
                
                // Close the tab
                try {
                    chrome.tabs.remove(tab.id);
                    console.log('Background: Closed tab and reset User-Agent');
                } catch (e) {
                    console.log('Background: Error closing tab:', e);
                }
            }
        }, 8000); // Wait 8 seconds for page to load
        
        return {success: true, message: 'Extraction started'};
        
    } catch (error) {
        console.error('Background: Error starting extraction:', error);
        
        // Reset User-Agent on error too
        await resetUserAgent();
        
        currentExtraction = {
            completed: true,
            success: false,
            videoUrl: null,
            error: error.message
        };
        throw error;
    }
}

// Function to set mobile User-Agent for extraction
async function setMobileUserAgent() {
    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [1],
            addRules: [{
                id: 1,
                priority: 1,
                action: {
                    type: 'modifyHeaders',
                    requestHeaders: [{
                        header: 'User-Agent',
                        operation: 'set',
                        value: 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Mobile Safari/537.36'
                    }]
                },
                condition: {
                    urlFilter: '*facebook.com*',
                    resourceTypes: ['main_frame', 'sub_frame']
                }
            }]
        });
        console.log('Background: Set mobile User-Agent');
    } catch (error) {
        console.log('Background: Could not set mobile User-Agent:', error);
    }
}

// Function to reset User-Agent back to default
async function resetUserAgent() {
    try {
        await chrome.declarativeNetRequest.updateDynamicRules({
            removeRuleIds: [1]
        });
        console.log('Background: Reset User-Agent to default');
    } catch (error) {
        console.log('Background: Could not reset User-Agent:', error);
    }
}

// Clean up when tab is closed or updated
chrome.tabs.onRemoved.addListener((tabId) => {
    if (foundVideos.has(tabId)) {
        foundVideos.delete(tabId);
    }
    if (extractionPromises.has(tabId)) {
        extractionPromises.delete(tabId);
    }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    // Clear videos when navigating to a new page
    if (changeInfo.status === 'loading' && changeInfo.url) {
        if (foundVideos.has(tabId)) {
            foundVideos.delete(tabId);
        }
    }
});

// Initialize: Ensure User-Agent is reset on startup
chrome.runtime.onStartup.addListener(() => {
    resetUserAgent();
});