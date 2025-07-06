// ========== JSON AUTO-REFRESH TABLE ==========
const GITHUB_JSON_URL = 'https://raw.githubusercontent.com/guezito-dev/ethos/main/gigachads-ranking.json';

let autoRefreshInterval;
let isAutoRefreshEnabled = false;
let lastJsonUpdate = 0;

// Debug function
function debug(...args) {
    console.log('🔍 [TABLE DEBUG]', ...args);
}

// ========== JSON Functions ==========
async function fetchGigachadsData() {
    try {
        const response = await fetch(GITHUB_JSON_URL + '?t=' + Date.now()); // Cache busting
        if (response.ok) {
            const data = await response.json();
            lastJsonUpdate = Date.now();
            debug('✅ JSON données récupérées:', data.length, 'utilisateurs');
            return data;
        } else {
            debug('❌ Erreur lors du fetch JSON:', response.status);
            return null;
        }
    } catch (error) {
        debug('❌ Erreur JSON fetch:', error);
        return null;
    }
}

// ========== Table Functions ==========
function updateTableFromJson(data) {
    const tbody = document.querySelector('#gigachads-table tbody');
    if (!tbody) {
        debug('❌ Tableau non trouvé');
        return;
    }

    // Trier par credibilityScore
    const sortedData = [...data].sort((a, b) => b.credibilityScore - a.credibilityScore);
    
    // Mettre à jour les rangs
    sortedData.forEach((user, index) => {
        user.rank = index + 1;
    });

    tbody.innerHTML = '';
    
    sortedData.forEach(user => {
        const row = document.createElement('tr');
        
        row.innerHTML = `
            <td class="rank">#${user.rank}</td>
            <td class="user">
                <img src="${user.avatar}" alt="${user.username}" class="avatar">
                <div class="user-info">
                    <span class="username">${user.username}</span>
                    <span class="address">${user.address}</span>
                </div>
            </td>
            <td class="score">${user.credibilityScore}</td>
            <td class="vouches">${user.vouchesReceived}</td>
            <td class="reviews">${user.reviewsReceived}</td>
            <td class="activity">${user.totalActivity}</td>
        `;
        
        tbody.appendChild(row);
    });

    // Update last refresh time
    updateLastRefreshTime();
    debug('✅ Tableau mis à jour avec', sortedData.length, 'utilisateurs');
}

// ========== Refresh Functions ==========
function updateLastRefreshTime() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('fr-FR');
    
    // Mettre à jour l'affichage si l'élément existe
    const lastRefreshElement = document.querySelector('.last-refresh');
    if (lastRefreshElement) {
        lastRefreshElement.textContent = `Dernière mise à jour: ${timeString}`;
    }
    
    debug('⏰ Dernière mise à jour:', timeString);
}

async function refreshTableData() {
    debug('🔄 Actualisation des données...');
    
    const data = await fetchGigachadsData();
    if (data) {
        updateTableFromJson(data);
        debug('✅ Données actualisées avec succès');
        return true;
    } else {
        debug('❌ Échec de l\'actualisation');
        return false;
    }
}

function toggleAutoRefresh() {
    if (isAutoRefreshEnabled) {
        clearInterval(autoRefreshInterval);
        isAutoRefreshEnabled = false;
        debug('⏸️ Auto-refresh désactivé');
    } else {
        autoRefreshInterval = setInterval(() => {
            debug('🔄 Auto-refresh du tableau...');
            refreshTableData();
        }, 60000); // 1 minute
        isAutoRefreshEnabled = true;
        debug('▶️ Auto-refresh activé (60s)');
    }
    updateLastRefreshTime();
}

// ========== Initialization ==========
document.addEventListener('DOMContentLoaded', async function() {
    debug('🚀 Initialisation du tableau auto-refresh...');
    
    try {
        await refreshTableData();
        debug('✅ Données initiales chargées');
        
        // Démarrer l'auto-refresh après le premier chargement
        setTimeout(() => {
            debug('🚀 Activation de l\'auto-refresh...');
            toggleAutoRefresh();
        }, 2000);
        
    } catch (error) {
        debug('❌ Erreur lors du chargement initial:', error);
    }
});

// ========== Visibility Management ==========
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        if (autoRefreshInterval) {
            clearInterval(autoRefreshInterval);
            debug('⏸️ Auto-refresh en pause (onglet caché)');
        }
    } else {
        if (isAutoRefreshEnabled) {
            autoRefreshInterval = setInterval(() => {
                debug('🔄 Auto-refresh du tableau...');
                refreshTableData();
            }, 60000);
            debug('▶️ Auto-refresh repris (onglet visible)');
        }
    }
});

// ========== Global Controls ==========
window.gigachadTable = {
    toggleAutoRefresh: toggleAutoRefresh,
    manualRefresh: refreshTableData,
    isAutoRefreshEnabled: () => isAutoRefreshEnabled,
    getLastUpdate: () => lastJsonUpdate
};

// ========== Manual Controls (optional) ==========
// Vous pouvez utiliser ces commandes dans la console :
// gigachadTable.manualRefresh() - Actualiser manuellement
// gigachadTable.toggleAutoRefresh() - Activer/désactiver l'auto-refresh
// gigachadTable.isAutoRefreshEnabled() - Vérifier l'état
