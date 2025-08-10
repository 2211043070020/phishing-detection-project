console.log('Phishing Detection: Background script loaded');

// Configuration
const CONFIG = {
    MODEL_URL: 'https://raw.githubusercontent.com/yourusername/phishing-detection-extension/main/model/classifier55.json',
    MODEL_METADATA_URL: 'https://api.github.com/repos/yourusername/phishing-detection-extension/commits?path=classifier55.json&page=1&per_page=1',
    PHISHING_THRESHOLD: 0.5,
    UPDATE_CHECK_INTERVAL: 60 // minutes
};

let modelCache = null;

// Initialize extension
chrome.runtime.onInstalled.addListener(async (details) => {
    console.log('Extension installed/updated:', details.reason);
    
    try {
        await initializeExtension();
        console.log('Extension initialized successfully');
    } catch (error) {
        console.error('Error initializing extension:', error);
    }
});

// Service worker startup
chrome.runtime.onStartup.addListener(async () => {
    console.log('Extension startup');
    try {
        await initializeExtension();
    } catch (error) {
        console.error('Error on startup:', error);
    }
});

async function initializeExtension() {
    try {
        // Load cached model
        const result = await chrome.storage.local.get(['cache', 'modelLastUpdate']);
        
        if (result.cache) {
            modelCache = result.cache;
            console.log('Loaded cached model');
        } else {
            console.log('No cached model found, downloading...');
            await updateModel();
        }
        
        // Schedule model updates
        scheduleModelUpdates();
        
    } catch (error) {
        console.error('Error initializing extension:', error);
        throw error;
    }
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    console.log('Background script received message:', request);
    
    try {
        if (request.error) {
            console.error('Content script error:', request.error, request.details);
            sendResponse({success: false, error: request.error});
            return;
        }
        
        // Handle feature extraction results
        if (isFeatureVector(request)) {
            handleFeatureExtraction(request, sender)
                .then(result => sendResponse(result))
                .catch(error => {
                    console.error('Error handling features:', error);
                    sendResponse({success: false, error: error.message});
                });
            return true; // Keep message channel open for async response
        }
        
        // Handle other message types
        switch (request.action) {
            case 'get_model_info':
                getModelInfo()
                    .then(info => sendResponse(info))
                    .catch(error => sendResponse({error: error.message}));
                return true;
                
            case 'force_model_update':
                updateModel()
                    .then(() => sendResponse({success: true}))
                    .catch(error => sendResponse({success: false, error: error.message}));
                return true;
                
            default:
                sendResponse({success: true});
        }
        
    } catch (error) {
        console.error('Error in message handler:', error);
        sendResponse({success: false, error: error.message});
    }
});

function isFeatureVector(obj) {
    // Check if object contains feature extraction results
    const expectedFeatures = [
        'IP Address', 'URL Length', 'Short URL', '@', 'Redirecting //',
        'Prefix/Suffix', 'Sub Domains', 'HTTPS in Domain', 'SSL Certificate',
        'Request URL', 'Anchor', 'Script and Link', 'SFH', 'mailto',
        'iFrames', 'Favicon', 'Port', 'DNS Analysis'
    ];
    
    const objKeys = Object.keys(obj);
    return expectedFeatures.some(feature => objKeys.includes(feature));
}

async function handleFeatureExtraction(features, sender) {
    try {
        console.log('Processing features:', features);
        
        // Ensure model is loaded
        if (!modelCache) {
            console.log('Model not cached, attempting to load...');
            await loadModel();
        }
        
        if (!modelCache) {
            throw new Error('Model not available');
        }
        
        // Convert features to array format
        const featureArray = convertFeaturesToArray(features);
        console.log('Feature array:', featureArray);
        
        // Make prediction
        const prediction = await predictPhishing(featureArray);
        console.log('Prediction result:', prediction);
        
        // Handle prediction result
        if (prediction.isPhishing) {
            // Send alert to content script
            try {
                await chrome.tabs.sendMessage(sender.tab.id, {
                    action: 'alert_user',
                    message: `⚠️ Warning: This website may be a phishing attempt!
                    
Risk Score: ${(prediction.riskScore * 100).toFixed(1)}%
Confidence: ${(prediction.confidence * 100).toFixed(1)}%

Please verify this website's authenticity before entering any personal information.`,
                    prediction: prediction
                });
            } catch (error) {
                console.error('Error sending alert to content script:', error);
            }
        }
        
        // Store prediction result for popup
        await chrome.storage.local.set({
            [`prediction_${sender.tab.id}`]: {
                ...prediction,
                features: features,
                url: sender.tab.url,
                timestamp: Date.now()
            }
        });
        
        return {
            success: true,
            prediction: prediction
        };
        
    } catch (error) {
        console.error('Error handling feature extraction:', error);
        return {
            success: false,
            error: error.message
        };
    }
}

function convertFeaturesToArray(features) {
    // Map features to expected order
    const featureOrder = [
        'IP Address', 'URL Length', 'Short URL', '@', 'Redirecting //',
        'Prefix/Suffix', 'Sub Domains', 'HTTPS in Domain', 'SSL Certificate',
        'Request URL', 'Anchor', 'Script and Link', 'SFH', 'mailto',
        'iFrames', 'Favicon', 'Port', 'DNS Analysis'
    ];
    
    return featureOrder.map(featureName => {
        const value = features[featureName];
        // Convert string values to numbers
        if (value === undefined || value === null) {
            return 0; // Default value
        }
        return parseFloat(value) || 0;
    });
}

async function predictPhishing(featureArray) {
    try {
        if (!modelCache) {
            throw new Error('Model not loaded');
        }
        
        // Simple prediction logic based on feature weights
        // This is a simplified implementation - in a real scenario, you'd implement the actual CatBoost algorithm
        const featureWeights = modelCache.feature_importances || [];
        
        let score = 0;
        let totalWeight = 0;
        
        for (let i = 0; i < Math.min(featureArray.length, featureWeights.length); i++) {
            const featureValue = featureArray[i];
            const weight = featureWeights[i] || 0;
            
            // Positive feature values contribute to phishing score
            if (featureValue > 0) {
                score += weight * featureValue;
            }
            totalWeight += Math.abs(weight);
        }
        
        // Normalize score
        const normalizedScore = totalWeight > 0 ? Math.abs(score) / totalWeight : 0;
        
        // Apply sigmoid function to get probability
        const riskScore = 1 / (1 + Math.exp(-normalizedScore * 5)); // Scaled sigmoid
        
        // Adjust threshold based on DNS analysis
        let threshold = CONFIG.PHISHING_THRESHOLD;
        const dnsAnalysis = featureArray[featureArray.length - 1]; // Last feature is DNS
        if (dnsAnalysis < 0) {
            threshold += 0.1; // More lenient for sites with good DNS
        }
        
        const isPhishing = riskScore >= threshold;
        const confidence = Math.max(Math.abs(riskScore - 0.5) * 2, 0.5);
        
        return {
            isPhishing: isPhishing,
            riskScore: riskScore,
            confidence: confidence,
            threshold: threshold,
            legitimatePercentage: Math.max(0, Math.min(100, (1 - riskScore) * 100))
        };
        
    } catch (error) {
        console.error('Error making prediction:', error);
        throw error;
    }
}

// Model management functions
async function loadModel() {
    try {
        const result = await chrome.storage.local.get(['cache']);
        if (result.cache) {
            modelCache = result.cache;
            console.log('Model loaded from storage');
            return true;
        }
        return false;
    } catch (error) {
        console.error('Error loading model from storage:', error);
        return false;
    }
}

async function updateModel() {
    try {
        console.log('Fetching model from:', CONFIG.MODEL_URL);
        
        const response = await fetch(CONFIG.MODEL_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
        }
        
        const modelData = await response.json();
        console.log('Model fetched successfully');
        
        // Validate model structure
        if (!modelData.model_type || !modelData.feature_importances) {
            throw new Error('Invalid model format');
        }
        
        // Get model metadata
        const metadata = await getModelMetadata();
        
        // Cache the model
        await chrome.storage.local.set({
            cache: modelData,
            modelSha: metadata.lastCommitSha,
            modelLastUpdate: metadata.lastUpdateTime || Date.now(),
            modelLastCheck: Date.now()
        });
        
        modelCache = modelData;
        console.log('Model cached successfully');
        
        return true;
        
    } catch (error) {
        console.error('Error updating model:', error);
        
        // If update fails, try to use cached model
        const loaded = await loadModel();
        if (!loaded) {
            throw new Error('No model available and update failed');
        }
        
        return false;
    }
}

async function getModelMetadata() {
    try {
        const response = await fetch(CONFIG.MODEL_METADATA_URL);
        if (!response.ok) {
            console.warn('Could not fetch model metadata');
            return {};
        }
        
        const data = await response.json();
        if (data.length > 0) {
            return {
                lastCommitSha: data[0].sha,
                lastUpdateTime: new Date(data[0].commit.author.date).getTime()
            };
        }
        
        return {};
    } catch (error) {
        console.error('Error fetching model metadata:', error);
        return {};
    }
}

async function checkForModelUpdate() {
    try {
        const result = await chrome.storage.local.get(['modelSha', 'modelLastCheck']);
        
        // Check if we've checked recently (within last hour)
        const lastCheck = result.modelLastCheck || 0;
        const hourAgo = Date.now() - (60 * 60 * 1000);
        
        if (lastCheck > hourAgo) {
            console.log('Model check skipped - checked recently');
            return false;
        }
        
        const metadata = await getModelMetadata();
        
        if (!metadata.lastCommitSha) {
            console.log('Could not get current model version');
            return false;
        }
        
        const currentSha = result.modelSha;
        const needsUpdate = !currentSha || currentSha !== metadata.lastCommitSha;
        
        // Update last check time
        await chrome.storage.local.set({
            modelLastCheck: Date.now()
        });
        
        if (needsUpdate) {
            console.log('Model update available');
        } else {
            console.log('Model is up to date');
        }
        
        return needsUpdate;
        
    } catch (error) {
        console.error('Error checking for model update:', error);
        return false;
    }
}

function scheduleModelUpdates() {
    // Clear existing alarms
    chrome.alarms.clear('modelUpdateCheck');
    
    // Schedule periodic checks
    chrome.alarms.create('modelUpdateCheck', {
        delayInMinutes: CONFIG.UPDATE_CHECK_INTERVAL,
        periodInMinutes: CONFIG.UPDATE_CHECK_INTERVAL
    });
    
    console.log(`Scheduled model update checks every ${CONFIG.UPDATE_CHECK_INTERVAL} minutes`);
}

// Handle alarm for model updates
chrome.alarms.onAlarm.addListener(async (alarm) => {
    if (alarm.name === 'modelUpdateCheck') {
        console.log('Running scheduled model update check');
        
        try {
            const needsUpdate = await checkForModelUpdate();
            if (needsUpdate) {
                console.log('Updating model...');
                await updateModel();
                console.log('Model updated successfully');
            }
        } catch (error) {
            console.error('Error in scheduled model update:', error);
        }
    }
});

async function getModelInfo() {
    try {
        const result = await chrome.storage.local.get([
            'modelSha', 'modelLastUpdate', 'modelLastCheck'
        ]);
        
        return {
            hasModel: !!modelCache,
            modelType: modelCache?.model_type || 'Unknown',
            featureCount: modelCache?.n_features || 0,
            version: modelCache?.version || '1.0',
            lastUpdate: result.modelLastUpdate ? new Date(result.modelLastUpdate).toLocaleString() : 'Unknown',
            lastCheck: result.modelLastCheck ? new Date(result.modelLastCheck).toLocaleString() : 'Unknown',
            sha: result.modelSha?.substring(0, 7) || 'Unknown'
        };
    } catch (error) {
        console.error('Error getting model info:', error);
        return {
            hasModel: false,
            error: error.message
        };
    }
}

console.log('Background script initialized');
