const fs = require('fs');

const DEBUG_MODE = true;

const debug = (message, data = null) => {
    if (DEBUG_MODE) {
        console.log(`[NEW-GIGACHADS] ${message}`);
        if (data) console.log(JSON.stringify(data, null, 2));
    }
};

async function generateNewGigachadsData() {
    debug('🔄 Starting new gigachads data generation...');
    
    try {
        // Charger les données Gigachads
        const gigachadsResponse = await fetch('https://raw.githubusercontent.com/guezito-dev/Ethos/main/gigachads-data.json');
        if (!gigachadsResponse.ok) {
            throw new Error(`HTTP error! status: ${gigachadsResponse.status}`);
        }
        
        const gigachadsData = await gigachadsResponse.json();
        
        if (!gigachadsData || !gigachadsData.users || gigachadsData.users.length === 0) {
            throw new Error('No Gigachads data available');
        }
        
        const recentGigachads = gigachadsData.users
            .filter(user => user.profileId) 
            .sort((a, b) => b.profileId - a.profileId) 
            .slice(0, 15);
        
        debug(`✅ Recent Gigachads found: ${recentGigachads.length}`);
        
        if (recentGigachads.length === 0) {
            throw new Error('No recent Gigachads found');
        }
        
        const profileIds = recentGigachads.map(g => g.profileId);
        
        // Fetch profiles data from API
        const profilesResponse = await fetch('https://api.ethos.network/api/v1/profiles', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                ids: profileIds,
                limit: 15,
                offset: 0,
                useCache: true
            })
        });
        
        if (!profilesResponse.ok) {
            throw new Error(`API error: ${profilesResponse.status}`);
        }
        
        const profilesData = await profilesResponse.json();
        
        if (!profilesData.ok || !profilesData.data || !profilesData.data.values) {
            throw new Error('Invalid profiles data structure');
        }
        
        // 🔥 CROISER LES DONNÉES AVEC invitedBy
        const gigachadsWithRealDates = recentGigachads.map(gigachad => {
            const profileData = profilesData.data.values.find(p => p.id === gigachad.profileId);
            if (profileData && profileData.createdAt) {
                const realCreatedAt = profileData.createdAt * 1000;
                
                return {
                    ...gigachad,
                    // ✅ RÉCUPÉRER invitedBy DEPUIS L'API
                    invitedBy: profileData.invitedBy || null,
                    realCreatedAt,
                    profileData: {
                        createdAt: profileData.createdAt,
                        updatedAt: profileData.updatedAt,
                        invitedBy: profileData.invitedBy,
                        invitesAvailable: profileData.invitesAvailable
                    }
                };
            }
            return null;
        }).filter(Boolean);
        
        // Trier par date de création (plus récent en premier)
        const sortedGigachads = gigachadsWithRealDates
            .sort((a, b) => b.realCreatedAt - a.realCreatedAt)
            .slice(0, 10);
        
        debug(`✅ Sorted Gigachads with real dates: ${sortedGigachads.length}`);
        
        if (sortedGigachads.length === 0) {
            throw new Error('No Gigachads with valid dates found');
        }
        
        // Enrichir les données
        const enrichedGigachads = sortedGigachads.map(gigachad => {
            const displayName = gigachad.displayName || gigachad.username || 'Unknown';
            const avatarUrl = gigachad.avatarUrl || 'https://via.placeholder.com/35';
            const username = gigachad.username || displayName;
            
            // Calculer le temps écoulé
            const now = Date.now();
            const diffInMs = now - gigachad.realCreatedAt;
            const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));
            const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
            const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
            
            let timeAgo;
            if (diffInDays > 0) {
                timeAgo = `${diffInDays}d ago`;
            } else if (diffInHours > 0) {
                timeAgo = `${diffInHours}h ago`;
            } else if (diffInMinutes > 0) {
                timeAgo = `${diffInMinutes}m ago`;
            } else {
                timeAgo = 'Just now';
            }
            
            const profileUrl = `https://app.ethos.network/profile/x/${username}`;
            
            return {
                profileId: gigachad.profileId,
                username: gigachad.username,
                displayName: gigachad.displayName,
                avatarUrl: gigachad.avatarUrl,
                invitedBy: gigachad.invitedBy, // ✅ MAINTENANT DISPONIBLE
                score: gigachad.score,
                realCreatedAt: gigachad.realCreatedAt,
                timeAgo: timeAgo,
                profileUrl: profileUrl,
                isNew: true,
                profileData: gigachad.profileData
            };
        });
        
        // ✅ DEBUG POUR VÉRIFIER invitedBy
        debug('🔍 Sample enriched gigachad:', {
            username: enrichedGigachads[0]?.username,
            invitedBy: enrichedGigachads[0]?.invitedBy,
            timeAgo: enrichedGigachads[0]?.timeAgo
        });
        
        // Générer le JSON
        const jsonOutput = {
            success: true,
            totalProcessed: recentGigachads.length,
            apiProfilesFetched: profilesData.data.values.length,
            finalResults: enrichedGigachads.length,
            generatedAt: new Date().toISOString(),
            lastUpdated: new Date().toLocaleString('fr-FR', { timeZone: 'Europe/Paris' }),
            data: enrichedGigachads
        };
        
        // Sauvegarder le fichier
        fs.writeFileSync('new-gigachads-data.json', JSON.stringify(jsonOutput, null, 2));
        
        debug('✅ New gigachads data generated successfully!');
        debug('📊 Statistics:', {
            totalProcessed: recentGigachads.length,
            apiProfilesFetched: profilesData.data.values.length,
            finalResults: enrichedGigachads.length
        });
        
        // ✅ VÉRIFIER LE FICHIER GÉNÉRÉ
        const savedData = JSON.parse(fs.readFileSync('new-gigachads-data.json', 'utf8'));
        debug('✅ Saved data sample:', {
            username: savedData.data[0]?.username,
            invitedBy: savedData.data[0]?.invitedBy,
            timeAgo: savedData.data[0]?.timeAgo
        });
        
    } catch (error) {
        debug('❌ Error generating new gigachads data:', error);
        
        // Générer un JSON d'erreur
        const errorJson = {
            success: false,
            error: error.message,
            generatedAt: new Date().toISOString(),
            data: []
        };
        
        fs.writeFileSync('new-gigachads-data.json', JSON.stringify(errorJson, null, 2));
    }
}

// Exécuter si appelé directement
if (require.main === module) {
    generateNewGigachadsData();
}

module.exports = { generateNewGigachadsData };
