// Injected script to monitor network requests on Facebook

(function() {
    'use strict';
    
    // Override XMLHttpRequest to monitor network requests
    const originalXHROpen = XMLHttpRequest.prototype.open;
    const originalXHRSend = XMLHttpRequest.prototype.send;
    
    XMLHttpRequest.prototype.open = function(method, url, ...args) {
        this._url = url;
        return originalXHROpen.apply(this, [method, url, ...args]);
    };
    
    XMLHttpRequest.prototype.send = function(...args) {
        this.addEventListener('readystatechange', function() {
            if (this.readyState === 4 && this._url) {
                // Check if this is a video URL
                if (this._url.includes('fbcdn.net') && 
                    (this._url.includes('.mp4') || 
                     this.getResponseHeader('content-type')?.includes('video'))) {
                    
                    // Notify content script immediately
                    window.dispatchEvent(new CustomEvent('videoFound', {
                        detail: {
                            url: this._url,
                            contentType: this.getResponseHeader('content-type'),
                            source: 'xhr'
                        }
                    }));
                }
            }
        });
        
        return originalXHRSend.apply(this, args);
    };
    
    // Override fetch to monitor network requests
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        const url = typeof input === 'string' ? input : input.url;
        
        return originalFetch.apply(this, arguments).then(response => {
            // Check if this is a video URL
            if (url.includes('fbcdn.net') && 
                (url.includes('.mp4') || 
                 response.headers.get('content-type')?.includes('video'))) {
                
                // Notify content script immediately
                window.dispatchEvent(new CustomEvent('videoFound', {
                    detail: {
                        url: url,
                        contentType: response.headers.get('content-type'),
                        source: 'fetch'
                    }
                }));
            }
            
            return response;
        });
    };
    
    // Monitor for video elements being added to DOM
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            mutation.addedNodes.forEach((node) => {
                if (node.nodeName === 'VIDEO' || 
                    (node.querySelectorAll && node.querySelectorAll('video').length > 0)) {
                    
                    const videos = node.nodeName === 'VIDEO' ? [node] : node.querySelectorAll('video');
                    
                    videos.forEach(video => {
                        // Check video src
                        if (video.src && video.src.includes('fbcdn.net')) {
                            window.dispatchEvent(new CustomEvent('videoFound', {
                                detail: {
                                    url: video.src,
                                    element: 'video',
                                    source: 'dom-mutation'
                                }
                            }));
                        }
                        
                        // Check source elements
                        const sources = video.querySelectorAll('source');
                        sources.forEach(source => {
                            if (source.src && source.src.includes('fbcdn.net')) {
                                window.dispatchEvent(new CustomEvent('videoFound', {
                                    detail: {
                                        url: source.src,
                                        element: 'source',
                                        source: 'dom-mutation'
                                    }
                                }));
                            }
                        });
                    });
                }
            });
        });
    });
    
    // Start observing when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            observer.observe(document.body, {
                childList: true,
                subtree: true
            });
        });
    } else {
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
    
    // Also check existing video elements
    setTimeout(() => {
        const existingVideos = document.querySelectorAll('video');
        existingVideos.forEach(video => {
            if (video.src && video.src.includes('fbcdn.net')) {
                window.dispatchEvent(new CustomEvent('videoFound', {
                    detail: {
                        url: video.src,
                        element: 'existing-video',
                        source: 'existing-scan'
                    }
                }));
            }
            
            // Also check source elements in existing videos
            const sources = video.querySelectorAll('source');
            sources.forEach(source => {
                if (source.src && source.src.includes('fbcdn.net')) {
                    window.dispatchEvent(new CustomEvent('videoFound', {
                        detail: {
                            url: source.src,
                            element: 'existing-source',
                            source: 'existing-scan'
                        }
                    }));
                }
            });
        });
    }, 1000);
    
})();