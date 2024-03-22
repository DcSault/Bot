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
        collector.on('collect', (reaction) => {
            planningResponses[user.id].disponibilites[jour] = reaction.emoji.name === '✅';
            dmMessage.delete().catch(console.error);
            resolve();
        });

        collector.on('end', collected => {
            if (collected.size === 0) dmMessage.delete().catch(console.error);
        });
    });
}

async function updateSummaryMessage() {
    const channel = await client.channels.fetch(SUMMARY_CHANNEL_ID);

    const logoUrl = 'https://decideur-it.fr/wp-content/uploads/2022/09/Septeo-vert-quadri300dpi-640w.png'; // Remplacez ceci par l'URL du logo de Septeo

    const embed = new EmbedBuilder()
        .setTitle('Résumé des disponibilités')
        .setColor(0xFFA500) // Couleur orange
        .setDescription('Voici le résumé des disponibilités pour la semaine :')
        .setThumbnail(logoUrl); // Ajout du logo

    // Pour chaque jour, ajouter une section dans l'embed
    jours.forEach(jour => {
        const disponibilitesParJour = Object.values(planningResponses)
            .map(({ username, disponibilites }) => `${username}: ${disponibilites[jour] ? '✅ ' : '❌ '}`)
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
}


async function loadSummaryMessageId() {
    try {
        const data = await fs.readFile('summaryMessageId.json', 'utf8');
        const jsonData = JSON.parse(data);
        summaryMessageId = jsonData.summaryMessageId;
    } catch {
        console.log('Aucun ID de message de résumé sauvegardé trouvé. Un nouveau message sera créé.');
    }
} // Cette accolade ferme la fonction loadSummaryMessageId

// Cette accolade ferme la définition de `client`
client.login('MTIyMDcxMzI0NjQ5MTkzNDc3MQ.GTfXsE.R8dRfesxQa6--NmMNT56vxGP1adrjZEvx0XnJs'); //
