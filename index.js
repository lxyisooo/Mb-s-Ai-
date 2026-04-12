const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, 
    ButtonStyle, ActivityType, SlashCommandBuilder, REST, Routes 
} = require("discord.js");
const mongoose = require("mongoose");
require("dotenv").config();

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, GatewayIntentBits.GuildMembers
    ]
});

// ================= [ CONFIGURATION ] =================
const OWNER_ID = "1451533934130364467"; // <--- CHANGE THIS
const theme = "#2b2d31"; 
let activeEvent = null; 

// ================= [ DATABASE MODELS ] =================
const User = mongoose.model("User", new mongoose.Schema({
    userId: String,
    stars: { type: Number, default: 0 },
    inventory: { type: Array, default: [] }
}));

const TriviaStats = mongoose.model("TriviaStats", new mongoose.Schema({
    usedIds: { type: Array, default: [] } 
}));

// ================= [ 100 UNIQUE TRIVIA POOL ] =================
const triviaPool = [
    { id: 1, q: "Science: What is the most common element in the universe?", a: "hydrogen" },
    { id: 2, q: "Science: What part of the cell is the powerhouse?", a: "mitochondria" },
    { id: 3, q: "Science: What is the boiling point of water (Celsius)?", a: "100" },
    { id: 4, q: "Math: Solve for x: 3x - 9 = 21", a: "10" },
    { id: 5, q: "History: In what year did WWI start?", a: "1914" },
    { id: 6, q: "Science: What gas do plants absorb from the air?", a: "carbon dioxide" },
    { id: 7, q: "Geography: What is the capital of Japan?", a: "tokyo" },
    { id: 8, q: "Math: What is the square root of 144?", a: "12" },
    { id: 9, q: "History: Who was the first US President?", a: "george washington" },
    { id: 10, q: "Science: H2O is the chemical formula for what?", a: "water" },
    { id: 11, q: "Math: How many degrees are in a right angle?", a: "90" },
    { id: 12, q: "Science: What is the hardest natural substance?", a: "diamond" },
    { id: 13, q: "History: Who painted the Mona Lisa?", a: "da vinci" },
    { id: 14, q: "Geography: Which is the largest ocean?", a: "pacific" },
    { id: 15, q: "Math: What is 15% of 200?", a: "30" },
    { id: 16, q: "Science: What is the closest star to Earth?", a: "sun" },
    { id: 17, q: "History: What year did the Berlin Wall fall?", a: "1989" },
    { id: 18, q: "Geography: What is the capital of France?", a: "paris" },
    { id: 19, q: "Science: Which blood type is the universal donor?", a: "o" },
    { id: 20, q: "Math: How many sides does a heptagon have?", a: "7" },
    { id: 21, q: "Science: What is the largest organ in the human body?", a: "skin" },
    { id: 22, q: "History: Who was known as the Maid of Orleans?", a: "joan of arc" },
    { id: 23, q: "Geography: What is the longest river in the world?", a: "nile" },
    { id: 24, q: "Science: What is the center of an atom called?", a: "nucleus" },
    { id: 25, q: "Math: What is the value of Pi to two decimal places?", a: "3.14" },
    { id: 26, q: "History: Which empire built the Colosseum?", a: "roman" },
    { id: 27, q: "Science: What do bees collect to make honey?", a: "nectar" },
    { id: 28, q: "Math: What is 8 squared?", a: "64" },
    { id: 29, q: "Geography: On which continent is the Sahara Desert?", a: "africa" },
    { id: 30, q: "Science: What is the chemical symbol for Gold?", a: "au" },
    { id: 31, q: "History: Who wrote the Declaration of Independence?", a: "thomas jefferson" },
    { id: 32, q: "Math: What is 100 divided by 4?", a: "25" },
    { id: 33, q: "Geography: What is the capital of Italy?", a: "rome" },
    { id: 34, q: "Science: How many planets are in our solar system?", a: "8" },
    { id: 35, q: "History: Who was the first man to step on the moon?", a: "neil armstrong" },
    { id: 36, q: "Math: What is the sum of angles in a triangle?", a: "180" },
    { id: 37, q: "Science: What planet is known as the Red Planet?", a: "mars" },
    { id: 38, q: "Geography: What is the capital of Canada?", a: "ottawa" },
    { id: 39, q: "History: Who was the leader of the Civil Rights Movement?", a: "martin luther king" },
    { id: 40, q: "Science: What is the freezing point of water in Celsius?", a: "0" },
    { id: 41, q: "Math: What is 7 times 8?", a: "56" },
    { id: 42, q: "Geography: Which country has the most population?", a: "india" },
    { id: 43, q: "History: In what year did the Titanic sink?", a: "1912" },
    { id: 44, q: "Science: What gas do humans breathe out?", a: "carbon dioxide" },
    { id: 45, q: "Math: What is the next prime number after 7?", a: "11" },
    { id: 46, q: "Geography: What is the smallest country in the world?", a: "vatican city" },
    { id: 47, q: "History: Who discovered gravity when an apple fell?", a: "isaac newton" },
    { id: 48, q: "Science: What is the speed of light?", a: "299792458" },
    { id: 49, q: "Math: What is the perimeter of a 5x5 square?", a: "20" },
    { id: 50, q: "Geography: Which state is the largest in the USA?", a: "alaska" },
    { id: 51, q: "Science: What is the chemical symbol for Iron?", a: "fe" },
    { id: 52, q: "History: Who was the first woman to win a Nobel Prize?", a: "marie curie" },
    { id: 53, q: "Math: What is 12 multiplied by 12?", a: "144" },
    { id: 54, q: "Geography: Mount Everest is in which mountain range?", a: "himalayas" },
    { id: 55, q: "Science: How many bones are in the adult human body?", a: "206" },
    { id: 56, q: "History: Which country gifted the Statue of Liberty?", a: "france" },
    { id: 57, q: "Math: How many zeros are in a million?", a: "6" },
    { id: 58, q: "Geography: What is the largest desert in the world?", a: "antarctica" },
    { id: 59, q: "Science: What is the most common gas in Earth's atmosphere?", a: "nitrogen" },
    { id: 60, q: "History: Who was the 16th US President?", a: "abraham lincoln" },
    { id: 61, q: "Math: Solve 2 + 2 * 2", a: "6" },
    { id: 62, q: "Geography: What is the capital of Spain?", a: "madrid" },
    { id: 63, q: "Science: What type of animal is a Komodo dragon?", a: "lizard" },
    { id: 64, q: "History: When did World War II end?", a: "1945" },
    { id: 65, q: "Math: What is the square root of 81?", a: "9" },
    { id: 66, q: "Geography: What is the capital of Egypt?", a: "cairo" },
    { id: 67, q: "Science: What is the study of fossils called?", a: "paleontology" },
    { id: 68, q: "History: Who was the first Emperor of Rome?", a: "augustus" },
    { id: 69, q: "Math: What is 25% of 80?", a: "20" },
    { id: 70, q: "Geography: Which country is known as the Land of the Rising Sun?", a: "japan" },
    { id: 71, q: "Science: What is the chemical symbol for Silver?", a: "ag" },
    { id: 72, q: "History: Who invented the lightbulb?", a: "thomas edison" },
    { id: 73, q: "Math: How many seconds are in an hour?", a: "3600" },
    { id: 74, q: "Geography: What is the largest continent?", a: "asia" },
    { id: 75, q: "Science: What is the main source of energy for Earth?", a: "sun" },
    { id: 76, q: "History: What was the ancient name for Iraq?", a: "mesopotamia" },
    { id: 77, q: "Math: What is the only even prime number?", a: "2" },
    { id: 78, q: "Geography: What is the largest island in the world?", a: "greenland" },
    { id: 79, q: "Science: Which organ pumps blood through the body?", a: "heart" },
    { id: 80, q: "History: Who was the King of Rock and Roll?", a: "elvis presley" },
    { id: 81, q: "Math: What is 1/2 + 1/4?", a: "0.75" },
    { id: 82, q: "Geography: What is the capital of Germany?", a: "berlin" },
    { id: 83, q: "Science: How many teeth does an adult human have?", a: "32" },
    { id: 84, q: "History: Who was the longest-reigning British monarch?", a: "elizabeth ii" },
    { id: 85, q: "Math: How many sides does a hexagon have?", a: "6" },
    { id: 86, q: "Geography: What is the smallest continent?", a: "australia" },
    { id: 87, q: "Science: What force keeps us on the ground?", a: "gravity" },
    { id: 88, q: "History: What was the first civilization?", a: "sumerians" },
    { id: 89, q: "Math: What is the square root of 16?", a: "4" },
    { id: 90, q: "Geography: What is the capital of Australia?", a: "canberra" },
    { id: 91, q: "Science: What is the largest mammal on Earth?", a: "blue whale" },
    { id: 92, q: "History: In what year was the Magna Carta signed?", a: "1215" },
    { id: 93, q: "Math: What is 9 multiplied by 9?", a: "81" },
    { id: 94, q: "Geography: What is the capital of Russia?", a: "moscow" },
    { id: 95, q: "Science: What color are emeralds?", a: "green" },
    { id: 96, q: "History: Who wrote Romeo and Juliet?", a: "william shakespeare" },
    { id: 97, q: "Math: What is 50 times 50?", a: "2500" },
    { id: 98, q: "Geography: Which country has the most volcanoes?", a: "indonesia" },
    { id: 99, q: "Science: What is the chemical symbol for Sodium?", a: "na" },
    { id: 100, q: "Misc: What is the largest planet in our solar system?", a: "jupiter" }
];

// ================= [ SLASH COMMAND REFRESH ] =================
const commands = [
    new SlashCommandBuilder().setName('drop').setDescription('Admin: Trigger Star Drop'),
    new SlashCommandBuilder().setName('trivia').setDescription('Admin: Trigger Unique Trivia'),
    new SlashCommandBuilder().setName('jackpot').setDescription('Admin: Trigger Mega Jackpot')
].map(cmd => cmd.toJSON());

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
(async () => {
    try {
        console.log('🔄 Cleaning old cache and registering new Owner Slash Commands...');
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: [] }); 
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
    } catch (e) { console.error(e); }
})();

// ================= [ EVENT ENGINE ] =================

async function triggerDrop(channel) {
    const reward = Math.floor(Math.random() * 130) + 200;
    const code = "MB" + Math.floor(Math.random() * 9999);
    activeEvent = { answer: code.toLowerCase(), reward, type: "DROP" };
    
    const embed = new EmbedBuilder()
        .setAuthor({ name: "STARS DROP", iconURL: "https://i.imgur.com/8N95uXF.png" })
        .setColor("#5865F2")
        .setDescription(
http://googleusercontent.com/immersive_entry_chip/0
http://googleusercontent.com/immersive_entry_chip/1

### 🎯 Pro-Tip for your Slash Commands:
Once you deploy this, the old slash commands might still show up for a few minutes in your Discord client because of its local cache. To fix it immediately:
1.  **Fully close Discord** (and the mobile app).
2.  **Restart the bot.**
3.  **Re-open Discord.**

They will now be replaced by your locked `/drop`, `/trivia`, and `/jackpot`. 😈🔥💫
