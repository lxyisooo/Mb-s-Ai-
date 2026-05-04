const { Client, GatewayIntentBits, EmbedBuilder, REST, Routes,
SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle
} = require("discord.js");
require("dotenv").config();

const client=new Client({intents:[
GatewayIntentBits.Guilds,GatewayIntentBits.GuildMessages,
GatewayIntentBits.MessageContent,GatewayIntentBits.DirectMessages]});

const BRANDS={
mcdonalds:{name:"🍟 McDonald's",emoji:"🍟",color:0xFFC72C,desc:"World’s largest fast food chain",
menu:{BigMac:5.99,QuarterPounder:4.99,Nuggets:4.49,Fries:2.49,McFlurry:3.49},salary:12},
popeyes:{name:"🍗 Popeyes",emoji:"🍗",color:0xD71E28,desc:"Louisiana chicken",
menu:{Sandwich:3.99,CajunFries:2.99,Shrimp:4.99,Mac:2.49,Rice:2.99},salary:13},
wendys:{name:"🌶️ Wendy's",emoji:"🌶️",color:0xD62300,desc:"Fresh beef burgers",
menu:{Single:3.99,Double:5.99,Chicken:4.49,Frosty:2.99,Fries:2.49},salary:12},
kfc:{name:"🍗 KFC",emoji:"🍗",color:0xFF0000,desc:"Fried chicken",
menu:{Original:7.99,Crispy:8.49,Popcorn:3.99,Mac:2.49,Mash:1.99},salary:14},
chipotle:{name:"🌯 Chipotle",emoji:"🌯",color:0xE4002B,desc:"Burritos & bowls",
menu:{Chicken:8.95,Steak:9.25,Carnitas:10.95,Barbacoa:9.75,Sofritas:9.75},salary:13},
subway:{name:"🥪 Subway",emoji:"🥪",color:0x009E3A,desc:"Build subs",
menu:{Italian:7.99,Steak:8.99,Veggie:5.99,Meatball:6.99,Cookie:1.99},salary:11},
tacobell:{name:"🌮 Taco Bell",emoji:"🌮",color:0x702C7F,desc:"Think outside the bun",
menu:{Crunchwrap:4.99,Burrito:4.99,Taco:1.99,Blast:2.49,Bean:1.49},salary:10},
innout:{name:"🍔 In-N-Out",emoji:"🍔",color:0xFFC600,desc:"West coast burgers",
menu:{Double:5.45,Burger:3.45,Cheese:4.15,Fries:1.65,Shake:3.45},salary:14}
};

const CITIES=["New York","LA","Chicago","Houston","Phoenix","Miami","Boston","Seattle","Austin","Denver"];
const FN=["Marcus","Jessica","David","Sarah","James","Emma","Michael","Olivia","Chris","Sophia"];
const LN=["Johnson","Smith","Williams","Brown","Jones","Garcia","Miller","Davis","Rodriguez","Martinez"];
const businesses={};

class Employee{
constructor(n,r){
this.id=Math.random().toString(36).slice(2);
this.name=n;this.role=r;this.level=1;
this.salary=r==="cashier"?12:r==="cook"?16:20;
this.morale=100;this.performance=.8;}
}

class Location{
constructor(n,c,b){
this.id=Math.random().toString(36).slice(2);
this.name=n;this.city=c;this.brandKey=b;
this.brand=BRANDS[b];this.level=1;
this.balance=5000;this.revenue=0;
this.reputation=75;this.employees=[];
this.last=new Date();this.customers=0;this.sat=80;}
tick(){
if((Date.now()-this.last)/1e3<30)return;
this.last=new Date();
this.balance-=this.employees.reduce((t,e)=>t+e.salary,0);
const h=new Date().getHours();if(h<6||h>23)return;
const perf=this.employees.length?
this.employees.reduce((a,e)=>a+e.performance,0)/this.employees.length:.5;
const cust=Math.floor((this.level*this.reputation/100)*(8+perf*4));
for(let i=0;i<cust;i++){
const prices=Object.values(this.brand.menu);
const p=prices[Math.floor(Math.random()*prices.length)];
this.balance+=p-p*.35;this.revenue+=p-p*.35;this.customers++;
if(Math.random()>.3){this.reputation=Math.min(100,this.reputation+.5);
this.sat=Math.min(100,this.sat+1);}}}
}

class Business{
constructor(id){
this.id=id;this.name="My Empire";this.locs=[];
this.bank=15000;this.level=1;
this.prestige=0;this.setup=false;}
total(){return this.bank+this.locs.reduce((s,l)=>s+l.balance,0);}
rev(){return this.locs.reduce((s,l)=>s+l.revenue,0);}
emps(){return this.locs.reduce((s,l)=>s+l.employees.length,0);}
}

const getBiz=id=>businesses[id]||(businesses[id]=new Business(id));
const empName=()=>`${FN[Math.random()*FN.length|0]} ${LN[Math.random()*LN.length|0]}`;
const bar=(c,m)=>"█".repeat(c/m*15|0)+"░".repeat(15-(c/m*15|0));

const bizEmbed=b=>new EmbedBuilder()
.setTitle(`${b.locs[0]?.brand.emoji||"🏪"} ${b.name}`)
.setColor(b.locs[0]?.brand.color||0xFF6B35)
.addFields(
{name:"💰 Balance",value:`$${b.total().toLocaleString()}`,inline:true},
{name:"📈 Revenue",value:`$${b.rev().toLocaleString()}`,inline:true},
{name:"🏆 Prestige",value:String(b.prestige),inline:true},
{name:"🏪 Locations",value:String(b.locs.length),inline:true},
{name:"👥 Employees",value:String(b.emps()),inline:true},
{name:"📍 Stores",value:b.locs.map(l=>`**${l.name}** (${l.city})`).join("\n")||"None"}
);
client.once("ready",async()=>{
const rest=new REST({version:"10"}).setToken(process.env.DISCORD_TOKEN);
await rest.put(Routes.applicationCommands(client.user.id),{body:[
new SlashCommandBuilder().setName("start").setDescription("Start your empire"),
new SlashCommandBuilder().setName("status").setDescription("View business"),
new SlashCommandBuilder().setName("locations").setDescription("Manage locations"),
new SlashCommandBuilder().setName("leaderboard").setDescription("Rankings")
]});
console.log("BOT READY");
});

client.on("interactionCreate",async i=>{
if(i.isChatInputCommand()){
const b=getBiz(i.user.id);

if(i.commandName==="start"){
if(b.setup)return i.reply({embeds:[bizEmbed(b)]});
const select=new StringSelectMenuBuilder()
.setCustomId("select_brand")
.setPlaceholder("Choose brand")
.addOptions(Object.entries(BRANDS).map(([k,v])=>({
label:v.name,value:k,emoji:v.emoji})));
return i.reply({embeds:[
new EmbedBuilder().setTitle("🍔 Fast Food Tycoon")
.setDescription("Pick your starting brand")],
components:[new ActionRowBuilder().addComponents(select)]});
}

if(i.commandName==="status")
return i.reply({embeds:[bizEmbed(b)]});

if(i.commandName==="locations"){
b.locs.forEach(l=>l.tick());
const embeds=b.locs.map(l=>new EmbedBuilder()
.setTitle(`${l.brand.emoji} ${l.name}`)
.setColor(l.brand.color)
.addFields(
{name:"💰 Balance",value:`$${l.balance}`,inline:true},
{name:"📊 Revenue",value:`$${l.revenue}`,inline:true},
{name:"⭐ Reputation",value:`${bar(l.reputation,100)} ${l.reputation}`,inline:true},
{name:"😊 Satisfaction",value:`${l.sat}%`,inline:true},
{name:"👥 Customers",value:String(l.customers),inline:true},
{name:"Staff",value:l.employees.map(e=>`${e.name} (${e.role})`).join("\n")||"None"}
));
const select=new StringSelectMenuBuilder()
.setCustomId("select_location")
.setPlaceholder("Select location")
.addOptions(b.locs.map(l=>({label:l.name,value:l.id,description:l.city})));
return i.reply({embeds,components:[new ActionRowBuilder().addComponents(select)]});
}

if(i.commandName==="leaderboard"){
const lb=Object.values(businesses)
.sort((a,b)=>b.prestige-a.prestige||b.total()-a.total()).slice(0,10);
return i.reply({embeds:[
new EmbedBuilder().setTitle("🏆 Leaderboard")
.setDescription(lb.map((x,i)=>`${i+1}. **${x.name}** | Prestige ${x.prestige}`).join("\n"))
]});
}
}

if(i.isStringSelectMenu()){
const b=getBiz(i.user.id);

if(i.customId==="select_brand"){
const k=i.values[0],v=BRANDS[k];
const loc=new Location(v.name,CITIES[Math.random()*CITIES.length|0],k);
b.name=v.name;b.locs.push(loc);b.setup=true;
return i.reply({embeds:[
new EmbedBuilder().setTitle(`✅ Welcome to ${v.name}`)
.setColor(v.color).setDescription(v.desc)
]});
}

if(i.customId==="select_location"){
const loc=b.locs.find(l=>l.id===i.values[0]);
if(!loc)return;
const row=new ActionRowBuilder().addComponents(
new ButtonBuilder().setCustomId(`hire_${loc.id}`).setLabel("👔 Hire").setStyle(ButtonStyle.Success),
new ButtonBuilder().setCustomId(`sup_${loc.id}`).setLabel("📦 Supplies").setStyle(ButtonStyle.Primary),
new ButtonBuilder().setCustomId(`up_${loc.id}`).setLabel("🏗️ Upgrade").setStyle(ButtonStyle.Secondary)
);
return i.reply({embeds:[new EmbedBuilder()
.setTitle(`${loc.brand.emoji} ${loc.name}`)
.addFields({name:"💰 Balance",value:`$${loc.balance}`})],
components:[row],ephemeral:true});
}
}

if(i.isButton()){
const b=getBiz(i.user.id);
const [act,id]=i.customId.split("_");
const loc=b.locs.find(l=>l.id===id);if(!loc)return;

if(act==="hire"){
const e=new Employee(empName(),"cashier");
const cost=e.salary*15;if(loc.balance<cost)
return i.reply({content:"❌ Not enough money",ephemeral:true});
loc.balance-=cost;loc.employees.push(e);
return i.reply({content:`✅ Hired ${e.name}`,ephemeral:true});
}

if(act==="sup"){
if(loc.balance<800)return i.reply({content:"❌ Need $800",ephemeral:true});
loc.balance-=800;return i.reply({content:"📦 Supplies ordered",ephemeral:true});
}

if(act==="up"){
const cost=2000*loc.level;
if(loc.balance<cost)return i.reply({content:"❌ Not enough money",ephemeral:true});
loc.balance-=cost;loc.level++;b.prestige+=15;
return i.reply({content:`🏗️ Upgraded to level ${loc.level}`,ephemeral:true});
}
}
});

client.login(process.env.DISCORD_TOKEN);
