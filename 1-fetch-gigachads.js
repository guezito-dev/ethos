const fs = require('fs');
const path = require('path');

async function fetchAllGigachads() {
  console.log('🎯 FETCHING ABSTRACT GIGA CHADS\n');
  
  try {
    
    console.log('👥 Fetching all Abstract Giga Chads...');
    
    const response = await fetch('https://api.ethos.network/api/v2/categories/26/users?limit=1000', {
      headers: { "Accept": "*/*" }
    });
    
    if (!response.ok) {
      throw new Error(`API Error: ${response.status}`);
    }
    
    const data = await response.json();
    let allGigachads = data.users || [];
    
    console.log(`✅ Total: ${allGigachads.length} Abstract Giga Chads fetched!`);
    
    
    console.log('\n🕵️ SECURITY CHECK FOR DUPLICATES...');
    const auditResult = auditDuplicates(allGigachads);
    
    let cleanupResult = { removedCount: 0 }; 
    
    if (auditResult.hasDuplicates) {
      console.log('⚠️ Duplicates detected in API response - cleaning...');
      cleanupResult = cleanupDuplicates(allGigachads, auditResult);
      allGigachads = cleanupResult.cleanedUsers;
      console.log(`🧹 ${cleanupResult.removedCount} duplicates removed`);
    } else {
      console.log('✅ No duplicates detected - Data perfectly clean!');
    }
    
    
    console.log('\n🔍 CHECKING FOR MISSING PROFILE IDS...');
    const usersWithMissingProfileIds = allGigachads.filter(user => user.profileId === null);
    console.log(`   • Users without profileId: ${usersWithMissingProfileIds.length}/${allGigachads.length}`);
    
    let recoveredCount = 0;
    if (usersWithMissingProfileIds.length > 0) {
      console.log('🔄 Attempting to recover profileIds...');
      const { updatedUsers, foundCount } = await checkMissingProfileIds(usersWithMissingProfileIds);
      recoveredCount = foundCount;
      
      if (recoveredCount > 0) {
        
        const usersWithProfileIds = allGigachads.filter(user => user.profileId !== null);
        allGigachads = [...usersWithProfileIds, ...updatedUsers];
        console.log(`✅ ${recoveredCount} profileIds recovered!`);
      } else {
        console.log('⚠️ No additional profileId found');
      }
    }
    
    
    console.log('\n📊 DATA ANALYSIS...');
    const stats = analyzeGigachadsData(allGigachads);
    displayStats(stats);
    
    
    const gigachadsData = {
      metadata: {
        totalCount: allGigachads.length,
        fetchedAt: new Date().toISOString(),
        fetchMethod: 'single-call-high-limit',
        recoveredProfilesCount: recoveredCount,
        duplicatesFound: auditResult.hasDuplicates ? 'yes' : 'no',
        duplicatesRemoved: cleanupResult.removedCount, 
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
        
        ...(user.socialLinks && { socialLinks: user.socialLinks }),
        ...(user.verified && { verified: user.verified }),
        ...(user.badges && { badges: user.badges })
      }))
    };
    
    
    const filename = 'gigachads-data.json';
    const filepath = path.join(__dirname, filename);
    
    fs.writeFileSync(filepath, JSON.stringify(gigachadsData, null, 2));
    
    console.log(`\n💾 DATA SAVED SUCCESSFULLY!`);
    console.log(`📁 File: ${filename}`);
    console.log(`📏 Size: ${(fs.statSync(filepath).size / 1024).toFixed(2)} KB`);
    
    
    console.log('\n🎉 FINAL SUMMARY:');
    console.log('═══════════════════════════════════════');
    console.log(`✅ Users fetched: ${allGigachads.length}`);
    console.log(`🔄 ProfileIds recovered: ${recoveredCount}`);
    console.log(`🧹 Duplicates removed: ${cleanupResult.removedCount}`);
    console.log(`🧹 Method: Single call with high limit`);
    console.log(`⏱️ Completed: ${new Date().toLocaleString('en-US')}`);
    console.log('═══════════════════════════════════════');
    
    return gigachadsData;
    
  } catch (error) {
    console.error('❌ ERROR DURING FETCH:', error.message);
    console.error('🔍 Stack trace:', error.stack);
    process.exit(1);
  }
}


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

function cleanupDuplicates(users, auditResult) {
  const toRemove = new Set();
  
 
  Object.values(auditResult.duplicates).forEach(duplicateArray => {
    duplicateArray.forEach(duplicate => {
      if (duplicate.indexes && duplicate.indexes.length > 1) {
        
        duplicate.indexes.slice(1).forEach(index => toRemove.add(index));
      }
    });
  });
  
  
  const cleanedUsers = users.filter((user, index) => !toRemove.has(index));
  
  console.log(`🧹 Duplicates removed: ${toRemove.size}`);
  if (toRemove.size > 0) {
    console.log(`   • By ID: ${auditResult.duplicates.byId.length}`);
    console.log(`   • By ProfileId: ${auditResult.duplicates.byProfileId.length}`);
    console.log(`   • By Username: ${auditResult.duplicates.byUsername.length}`);
    console.log(`   • By Address: ${auditResult.duplicates.byAddress.length}`);
    console.log(`   • By DisplayName: ${auditResult.duplicates.byDisplayName.length}`);
  }
  
  return { 
    cleanedUsers, 
    removedCount: toRemove.size 
  };
}

/**
 * 📊 ANALYZE DATA
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
      untrusted: 0,    // 1 - 799
      questionable: 0, // 800 - 1199
      neutral: 0,      // 1200 - 1599
      reputableI: 0,   // 1600 - 1799
      reputableII: 0,  // 1800 - 1999
      exemplaryI: 0,   // 2000 - 2199
      exemplaryII: 0,  // 2200 - 2399
      reveredI: 0,     // 2400 - 2599
      reveredII: 0     // 2600 +
    }
  };
  
  
  const usersWithScore = users.filter(u => u.score !== null && u.score !== undefined);
  if (usersWithScore.length > 0) {
    stats.averageScore = usersWithScore.reduce((sum, u) => sum + u.score, 0) / usersWithScore.length;
    
    usersWithScore.forEach(u => {
      if (u.score >= 1 && u.score <= 799) stats.scoreDistribution.untrusted++;
      else if (u.score >= 800 && u.score <= 1199) stats.scoreDistribution.questionable++;
      else if (u.score >= 1200 && u.score <= 1599) stats.scoreDistribution.neutral++;
      else if (u.score >= 1600 && u.score <= 1799) stats.scoreDistribution.reputableI++;
      else if (u.score >= 1800 && u.score <= 1999) stats.scoreDistribution.reputableII++;
      else if (u.score >= 2000 && u.score <= 2199) stats.scoreDistribution.exemplaryI++;
      else if (u.score >= 2200 && u.score <= 2399) stats.scoreDistribution.exemplaryII++;
      else if (u.score >= 2400 && u.score <= 2599) stats.scoreDistribution.reveredI++;
      else if (u.score >= 2600) stats.scoreDistribution.reveredII++;
    });
  }
  
  return stats;
}

/**
 * 📈 DISPLAY STATISTICS
 */
function displayStats(stats) {
  console.log(`📊 Complete statistics:`);
  console.log(`   • Total users: ${stats.total}`);
  console.log(`   • With ProfileId: ${stats.withProfileId} (${(stats.withProfileId/stats.total*100).toFixed(1)}%)`);
  console.log(`   • Without ProfileId: ${stats.withoutProfileId} (${(stats.withoutProfileId/stats.total*100).toFixed(1)}%)`);
  console.log(`   • With Username: ${stats.withUsername} (${(stats.withUsername/stats.total*100).toFixed(1)}%)`);
  console.log(`   • With DisplayName: ${stats.withDisplayName} (${(stats.withDisplayName/stats.total*100).toFixed(1)}%)`);
  console.log(`   • With Description: ${stats.withDescription} (${(stats.withDescription/stats.total*100).toFixed(1)}%)`);
  console.log(`   • With Avatar: ${stats.withAvatar} (${(stats.withAvatar/stats.total*100).toFixed(1)}%)`);
  console.log(`   • With Score: ${stats.withScore} (${(stats.withScore/stats.total*100).toFixed(1)}%)`);
  console.log(`   • With Address: ${stats.withAddress} (${(stats.withAddress/stats.total*100).toFixed(1)}%)`);
  
  if (stats.withScore > 0) {
    console.log(`   • Average score: ${stats.averageScore.toFixed(2)}`);
    console.log(`   • Score distribution:`);
    console.log(`     - Untrusted (1 - 799): ${stats.scoreDistribution.untrusted}`);
    console.log(`     - Questionable (800 - 1199): ${stats.scoreDistribution.questionable}`);
    console.log(`     - Neutral (1200 - 1599): ${stats.scoreDistribution.neutral}`);
    console.log(`     - Reputable I (1600 - 1799): ${stats.scoreDistribution.reputableI}`);
    console.log(`     - Reputable II (1800 - 1999): ${stats.scoreDistribution.reputableII}`);
    console.log(`     - Exemplary I (2000 - 2199): ${stats.scoreDistribution.exemplaryI}`);
    console.log(`     - Exemplary II (2200 - 2399): ${stats.scoreDistribution.exemplaryII}`);
    console.log(`     - Revered I (2400 - 2599): ${stats.scoreDistribution.reveredI}`);
    console.log(`     - Revered II (2600 + ): ${stats.scoreDistribution.reveredII}`);
  }
}

/**
 * 🔄 CHECK MISSING PROFILE IDS
 */
async function checkMissingProfileIds(usersWithMissingProfileIds) {
  console.log('🔄 Checking profileIds via API /users/by/x...');
  
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
      console.log(`   📡 Batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(usersWithMissingProfileIds.length/batchSize)} (${usernames.length} usernames)`);
      
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
        console.warn(`⚠️ API error for batch ${Math.floor(i/batchSize) + 1}: ${response.status}`);
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
          console.log(`   ✅ ProfileId found for ${originalUser.username}: ${ethosUser.profileId}`);
          
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
      
      
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.warn(`⚠️ Error during batch verification ${Math.floor(i/batchSize) + 1}:`, error.message);
      updatedUsers.push(...batch);
    }
  }
  
  console.log(`🎉 ProfileIds found: ${foundProfiles}/${usersWithMissingProfileIds.length}`);
  
  return { updatedUsers, foundCount: foundProfiles };
}


console.log('🚀 STARTING FETCH SCRIPT...');
console.log('⏱️ ', new Date().toLocaleString('en-US'));
console.log('');

fetchAllGigachads()
  .then(data => {
    console.log('\n🎉 SCRIPT COMPLETED SUCCESSFULLY!');
    console.log(`📊 ${data.metadata.totalCount} users fetched`);
  })
  .catch(error => {
    console.error('\n❌ FATAL ERROR:', error.message);
    process.exit(1);
  });