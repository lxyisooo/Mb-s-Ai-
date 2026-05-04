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
const buildBizEmbed=b=>new EmbedBuilder()
.setTitle(`${b.locations[0]?.brand.emoji||"🏪"} ${b.business_name}`)
.setColor(b.locations[0]?.brand.color||0xFF6B35)
.addFields(
{name:"💰 Balance",value:`$${b.getTotalBalance().toLocaleString()}`,inline:true},
{name:"📈 Revenue",value:`$${b.getTotalRevenue().toLocaleString()}`,inline:true},
{name:"🏆 Prestige",value:String(b.prestige),inline:true},
{name:"🏪 Locations",value:String(b.locations.length),inline:true},
{name:"👥 Employees",value:String(b.getTotalEmployees()),inline:true},
{name:"📍 Stores",value:b.locations.map(l=>`**${l.name}** (${l.city})`).join("\n")||"None"}
);

client.once("ready",async()=>{
  const rest=new REST({version:"10"}).setToken(token);
  await rest.put(Routes.applicationCommands(client.user.id),{body:[
    new SlashCommandBuilder().setName("start").setDescription("Start your empire"),
    new SlashCommandBuilder().setName("status").setDescription("View business"),
    new SlashCommandBuilder().setName("locations").setDescription("Manage locations"),
    new SlashCommandBuilder().setName("leaderboard").setDescription("Global rankings")
  ]});
  console.log("✅ BOT READY");
});

client.on("interactionCreate",async i=>{
  if(i.isChatInputCommand()){
    const b=getBiz(i.user.id);

    if(i.commandName==="start"){
      if(b.setup_complete)return i.reply({embeds:[buildBizEmbed(b)]});
      const select=new StringSelectMenuBuilder()
      .setCustomId("select_brand")
      .setPlaceholder("Choose brand")
      .addOptions(Object.entries(BRANDS).map(([k,v])=>({
        label:v.name,value:k,emoji:v.emoji
      })));
      return i.reply({
        embeds:[new EmbedBuilder().setTitle("🍔 Fast Food Tycoon")
        .setDescription("Pick your starting brand")],
        components:[new ActionRowBuilder().addComponents(select)]
      });
    }

    if(i.commandName==="status")
      return i.reply({embeds:[buildBizEmbed(b)]});

    if(i.commandName==="locations"){
      b.locations.forEach(l=>l.tick());
      const embeds=b.locations.map(l=>new EmbedBuilder()
        .setTitle(`${l.brand.emoji} ${l.name}`)
        .setColor(l.brand.color)
        .addFields(
          {name:"💰 Balance",value:`$${l.balance}`,inline:true},
          {name:"📊 Revenue",value:`$${l.revenue_today}`,inline:true},
          {name:"⭐ Reputation",value:`${bar(l.reputation,100)} ${l.reputation}`,inline:true},
          {name:"😊 Satisfaction",value:`${l.avg_satisfaction}%`,inline:true},
          {name:"👥 Customers",value:String(l.customer_count),inline:true},
          {name:"Staff",value:l.employees.map(e=>`${e.name} (${e.role})`).join("\n")||"None"}
        )
      );
      const select=new StringSelectMenuBuilder()
      .setCustomId("select_location")
      .setPlaceholder("Select location")
      .addOptions(b.locations.map(l=>({
        label:l.name,value:l.id,description:l.city
      })));
      return i.reply({embeds,components:[new ActionRowBuilder().addComponents(select)]});
    }

    if(i.commandName==="leaderboard"){
      const lb=Object.values(businesses)
      .sort((a,b)=>b.prestige-a.prestige||b.getTotalBalance()-a.getTotalBalance())
      .slice(0,10);
      return i.reply({embeds:[
        new EmbedBuilder().setTitle("🏆 Leaderboard")
        .setDescription(lb.map((x,i)=>`${i+1}. **${x.business_name}** | Prestige ${x.prestige}`).join("\n"))
      ]});
    }
        }
    if(i.isStringSelectMenu()){
    const b=getBiz(i.user.id);

    if(i.customId==="select_brand"){
      const k=i.values[0],v=BRANDS[k];
      const loc=new Location(v.name,CITIES[Math.random()*CITIES.length|0],k);
      b.business_name=v.name;b.locations.push(loc);b.setup_complete=true;
      return i.reply({embeds:[
        new EmbedBuilder().setTitle(`✅ Welcome to ${v.name}`)
        .setColor(v.color).setDescription(v.description)
      ]});
    }

    if(i.customId==="select_location"){
      const loc=b.locations.find(l=>l.id===i.values[0]); if(!loc)return;
      const row=new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`hire_${loc.id}`).setLabel("👔 Hire").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(`sup_${loc.id}`).setLabel("📦 Supplies").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(`up_${loc.id}`).setLabel("🏗️ Upgrade").setStyle(ButtonStyle.Secondary)
      );
      return i.reply({embeds:[
        new EmbedBuilder().setTitle(`${loc.brand.emoji} ${loc.name}`)
        .addFields({name:"💰 Balance",value:`$${loc.balance}`})
      ],components:[row],ephemeral:true});
    }
  }

  if(i.isButton()){
    const b=getBiz(i.user.id);
    const [act,id]=i.customId.split("_");
    const loc=b.locations.find(l=>l.id===id); if(!loc)return;

    if(act==="hire"){
      const e=new Employee(empName(),"cashier");
      const cost=e.salary*15;
      if(loc.balance<cost)
        return i.reply({content:"❌ Not enough money",ephemeral:true});
      loc.balance-=cost;loc.employees.push(e);
      return i.reply({content:`✅ Hired ${e.name}`,ephemeral:true});
    }

    if(act==="sup"){
      if(loc.balance<800)
        return i.reply({content:"❌ Need $800",ephemeral:true});
      loc.balance-=800;
      return i.reply({content:"📦 Supplies ordered",ephemeral:true});
    }

    if(act==="up"){
      const cost=2000*loc.level;
      if(loc.balance<cost)
        return i.reply({content:"❌ Not enough money",ephemeral:true});
      loc.balance-=cost;loc.level++;b.prestige+=15;
      return i.reply({content:`🏗️ Upgraded to level ${loc.level}`,ephemeral:true});
    }
  }
});

client.login(token);
