const sqlite3 = require('sqlite3').verbose();

// Connexion à la base de données SQLite
const db = new sqlite3.Database('./bot.db', sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
    if (err) {
        console.error("Erreur lors de la connexion à la base de données 'bot.db':", err.message);
        throw err;
    }
    console.log("Connecté à la base de données 'bot.db'.");

    // Création de la table 'disponibilites' si elle n'existe pas déjà
    db.run(`CREATE TABLE IF NOT EXISTS disponibilites (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        username TEXT NOT NULL,
        jour TEXT NOT NULL,
        disponible BOOLEAN NOT NULL,
        commentaire TEXT
    )`, (err) => {
        if (err) {
            console.error("Erreur lors de la création de la table 'disponibilites':", err.message);
        } else {
            console.log("Table 'disponibilites' prête ou déjà existante.");
        }
    });    
});

/**
 * Enregistre les disponibilités d'un utilisateur dans la base de données.
 */
function saveAvailability(userId, username, jour, disponible, commentaire, callback) {
    // Vérifier d'abord si une entrée existe
    const checkSql = `SELECT id FROM disponibilites WHERE userId = ? AND jour = ?`;
    db.get(checkSql, [userId, jour], function(err, row) {
        if (err) {
            console.error("Erreur lors de la vérification des disponibilités existantes:", err.message);
            return;
        }
        
        if (row) {
            // Une entrée existe, donc la mettre à jour
            const updateSql = `UPDATE disponibilites SET disponible = ?, commentaire = ? WHERE id = ?`;
            db.run(updateSql, [disponible, commentaire, row.id], function(err) {
                if (err) {
                    console.error("Erreur lors de la mise à jour des disponibilités:", err.message);
                } else {
                    console.log(`La disponibilité de l'utilisateur ${username} pour ${jour} a été mise à jour.`);
                    if(callback) callback(); // Exécuter le callback après la mise à jour
                }
            });
        } else {
            // Aucune entrée existante, créer une nouvelle
            const insertSql = `INSERT INTO disponibilites (userId, username, jour, disponible, commentaire) VALUES (?, ?, ?, ?, ?)`;
            db.run(insertSql, [userId, username, jour, disponible, commentaire], function(err) {
                if (err) {
                    console.error("Erreur lors de l'enregistrement des disponibilités:", err.message);
                } else {
                    console.log(`Une nouvelle disponibilité pour ${username} le ${jour} a été enregistrée.`);
                    if(callback) callback(); // Exécuter le callback après l'insertion
                }
            });
        }
    });
}


/**
 * Récupère toutes les disponibilités enregistrées dans la base de données.
 */
function getAvailabilities(callback) {
    const sql = `SELECT * FROM disponibilites ORDER BY jour ASC`;
    db.all(sql, [], (err, rows) => {
        if (err) {
            console.error("Erreur lors de la récupération des disponibilités:", err.message);
            return;
        }
        callback(rows);
    });
}

function getUserAvailabilities(userId, callback) {
    const sql = `SELECT * FROM disponibilites WHERE userId = ? ORDER BY jour ASC`;
    db.all(sql, [userId], (err, rows) => {
        if (err) {
            console.error("Erreur lors de la récupération des disponibilités pour l'utilisateur:", err.message);
        } else {
            console.log("Disponibilités récupérées pour l'utilisateur:", rows);
        }
        callback(rows);
    });
}


// Supprimer la disponibilité d'un utilisateur pour un jour spécifique
function deleteSpecificAvailability(userId, day, callback) {
    const sql = `DELETE FROM disponibilites WHERE userId = ? AND jour = ?`;
    db.run(sql, [userId, day], function(err) {
        if (err) {
            console.error("Erreur lors de la suppression de la disponibilité:", err.message);
            return callback(err);
        }
        console.log(`Disponibilité supprimée pour ${userId} le ${day}.`);
        callback(null);
    });
}

// Supprimer toutes les disponibilités pour un utilisateur
function deleteAllAvailabilities(userId, callback) {
    const sql = `DELETE FROM disponibilites WHERE userId = ?`;
    db.run(sql, [userId], function(err) {
        if (err) {
            console.error("Erreur lors de la suppression des disponibilités:", err.message);
            return callback(err);
        }
        console.log(`Toutes les disponibilités supprimées pour ${userId}.`);
        callback(null);
    });
}

module.exports = { saveAvailability, getAvailabilities, getUserAvailabilities, deleteSpecificAvailability, deleteAllAvailabilities };

