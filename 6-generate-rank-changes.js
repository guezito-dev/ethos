const fs = require('fs');
const path = require('path');

const DEBUG_MODE = true;

function debug(message, data = null) {
    if (DEBUG_MODE) {
        console.log(`[RANK-CHANGES] ${message}`, data || '');
    }
}

async function generateRankChangesData() {
    try {
        debug('🔄 Loading activities data...');
        
        
        const activitiesResponse = await fetch('https://raw.githubusercontent.com/guezito-dev/Ethos/main/activities-data.json');
        if (!activitiesResponse.ok) throw new Error('Failed to fetch activities data');
        
        const activitiesData = await activitiesResponse.json();
        const vouches = activitiesData.data.vouches || [];
        const reviews = activitiesData.data.reviews || [];
        
        debug('✅ Activities loaded:', vouches.length, 'vouches,', reviews.length, 'reviews');
        
       
        const isToday = (timestamp) => {
            if (!timestamp) return false;
            const activityDate = new Date(timestamp * 1000);
            const today = new Date();
            return today.toDateString() === activityDate.toDateString();
        };
        
        
        const todayVouches = vouches.filter(vouch => isToday(vouch.timestamp));
        const todayReviews = reviews.filter(review => isToday(review.timestamp));
        
        debug('📊 Today vouches:', todayVouches.length);
        debug('📊 Today reviews:', todayReviews.length);
        
        
        let finalVouches = todayVouches;
        let finalReviews = todayReviews;
        
        if (todayVouches.length === 0 && todayReviews.length === 0) {
            const oneDayAgo = new Date();
            oneDayAgo.setDate(oneDayAgo.getDate() - 1);
            
            finalVouches = vouches.filter(vouch => {
                const activityDate = new Date(vouch.timestamp * 1000);
                return activityDate >= oneDayAgo;
            });
            
            finalReviews = reviews.filter(review => {
                const activityDate = new Date(review.timestamp * 1000);
                return activityDate >= oneDayAgo;
            });
            
            debug('📊 No activities today, taking last 24h');
            debug('📊 Recent vouches (24h):', finalVouches.length);
            debug('📊 Recent reviews (24h):', finalReviews.length);
        }
        
        
        const todayPoints = {};
        
        const addPoints = (userName, points, reason, avatarUrl) => {
            debug('🔍 Adding points:', userName, points, reason);
            
            if (!userName) return;
            
            if (!todayPoints[userName]) {
                todayPoints[userName] = {
                    displayName: userName,
                    avatarUrl: avatarUrl || 'https://via.placeholder.com/35',
                    points: 0,
                    activities: []
                };
            }
            todayPoints[userName].points += points;
            todayPoints[userName].activities.push(reason);
        };
        
        
        finalVouches.forEach((vouch, index) => {
            const activityDate = new Date(vouch.timestamp * 1000);
            debug(`🔍 Processing vouch ${index}:`, vouch.author?.name, '->', vouch.subject?.name, 'at', activityDate.toLocaleString());
            
            if (vouch.author && vouch.subject) {
                
                addPoints(vouch.author.name, 10, `Vouch given (+10pts)`, vouch.author.avatar);
                
                addPoints(vouch.subject.name, 5, `Vouch received (+5pts)`, vouch.subject.avatar);
            }
        });
        
        
        finalReviews.forEach((review, index) => {
            const activityDate = new Date(review.timestamp * 1000);
            debug(`🔍 Processing review ${index}:`, review.author?.name, '->', review.subject?.name, 'at', activityDate.toLocaleString());
            
            if (review.author && review.subject) {
                
                addPoints(review.author.name, 2, `Review given (+2pts)`, review.author.avatar);
                
                addPoints(review.subject.name, 1, `Review received (+1pt)`, review.subject.avatar);
            }
        });
        
        debug('🔍 Points calculated:', todayPoints);
        
        
        const topGainersToday = Object.values(todayPoints)
            .filter(userData => userData.points > 0)
            .sort((a, b) => b.points - a.points)
            .slice(0, 5);
        
        debug('🎯 Top gainers found:', topGainersToday.length);
        debug('👥 Top gainers:', topGainersToday.map(u => `${u.displayName}: +${u.points}pts`));
        
        
        const rankChangesData = {
            success: true,
            data: topGainersToday,
            stats: {
                totalGainers: topGainersToday.length,
                totalPointsGained: topGainersToday.reduce((sum, user) => sum + user.points, 0),
                todayVouches: todayVouches.length,
                todayReviews: todayReviews.length,
                recentVouches: finalVouches.length,
                recentReviews: finalReviews.length,
                dataSource: todayVouches.length > 0 || todayReviews.length > 0 ? 'today' : 'recent'
            },
            lastUpdated: new Date().toISOString()
        };
        
        
        const outputPath = path.join(__dirname, 'rank-changes-data.json');
        fs.writeFileSync(outputPath, JSON.stringify(rankChangesData, null, 2));
        
        debug('✅ Rank changes data generated successfully');
        debug('📊 Final stats:', rankChangesData.stats);
        
        return rankChangesData;
        
    } catch (error) {
        debug('❌ Error generating rank changes data:', error);
        throw error;
    }
}


if (require.main === module) {
    generateRankChangesData()
        .then(() => {
            debug('🎉 Script completed successfully');
            process.exit(0);
        })
        .catch(error => {
            debug('💥 Script failed:', error);
            process.exit(1);
        });
}

module.exports = { generateRankChangesData };
