// 1-fetch-gigachads.js
const fs = require('fs');
const path = require('path');

async function fetchAllGigachads() {
  console.log('🎯 RÉCUPÉRATION DES ABSTRACT GIGA CHADS\n');
  
  try {
    // 1. 🚀 APPEL UNIQUE AVEC LIMITE ÉLEVÉE
    console.log('👥 Récupération de tous les Abstract Giga Chads...');
    
    const response = await fetch('https://api.ethos.network/api/v2/categories/26/users?limit=1000', {
      headers: { "Accept": "*/*" }
    });
    
    if (!response.ok) {
      throw new Error(`Erreur API: ${response.status}`);
    }
    
    const data = await response.json();
    let allGigachads = data.users || [];
    
    console.log(`✅ Total: ${allGigachads.length} Abstract Giga Chads récupérés !`);
    
    // 2. 🔍 VÉRIFICATION DE SÉCURITÉ DES DOUBLONS
    console.log('\n🕵️ VÉRIFICATION DE SÉCURITÉ DES DOUBLONS...');
    const auditResult = auditDuplicates(allGigachads);
    
    let cleanupResult = { removedCount: 0 }; // 🔧 DÉCLARATION MANQUANTE
    
    if (auditResult.hasDuplicates) {
      console.log('⚠️ Doublons détectés dans la réponse API - nettoyage...');
      cleanupResult = cleanupDuplicates(allGigachads, auditResult);
      allGigachads = cleanupResult.cleanedUsers;
      console.log(`🧹 ${cleanupResult.removedCount} doublons supprimés`);
    } else {
      console.log('✅ Aucun doublon détecté - Données parfaitement propres !');
    }
    
    // 3. Vérifier les profileIds manquants
    console.log('\n🔍 VÉRIFICATION DES PROFILE IDS MANQUANTS...');
    const usersWithMissingProfileIds = allGigachads.filter(user => user.profileId === null);
    console.log(`   • Utilisateurs sans profileId: ${usersWithMissingProfileIds.length}/${allGigachads.length}`);
    
    let recoveredCount = 0;
    if (usersWithMissingProfileIds.length > 0) {
      console.log('🔄 Tentative de récupération des profileIds...');
      const { updatedUsers, foundCount } = await checkMissingProfileIds(usersWithMissingProfileIds);
      recoveredCount = foundCount;
      
      if (recoveredCount > 0) {
        // Fusionner les utilisateurs mis à jour avec les autres
        const usersWithProfileIds = allGigachads.filter(user => user.profileId !== null);
        allGigachads = [...usersWithProfileIds, ...updatedUsers];
        console.log(`✅ ${recoveredCount} profileIds récupérés !`);
      } else {
        console.log('⚠️ Aucun profileId supplémentaire trouvé');
      }
    }
    
    // 4. Analyser les données
    console.log('\n📊 ANALYSE DES DONNÉES...');
    const stats = analyzeGigachadsData(allGigachads);
    displayStats(stats);
    
    // 5. Préparer les données pour le fichier
    const gigachadsData = {
      metadata: {
        totalCount: allGigachads.length,
        fetchedAt: new Date().toISOString(),
        fetchMethod: 'single-call-high-limit',
        recoveredProfilesCount: recoveredCount,
        duplicatesFound: auditResult.hasDuplicates ? 'yes' : 'no',
        duplicatesRemoved: cleanupResult.removedCount, // 🔧 MAINTENANT DÉFINI
        apiUrl: 'https://api.ethos.network/api/v2/categories/26/users?limit=1000'
      },
      statistics: stats,
      users: allGigachads.map(user => ({
        id: user.id,
        profileId: user.profileId,
        username: user.username,
        displayName: user.displayName,
        avatarUrl: user.avatarUrl,
        description: user.description,
        score: user.score,
        primaryAddress: user.primaryAddress,
        addedAt: user.addedAt,
        // Champs supplémentaires si disponibles
        ...(user.socialLinks && { socialLinks: user.socialLinks }),
        ...(user.verified && { verified: user.verified }),
        ...(user.badges && { badges: user.badges })
      }))
    };
    
    // 6. Sauvegarder dans un fichier JSON
    const filename = 'gigachads-data.json';
    const filepath = path.join(__dirname, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(gigachadsData, null, 2));
    
    console.log(`\n💾 DONNÉES SAUVEGARDÉES AVEC SUCCÈS !`);
    console.log(`📁 Fichier: ${filename}`);
    console.log(`📏 Taille: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
    
    // 7. Résumé final
    console.log('\n🎉 RÉSUMÉ FINAL:');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Utilisateurs récupérés: ${allGigachads.length}`);
    console.log(`🔄 ProfileIds récupérés: ${recoveredCount}`);
    console.log(`🧹 Doublons supprimés: ${cleanupResult.removedCount}`);
    console.log(`🧹 Méthode: Appel unique avec limite élevée`);
    console.log(`⏱️ Terminé: ${new Date().toLocaleString()}`);
    console.log('═══════════════════════════════════════');
    
    return gigachadsData;
    
  } catch (error) {
    console.error('❌ ERREUR LORS DE LA RÉCUPÉRATION:', error.message);
    console.error('🔍 Stack trace:', error.stack);
    process.exit(1);
  }
}

/**
 * 🔍 AUDIT DES DOUBLONS
 */
function auditDuplicates(users) {
  const idsMap = new Map();
  const profileIdsMap = new Map();
  const usernamesMap = new Map();
  const addressesMap = new Map();
  const displayNamesMap = new Map();
  
  const duplicates = {
    byId: [],
    byProfileId: [],
    byUsername: [],
    byAddress: [],
    byDisplayName: []
  };
  
  users.forEach((user, index) => {
    // Vérifier doublons par ID
    if (user.id) {
      if (idsMap.has(user.id)) {
        duplicates.byId.push({
          id: user.id,
          indexes: [idsMap.get(user.id), index],
          usernames: [users[idsMap.get(user.id)].username, user.username]
        });
      } else {
        idsMap.set(user.id, index);
      }
    }
    
    // Vérifier doublons par profileId
    if (user.profileId) {
      if (profileIdsMap.has(user.profileId)) {
        duplicates.byProfileId.push({
          profileId: user.profileId,
          indexes: [profileIdsMap.get(user.profileId), index],
          usernames: [users[profileIdsMap.get(user.profileId)].username, user.username]
        });
      } else {
        profileIdsMap.set(user.profileId, index);
      }
    }
    
    // Vérifier doublons par username
    if (user.username) {
      const lowerUsername = user.username.toLowerCase();
      if (usernamesMap.has(lowerUsername)) {
        duplicates.byUsername.push({
          username: user.username,
          indexes: [usernamesMap.get(lowerUsername), index],
          ids: [users[usernamesMap.get(lowerUsername)].id, user.id]
        });
      } else {
        usernamesMap.set(lowerUsername, index);
      }
    }
    
    // Vérifier doublons par address
    if (user.primaryAddress) {
      const lowerAddress = user.primaryAddress.toLowerCase();
      if (addressesMap.has(lowerAddress)) {
        duplicates.byAddress.push({
          address: user.primaryAddress,
          indexes: [addressesMap.get(lowerAddress), index],
          usernames: [users[addressesMap.get(lowerAddress)].username, user.username]
        });
      } else {
        addressesMap.set(lowerAddress, index);
      }
    }
    
    // Vérifier doublons par displayName
    if (user.displayName) {
      const lowerDisplayName = user.displayName.toLowerCase();
      if (displayNamesMap.has(lowerDisplayName)) {
        duplicates.byDisplayName.push({
          displayName: user.displayName,
          indexes: [displayNamesMap.get(lowerDisplayName), index],
          usernames: [users[displayNamesMap.get(lowerDisplayName)].username, user.username]
        });
      } else {
        displayNamesMap.set(lowerDisplayName, index);
      }
    }
  });
  
  const hasDuplicates = Object.values(duplicates).some(arr => arr.length > 0);
  
  return { hasDuplicates, duplicates };
}

/**
 * 🧹 NETTOYAGE DES DOUBLONS
 */
function cleanupDuplicates(users, auditResult) {
  const toRemove = new Set();
  
  // Marquer les doublons pour suppression (garder le premier)
  Object.values(auditResult.duplicates).forEach(duplicateArray => {
    duplicateArray.forEach(duplicate => {
      if (duplicate.indexes && duplicate.indexes.length > 1) {
        // Garder le premier, supprimer les autres
        duplicate.indexes.slice(1).forEach(index => toRemove.add(index));
      }
    });
  });
  
  // Filtrer les utilisateurs
  const cleanedUsers = users.filter((user, index) => !toRemove.has(index));
  
  console.log(`🧹 Doublons supprimés: ${toRemove.size}`);
  if (toRemove.size > 0) {
    console.log(`   • Par ID: ${auditResult.duplicates.byId.length}`);
    console.log(`   • Par ProfileId: ${auditResult.duplicates.byProfileId.length}`);
    console.log(`   • Par Username: ${auditResult.duplicates.byUsername.length}`);
    console.log(`   • Par Address: ${auditResult.duplicates.byAddress.length}`);
    console.log(`   • Par DisplayName: ${auditResult.duplicates.byDisplayName.length}`);
  }
  
  return { 
    cleanedUsers, 
    removedCount: toRemove.size 
  };
}

/**
 * 📊 ANALYSER LES DONNÉES
 */
function analyzeGigachadsData(users) {
  const stats = {
    total: users.length,
    withProfileId: users.filter(u => u.profileId !== null).length,
    withoutProfileId: users.filter(u => u.profileId === null).length,
    withUsername: users.filter(u => u.username).length,
    withDisplayName: users.filter(u => u.displayName).length,
    withDescription: users.filter(u => u.description).length,
    withAvatar: users.filter(u => u.avatarUrl).length,
    withScore: users.filter(u => u.score !== null && u.score !== undefined).length,
    withAddress: users.filter(u => u.primaryAddress).length,
    averageScore: 0,
    scoreDistribution: {
      high: 0,    // > 80
      medium: 0,  // 20-80
      low: 0      // < 20
    }
  };
  
  // Calculer score moyen et distribution
  const usersWithScore = users.filter(u => u.score !== null && u.score !== undefined);
  if (usersWithScore.length > 0) {
    stats.averageScore = usersWithScore.reduce((sum, u) => sum + u.score, 0) / usersWithScore.length;
    
    usersWithScore.forEach(u => {
      if (u.score > 80) stats.scoreDistribution.high++;
      else if (u.score >= 20) stats.scoreDistribution.medium++;
      else stats.scoreDistribution.low++;
    });
  }
  
  return stats;
}

/**
 * 📈 AFFICHER LES STATISTIQUES
 */
function displayStats(stats) {
  console.log(`📊 Statistiques complètes:`);
  console.log(`   • Total utilisateurs: ${stats.total}`);
  console.log(`   • Avec ProfileId: ${stats.withProfileId} (${(stats.withProfileId/stats.total*100).toFixed(1)}%)`);
  console.log(`   • Sans ProfileId: ${stats.withoutProfileId} (${(stats.withoutProfileId/stats.total*100).toFixed(1)}%)`);
  console.log(`   • Avec Username: ${stats.withUsername} (${(stats.withUsername/stats.total*100).toFixed(1)}%)`);
  console.log(`   • Avec DisplayName: ${stats.withDisplayName} (${(stats.withDisplayName/stats.total*100).toFixed(1)}%)`);
  console.log(`   • Avec Description: ${stats.withDescription} (${(stats.withDescription/stats.total*100).toFixed(1)}%)`);
  console.log(`   • Avec Avatar: ${stats.withAvatar} (${(stats.withAvatar/stats.total*100).toFixed(1)}%)`);
  console.log(`   • Avec Score: ${stats.withScore} (${(stats.withScore/stats.total*100).toFixed(1)}%)`);
  console.log(`   • Avec Address: ${stats.withAddress} (${(stats.withAddress/stats.total*100).toFixed(1)}%)`);
  
  if (stats.withScore > 0) {
    console.log(`   • Score moyen: ${stats.averageScore.toFixed(2)}`);
    console.log(`   • Distribution des scores:`);
    console.log(`     - Élevé (>80): ${stats.scoreDistribution.high}`);
    console.log(`     - Moyen (20-80): ${stats.scoreDistribution.medium}`);
    console.log(`     - Bas (<20): ${stats.scoreDistribution.low}`);
  }
}

/**
 * 🔄 VÉRIFIER LES PROFILEIDS MANQUANTS
 */
async function checkMissingProfileIds(usersWithMissingProfileIds) {
  console.log('🔄 Vérification des profileIds via l\'API /users/by/x...');
  
  const batchSize = 10;
  const updatedUsers = [];
  let foundProfiles = 0;
  
  for (let i = 0; i < usersWithMissingProfileIds.length; i += batchSize) {
    const batch = usersWithMissingProfileIds.slice(i, i + batchSize);
    const usernames = batch
      .map(user => user.username)
      .filter(username => username && username.trim() !== '');
    
    if (usernames.length === 0) {
      updatedUsers.push(...batch);
      continue;
    }
    
    try {
      console.log(`   📡 Lot ${Math.floor(i/batchSize) + 1}/${Math.ceil(usersWithMissingProfileIds.length/batchSize)} (${usernames.length} usernames)`);
      
      const response = await fetch('https://api.ethos.network/api/v2/users/by/x', {
        method: 'POST',
        headers: {
          "Content-Type": "application/json",
          "Accept": "application/json"
        },
        body: JSON.stringify({
          "accountIdsOrUsernames": usernames
        })
      });
      
      if (!response.ok) {
        console.warn(`⚠️ Erreur API pour le lot ${Math.floor(i/batchSize) + 1}: ${response.status}`);
        updatedUsers.push(...batch);
        continue;
      }
      
      const ethosUsers = await response.json();
      
      for (const originalUser of batch) {
        if (!originalUser.username) {
          updatedUsers.push(originalUser);
          continue;
        }
        
        const ethosUser = ethosUsers.find(eu => 
          eu.username && eu.username.toLowerCase() === originalUser.username.toLowerCase()
        );
        
        if (ethosUser && ethosUser.profileId) {
          console.log(`   ✅ ProfileId trouvé pour ${originalUser.username}: ${ethosUser.profileId}`);
          
          updatedUsers.push({
            ...originalUser,
            profileId: ethosUser.profileId,
            displayName: ethosUser.displayName || originalUser.displayName,
            avatarUrl: ethosUser.avatarUrl || originalUser.avatarUrl,
            description: ethosUser.description || originalUser.description,
            score: ethosUser.score !== undefined ? ethosUser.score : originalUser.score
          });
          foundProfiles++;
        } else {
          updatedUsers.push(originalUser);
        }
      }
      
      // Pause entre les lots
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.warn(`⚠️ Erreur lors de la vérification du lot ${Math.floor(i/batchSize) + 1}:`, error.message);
      updatedUsers.push(...batch);
    }
  }
  
  console.log(`🎉 ProfileIds trouvés: ${foundProfiles}/${usersWithMissingProfileIds.length}`);
  
  return { updatedUsers, foundCount: foundProfiles };
}

// 🚀 LANCEMENT DU SCRIPT
console.log('🚀 DÉMARRAGE DU SCRIPT DE RÉCUPÉRATION...');
console.log('⏱️ ', new Date().toLocaleString());
console.log('');

fetchAllGigachads()
  .then(data => {
    console.log('\n🎉 SCRIPT TERMINÉ AVEC SUCCÈS !');
    console.log(`📊 ${data.metadata.totalCount} utilisateurs récupérés`);
  })
  .catch(error => {
    console.error('\n❌ ERREUR FATALE:', error.message);
    process.exit(1);
  });
