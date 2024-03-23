require('dotenv').config();
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
    console.log('Le bot est prêt!');
    await loadSummaryMessageId();
});

client.on('messageCreate', async message => {
    if (message.content.startsWith('!planning') && !message.author.bot) {
        const user = message.mentions.users.first() || message.author; // Collecte pour l'utilisateur mentionné ou l'auteur du message
        await collectAvailability(user);
    }
});

async function collectAvailability(user) {
    planningResponses[user.id] = { username: user.username, disponibilites: {} };
    for (const jour of jours) {
        await askAvailability(user, jour);
    }
    await updateSummaryMessage(); 
    await sendSummaryInDM(user.id); 
}

async function askAvailability(user, jour) {
    const dmMessage = await user.send(`Êtes-vous disponible le ${jour}? Réagissez avec ✅ pour oui ou ❌ pour non.`).catch(console.error);
    if (!dmMessage) return;

    const reactions = ['✅', '❌'];
    for (const reaction of reactions) {
        await dmMessage.react(reaction);
    }

    const filter = (reaction, userReact) => reactions.includes(reaction.emoji.name) && userReact.id === user.id;
    const collector = dmMessage.createReactionCollector({ filter, max: 1, time: 60000 });

    return new Promise(resolve => {
        collector.on('collect', async (reaction) => {
            planningResponses[user.id].disponibilites[jour] = { disponible: reaction.emoji.name === '✅' };
            if (reaction.emoji.name === '✅') {
                const requestCommentMsg = await user.send(`Veuillez entrer votre heure de disponibilité pour le ${jour} (ex: "21:00").`).catch(console.error);
                const commentCollector = requestCommentMsg.channel.createMessageCollector({ time: 60000, max: 1 });

                commentCollector.on('collect', msg => {
                    if (msg.content.trim() !== '') {
                        planningResponses[user.id].disponibilites[jour].commentaire = `Disponible à ${msg.content} heures`;
                    }
                    resolve();
                });
            } else {
                resolve();
            }
        });
    });
}

async function sendSummaryInDM(userId) {
    const user = await client.users.fetch(userId);
    const disponibilites = planningResponses[userId].disponibilites;
    const embed = new EmbedBuilder()
        .setTitle('Résumé de vos disponibilités')
        .setDescription('Voici un résumé de vos disponibilités que vous avez indiquées :')
        .setColor(0xFFA500)
        .setThumbnail('https://decideur-it.fr/wp-content/uploads/2022/09/Septeo-vert-quadri300dpi-640w.png')
        .setTimestamp();

    jours.forEach(jour => {
        const disponibilite = disponibilites[jour];
        const statut = disponibilite && disponibilite.disponible ? '✅ Disponible' : '❌ Non Disponible';
        const commentaire = disponibilite && disponibilite.commentaire ? ` (${disponibilite.commentaire})` : '';
        embed.addFields({ name: jour, value: `${statut}${commentaire}`, inline: false });
    });

    user.send({ embeds: [embed] }).catch(console.error);
}


async function updateSummaryMessage() {
    const channel = await client.channels.fetch(SUMMARY_CHANNEL_ID);
    const embed = new EmbedBuilder()
        .setTitle('Résumé des disponibilités')
        .setColor(0xFFA500) // Couleur orange
        .setDescription('Voici le résumé des disponibilités pour la semaine :')
        .setThumbnail('https://decideur-it.fr/wp-content/uploads/2022/09/Septeo-vert-quadri300dpi-640w.png')
        .setTimestamp();

    jours.forEach(jour => {
        const disponibilitesParJour = Object.values(planningResponses)
            .map(({ username, disponibilites }) => {
                if (disponibilites[jour]) {
                    const disponibilite = disponibilites[jour];
                    return `${username}: ${disponibilite.disponible ? '✅' : '❌'} ${disponibilite.commentaire || ''}`.trim();
                }
                return 'Aucune donnée';
            })
            .join('\n') || 'Aucune donnée';

            embed.addFields({ name: `__${jour}__`, value: disponibilitesParJour, inline: false });
        });
    
        if (summaryMessageId) {
            try {
                const message = await channel.messages.fetch(summaryMessageId);
                await message.edit({ embeds: [embed] });
            } catch {
                // Si le message ne peut pas être récupéré (peut-être a-t-il été supprimé), réinitialisez summaryMessageId
                summaryMessageId = null;
            }
        }
        
        if (!summaryMessageId) {
            const message = await channel.send({ embeds: [embed] });
            summaryMessageId = message.id;
            await fs.writeFile('summaryMessageId.json', JSON.stringify({ summaryMessageId }, null, 2));
        }
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
    
