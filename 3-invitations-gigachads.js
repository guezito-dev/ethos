const fs = require('fs');
const DEBUG_MODE = true;

function debug(message, data = null) {
    if (DEBUG_MODE) {
        console.log(`[INVITATIONS-GENERATOR] ${message}`, data);
    }
}

async function loadGigachadsForInvitations() {
    try {
        debug('Loading Gigachads data for invitations...');
        const response = await fetch('https://raw.githubusercontent.com/guezito-dev/Ethos/main/gigachads-data.json');
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        const data = await response.json();
        debug('✅ Gigachads data for invitations loaded', { count: data.users?.length || 0 });
        return data;
    } catch (error) {
        debug('❌ Error loading Gigachads data for invitations:', error);
        return null;
    }
}

async function loadInvitationsData() {
    try {
        debug('Loading ALL invitations data like Ethoscope...');
        
        let allProfilesWithInvites = [];
        let offset = 0;
        const limit = 100; 
        let hasMore = true;
        let totalFetched = 0;
        
        while (hasMore && totalFetched < 1000) { 
            debug(`Fetching profiles batch - offset: ${offset}, limit: ${limit}`);
            
            const apiUrl = `https://api.ethos.network/api/v1/profiles/directory?limit=${limit}&offset=${offset}&sortField=invitesAvailable`;
            
            const response = await fetch(apiUrl, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (compatible; EthosClient/1.0)'
                }
            });
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            if (data.ok && data.data.values) {
                const profilesWithInvites = data.data.values.filter(profile => 
                    profile.invitesAvailable && profile.invitesAvailable >= 1
                );
                
                allProfilesWithInvites = allProfilesWithInvites.concat(profilesWithInvites);
                totalFetched += data.data.values.length;
                
                debug(`✅ Batch fetched: ${data.data.values.length} profiles, ${profilesWithInvites.length} with invites`);
                
                hasMore = data.data.values.length === limit && profilesWithInvites.length > 0;
                offset += limit;
                
                if (hasMore) {
                    await new Promise(resolve => setTimeout(resolve, 200));
                }
            } else {
                debug('❌ Invalid response format');
                hasMore = false;
            }
        }
        
        debug('✅ All invitations data loaded', { 
            totalProfilesWithInvites: allProfilesWithInvites.length,
            totalInvites: allProfilesWithInvites.reduce((sum, p) => sum + (p.invitesAvailable || 0), 0)
        });
        
        return allProfilesWithInvites;
        
    } catch (error) {
        debug('❌ Error loading invitations data:', error);
        return [];
    }
}

async function generateInvitationsData() {
    try {
        debug('🔄 Starting invitations generation...');
        
        const [gigachadsData, allProfilesWithInvites] = await Promise.all([
            loadGigachadsForInvitations(),
            loadInvitationsData()
        ]);
        
        if (!gigachadsData || !allProfilesWithInvites || allProfilesWithInvites.length === 0) {
            throw new Error('No data available');
        }
        
        
        const gigachadProfileIds = new Set(
            gigachadsData.users
                .filter(user => user.profileId !== null && user.profileId !== undefined)
                .map(user => user.profileId)
        );
        
        debug('📊 Gigachads found:', gigachadProfileIds.size);
        
        
        const seenProfileIds = new Set();
        const seenUsernames = new Set();
        
        const gigachadsWithInvites = allProfilesWithInvites
            .filter(profile => {
                const profileId = profile.actor?.profileId;
                const username = profile.actor?.name?.toLowerCase();
                
                if (!profileId || !gigachadProfileIds.has(profileId) || profile.invitesAvailable < 1) {
                    return false;
                }
                
                if (seenProfileIds.has(profileId) || seenUsernames.has(username)) {
                    debug(`🔄 Duplicate found - ProfileId: ${profileId}, Username: ${username}`);
                    return false;
                }
                
                seenProfileIds.add(profileId);
                seenUsernames.add(username);
                return true;
            })
            .sort((a, b) => b.invitesAvailable - a.invitesAvailable)
            .slice(0, 5); 
        
        debug('✅ Unique Gigachads with invites found:', gigachadsWithInvites.length);
        
        const jsonData = {
            lastUpdated: new Date().toISOString(),
            totalGigachads: gigachadProfileIds.size,
            gigachadsWithInvites: gigachadsWithInvites.length,
            totalInvites: gigachadsWithInvites.reduce((sum, p) => sum + (p.invitesAvailable || 0), 0),
            data: gigachadsWithInvites.map(profile => {
                const gigachad = gigachadsData.users.find(user => user.profileId === profile.actor.profileId);
                
                const displayName = gigachad?.displayName || profile.actor?.name || 'Unknown';
                const avatarUrl = gigachad?.avatarUrl || profile.actor?.avatar || 'https://via.placeholder.com/35';
                const inviteCount = profile.invitesAvailable || 0;
                const username = gigachad?.username || profile.actor?.name || displayName;
                
                return {
                    profileId: profile.actor.profileId,
                    displayName: displayName,
                    username: username,
                    avatarUrl: avatarUrl,
                    invitesAvailable: inviteCount,
                    inviteText: `${inviteCount} invite${inviteCount > 1 ? 's' : ''}`,
                    xUrl: `https://x.com/${username}`
                };
            })
        };
        
        
        const fileName = 'invitations-data.json';
        fs.writeFileSync(fileName, JSON.stringify(jsonData, null, 2));
        
        debug('✅ JSON file generated successfully:', fileName);
        console.log(`📄 File saved: ${fileName}`);
        console.log(`📊 Found ${jsonData.data.length} Gigachads with ${jsonData.totalInvites} total invites`);
        
        return jsonData;
        
    } catch (error) {
        debug('❌ Error generating invitations data:', error);
        throw error;
    }
}


if (require.main === module) {
    generateInvitationsData()
        .then(data => {
            console.log('🎉 Invitations data generated successfully!');
            process.exit(0);
        })
        .catch(error => {
            console.error('❌ Failed to generate invitations data:', error);
            process.exit(1);
        });
}

module.exports = { generateInvitationsData };
