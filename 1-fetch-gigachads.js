// 1-fetch-gigachads.js
const fs = require('fs');
const path = require('path');

async function fetchAllGigachads() {
  console.log('🎯 RÉCUPÉRATION DES ABSTRACT GIGA CHADS\n');
  
  try {
    // 1. Récupérer tous les Giga Chads
    console.log('👥 Récupération des Abstract Giga Chads...');
    let allGigachads = [];
    let offset = 0;
    const limit = 50;
    
    while (true) {
      const response = await fetch(`https://api.ethos.network/api/v2/categories/26/users?limit=${limit}&offset=${offset}`, {
        headers: { "Accept": "*/*" }
      });
      
      if (!response.ok) {
        throw new Error(`Erreur API: ${response.status}`);
      }
      
      const data = await response.json();
      const users = data.users || [];
      allGigachads = allGigachads.concat(users);
      
      console.log(`📊 Récupérés: ${allGigachads.length} Abstract Giga Chads`);
      
      if (users.length < limit) break;
      offset += limit;
      
      // Pause pour éviter rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log(`✅ Total: ${allGigachads.length} Abstract Giga Chads récupérés !`);
    
    // 2. Préparer les données pour le fichier
    const gigachadsData = {
      totalCount: allGigachads.length,
      fetchedAt: new Date().toISOString(),
      users: allGigachads.map(user => ({
        id: user.id,
        profileId: user.profileId,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        description: user.description,
        score: user.score,
        primaryAddress: user.primaryAddress,
        addedAt: user.addedAt
      }))
    };
    
    // 3. Sauvegarder dans un fichier JSON
    const filename = 'gigachads-data.json';
    const filepath = path.join(__dirname, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(gigachadsData, null, 2));
    
    console.log(`💾 Données sauvegardées dans: ${filename}`);
    console.log(`📊 Statistiques:`);
    console.log(`   • Total utilisateurs: ${gigachadsData.totalCount}`);
    console.log(`   • Avec profileId: ${gigachadsData.users.filter(u => u.profileId !== null).length}`);
    console.log(`   • Sans profileId: ${gigachadsData.users.filter(u => u.profileId === null).length}`);
    
  } catch (error) {
    console.error('❌ Erreur:', error.message);
    process.exit(1);
  }
}

// 🚀 Lancer la récupération
fetchAllGigachads().catch(console.error);
