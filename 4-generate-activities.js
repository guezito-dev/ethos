const fs = require('fs');

const DEBUG_MODE = true;

const debug = (message, data = null) => {
    if (DEBUG_MODE) {
        console.log(`[ACTIVITIES] ${message}`);
        if (data) console.log(JSON.stringify(data, null, 2));
    }
};

async function fetchUserActivities(profileId) {
    debug(`Fetching activities for profileId: ${profileId}`);
    
    try {
        const userkey = `profileId:${profileId}`;
        
        const response = await fetch('https://api.ethos.network/api/v2/activities/profile/all', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
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
            debug(`✅ API Response for ${profileId}:`, {
                total: data.total,
                activities: data.values?.length || 0
            });
            
            return {
                activities: data.values || [],
                total: data.total || 0
            };
        } else {
            debug(`❌ API Error for ${profileId}: ${response.status} ${response.statusText}`);
            return { activities: [], total: 0 };
        }
    } catch (error) {
        debug(`❌ Network Error for ${profileId}:`, error.message);
        return { activities: [], total: 0 };
    }
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

function createUniqueId(activity) {
    const authorId = activity.author?.profileId || activity.authorUser?.profileId;
    const subjectId = activity.subject?.profileId || activity.subjectUser?.profileId;
    const timestamp = activity.createdAt || activity.timestamp;
    const type = activity.type;
    return `${type}-${authorId}-${subjectId}-${timestamp}`;
}

async function generateActivitiesData() {
    debug('🔄 Starting activities data generation (vouches + reviews)...');
    
    try {
        
        const gigachadsResponse = await fetch('https://raw.githubusercontent.com/guezito-dev/Ethos/main/gigachads-ranking.json');
        if (!gigachadsResponse.ok) {
            throw new Error('Failed to fetch gigachads data');
        }
        
        const gigachadsData = await gigachadsResponse.json();
        
        if (!gigachadsData.ranking || gigachadsData.ranking.length === 0) {
            throw new Error('No ranking data found');
        }
        
        const users = gigachadsData.ranking.map(rank => rank.user);
        debug(`📊 Processing ${users.length} users for activities...`);
        
        const allVouches = [];
        const allReviews = [];
        const processedActivities = new Set();
        const gigachadProfileIds = new Set(users.map(u => u.profileId));
        
        
        const limitedUsers = users.slice(0, 15);
        
        
        const batchSize = 5;
        for (let i = 0; i < limitedUsers.length; i += batchSize) {
            const batch = limitedUsers.slice(i, i + batchSize);
            
            const promises = batch.map(async (user) => {
                if (!user.profileId) {
                    debug(`⚠️ Skipping user without profileId: ${user.username}`);
                    return { vouches: [], reviews: [] };
                }
                
                debug(`🔍 Fetching activities for user ${user.profileId} (${user.username})`);
                
                const userActivities = await fetchUserActivities(user.profileId);
                
                if (userActivities.activities && userActivities.activities.length > 0) {
                    debug(`📊 User ${user.username} has ${userActivities.activities.length} total activities`);
                    
                    const userVouches = [];
                    const userReviews = [];
                    
                    userActivities.activities.forEach(activity => {
                        const authorProfileId = activity.author?.profileId;
                        const subjectProfileId = activity.subject?.profileId;
                        
                        
                        if (!authorProfileId || !subjectProfileId) return;
                        if (!gigachadProfileIds.has(authorProfileId)) return;
                        if (!gigachadProfileIds.has(subjectProfileId)) return;
                        if (authorProfileId === subjectProfileId) return;
                        
                        const uniqueId = createUniqueId(activity);
                        
                        if (processedActivities.has(uniqueId)) {
                            return;
                        }
                        
                        processedActivities.add(uniqueId);
                        
                        
                        if (activity.type === 'vouch') {
                            const authorName = activity.author?.name || activity.author?.username || 'Unknown';
                            const subjectName = activity.subject?.name || activity.subject?.username || 'Unknown';
                            const authorAvatar = activity.author?.avatar || 'https://via.placeholder.com/32';
                            const subjectAvatar = activity.subject?.avatar || 'https://via.placeholder.com/32';
                            const timestamp = activity.timestamp || activity.createdAt;
                            const timeAgo = formatTimeAgo(timestamp);
                            const stakeAmount = getStakedAmount(activity);
                            const vouchId = activity.data?.id;
                            
                            let clickUrl;
                            if (vouchId) {
                                clickUrl = `https://app.ethos.network/activity/vouch/${vouchId}`;
                            } else {
                                const subjectUsername = activity.subject?.username;
                                clickUrl = `https://app.ethos.network/profile/x/${subjectUsername}`;
                            }
                            
                           
                            activity.enriched = {
                                authorName,
                                subjectName,
                                authorAvatar,
                                subjectAvatar,
                                timeAgo,
                                stakeAmount,
                                clickUrl,
                                vouchId
                            };
                            
                            userVouches.push(activity);
                        }
                        
                        
                        else if (activity.type === 'review') {
                            const authorName = activity.author?.name || activity.author?.username || 'Unknown';
                            const subjectName = activity.subject?.name || activity.subject?.username || 'Unknown';
                            const authorAvatar = activity.author?.avatar || 'https://via.placeholder.com/32';
                            const subjectAvatar = activity.subject?.avatar || 'https://via.placeholder.com/32';
                            const timestamp = activity.timestamp || activity.createdAt;
                            const timeAgo = formatTimeAgo(timestamp);
                            const score = activity.data?.score || 'neutral';
                            const scoreClass = score === 'positive' ? 'positive' : 
                                              score === 'negative' ? 'negative' : 'neutral';
                            const scoreText = score.charAt(0).toUpperCase() + score.slice(1);
                            const reviewId = activity.data?.id;
                            
                            let clickUrl;
                            if (reviewId) {
                                clickUrl = `https://app.ethos.network/activity/review/${reviewId}`;
                            } else {
                                const subjectUsername = activity.subject?.username;
                                clickUrl = `https://app.ethos.network/profile/x/${subjectUsername}`;
                            }
                            
                            
                            activity.enriched = {
                                authorName,
                                subjectName,
                                authorAvatar,
                                subjectAvatar,
                                timeAgo,
                                score,
                                scoreClass,
                                scoreText,
                                clickUrl,
                                reviewId
                            };
                            
                            userReviews.push(activity);
                        }
                    });
                    
                    debug(`✅ User ${user.username}: ${userVouches.length} vouches, ${userReviews.length} reviews`);
                    
                    return { vouches: userVouches, reviews: userReviews };
                } else {
                    debug(`⚠️ No activities found for ${user.username}`);
                }
                
                return { vouches: [], reviews: [] };
            });
            
            const batchResults = await Promise.all(promises);
            batchResults.forEach(result => {
                if (result.vouches.length > 0) {
                    allVouches.push(...result.vouches);
                }
                if (result.reviews.length > 0) {
                    allReviews.push(...result.reviews);
                }
            });
            
          
            if (i + batchSize < limitedUsers.length) {
                debug(`⏳ Pausing between batches...`);
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        debug(`📊 Total found: ${allVouches.length} vouches, ${allReviews.length} reviews`);
        
        
        allVouches.sort((a, b) => {
            const timestampA = a.timestamp || a.createdAt || 0;
            const timestampB = b.timestamp || b.createdAt || 0;
            return timestampB - timestampA;
        });
        
        allReviews.sort((a, b) => {
            const timestampA = a.timestamp || a.createdAt || 0;
            const timestampB = b.timestamp || b.createdAt || 0;
            return timestampB - timestampA;
        });
        
        
        const recentVouches = allVouches.slice(0, 20);
        const recentReviews = allReviews.slice(0, 20);
        
        debug(`✅ Final results: ${recentVouches.length} vouches, ${recentReviews.length} reviews`);
        
        
        const jsonOutput = {
            success: true,
            totalVouches: allVouches.length,
            totalReviews: allReviews.length,
            recentVouches: recentVouches.length,
            recentReviews: recentReviews.length,
            usersProcessed: limitedUsers.length,
            generatedAt: new Date().toISOString(),
            lastUpdated: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
            data: {
                vouches: recentVouches,
                reviews: recentReviews
            }
        };
        
       
        fs.writeFileSync('activities-data.json', JSON.stringify(jsonOutput, null, 2));
        
        debug('✅ Activities data generated successfully!');
        debug(`📊 Statistics: ${recentVouches.length} vouches, ${recentReviews.length} reviews saved`);
        
    } catch (error) {
        debug('❌ Error generating activities data:', error);
        
        
        const errorJson = {
            success: false,
            error: error.message,
            generatedAt: new Date().toISOString(),
            data: {
                vouches: [],
                reviews: []
            }
        };
        
        fs.writeFileSync('activities-data.json', JSON.stringify(errorJson, null, 2));
    }
}


if (require.main === module) {
    generateActivitiesData();
}

module.exports = { generateActivitiesData };
