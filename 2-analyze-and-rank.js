const fs = require('fs');
const path = require('path');

async function analyzeAndRankGigachads() {
    console.log('🏆 ANALYSIS AND RANKING OF ABSTRACT GIGA CHADS\n');

    try {
        const dataPath = path.join(__dirname, 'gigachads-data.json');

        if (!fs.existsSync(dataPath)) {
            console.error('❌ File gigachads-data.json not found!');
            console.log('👉 Run first: node 1-fetch-gigachads.js');
            return;
        }

        const rawData = fs.readFileSync(dataPath, 'utf8');
        const gigachadsData = JSON.parse(rawData);
        
        console.log(`📁 Data loaded: ${gigachadsData.totalCount} Abstract Giga Chads`);

        const activeUsers = gigachadsData.users.filter(u => u.profileId !== null);
        console.log(`🆔 Active users (with profileId): ${activeUsers.length}`);
        console.log(`❌ Excluded (without profileId): ${gigachadsData.totalCount - activeUsers.length}`);

        const gigachadProfileIds = new Set(activeUsers.map(u => u.profileId));
        const profileIdToUser = new Map(activeUsers.map(u => [u.profileId, u]));
        
        
        const userScores = new Map();

        activeUsers.forEach(user => {
            userScores.set(user.id, {
                user: user,
                reviewsReceived: 0,
                reviewsGiven: 0,
                vouchesReceived: 0,
                vouchesGiven: 0,
                attestationsReceived: 0,
                attestationsGiven: 0,
                totalScore: 0,
                lastActivity: null,
                reviewsGivenAvatars: [],
                reviewsReceivedAvatars: [],
                vouchesGivenAvatars: [],
                vouchesReceivedAvatars: []
            });
        });

        console.log('\n🔍 Analyzing active users\' activities...');

        let analyzedCount = 0;
        const startTime = Date.now();

        for (const user of activeUsers) {
            analyzedCount++;

            if (analyzedCount % 10 === 0) {
                const elapsed = (Date.now() - startTime) / 1000;
                const estimated = (elapsed / analyzedCount) * activeUsers.length;
                console.log(`📊 Analysis ${analyzedCount}/${activeUsers.length} - ETA: ${Math.round(estimated - elapsed)}s`);
            }

            try {
                const activityResponse = await fetch('https://api.ethos.network/api/v2/activities/profile/all', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify({
                        userkey: `profileId:${user.profileId}`,
                        excludeHistorical: false,
                        limit: 500,
                        offset: 0
                    })
                });

                if (activityResponse.ok) {
                    const activityData = await activityResponse.json();
                    const activities = activityData.values || [];
                    const userScore = userScores.get(user.id);

                    activities.forEach(activity => {
                        const subjectProfileId = activity.subject?.profileId;
                        const authorProfileId = activity.author?.profileId;

                        if (!userScore.lastActivity || new Date(activity.createdAt) > new Date(userScore.lastActivity)) {
                            userScore.lastActivity = activity.createdAt;
                        }

                        if (authorProfileId === user.profileId) {
                            if (activity.type === 'review' && subjectProfileId && gigachadProfileIds.has(subjectProfileId)) {
                                userScore.reviewsGiven++;
                                const subjectUser = profileIdToUser.get(subjectProfileId);
                                if (subjectUser) {
                                    userScore.reviewsGivenAvatars.push({ avatar: subjectUser.avatarUrl });
                                }
                            }

                            if (activity.type === 'vouch' && subjectProfileId && gigachadProfileIds.has(subjectProfileId)) {
                                userScore.vouchesGiven++;
                                const subjectUser = profileIdToUser.get(subjectProfileId);
                                if (subjectUser) {
                                    userScore.vouchesGivenAvatars.push({ avatar: subjectUser.avatarUrl });
                                }
                            }

                            if (activity.type === 'attestation' && subjectProfileId && gigachadProfileIds.has(subjectProfileId)) {
                                userScore.attestationsGiven++;
                            }
                        }

                        if (subjectProfileId === user.profileId) {
                            if (activity.type === 'review' && authorProfileId && gigachadProfileIds.has(authorProfileId)) {
                                userScore.reviewsReceived++;
                                const authorUser = profileIdToUser.get(authorProfileId);
                                if (authorUser) {
                                    userScore.reviewsReceivedAvatars.push({ avatar: authorUser.avatarUrl });
                                }
                            }

                            if (activity.type === 'vouch' && authorProfileId && gigachadProfileIds.has(authorProfileId)) {
                                userScore.vouchesReceived++;
                                const authorUser = profileIdToUser.get(authorProfileId);
                                if (authorUser) {
                                    userScore.vouchesReceivedAvatars.push({ avatar: authorUser.avatarUrl });
                                }
                            }

                            if (activity.type === 'attestation' && authorProfileId && gigachadProfileIds.has(authorProfileId)) {
                                userScore.attestationsReceived++;
                            }
                        }
                    });
                }
            } catch (error) {
                console.log(`   ❌ Error for ${user.username}: ${error.message}`);
            }

            await new Promise(resolve => setTimeout(resolve, 200));
        }

        console.log('\n🧮 Calculating scores...');

        userScores.forEach((score, userId) => {
            const totalScore =
                (score.reviewsReceived * 1) +
                (score.reviewsGiven * 2) +
                (score.vouchesReceived * 5) +
                (score.vouchesGiven * 10);

            score.totalScore = totalScore;
        });

        const ranking = Array.from(userScores.values())
            .sort((a, b) => b.totalScore - a.totalScore);

        console.log('\n🏆 ABSTRACT GIGA CHADS RANKING BY POINTS 🏆');

        console.log('Rank | Name                 | Reviews | Vouches | Points | Ethos Profile                                          | X Profile');
        console.log('     |                     | Rec|Giv | Rec|Giv |  Total |                                                       |');
        console.log('-----|---------------------|--------|--------|--------|-------------------------------------------------------|---------------------------');

        ranking.forEach((userScore, index) => {
            const rank = (index + 1).toString().padStart(4);
            const name = userScore.user.username.padEnd(19).substring(0, 19);
            const revRec = userScore.reviewsReceived.toString().padStart(3);
            const revGiv = userScore.reviewsGiven.toString().padStart(3);
            const vouchRec = userScore.vouchesReceived.toString().padStart(3);
            const vouchGiv = userScore.vouchesGiven.toString().padStart(3);
            const totalScore = userScore.totalScore.toString().padStart(6);
            const ethosUrl = `https://app.ethos.network/profile/x/${userScore.user.username}`;
            const xUrl = `https://x.com/${userScore.user.username}`;

            console.log(`${rank} | ${name} | ${revRec}|${revGiv} | ${vouchRec}|${vouchGiv} |${totalScore} | ${ethosUrl.padEnd(53)} | ${xUrl}`);
        });

        const usersWithActivity = ranking.filter(u => u.totalScore > 0).length;
        const totalInteractions = ranking.reduce((sum, u) => 
            sum + u.reviewsReceived + u.reviewsGiven + u.vouchesReceived + u.vouchesGiven, 0
        );

        console.log('\n📊 FINAL STATISTICS:');
        console.log(`👥 Total Abstract Giga Chads: ${gigachadsData.totalCount}`);
        console.log(`🆔 Active users (with profileId): ${activeUsers.length}`);
        console.log(`⚡ With activity between Giga Chads: ${usersWithActivity}`);
        console.log(`🔄 Total internal interactions: ${totalInteractions}`);

        const webData = {
            metadata: {
                generatedAt: new Date().toISOString(),
                totalGigachads: gigachadsData.totalCount,
                activeUsers: activeUsers.length,
                usersWithActivity: usersWithActivity,
                totalInteractions: totalInteractions,
                scoring: {
                    reviewReceived: 1,
                    reviewGiven: 2,
                    vouchReceived: 5,
                    vouchGiven: 10
                }
            },
            ranking: ranking.map((userScore, index) => ({
                rank: index + 1,
                user: {
                    id: userScore.user.id,
                    username: userScore.user.username,
                    displayName: userScore.user.displayName || userScore.user.username,
                    avatarUrl: userScore.user.avatarUrl,
                    profileId: userScore.user.profileId,
                    primaryAddress: userScore.user.primaryAddress,
                    profileUrl: `https://app.ethos.network/profile/x/${userScore.user.username}`,
                    twitterUrl: `https://x.com/${userScore.user.username}`
                },
                stats: {
                    reviewsReceived: userScore.reviewsReceived,
                    reviewsGiven: userScore.reviewsGiven,
                    vouchesReceived: userScore.vouchesReceived,
                    vouchesGiven: userScore.vouchesGiven,
                    attestationsReceived: userScore.attestationsReceived,
                    attestationsGiven: userScore.attestationsGiven,
                    totalScore: userScore.totalScore,
                    reviewsGivenAvatars: userScore.reviewsGivenAvatars,
                    reviewsReceivedAvatars: userScore.reviewsReceivedAvatars,
                    vouchesGivenAvatars: userScore.vouchesGivenAvatars,
                    vouchesReceivedAvatars: userScore.vouchesReceivedAvatars
                },
                lastActivity: userScore.lastActivity
            }))
        };

        const webDataPath = path.join(__dirname, 'gigachads-ranking.json');
        fs.writeFileSync(webDataPath, JSON.stringify(webData, null, 2));

        console.log(`\n💾 Data saved: gigachads-ranking.json`);
        console.log(`🌐 Ready for your website with Ethos + X links!`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        process.exit(1);
    }
}


analyzeAndRankGigachads().catch(console.error);