const { REST } = require('@discordjs/rest');
const { Routes, ApplicationCommandOptionType } = require('discord-api-types/v9');
require('dotenv').config();

const jours = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];

const commands = [{
  name: 'modifier',
  description: 'Modifie ta disponibilité pour un jour spécifique',
  options: [{
    name: 'jour',
    type: ApplicationCommandOptionType.String,
    description: 'Le jour pour lequel tu souhaites modifier ta disponibilité',
    required: true,
    choices: jours.map(jour => ({
      name: jour,
      value: jour.toLowerCase()
    }))
  }, {
    name: 'disponibilite',
    type: ApplicationCommandOptionType.Boolean,
    description: 'Es-tu disponible ce jour?',
    required: true
  }, {
    name: 'heure',
    type: ApplicationCommandOptionType.String,
    description: 'À quelle heure es-tu disponible? (facultatif)',
    required: false
  }]
}];

const rest = new REST({ version: '9' }).setToken(process.env.DISCORD_BOT_TOKEN);

(async () => {
  try {
    console.log('Commence à enregistrer les commandes slash au serveur.');

    await rest.put(
      Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID),
      { body: commands },
    );

    console.log('Commandes slash enregistrées avec succès.');
  } catch (error) {
    console.error(error);
  }
})();
