require('dotenv').config();
const { saveAvailability, getAvailabilities, getUserAvailabilities, deleteAllAvailabilities, deleteSpecificAvailability  } = require('./database');
const { Client, GatewayIntentBits, EmbedBuilder } = require('discord.js');
const fs = require('fs').promises;

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.DirectMessageReactions,
    ]
});

const SUMMARY_CHANNEL_ID = '1220816215627272192'; // Remplacez par l'ID de votre salon de résumé
let summaryMessageId = null;
const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const planningResponses = {}; // Structure pour les réponses

client.once('ready', async () => {
    console.log('Le bot est prêt! Petit pd de QDD');
    await loadSummaryMessageId();
});

client.on('messageCreate', async message => {
    if (message.content.startsWith('!planning') && !message.author.bot) {
        const user = message.mentions.users.first() || message.author;
        await collectAvailability(user);
    }
    else if (message.content.startsWith('!supprimer') && message.author.id === '314114260680572929') {
        const parts = message.content.split(' ').filter(part => part);
        if (parts.length < 3) {
            return message.reply('Usage: !supprimer [ID utilisateur] [jour ou "tout"]');
        }

        const targetUserId = parts[1];
        const dayOrAll = parts[2].toLowerCase(); // "tout" pour tout supprimer, sinon le jour spécifique

        if (dayOrAll === "tout") {
            deleteAllAvailabilities(targetUserId, async (err) => {
                if (err) {
                    return message.reply("Erreur lors de la suppression des disponibilités.");
                }
                message.reply("Toutes les disponibilités ont été supprimées avec succès pour l'utilisateur spécifié.");
                await updateSummaryMessage(); // Mise à jour du message de résumé après suppression
            });
        } else {
            deleteSpecificAvailability(targetUserId, dayOrAll, async (err) => {
                if (err) {
                    return message.reply(`Erreur lors de la suppression de la disponibilité pour ${dayOrAll}.`);
                }
                message.reply(`La disponibilité pour ${dayOrAll} a été supprimée avec succès pour l'utilisateur spécifié.`);
                await updateSummaryMessage(); // Mise à jour du message de résumé après suppression
            });
        }
    }
});



client.on('interactionCreate', async interaction => {
    if (!interaction.isCommand()) return;

    if (interaction.commandName === 'modifier') {
        const jour = interaction.options.getString('jour');
        const disponibilite = interaction.options.getBoolean('disponibilite');
        const heure = interaction.options.getString('heure') || '';
        const userId = interaction.user.id;
        const username = interaction.user.username;

        // Assurez-vous que le jour est correctement formaté, si nécessaire
        // Convertir la disponibilité en format attendu par saveAvailability
        const disponible = disponibilite ? true : false;

        saveAvailability(userId, username, capitalizeFirstLetter(jour), disponible, heure, async () => {
            await updateSummaryMessage();
            await interaction.reply(`Votre disponibilité pour ${capitalizeFirstLetter(jour)} a été mise à jour : ${disponible ? '✅ Disponible' : '❌ Non Disponible'} ${heure ? `à ${heure} heures` : ''}`);
        });
    }
});

// Fonction pour capitaliser la première lettre (si nécessaire pour votre implémentation)
function capitalizeFirstLetter(string) {
    return string.charAt(0).toUpperCase() + string.slice(1).toLowerCase();
}

async function collectAvailability(user) {
    planningResponses[user.id] = { username: user.username, disponibilites: {} };
    for (const jour of jours) {
        await askAvailability(user, jour);
    }
    await updateSummaryMessage(); 
    await sendSummaryInDM(user.id); 
}

async function askAvailability(user, jour) {
    try {
        const dmMessage = await user.send(`Êtes-vous disponible le ${jour}? Réagissez avec ✅ pour oui ou ❌ pour non.`);
        await dmMessage.react('✅');
        await dmMessage.react('❌');

        const filter = (reaction, userReact) => {
            return ['✅', '❌'].includes(reaction.emoji.name) && userReact.id === user.id;
        };

        const reaction = await waitForReaction(dmMessage, filter, 60000);
        if (!reaction) {
            await user.send("Temps écoulé! Veuillez répondre plus rapidement la prochaine fois.");
            return;
        }

        const disponible = reaction.emoji.name === '✅';
        if (disponible) {
            await askForAvailabilityTime(user, jour);
        } else {
            saveAvailability(user.id, user.username, jour, false, '');
            await user.send(`Votre indisponibilité pour le ${jour} a été enregistrée.`);
        }
    } catch (error) {
        console.error("Erreur lors de l'envoi du message ou de la réaction:", error);
    }
}

function waitForReaction(dmMessage, filter, time) {
    return new Promise(resolve => {
        const collector = dmMessage.createReactionCollector({ filter, max: 1, time: time });

        collector.on('end', collected => resolve(collected.first()));
    });
}

async function askForAvailabilityTime(user, jour) {
    const requestCommentMsg = await user.send(`Veuillez entrer votre heure de disponibilité pour le ${jour} (ex: "21:00").`);

    const filter = m => m.author.id === user.id;
    const msg = await waitForMessage(requestCommentMsg.channel, filter, 60000);
    if (!msg) {
        await user.send("Temps écoulé pour l'heure de disponibilité. Veuillez recommencer le processus.");
        return;
    }

    const commentaire = msg.content.trim() !== '' ? `Disponible à ${msg.content} heures` : 'Disponible';
    saveAvailability(user.id, user.username, jour, true, commentaire);
    await user.send(`Votre disponibilité pour le ${jour} à ${commentaire} a été enregistrée.`);
}

function waitForMessage(channel, filter, time) {
    return new Promise(resolve => {
        const collector = channel.createMessageCollector({ filter, max: 1, time: time });

        collector.on('end', collected => resolve(collected.first()));
    });
}

async function sendSummaryInDM(userId) {
    getUserAvailabilities(userId, async (disponibilites) => {
        const user = await client.users.fetch(userId);
        const embed = new EmbedBuilder()
            .setTitle('Résumé de vos disponibilités')
            .setDescription('Voici un résumé de vos disponibilités que vous avez indiquées :')
            .setColor(0xFFA500)
            .setThumbnail('https://decideur-it.fr/wp-content/uploads/2022/09/Septeo-vert-quadri300dpi-640w.png')
            .setTimestamp();

        jours.forEach(jour => {
            const disponibilite = disponibilites.find(d => d.jour === jour);
            const statut = disponibilite && disponibilite.disponible ? '✅ ' : '❌ ';
            const commentaire = disponibilite && disponibilite.commentaire ? ` (${disponibilite.commentaire})` : '';
            embed.addFields({ name: jour, value: `${statut}${commentaire}`, inline: false });
        });

        user.send({ embeds: [embed] }).catch(console.error);
    });
}

async function updateSummaryMessage() {
    getAvailabilities(async (availabilities) => {
        const channel = await client.channels.fetch(SUMMARY_CHANNEL_ID);
        const embed = new EmbedBuilder()
            .setTitle('Résumé des disponibilités')
            .setColor(0xFFA500)
            .setDescription('Voici le résumé des disponibilités pour la semaine :')
            .setThumbnail('https://decideur-it.fr/wp-content/uploads/2022/09/Septeo-vert-quadri300dpi-640w.png')
            .setTimestamp();

        jours.forEach(jour => {
            const disponibilitesParJour = availabilities
                .filter(({ jour: jourDb }) => jourDb === jour)
                .map(({ username, disponible, commentaire }) => {
                    return `${username}: ${disponible ? '✅ ' : '❌ '} ${commentaire || ''}`.trim();
                })
                .join('\n') || 'Aucune donnée';

            embed.addFields({ name: `__${jour}__`, value: disponibilitesParJour, inline: false });
        });

        if (summaryMessageId) {
            try {
                const message = await channel.messages.fetch(summaryMessageId);
                await message.edit({ embeds: [embed] });
            } catch {
                summaryMessageId = null;
            }
        }

        if (!summaryMessageId) {
            const message = await channel.send({ embeds: [embed] });
            summaryMessageId = message.id;
            await fs.writeFile('summaryMessageId.json', JSON.stringify({ summaryMessageId }, null, 2));
        }
    });
}    
    async function loadSummaryMessageId() {
        try {
            const data = await fs.readFile('summaryMessageId.json', 'utf8');
            const jsonData = JSON.parse(data);
            summaryMessageId = jsonData.summaryMessageId;
        } catch (error) {
            console.log('Aucun ID de message de résumé sauvegardé trouvé. Un nouveau message sera créé.');
        }
    }
    
    client.login(process.env.DISCORD_BOT_TOKEN);
    
