(function() {
    'use strict';
    
    // Avoid running multiple times on the same page
    if (window.phishingDetectionProcessed) {
        return;
    }
    window.phishingDetectionProcessed = true;
    
    console.log('Phishing Detection: Content script loaded');
    
    function extractFeatures() {
        var result = {};
        var url = window.location.href;
        var urlDomain = window.location.hostname;
        
        try {
            // Feature 1: IP Address detection
            var ipPattern = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
            var hexPattern = /^(?:0x[0-9A-Fa-f]{1,2}\.){3}0x[0-9A-Fa-f]{1,2}$/;
            
            if (ipPattern.test(urlDomain) || hexPattern.test(urlDomain)) {
                result["IP Address"] = "1";
            } else {
                result["IP Address"] = "-1";
            }
            
            // Feature 2: URL Length
            if (url.length < 54) {
                result["URL Length"] = "-1";
            } else if (url.length >= 54 && url.length <= 75) {
                result["URL Length"] = "0";
            } else {
                result["URL Length"] = "1";
            }
            
            // Feature 3: Short URL detection
            var onlyDomain = urlDomain.replace(/^www\./, '');
            if (onlyDomain.length < 7) {
                result["Short URL"] = "1";
            } else {
                result["Short URL"] = "-1";
            }
            
            // Feature 4: @ symbol in URL
            if (url.includes('@')) {
                result["@"] = "1";
            } else {
                result["@"] = "-1";
            }
            
            // Feature 5: Redirecting // after position 7
            if (url.lastIndexOf("//") > 7) {
                result["Redirecting //"] = "1";
            } else {
                result["Redirecting //"] = "-1";
            }
            
            // Feature 6: Prefix/Suffix with dash
            if (urlDomain.includes('-')) {
                result["Prefix/Suffix"] = "1";
            } else {
                result["Prefix/Suffix"] = "-1";
            }
            
            // Feature 7: Subdomain count
            var subdomains = urlDomain.split('.').length - 2; // -2 for domain.tld
            if (subdomains <= 1) {
                result["Sub Domains"] = "-1";
            } else if (subdomains === 2) {
                result["Sub Domains"] = "0";
            } else {
                result["Sub Domains"] = "1";
            }
            
            // Feature 8: HTTPS in domain name
            if (onlyDomain.includes('https')) {
                result["HTTPS in Domain"] = "1";
            } else {
                result["HTTPS in Domain"] = "-1";
            }
            
            // Feature 9: SSL Certificate (HTTPS usage)
            if (window.location.protocol === 'https:') {
                result["SSL Certificate"] = "-1";
            } else {
                result["SSL Certificate"] = "1";
            }
            
            // Feature 10: Request URL analysis
            var imgTags = document.getElementsByTagName("img");
            var phishCount = 0;
            var legitCount = 0;
            var domainPattern = new RegExp(onlyDomain.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
            
            for (var i = 0; i < imgTags.length; i++) {
                var src = imgTags[i].getAttribute("src");
                if (!src) continue;
                
                if (domainPattern.test(src) || (src.charAt(0) === '/' && src.charAt(1) !== '/')) {
                    legitCount++;
                } else if (src.startsWith('http')) {
                    phishCount++;
                }
            }
            
            var totalCount = phishCount + legitCount;
            var outRequest = totalCount > 0 ? (phishCount / totalCount) * 100 : 0;
            
            if (outRequest < 22) {
                result["Request URL"] = "-1";
            } else if (outRequest >= 22 && outRequest < 61) {
                result["Request URL"] = "0";
            } else {
                result["Request URL"] = "1";
            }
            
            // Feature 11: Anchor tag analysis
            var aTags = document.getElementsByTagName("a");
            phishCount = 0;
            legitCount = 0;
            
            for (var i = 0; i < aTags.length; i++) {
                var href = aTags[i].getAttribute("href");
                if (!href) continue;
                
                if (domainPattern.test(href) || href.charAt(0) === '#' || 
                    (href.charAt(0) === '/' && href.charAt(1) !== '/')) {
                    legitCount++;
                } else if (href.startsWith('http')) {
                    phishCount++;
                }
            }
            
            totalCount = phishCount + legitCount;
            outRequest = totalCount > 0 ? (phishCount / totalCount) * 100 : 0;
            
            if (outRequest < 31) {
                result["Anchor"] = "-1";
            } else if (outRequest >= 31 && outRequest <= 67) {
                result["Anchor"] = "0";
            } else {
                result["Anchor"] = "1";
            }
            
            // Feature 12: Script and Link tags analysis
            var sTags = document.getElementsByTagName("script");
            var lTags = document.getElementsByTagName("link");
            phishCount = 0;
            legitCount = 0;
            
            // Analyze script tags
            for (var i = 0; i < sTags.length; i++) {
                var src = sTags[i].getAttribute("src");
                if (!src) continue;
                
                if (domainPattern.test(src) || (src.charAt(0) === '/' && src.charAt(1) !== '/')) {
                    legitCount++;
                } else if (src.startsWith('http')) {
                    phishCount++;
                }
            }
            
            // Analyze link tags
            for (var i = 0; i < lTags.length; i++) {
                var href = lTags[i].getAttribute("href");
                if (!href) continue;
                
                if (domainPattern.test(href) || (href.charAt(0) === '/' && href.charAt(1) !== '/')) {
                    legitCount++;
                } else if (href.startsWith('http')) {
                    phishCount++;
                }
            }
            
            totalCount = phishCount + legitCount;
            outRequest = totalCount > 0 ? (phishCount / totalCount) * 100 : 0;
            
            if (outRequest < 17) {
                result["Script and Link"] = "-1";
            } else if (outRequest >= 17 && outRequest <= 81) {
                result["Script and Link"] = "0";
            } else {
                result["Script and Link"] = "1";
            }
            
            // Feature 13: Server Form Handler (SFH)
            var forms = document.getElementsByTagName("form");
            var res = "-1";
            
            for (var i = 0; i < forms.length; i++) {
                var action = forms[i].getAttribute("action");
                if (!action || action === "" || action === "#") {
                    res = "1";
                    break;
                } else if (!action.startsWith("/") && !domainPattern.test(action)) {
                    res = "0";
                }
            }
            result["SFH"] = res;
            
            // Feature 14: Mailto detection
            res = "-1";
            for (var i = 0; i < forms.length; i++) {
                var action = forms[i].getAttribute("action");
                if (action && action.toLowerCase().startsWith("mailto")) {
                    res = "1";
                    break;
                }
            }
            result["mailto"] = res;
            
            // Feature 15: iFrames
            var iframes = document.getElementsByTagName("iframe");
            if (iframes.length === 0) {
                result["iFrames"] = "-1";
            } else {
                // Check for invisible or suspicious iframes
                var suspiciousIframes = 0;
                for (var i = 0; i < iframes.length; i++) {
                    var iframe = iframes[i];
                    var style = window.getComputedStyle(iframe);
                    if (style.display === 'none' || style.visibility === 'hidden' || 
                        iframe.width < 10 || iframe.height < 10) {
                        suspiciousIframes++;
                    }
                }
                result["iFrames"] = suspiciousIframes > 0 ? "1" : "0";
            }
            
            // Feature 16: Favicon
            var faviconLinks = document.querySelectorAll('link[rel*="icon"]');
            if (faviconLinks.length === 0) {
                result["Favicon"] = "1";
            } else {
                var externalFavicon = false;
                for (var i = 0; i < faviconLinks.length; i++) {
                    var href = faviconLinks[i].getAttribute("href");
                    if (href && !domainPattern.test(href) && href.startsWith('http')) {
                        externalFavicon = true;
                        break;
                    }
                }
                result["Favicon"] = externalFavicon ? "1" : "-1";
            }
            
            // Feature 17: Port
            var port = window.location.port;
            if (!port) {
                // Default ports
                port = window.location.protocol === 'https:' ? '443' : '80';
            }
            
            if (port === '80' || port === '443') {
                result["Port"] = "-1";
            } else {
                result["Port"] = "1";
            }
            
            console.log('Features extracted (before DNS):', result);
            
            // Feature 18: DNS Analysis (async)
            checkDNSRisk(urlDomain).then(riskLevel => {
                result["DNS Analysis"] = String(riskLevel);
                
                console.log('All features extracted:', result);
                
                // Send message to background script
                if (chrome && chrome.runtime) {
                    chrome.runtime.sendMessage(result, function(response) {
                        if (chrome.runtime.lastError) {
                            console.error('Error sending message:', chrome.runtime.lastError);
                        } else {
                            console.log('Features sent to background script');
                        }
                    });
                }
            }).catch(error => {
                console.error('DNS analysis failed:', error);
                result["DNS Analysis"] = "1"; // Default to risky if DNS check fails
                
                // Send message even if DNS fails
                if (chrome && chrome.runtime) {
                    chrome.runtime.sendMessage(result, function(response) {
                        if (chrome.runtime.lastError) {
                            console.error('Error sending message:', chrome.runtime.lastError);
                        }
                    });
                }
            });
            
        } catch (error) {
            console.error('Error extracting features:', error);
            
            // Send error message to background script
            if (chrome && chrome.runtime) {
                chrome.runtime.sendMessage({
                    error: 'Feature extraction failed',
                    details: error.message
                });
            }
        }
    }
    
    // DNS Analysis functions
    async function fetchDNSData(domain) {
        try {
            const cleanDomain = cleanDomainName(domain);
            const response = await fetch(`https://networkcalc.com/api/dns/lookup/${cleanDomain}`, {
