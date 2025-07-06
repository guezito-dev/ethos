const DEBUG_MODE = true;
const MAX_ITEMS = 20; // Augmenté pour avoir plus d'activités mixtes
const GITHUB_JSON_URL = 'https://raw.githubusercontent.com/guezito-dev/notion-gigachads/main/Ethos/gigachads-ranking.json';

let gigachadsData = null;
const processedActivities = new Set();

// ========== Cache System ==========
class ActivitiesCache {
    constructor() {
        this.cache = new Map();
        this.cacheDuration = 5 * 60 * 1000; // 5 minutes
    }
    
    getCacheKey(userkey) {
        return `activities_${userkey}`;
    }
    
    get(userkey) {
        const key = this.getCacheKey(userkey);
        const cached = this.cache.get(key);
        
        if (cached && Date.now() - cached.timestamp < this.cacheDuration) {
            debug(`Cache hit for ${userkey}`);
            return cached.data;
        }
        
        return null;
    }
    
    set(userkey, data) {
        const key = this.getCacheKey(userkey);
        this.cache.set(key, {
            data: data,
            timestamp: Date.now()
        });
    }
}

const activitiesCache = new ActivitiesCache();

function debug(message, data = null) {
    if (DEBUG_MODE) {
        console.log(`[ACTIVITIES] ${message}`, data);
    }
}

// ========== Utils ==========

function formatTimeAgo(timestamp) {
    let t = parseInt(timestamp, 10);
    if (t < 1e12) t = t * 1000;
    const now = Date.now();
    const diff = Math.floor((now - t) / 1000);
    if (diff < 60) return `${diff}s ago`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
    return `${Math.floor(diff / 2592000)}mo ago`;
}

function weiToEth(wei) {
    if (!wei || wei === '0') return '0.000';
    return (parseInt(wei) / 1e18).toFixed(3);
}

function getStakedAmount(activity) {
    if (activity.data?.deposited) {
        return weiToEth(activity.data.deposited);
    }
    if (activity.content?.deposited) {
        return weiToEth(activity.content.deposited);
    }
    if (activity.data?.staked) {
        return weiToEth(activity.data.staked);
    }
    if (activity.content?.stakeAmount) {
        return parseFloat(activity.content.stakeAmount).toFixed(3);
    }
    if (activity.content?.staked) {
        return weiToEth(activity.content.staked);
    }
    return '0.000';
}

function showError(message, details = null) {
    console.error('[ERROR]', message, details);
    document.getElementById('loading').style.display = 'none';
    const errorEl = document.getElementById('error');
    errorEl.style.display = 'block';
    errorEl.innerHTML = `<div class="error">${message}</div>`;
}

// ========== Activity Parsing ==========
function createUniqueId(activity) {
    const authorId = activity.author?.profileId || activity.authorUser?.profileId;
    const subjectId = activity.subject?.profileId || activity.subjectUser?.profileId;
    const timestamp = activity.createdAt || activity.timestamp;
    const type = activity.type;
    return `${type}-${authorId}-${subjectId}-${timestamp}`;
}

async function fetchUserActivities(userkey) {
    debug(`Fetching activities for ${userkey}`);
    
    // Check cache first
    const cachedData = activitiesCache.get(userkey);
    if (cachedData) {
        return cachedData;
    }
    
    try {
        const response = await fetch('https://api.ethos.network/api/v2/activities/profile/all', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                userkey: userkey,
                excludeHistorical: false,
                limit: 50,
                offset: 0
            })
        });

        if (response.ok) {
            const data = await response.json();
            const result = {
                activities: data.values || [],
                total: data.total || 0
            };
            
            // Cache the result
            activitiesCache.set(userkey, result);
            return result;
        } else {
            return { activities: [], total: 0 };
        }
    } catch (error) {
        debug(`Error fetching activities for ${userkey}:`, error);
        return { activities: [], total: 0 };
    }
}

// ========== Card Creation ==========
function createVouchMarqueeCard(vouch) {
    const translatedTitle = vouch.translation?.translatedContent || vouch.comment || vouch.content?.comment || 'Vouch';
    const subjectName = vouch.subjectUser.displayName || vouch.subjectUser.username;
    const authorName = vouch.authorUser.displayName || vouch.authorUser.username;
    const authorAvatar = vouch.authorUser.avatarUrl || 'https://via.placeholder.com/24';
    const subjectAvatar = vouch.subjectUser.avatarUrl || 'https://via.placeholder.com/24';
    const timeAgo = formatTimeAgo(vouch.createdAt || vouch.timestamp);
    const stakedAmount = vouch.stakedAmount || getStakedAmount(vouch);

    const vouchId = vouch.data?.id || vouch.content?.id || vouch.id;
    const url = vouchId ? `https://app.ethos.network/activity/vouch/${vouchId}` : "#";

    const truncatedTitle = translatedTitle.length > 40 ? 
        translatedTitle.substring(0, 40) + '...' : translatedTitle;

    return `
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="marquee-card marquee-card-vouch">
            <div class="marquee-avatars">
                <img class="marquee-avatar" src="${authorAvatar}" alt="${authorName}" loading="lazy" 
                     onerror="this.src='https://via.placeholder.com/24'">
                <span class="marquee-arrow">→</span>
                <img class="marquee-avatar" src="${subjectAvatar}" alt="${subjectName}" loading="lazy"
                     onerror="this.src='https://via.placeholder.com/24'">
            </div>
            <div class="marquee-content">
                <div class="marquee-main-line">
                    <span class="marquee-user">${authorName}</span>
                    <span class="marquee-verb">vouched</span>
                    <span class="marquee-user">${subjectName}</span>
                    <span class="marquee-amount">${stakedAmount} ETH</span>
                    <span class="marquee-time">${timeAgo}</span>
                </div>
                <div class="marquee-title">${truncatedTitle}</div>
            </div>
        </a>
    `;
}

function createReviewMarqueeCard(review) {
    const translatedTitle = review.translation?.translatedContent || review.comment || review.content?.comment || 'Review';
    const timeAgo = formatTimeAgo(review.createdAt || review.timestamp);
    const authorName = review.authorUser.displayName || review.authorUser.username;
    const subjectName = review.subjectUser.displayName || review.subjectUser.username;
    const authorAvatar = review.authorUser.avatarUrl || 'https://via.placeholder.com/24';
    const subjectAvatar = review.subjectUser.avatarUrl || 'https://via.placeholder.com/24';

    const reviewId = review.data?.id || review.content?.id || review.id;
    const url = reviewId ? `https://app.ethos.network/activity/review/${reviewId}` : "#";

    const truncatedTitle = translatedTitle.length > 40 ? 
        translatedTitle.substring(0, 40) + '...' : translatedTitle;

    return `
        <a href="${url}" target="_blank" rel="noopener noreferrer" class="marquee-card marquee-card-review">
            <div class="marquee-avatars">
                <img class="marquee-avatar" src="${authorAvatar}" alt="${authorName}" loading="lazy" 
                     onerror="this.src='https://via.placeholder.com/24'">
                <span class="marquee-arrow">→</span>
                <img class="marquee-avatar" src="${subjectAvatar}" alt="${subjectName}" loading="lazy"
                     onerror="this.src='https://via.placeholder.com/24'">
            </div>
            <div class="marquee-content">
                <div class="marquee-main-line">
                    <span class="marquee-user">${authorName}</span>
                    <span class="marquee-verb">reviewed</span>
                    <span class="marquee-user">${subjectName}</span>
                    <span class="marquee-time">${timeAgo}</span>
                </div>
                <div class="marquee-title">${truncatedTitle}</div>
            </div>
        </a>
    `;
}
// ========== Main Fetch Logic ==========
async function fetchRecentActivities() {
    debug('Starting activities fetch...');
    if (!gigachadsData || !gigachadsData.ranking) {
        throw new Error('Giga Chads data not available');
    }

    const allVouches = [];
    const allReviews = [];
    const gigachadProfileIds = new Set(gigachadsData.ranking.map(u => u.user.profileId));
    const profileIdToUser = new Map(gigachadsData.ranking.map(u => [u.user.profileId, u.user]));
    processedActivities.clear();

    debug('Giga Chads detected', { count: gigachadProfileIds.size });
    const usersToCheck = gigachadsData.ranking.slice(0, 15);

    // Process users in parallel batches
    const batchSize = 5;
    for (let i = 0; i < usersToCheck.length; i += batchSize) {
        const batch = usersToCheck.slice(i, i + batchSize);
        const promises = batch.map(async (userRank) => {
            try {
                const userkey = `profileId:${userRank.user.profileId}`;
                const result = await fetchUserActivities(userkey);

                if (result.activities.length > 0) {
                    result.activities.forEach(activity => {
                        const authorProfileId = activity.author?.profileId;
                        const subjectProfileId = activity.subject?.profileId;
                        
                        if (authorProfileId && subjectProfileId) {
                            const uniqueId = createUniqueId(activity);

                            if (!processedActivities.has(uniqueId)) {
                                processedActivities.add(uniqueId);

                                if (gigachadProfileIds.has(subjectProfileId) &&
                                    gigachadProfileIds.has(authorProfileId) &&
                                    authorProfileId !== subjectProfileId) {

                                    const subjectUser = profileIdToUser.get(subjectProfileId);
                                    const authorUser = profileIdToUser.get(authorProfileId);

                                    if (subjectUser && authorUser) {
                                        const baseActivity = {
                                            ...activity,
                                            authorUser: authorUser,
                                            subjectUser: subjectUser,
                                            uniqueId: uniqueId
                                        };

                                        if (activity.type === 'vouch') {
                                            const stakedAmount = getStakedAmount(activity);
                                            debug(`✅ Unique vouch: ${authorUser.username} -> ${subjectUser.username} (${stakedAmount} ETH)`);
                                            allVouches.push({
                                                ...baseActivity,
                                                stakedAmount
                                            });
                                        } else if (activity.type === 'review') {
                                            debug(`✅ Unique review: ${authorUser.username} -> ${subjectUser.username}`);
                                            allReviews.push(baseActivity);
                                        }
                                    }
                                }
                            }
                        }
                    });
                }
            } catch (error) {
                debug(`Error for ${userRank.user.username}:`, error.message);
            }
        });

        await Promise.all(promises);
        
        // Small delay between batches
        if (i + batchSize < usersToCheck.length) {
            await new Promise(resolve => setTimeout(resolve, 200));
        }
    }

    // Sort by date
    allVouches.sort((a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp));
    allReviews.sort((a, b) => new Date(b.createdAt || b.timestamp) - new Date(a.createdAt || a.timestamp));
    
    debug('Total activities fetched', { vouches: allVouches.length, reviews: allReviews.length });
    
    return {
        vouches: allVouches.slice(0, MAX_ITEMS),
        reviews: allReviews.slice(0, MAX_ITEMS)
    };
}

// ========== Display Functions ==========
function displayCombinedMarquee(vouches, reviews) {
    const container = document.getElementById('activityContainer');
    
    // Utiliser la nouvelle fonction pour récupérer les 10 dernières activités
    const recentActivities = combineAndSortActivities(vouches, reviews);
    
    // Générer les cartes selon le type d'activité
    const allCards = recentActivities.map(activity => {
        if (activity.activityType === 'vouch') {
            return createVouchMarqueeCard(activity);
        } else {
            return createReviewMarqueeCard(activity);
        }
    });
    
    if (allCards.length === 0) {
        container.innerHTML = '<div class="no-data-today">No activities found between Giga Chads.</div>';
        return;
    }
    
    container.innerHTML = `
        <div class="marquee-container">
            <div class="marquee-track">
                ${allCards.join('')}
            </div>
        </div>
    `;
}

function combineAndSortActivities(vouches, reviews) {
    // Marquer les vouches avec leur type
    const vouchesWithType = vouches.map(vouch => ({
        ...vouch,
        activityType: 'vouch',
        sortTimestamp: vouch.createdAt || vouch.timestamp
    }));
    
    // Marquer les reviews avec leur type
    const reviewsWithType = reviews.map(review => ({
        ...review,
        activityType: 'review',
        sortTimestamp: review.createdAt || review.timestamp
    }));
    
    // Combiner les deux arrays
    const allActivities = [...vouchesWithType, ...reviewsWithType];
    
    // Trier par timestamp décroissant (plus récent en premier)
    allActivities.sort((a, b) => {
        const timestampA = new Date(a.sortTimestamp).getTime();
        const timestampB = new Date(b.sortTimestamp).getTime();
        return timestampB - timestampA;
    });
    
    // Retourner les 10 premiers
    return allActivities.slice(0, 10);
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

// ========== GitHub Data Loading ==========
async function loadGigachadsData() {
    debug('Loading Giga Chads data...');
    try {
        const response = await fetch(GITHUB_JSON_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        gigachadsData = await response.json();
        debug('Giga Chads data loaded successfully', { count: gigachadsData.ranking?.length || 0 });
    } catch (error) {
        debug('Error loading Giga Chads data:', error);
        throw error;
    }
}

// ========== Main Initialization ==========
async function loadActivities() {
    try {
        document.getElementById('loading').style.display = 'block';
        document.getElementById('error').style.display = 'none';
        
        // Load Giga Chads data first
        await loadGigachadsData();
        
        // Fetch activities
        const { vouches, reviews } = await fetchRecentActivities();
        
        // Display combined marquee
        displayCombinedMarquee(vouches, reviews);
        
        document.getElementById('loading').style.display = 'none';
        document.getElementById('content').style.display = 'block';
        
    } catch (error) {
        console.error('Error loading activities:', error);
        showError('Failed to load activities. Please try again later.');
    }
}

// Start the application
document.addEventListener('DOMContentLoaded', loadActivities);
