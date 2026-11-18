
// ============================================================
//  EVENTS on the road, 1272.  where(X) decides where an event can fire.
//  X: { realm, biome, lon, lat, edge, group, mountain, desert, danger, cargo, str }
//  Choices: p(S,X) = success chance (omit = certain).  ok/bad(S,X,M) apply effects and return result text.
// ============================================================
const pct = p => Math.round(Math.max(0.03, Math.min(0.97, p)) * 100) + '%';
const fightP = (X, B) => X.str / (X.str + B);
const banditStr = (X, k = 1) => Math.round((5 + X.cargo / 260) * X.danger * k);
const inBox = (X, a, b, c, d) => X.lon >= a && X.lon <= c && X.lat >= b && X.lat <= d;
const DESERTS = X => X.desert;

const EVENTS = [
  // ---------------- dangers anywhere ----------------
  { id:'brigands', title:'Brigands on the Road', npc:'bandits', w:X => 1.1 * X.danger * (X.paizaSafe ? 0.5 : 1),
    where: X => X.cargo > 30,
    text: (S, X) => `Armed men step from the rocks and block the road. Their leader looks over your laden animals and grins. "A toll for safe passage, merchant. Half your goods, and you may keep your life."`,
    choices: [
      { t:'Draw weapons and fight', p:(S, X) => fightP(X, banditStr(X)), why:(S, X) => `Your strength ${X.str} against roughly ${banditStr(X)}`,
        ok:(S, X, M) => { M.rep(4); const g = M.coins(Math.round(20 + X.danger * 25)); return `Your caravan drives them off. In their camp you find ${g}.`; },
        bad:(S, X, M) => { M.loseHireAny(); return `The brigands overwhelm you. ${M.loseAllGoods()}`; } },
      { t:'Hand over half your goods', ok:(S, X, M) => `They take what they want and vanish. ${M.loseGoodsFrac(0.5)}` },
      { t:'Flee into the hills', p:(S, X) => 0.25 + (X.speed - 20) / 40, why:(S, X) => `Depends on your caravan's speed (${mi(X.speed)} miles a day)`,
        ok:(S, X, M) => { M.days(1); return 'You scatter into the hills and regroup a day later with everything intact.'; },
        bad:(S, X, M) => `They catch the slowest animals. ${M.loseGoodsFrac(0.6)}` },
    ] },
  { id:'stuck_caravan', title:'A Caravan in Trouble', npc:'caravan', w:1,
    text:'A small caravan is stranded by the road. A camel has died and their water and food are almost gone. Their leader begs you to spare what you can.',
    choices: [
      { t:'Share 10 rations of food', req:S => S.food >= 10, ok:(S, X, M) => { M.supply('food', -10); M.rep(6); if (Math.random() < .6) { const g = M.randomGoodGift(80); return `They bless you by every god on the Silk Road, and press a gift into your hands: ${g}.`; } return 'They thank you warmly. Word of your kindness will travel ahead of you.'; } },
      { t:'Sell them food at a steep price', req:S => S.food >= 10, ok:(S, X, M) => { M.supply('food', -10); M.coins(35); M.rep(-3); return 'They pay, bitterly.'; } },
      { t:'Ride on', ok:(S, X, M) => { M.rep(-2); return 'You leave them to their fate.'; } },
    ] },
  { id:'lame_animal', title:'A Lame Animal', w:(X, S) => S.packCount() > 0 ? 1 : 0,
    text:'One of your pack animals stumbles on the stones and comes up lame. It can barely stand.',
    choices: [
      { t:'Rest for three days and tend it', ok:(S, X, M) => { M.days(3); return 'After three days of rest it can walk again, though slowly.'; } },
      { t:'Redistribute the load and abandon it', ok:(S, X, M) => `${M.loseAnimal()} You spread its load across the others.` },
      { t:'Try a healer\'s poultice (10 dirhams)', req:S => S.coins >= 10, p:() => .65, ok:(S, X, M) => { M.coins(-10); return 'The poultice of herbs and mutton fat works. It walks on by evening.'; }, bad:(S, X, M) => { M.coins(-10); return `The poultice does nothing. ${M.loseAnimal()}`; } },
    ] },
  { id:'veteran', title:'An Old Soldier', npc:'traveller', w:1,
    text:'A scarred veteran of the Mongol wars walks beside your caravan. He has no horse and no master. "Feed me," he says, "and I will guard your goods as I once guarded a khan\'s tent."',
    choices: [
      { t:'Take him on', ok:(S, X, M) => { M.addHire('guard', 1); return 'He joins as a guard, and asks only for his rations.'; } },
      { t:'Decline politely', ok:() => 'He shrugs and walks on toward the next town.' },
    ] },
  { id:'rival', title:'A Rival Merchant', npc:'caravan', w:X => X.cargo > 100 ? 1 : 0,
    text:'A merchant travelling the other way eyes your cargo. "I am short of goods for the market ahead. I will pay you well above the bazaar price, here and now, for some of your load."',
    choices: [
      { t:'Sell him a quarter of your goods', ok:(S, X, M) => M.sellFrac(0.25, 1.2) },
      { t:'Refuse', ok:() => 'You keep your goods for the bazaar.' },
    ] },
  { id:'dice', title:'Dice by the Campfire', w:.7,
    text:'At night the camel drivers gather around a fire, throwing knucklebones. They invite you to try your luck.',
    choices: [
      { t:'Wager 30 dirhams', req:S => S.coins >= 30, p:() => .45, ok:(S, X, M) => { M.coins(30); return 'The bones fall your way. You win 30 dirhams.'; }, bad:(S, X, M) => { M.coins(-30); return 'You lose 30 dirhams, and the drivers laugh until dawn.'; } },
      { t:'Watch, and go to sleep', ok:() => 'You sleep soundly.' },
    ] },
  { id:'cache', title:'An Abandoned Load', w:.6,
    text:'Beside the road lie the bleached bones of a camel and its scattered load, half-buried in dust. No one is in sight.',
    choices: [
      { t:'Search it', p:() => .7, ok:(S, X, M) => `Among the rags you find ${M.randomGoodGift(60)}.`, bad:(S, X, M) => { M.supply('food', -5); return 'Snakes have made it their home. In the commotion a sack of your food is spilled.'; } },
      { t:'Leave the dead in peace', ok:(S, X, M) => { M.rep(1); return 'Your men murmur approval.'; } },
    ] },
  { id:'guards_wages', title:'Grumbling Guards', w:(X, S) => (S.hires.guard || 0) >= 3 ? .8 : 0,
    text:'Your guards gather at dawn. "The road is longer than you promised. Double our pay, or we leave at the next town."',
    choices: [
      { t:'Pay them a bonus (5 dirhams each)', req:S => S.coins >= 5 * S.hires.guard, ok:(S, X, M) => { M.coins(-5 * S.hires.guard); return 'They grin and take up their spears again.'; } },
      { t:'Stand firm', p:(S, X) => .3 + S.rep / 200, why:S => `Depends on your reputation (${Math.round(S.rep)})`, ok:(S, X, M) => { M.rep(2); return 'They grumble but stay.'; }, bad:(S, X, M) => { M.loseHire('guard', Math.ceil(S.hires.guard / 2)); return 'Half of them walk off with their spears.'; } },
    ] },
  { id:'rumour', title:'Gossip of the Bazaars', npc:'caravan', w:1.2,
    text:'A friendly caravan shares your campfire. Over sweet tea their master talks of prices in the markets ahead.',
    choices: [
      { t:'Listen closely', ok:(S, X, M) => M.rumour() },
      { t:'Buy them a round of wine and ask more (10 dirhams)', req:S => S.coins >= 10, ok:(S, X, M) => { M.coins(-10); return M.rumour() + '<br><br>' + M.rumour(); } },
    ] },
  { id:'wolves', title:'Wolves in the Night', w:X => (X.biome === 'steppe' || X.mountain || X.biome === 'alpine' || X.biome === 'anatolia') ? 1 : .2,
    text:'Howls circle the camp after dark. Your animals stamp and pull at their tethers.',
    choices: [
      { t:'Keep the fires high all night', req:S => S.food >= 3, ok:(S, X, M) => { M.supply('food', -3); return 'No one sleeps, but the wolves keep their distance.'; } },
      { t:'Go out with torches and spears', p:(S, X) => fightP(X, 6), why:(S, X) => `Your strength ${X.str}`, ok:(S, X, M) => { M.rep(2); return 'You drive the pack off with burning brands.'; }, bad:(S, X, M) => M.loseAnimal() + ' The wolves drag it into the dark.' },
    ] },

  // ---------------- Byzantium & Anatolia ----------------
  { id:'seljuk_han', title:'The Sultan\'s Caravanserai', w:3, where:X => X.realm === 'rum' || X.realm === 'byz' && X.lon > 30,
    text:'You reach a great stone han built by the Seljuk sultans. By the founder\'s endowment, every traveller is given three days of free lodging, food for himself and fodder for his animals.',
    choices: [
      { t:'Accept the hospitality', ok:(S, X, M) => { M.supply('food', 3 * S.people()); M.supply('fodder', 3 * S.animalFodder()); M.days(1); return 'You eat well, mend saddles and rest the animals. Your stores are topped up.'; } },
      { t:'Give alms to the han\'s charity (20 dirhams)', req:S => S.coins >= 20, ok:(S, X, M) => { M.coins(-20); M.rep(5); M.supply('food', 3 * S.people()); return 'The steward records your gift in the han\'s ledger.'; } },
    ] },
  { id:'turkomans', title:'Turkoman Herders', npc:'nomads', w:2, where:X => X.realm === 'rum' || inBox(X, 30, 37, 45, 41),
    text:'A band of Turkoman herders is moving its flocks across the road. Polo called them "rude people with a rude language", but they weave the finest carpets in the world.',
    choices: [
      { t:'Buy carpets straight from the weavers', req:S => S.coins >= 40, ok:(S, X, M) => M.buyCheap('carpets', 3, 0.6) },
      { t:'Pass them warily', p:(S, X) => .7 + X.str / 100, ok:() => 'They watch you pass but do nothing.', bad:(S, X, M) => `Young men ride in and snatch goods from the back of your caravan. ${M.loseGoodsFrac(0.15)}` },
    ] },
  { id:'pervane', title:'The Pervane\'s Tax Men', npc:'officials', w:1.5, where:X => X.realm === 'rum',
    text:'Officials of the Pervane Mu\'in al-Din, who rules Rûm on behalf of the Mongols, stop the caravan. They demand a special levy "for the Ilkhan\'s army".',
    choices: [
      { t:'Pay the levy', ok:(S, X, M) => { const c = Math.max(10, Math.round(X.cargo * .05)); M.coins(-Math.min(S.coins, c)); return `You pay ${Math.min(S.coins, c)} dirhams.`; } },
      { t:'Show your paiza', req:S => S.paiza, ok:(S, X, M) => { M.rep(2); return 'They see the Khan\'s tablet, bow, and wave you on.'; } },
      { t:'Argue that you have already paid at the city gate', p:S => .25 + S.rep / 150, ok:() => 'They grudgingly let you go.', bad:(S, X, M) => { const c = Math.max(20, Math.round(X.cargo * .1)); M.coins(-Math.min(S.coins, c)); return 'They double the levy for your insolence.'; } },
    ] },
  { id:'ararat', title:'In the Shadow of Ararat', npc:'monk', w:3, once:true, where:X => inBox(X, 42, 38.8, 45.5, 40.5),
    text:'An Armenian monk points to the snow-capped mountain. "The Ark of Noah rests up there," he says, "but no one can climb to it, for the snow never melts."',
    choices: [
      { t:'Give alms for the monastery (15 dirhams)', req:S => S.coins >= 15, ok:(S, X, M) => { M.coins(-15); M.rep(5); return 'He blesses your journey and gives you bread for the road.'; } },
      { t:'Ask about the road ahead', ok:(S, X, M) => M.rumour() },
    ] },

  // ---------------- Caucasus & Black Sea ----------------
  { id:'derbent', title:'War at the Iron Gates', npc:'soldiers', w:3, where:X => inBox(X, 46.5, 40.5, 49.5, 44.5),
    text:'Since 1262 the Golden Horde and the Ilkhanate have fought over the passes of the Caucasus. A patrol stops you: are you a spy for the other khan?',
    choices: [
      { t:'Show your paiza', req:S => S.paiza, ok:() => 'The captain reads the tablet and lets you through.' },
      { t:'Bribe the captain (40 dirhams)', req:S => S.coins >= 40, ok:(S, X, M) => { M.coins(-40); return 'The coins vanish into his sleeve and you are waved on.'; } },
      { t:'Insist you are an honest merchant', p:S => .3 + S.rep / 120, ok:(S, X, M) => { M.rep(2); return 'He believes you, this time.'; }, bad:(S, X, M) => { M.days(4); return `You are held for four days while they search everything. ${M.loseGoodsFrac(0.2)}`; } },
    ] },
  { id:'genoese', title:'A Genoese Factor', npc:'traveller', w:2, where:X => inBox(X, 34, 40, 42, 42.5),
    text:'A Genoese merchant from the new colonies on the Black Sea is buying eastern goods for the ships at Trebizond.',
    choices: [
      { t:'Sell him your eastern goods at a premium', ok:(S, X, M) => M.sellFrac(0.4, 1.15, g => ECON.dist[g] && ECON.dist[g]['constantinople'] > 2000) },
      { t:'No business today', ok:() => 'He tips his cap.' },
    ] },

  // ---------------- Levant & Mamluk frontier ----------------
  { id:'mamluk_patrol', title:'A Mamluk Patrol', npc:'soldiers', w:3, where:X => X.realm === 'mamluk' || inBox(X, 35.5, 35, 39, 37),
    text:'Riders of Sultan Baybars gallop up. The Mamluks are at war with the Mongols, and any caravan coming from Mongol lands is suspected of spying.',
    choices: [
      { t:'Pay the "frontier tax" (8% of your cargo)', ok:(S, X, M) => { const c = Math.round(X.cargo * .08); M.coins(-Math.min(S.coins, c)); return `You pay ${Math.min(S.coins, c)} dirhams.`; } },
      { t:'Hide your paiza and play the simple merchant', p:S => S.paiza ? .5 : .7, ok:() => 'They grow bored and ride away.', bad:(S, X, M) => { if (S.paiza) { M.losePaiza(); return 'They find the Mongol tablet! You lose the paiza and barely escape with your life.'; } M.days(3); return `They hold you three days on suspicion. ${M.loseGoodsFrac(0.15)}`; } },
    ] },
  { id:'barid', title:'The Sultan\'s Post Rider', npc:'traveller', w:1.5, where:X => X.realm === 'mamluk',
    text:'A rider of the Mamluk barid, the sultan\'s postal service, gallops past. He reins in long enough to share news from Cairo.',
    choices: [ { t:'Ask for news of the markets', ok:(S, X, M) => M.rumour() } ] },

  // ---------------- Mesopotamia & Persia ----------------
  { id:'kurds', title:'Kurdish Raiders', npc:'bandits', w:X => 2.5 * (X.paizaSafe ? .6 : 1), where:X => inBox(X, 41, 33, 47, 38.5),
    text:'Polo warned that the Kurds of the mountains around Mosul "willingly plunder merchants". Horsemen are coming down from the hills.',
    choices: [
      { t:'Form a circle and fight', p:(S, X) => fightP(X, banditStr(X, 1.2)), why:(S, X) => `Strength ${X.str} against about ${banditStr(X, 1.2)}`, ok:(S, X, M) => { M.rep(5); return 'Your archers empty two saddles and the raiders wheel away.'; }, bad:(S, X, M) => `The raiders break your circle. ${M.loseAllGoods()}` },
      { t:'Offer a tribute of 10% of your goods', ok:(S, X, M) => `Their chief accepts and even gives you a guide to the next well. ${M.loseGoodsFrac(0.1)}` },
    ] },
  { id:'qaraunas', title:'The Qaraunas', npc:'bandits', w:X => 3 * (X.paizaSafe ? .7 : 1), where:X => inBox(X, 54, 26, 66, 33),
    text:'Polo wrote that the Qaraunas raiders of Persia could, by enchantment, make the day go dark so that travellers could not see them coming. A strange dust haze is gathering around you.',
    choices: [
      { t:'Tie the animals together and push for the nearest village', p:(S, X) => .35 + X.str / 60 + (S.hires.guide ? .15 : 0), why:(S, X) => `Strength ${X.str}${S.hires.guide ? ', and your guide knows the way' : ''}`, ok:(S, X, M) => 'You reach a walled village just as the riders appear out of the haze. The villagers bar the gate behind you.', bad:(S, X, M) => `The riders come out of the dark. ${M.loseGoodsFrac(0.7)}` },
      { t:'Stand and fight', p:(S, X) => fightP(X, banditStr(X, 1.4)), ok:(S, X, M) => { M.rep(6); M.coins(60); return 'You beat them off and take their spoils: 60 dirhams.'; }, bad:(S, X, M) => `You are overwhelmed in the darkness. ${M.loseAllGoods()}` },
    ] },
  { id:'yam', title:'A Station of the Yam', npc:'officials', w:2.5, where:X => REALMS[X.realm] && REALMS[X.realm].mongol && !X.mountain,
    text:'You reach a post station of the yam, the Mongol relay network. Polo counted 200,000 horses in its stations. Fresh horses and provisions wait for those with the Khan\'s authority.',
    choices: [
      { t:'Show your paiza and claim provisions', req:S => S.paiza, ok:(S, X, M) => { M.supply('food', 4 * S.people()); M.supply('fodder', 4 * S.animalFodder()); M.supply('water', 3 * S.people()); return 'The station master supplies you without charge, as the Khan commands.'; } },
      { t:'Buy food from the station keepers (25 dirhams)', req:S => S.coins >= 25, ok:(S, X, M) => { M.coins(-25); M.supply('food', 4 * S.people()); M.supply('fodder', 3 * S.animalFodder()); return 'They sell you provisions at a fair price.'; } },
      { t:'Ride past', ok:() => 'You water the animals at the trough and ride on.' },
    ] },
  { id:'qanat', title:'The Dry Qanat', w:2, where:X => X.biome === 'iran' || X.biome === 'mesopotamia',
    text:'The well marked on your route is dry. A villager says the qanat, the underground water channel feeding it, has collapsed. The qanat-diggers are at work, for a fee.',
    choices: [
      { t:'Pay the diggers for water (15 dirhams)', req:S => S.coins >= 15, ok:(S, X, M) => { M.coins(-15); M.supply('water', 3 * S.people() + 2 * S.packCount()); return 'You fill every skin.'; } },
      { t:'Press on to the next well', p:S => S.hires.guide ? .85 : .55, ok:() => 'You find water a day later.', bad:(S, X, M) => { M.supply('water', -Math.round(S.water * .6)); return 'The next well is dry too. Your water is running dangerously low.'; } },
    ] },
  { id:'old_man', title:'The Old Man of the Mountain', npc:'traveller', w:1.5, once:true, where:X => inBox(X, 49, 34.5, 60, 38),
    text:'An old storyteller tells you of the Old Man of the Mountain, lord of the Assassins of Alamut. He drugged young men, showed them a garden paradise, and sent them out to kill. Hülegü destroyed his castles in 1256.',
    choices: [ { t:'Pay him for the tale (5 dirhams)', req:S => S.coins >= 5, ok:(S, X, M) => { M.coins(-5); M.rep(1); S.flags.om = S.day; S.flags.om_kind = 1; return 'Your men are spellbound. You will tell the story in every caravanserai ahead.'; } }, { t:'Wave him away', ok:(S) => { S.flags.om = S.day; return 'He curses you mildly and wanders off.'; } } ] },
  { id:'maragheh', title:'An Astronomer\'s Request', npc:'monk', w:3, once:true, where:X => inBox(X, 44.5, 36, 48.5, 39),
    text:'A scholar from Nasir al-Din Tusi\'s observatory at Maragheh asks you to carry a crate of astronomical tables to a colleague in the east, to be delivered at Samarkand.',
    choices: [
      { t:'Accept (it weighs 1 load)', ok:(S, X, M) => { M.addGood('tables', 1); M.flag('tables'); return 'He promises a rich reward from the scholars of Samarkand.'; } },
      { t:'Decline', ok:() => 'He bows and goes to find another caravan.' },
    ] },
  { id:'simoom', title:'The Burning Wind', w:3, where:X => inBox(X, 54, 25, 59.5, 30),
    text:'Polo wrote that near Hormuz a wind blows so hot that it can kill a man, and the people survive by standing up to their necks in water. The air is beginning to scorch.',
    choices: [
      { t:'Shelter by a stream until it passes', ok:(S, X, M) => { M.days(2); return 'You lie in the shallows for two days, miserable but alive.'; } },
      { t:'Push on through it', p:() => .5, ok:(S, X, M) => { M.supply('water', -Math.round(S.water * .4)); return 'You make it through, but the wind dries out your water skins.'; }, bad:(S, X, M) => { M.supply('water', -Math.round(S.water * .5)); return M.loseAnimal() + ' The heat kills it.'; } },
    ] },

  // ---------------- Khorasan, Afghanistan, Badakhshan ----------------
  { id:'chagatai_war', title:'Armies on the Move', npc:'soldiers', w:2.5, where:X => inBox(X, 58, 34, 72, 41),
    text:'In 1270 Baraq of the Chagatai Khanate invaded Khorasan and was crushed by the Ilkhan Abaqa near Herat. The region is still full of soldiers, and a troop is requisitioning animals.',
    choices: [
      { t:'Give them one animal', req:S => S.packCount() > 0, ok:(S, X, M) => M.loseAnimal() },
      { t:'Pay them off (50 dirhams)', req:S => S.coins >= 50, ok:(S, X, M) => { M.coins(-50); return 'The officer pockets the silver.'; } },
      { t:'Show your paiza', req:S => S.paiza, ok:() => 'The Khan\'s tablet ends the conversation.' },
      { t:'Hide in a side valley', p:S => S.hires.guide ? .8 : .5, ok:(S, X, M) => { M.days(2); return 'They pass you by.'; }, bad:(S, X, M) => `They find you and take what they like. ${M.loseGoodsFrac(0.25)}` },
    ] },
  { id:'badakhshan_fever', title:'Fever in the Mountains', w:3, once:true, where:X => inBox(X, 67, 35.5, 72.5, 38),
    text:'You fall ill with a burning fever. Marco Polo fell sick here too, and recovered only after a year in the clean mountain air.',
    choices: [
      { t:'Rest in the mountain villages for a month', ok:(S, X, M) => { M.days(30); M.rep(1); return 'A month later you are strong again.'; } },
      { t:'Ride on through it', p:() => .55, ok:() => 'Shivering in the saddle, you somehow recover on the road.', bad:(S, X, M) => { M.days(10); return `You collapse and your men nurse you for ten days. While you lie sick, some of your goods go missing. ${M.loseGoodsFrac(0.15)}`; } },
    ] },
  { id:'ruby_smuggler', title:'A Ruby Smuggler', npc:'traveller', w:3, where:X => inBox(X, 68, 35, 74, 38.5),
    text:'A man sidles up with a pouch of balas rubies at half price. "From the king\'s own mines. He will never miss them." In Badakhshan, smuggling rubies is punished by death.',
    choices: [
      { t:'Buy them', req:S => S.coins >= 60, p:() => .7, ok:(S, X, M) => M.buyCheap('rubies', 2, 0.45), bad:(S, X, M) => { M.coins(-Math.min(S.coins, 100)); M.rep(-10); return 'The king\'s men were watching. You pay a heavy fine of up to 100 dirhams to keep your head.'; } },
      { t:'Report him to the king\'s officers', ok:(S, X, M) => { M.rep(6); M.coins(25); return 'The officers reward you with 25 dirhams.'; } },
      { t:'Ignore him', ok:() => 'He melts back into the crowd.' },
    ] },
  { id:'bucephalus', title:'Horses of Bucephalus', npc:'nomads', w:2, once:true, where:X => inBox(X, 67, 35.5, 72.5, 38),
    text:'A horse breeder claims his herd descends from Bucephalus, Alexander the Great\'s horse, and that each foal is born with a horn-like mark on its brow. He offers you a horse.',
    choices: [
      { t:'Buy horses of his line (300 dirhams)', req:S => S.coins >= 300 && !(S.speed && S.speed.breed), ok:(S, X, M) => { M.coins(-300); M.speedUp('bucephalus'); return 'Your caravan now moves on horses fit for a conqueror (+30% speed).'; } },
      { t:'Admire it and move on', ok:() => 'Its descendants, Polo says, were killed off by a jealous uncle of the king.' },
    ] },

  // ---------------- The Pamirs and mountain passes ----------------
  { id:'pamir_fire', title:'The Roof of the World', w:3, where:X => inBox(X, 71.5, 36.5, 76, 39.5),
    text:'You are so high that, as Polo noted, fire burns weakly and food will not cook properly. The animals are struggling to breathe.',
    choices: [
      { t:'Burn extra fodder to cook the meals', req:S => S.fodder >= 10, ok:(S, X, M) => { M.supply('fodder', -10); return 'The men eat hot food at least, and keep their strength.'; } },
      { t:'Eat cold and press on', ok:(S, X, M) => { M.supply('food', -2 * S.people()); return 'Half-cooked food, half digested. You get through more rations than usual.'; } },
    ] },
  { id:'argali', title:'The Great Sheep', w:2, where:X => inBox(X, 71.5, 36.5, 76, 39.5),
    text:'A herd of wild sheep with enormous curling horns crosses the slope above. Polo said their horns were six palms long; the shepherds use them as bowls.',
    choices: [
      { t:'Hunt them', p:S => (S.arms.bow ? .75 : .35) + (S.hires.archer ? .15 : 0), why:S => S.arms.bow || S.hires.archer ? 'You have bows' : 'You have no bows', ok:(S, X, M) => { M.supply('food', 4 * S.people() + 6); return 'Mutton for everyone. You salt the rest for the road.'; }, bad:(S, X, M) => { M.days(1); return 'The sheep vanish over the ridge, and you lose a day.'; } },
      { t:'Let them pass', ok:() => 'They watch you with yellow eyes.' },
    ] },
  { id:'snow_pass', title:'Snow in the Pass', w:X => X.mountain ? 2.5 : 0,
    text:'Snow is falling heavily. The pass ahead will soon be choked. Your men want to turn back and wait.',
    choices: [
      { t:'Wait for the storm to pass', ok:(S, X, M) => { M.days(5); return 'You shelter for five days under rock overhangs.'; } },
      { t:'Push through before it closes', p:S => .45 + (S.hires.guide ? .25 : 0) + (S.packKinds().yak || S.packKinds().mule ? .15 : 0), why:S => (S.hires.guide ? 'Your guide knows the pass. ' : '') + (S.packKinds().yak || S.packKinds().mule ? 'Mules and yaks are sure-footed.' : ''), ok:(S, X, M) => { M.rep(2); return 'You struggle over the top just before the snow closes it.'; }, bad:(S, X, M) => `An avalanche sweeps across the trail. ${M.loseAnimal()} ${M.loseGoodsFrac(0.2)}` },
    ] },

  // ---------------- Central Asia ----------------
  { id:'kaidu', title:'Kaidu\'s Riders', npc:'soldiers', w:2.5, where:X => inBox(X, 66, 36, 92, 46),
    text:'Kaidu, grandson of Ögedei, is at war with Kublai and controls much of Central Asia. His riders demand to know whose side you are on.',
    choices: [
      { t:'Pay tribute (10% of your goods)', ok:(S, X, M) => { S.flags.kd_paid = S.day; return `They take their share. ${M.loseGoodsFrac(0.1)}`; } },
      { t:'Hide your paiza and swear you trade for no khan', p:S => S.paiza ? .5 : .75, ok:() => 'They let you go.', bad:(S, X, M) => { if (S.paiza) M.losePaiza(); return `${S.paiza ? 'They find Kublai\'s tablet and take it. ' : ''}${M.loseGoodsFrac(0.3)}`; } },
      { t:'Fight', p:(S, X) => fightP(X, banditStr(X, 1.6)), ok:(S, X, M) => { M.rep(4); S.flags.kd_enemy = S.day; return 'You win, but you have made an enemy of Kaidu.'; }, bad:(S, X, M) => M.loseAllGoods() },
    ] },
  { id:'kipchak', title:'Kipchak Herders', npc:'nomads', w:2, where:X => X.biome === 'steppe',
    text:'Kipchak herders ride over with leather bags of kumis, fermented mare\'s milk. They want to trade.',
    choices: [
      { t:'Trade for food and fodder (15 dirhams)', req:S => S.coins >= 15, ok:(S, X, M) => { M.coins(-15); M.supply('food', 3 * S.people() + 4); M.supply('fodder', 8); return 'The kumis is sour and strong. Your men like it.'; } },
      { t:'Buy a pack pony (90 dirhams)', req:S => S.coins >= 90, ok:(S, X, M) => { M.coins(-90); M.setMount('horse'); return 'A tough little steppe pony joins your caravan as a pack animal.'; } },
      { t:'Ride on', ok:() => 'They shrug and ride off.' },
    ] },
  { id:'steppe_fire', title:'Grass Fire', w:1.5, where:X => X.biome === 'steppe',
    text:'A wall of smoke is rolling across the grassland toward you, driven by the wind.',
    choices: [
      { t:'Burn a firebreak and shelter in it', p:S => .7 + (S.hires.guide ? .2 : 0), ok:() => 'The fire splits around your burnt patch and passes.', bad:(S, X, M) => `The fire jumps the break. ${M.loseGoodsFrac(0.25)}` },
      { t:'Run for the river', p:(S, X) => .3 + (X.speed - 20) / 30, ok:(S, X, M) => { M.days(1); return 'You reach the water with everything intact.'; }, bad:(S, X, M) => M.loseAnimal() + ' ' + M.loseGoodsFrac(0.2) },
    ] },
  { id:'nestorians', title:'Nestorian Monks', npc:'monk', w:1.5, where:X => X.lon > 40,
    text:'A band of Nestorian Christian monks is walking east toward the Khan\'s lands. There are Nestorian churches all along the road to China, from Mosul to Khanbaliq.',
    choices: [
      { t:'Let them travel with you', req:S => S.food >= 8, ok:(S, X, M) => { M.supply('food', -8); M.rep(5); return 'They share stories and their prayers. Your name is spoken well of in the churches ahead.'; } },
      { t:'Wish them well', ok:() => 'They raise their hands in blessing.' },
    ] },
  { id:'dervish', title:'A Wandering Dervish', npc:'monk', w:1.2, where:X => ['rum', 'ilkhan', 'chagatai', 'mamluk', 'horde'].includes(X.realm),
    text:'A Sufi dervish in a patched cloak blesses your caravan. He follows the path of Rumi of Konya, still alive in 1272.',
    choices: [
      { t:'Give him alms (5 dirhams)', req:S => S.coins >= 5, ok:(S, X, M) => { M.coins(-5); M.rep(3); return 'He whirls, laughing, and blesses every animal.'; } },
      { t:'Share your bread', req:S => S.food >= 2, ok:(S, X, M) => { M.supply('food', -2); M.rep(2); return 'He eats with your men and tells them riddles.'; } },
    ] },

  // ---------------- Tarim Basin ----------------
  { id:'lop_voices', title:'Voices in the Desert', w:4, where:X => inBox(X, 85, 37.5, 95, 41) && X.desert,
    text:'At night, men hear voices calling their names from the dunes. Polo wrote that the spirits of the Desert of Lop lure stragglers away from the caravan. One of your camel drivers is walking toward the sound.',
    choices: [
      { t:'Tie the animals together and hang bells on their necks', ok:(S, X, M) => { M.rep(1); return 'Just as Polo described, you tie everyone together. The bells ring all night and no one is lost.'; } },
      { t:'Follow the voices', p:() => .2, ok:(S, X, M) => `In a hollow among the dunes you find the ruin of an ancient town, and ${M.randomGoodGift(150)}.`, bad:(S, X, M) => { M.days(3); if ((S.hires.handler || 0) > 0) M.loseHire('handler', 1); M.supply('water', -Math.round(S.water * .4)); return 'You wander for three days. When you find the caravan, your water is almost gone and one man never came back.'; } },
    ] },
  { id:'kara_buran', title:'Black Storm', w:X => X.desert ? 3 : 0,
    text:'The sky turns brown, then black. A kara-buran, the black sandstorm of the Taklamakan, is racing toward you.',
    choices: [
      { t:'Make the camels kneel and shelter behind them', p:S => .55 + (S.packKinds().camel ? .3 : 0), why:S => S.packKinds().camel ? 'Camels know what to do' : 'You have no camels', ok:(S, X, M) => { M.days(1); return 'You lie behind the kneeling camels until the storm blows itself out.'; }, bad:(S, X, M) => `When the storm lifts, part of the load is buried somewhere under the sand. ${M.loseGoodsFrac(0.3)}` },
      { t:'Try to outrun it', p:(S, X) => .2 + (X.speed - 20) / 40, ok:() => 'You outpace the storm by a whisker.', bad:(S, X, M) => `${M.loseAnimal()} ${M.loseGoodsFrac(0.35)}` },
    ] },
  { id:'buried_city', title:'A City Under the Sand', w:2, where:X => X.desert && X.lon > 77,
    text:'The wind has uncovered the walls of a long-dead city: wooden posts and the outline of houses. Old Buddhist cities like this lie all around the Taklamakan.',
    choices: [
      { t:'Dig for a day', p:() => .55, ok:(S, X, M) => { M.days(1); return `You find ${M.randomGoodGift(120)}.`; }, bad:(S, X, M) => { M.days(1); M.supply('water', -Math.round(S.people() * 2)); return 'You find only potsherds, and the digging costs you water.'; } },
      { t:'Leave it to the ghosts', ok:() => 'Your camel drivers are relieved.' },
    ] },
  { id:'jade_river', title:'The Jade River', npc:'nomads', w:3, where:X => inBox(X, 78.5, 36, 81.5, 38),
    text:'Along the White Jade River, villagers wade into the cold water feeling for stones with their feet. They offer to sell you some.',
    choices: [
      { t:'Buy jade straight from the divers', req:S => S.coins >= 30, ok:(S, X, M) => M.buyCheap('jade', 3, 0.55) },
      { t:'Watch and move on', ok:() => 'One of the divers holds up a perfect white pebble and grins.' },
    ] },
  { id:'dry_well', title:'The Well Is Bitter', w:X => X.desert ? 2 : 0,
    text:'The next well is brackish. Polo warned that some desert wells are bitter, and drinking from them gives you a flux.',
    choices: [
      { t:'Drink only from your own skins', ok:(S, X, M) => { M.supply('water', -S.people() * 2); return 'You ration what you carry.'; } },
      { t:'Water the animals from it', p:() => .6, ok:(S, X, M) => { M.supply('water', 2 * S.packCount()); return 'The animals drink and seem fine.'; }, bad:(S, X, M) => M.loseAnimal() + ' It sickens after drinking.' },
    ] },

  // ---------------- China ----------------
  { id:'paper_money', title:'The Khan\'s Paper Money', npc:'officials', w:2, once:true, where:X => X.realm === 'yuan' && X.lon > 94,
    text:'At the frontier of China proper, officials explain that in the Great Khan\'s lands all trade must be paid in paper money, printed on mulberry bark and stamped with his seal. Refusing it is punishable by death.',
    choices: [
      { t:'Change some of your silver (pay a 5% fee)', ok:(S, X, M) => { const fee = Math.round(S.coins * .05); M.coins(-fee); M.rep(3); return `You pay ${fee} dirhams in fees. Polo marvelled that this paper was accepted everywhere as if it were gold.`; } },
      { t:'Hide your silver and say nothing', p:() => .6, ok:() => 'They do not search you.', bad:(S, X, M) => { const f = Math.round(S.coins * .2); M.coins(-f); M.rep(-5); return `They find your silver and confiscate ${f} dirhams.`; } },
    ] },
  { id:'monastery', title:'Buddhist Monastery', npc:'monk', w:2, where:X => ['yuan', 'tibet'].includes(X.realm) || (X.lon > 86 && X.realm === 'yuan'),
    text:'Monks in saffron robes invite you to rest at their monastery. Inside is a great reclining Buddha. Polo wrote that the "idolaters" of these lands kept many monasteries.',
    choices: [
      { t:'Accept and make an offering (10 dirhams)', req:S => S.coins >= 10, ok:(S, X, M) => { M.coins(-10); M.rep(3); M.supply('food', 2 * S.people()); return 'You sleep under painted ceilings and leave with your food bags refilled.'; } },
      { t:'Accept without an offering', ok:(S, X, M) => { M.supply('food', S.people()); return 'The monks are gracious anyway.'; } },
    ] },
  { id:'sheepskin_raft', title:'Crossing the Yellow River', npc:'traveller', w:4, where:X => inBox(X, 103, 35.5, 107, 38.8),
    text:'At the Yellow River, ferrymen float the caravan across on rafts of inflated sheepskins lashed to wooden frames.',
    choices: [
      { t:'Pay the ferrymen well (20 dirhams)', req:S => S.coins >= 20, ok:(S, X, M) => { M.coins(-20); return 'They float you across with everything dry.'; } },
      { t:'Haggle them down', p:() => .6, ok:(S, X, M) => { M.coins(-5); return 'They grumble but take you across for 5 dirhams.'; }, bad:(S, X, M) => `A raft tips in the current. ${M.loseGoodsFrac(0.15)}` },
    ] },
  { id:'xiangyang_siege', title:'The Siege of Xiangyang', npc:'soldiers', w:4, where:X => inBox(X, 110, 30.5, 114.5, 33.5),
    text:'Mongol soldiers stop the caravan. For four years they have besieged Xiangyang, and Persian engineers are building great counterweight trebuchets. The army needs supplies.',
    choices: [
      { t:'Sell them food at a good price', req:S => S.food >= 20, ok:(S, X, M) => { M.supply('food', -20); M.coins(45); M.rep(3); return 'The quartermaster pays 45 dirhams in paper money.'; } },
      { t:'Show your paiza', req:S => S.paiza, ok:() => 'They salute and let you pass.' },
      { t:'Try to slip past', p:() => .5, ok:() => 'You pass unnoticed.', bad:(S, X, M) => `They requisition part of your cargo. ${M.loseGoodsFrac(0.2)}` },
    ] },
  { id:'song_patrol', title:'A Song Patrol', npc:'soldiers', w:2.5, where:X => X.realm === 'song',
    text:'Soldiers of the Southern Song stop you. To them, anyone from the north might be a Mongol spy.',
    choices: [
      { t:'Pay them a "gift" (30 dirhams)', req:S => S.coins >= 30, ok:(S, X, M) => { M.coins(-30); return 'The officer pockets it.'; } },
      { t:'Hide your paiza', p:S => S.paiza ? .45 : .8, ok:() => 'They let you through.', bad:(S, X, M) => { if (S.paiza) { M.losePaiza(); return `They find the Mongol tablet and take it. ${M.loseGoodsFrac(0.25)}`; } return M.loseGoodsFrac(0.15); } },
    ] },
  { id:'grand_canal', title:'Grain Barges', npc:'traveller', w:2.5, where:X => inBox(X, 116, 30, 121, 35),
    text:'A barge master on the canal offers to carry your goods and animals downstream for a fee, faster than the road.',
    choices: [
      { t:'Take the barge (30 dirhams, saves time and food)', req:S => S.coins >= 30, ok:(S, X, M) => { M.coins(-30); M.supply('food', 3 * S.people()); M.supply('fodder', 3 * S.animalFodder()); return 'You drift down the canal past rice paddies and willows, saving several days of supplies.'; } },
      { t:'Keep to the road', ok:() => 'You wave him off.' },
    ] },
  { id:'tea_horse', title:'Tea for Horses', npc:'nomads', w:3, where:X => inBox(X, 98, 34.5, 104, 38),
    text:'Tibetan traders at the frontier want to swap horses for tea. It is an old trade, and they drive a hard bargain.',
    choices: [
      { t:'Trade 4 bales of tea for a horse', req:S => (S.cargo.tea || 0) >= 4, ok:(S, X, M) => { M.addGood('tea', -4); M.setMount('horse'); return 'A good pack horse, cheaply bought.'; } },
      { t:'Sell them tea for silver', req:S => (S.cargo.tea || 0) >= 1, ok:(S, X, M) => M.sellFrac(1, 1.4, g => g === 'tea') },
      { t:'No trade', ok:() => 'They ride on.' },
    ] },
  { id:'khans_hunt', title:'The Khan\'s Hunt', npc:'soldiers', w:3, once:true, where:X => inBox(X, 113, 39, 118, 43),
    text:'You meet a hunting party from the Khan\'s court: falconers, beaters and cheetahs riding behind the saddles. An officer asks who you are.',
    choices: [
      { t:'Present a gift for the court (100 dirhams of goods)', req:(S, X) => X.cargo >= 100, ok:(S, X, M) => { M.loseValue(100); M.rep(12); return 'The officer promises to speak your name at court.'; } },
      { t:'Bow low and let them pass', ok:(S, X, M) => { M.rep(2); return 'The hunt thunders past.'; } },
    ] },

  // ---------------- Tibet ----------------
  { id:'mastiffs', title:'Tibetan Mastiffs', npc:'nomads', w:3, where:X => X.realm === 'tibet',
    text:'Herders keep great shaggy mastiffs. Polo said they were as big as donkeys and could hunt wild beasts. One herder offers a pup.',
    choices: [
      { t:'Buy a mastiff (40 dirhams)', req:S => S.coins >= 40 && (S.up.dog || 0) < 2, ok:(S, X, M) => { M.coins(-40); S.up.dog = (S.up.dog || 0) + 1; return 'Your caravan has a new guardian (+2 strength).'; } },
      { t:'Admire them from a distance', ok:() => 'The dogs growl at your camels.' },
    ] },
  { id:'bamboo', title:'Bamboo Fires', w:2, where:X => inBox(X, 94, 27, 104, 34),
    text:'Polo wrote that travellers here burn green bamboo at night: it bursts with loud cracks that frighten off lions and bears.',
    choices: [
      { t:'Burn bamboo through the night', ok:(S, X, M) => { M.rep(1); return 'The bangs echo off the mountains. Nothing comes near.'; } },
      { t:'Sleep without fires', p:() => .6, ok:() => 'A quiet night.', bad:(S, X, M) => M.loseAnimal() + ' A bear takes it in the night.' },
    ] },
  { id:'prayer_flags', title:'A Pass of Prayer Flags', w:2.5, where:X => X.realm === 'tibet' || X.biome === 'tibet',
    text:'At the top of the pass, a cairn of mani stones and prayer flags snaps in the wind. Pilgrims add a stone for a safe journey.',
    choices: [
      { t:'Add a stone and a strip of cloth', ok:(S, X, M) => { M.rep(2); return '"Lha gyalo!" — your men shout with the pilgrims: "The gods are victorious!"'; } },
      { t:'Hurry on', ok:() => 'The wind is bitterly cold.' },
    ] },
];

// ============================================================
//  BUILD 2 events: Egypt, Arabia, India, Indochina & Yunnan (1272)
// ============================================================
const EGYPT = X => inBox(X, 28.5, 23.5, 34.3, 31.7);
const ARABIA = X => inBox(X, 34.6, 12, 56, 30.2) && !inBox(X, 34.6, 29.2, 36.2, 30.2);
const YEMEN = X => inBox(X, 42.5, 12, 56, 18.2);
const INDIA = X => inBox(X, 66.5, 7.5, 92.5, 34.5) && !(X.lat > 28.3 && X.lon > 80);
const NINDIA = X => INDIA(X) && X.lat > 23.5;
const SINDIA = X => INDIA(X) && X.lat < 21;
const SEASIA = X => inBox(X, 92.3, 4.5, 110, 25.5) && !(X.lon > 98.5 && X.lat > 23.2 && X.lon < 106);
const YUNNAN = X => inBox(X, 98.5, 22.8, 104.5, 29.5);
const WET = X => SEASIA(X) || (INDIA(X) && (X.lon > 86 || X.lat < 14)) || YUNNAN(X);

EVENTS.push(
  // ---------------- Egypt ----------------
  { id:'nile_flood', title:'The Nile in Flood', npc:'traveller', w:2.5, where:X => EGYPT(X) && X.lat < 30.3,
    text:'The river has risen over the fields, as it does every late summer. The road along the bank is under water, and villages stand like islands in a brown lake. A boatman offers to ferry your caravan along the flood.',
    choices: [
      { t:'Hire the boatman (25 dirhams)', req:S => S.coins >= 25, ok:(S, X, M) => { M.coins(-25); return 'You drift past drowned palm groves and reach dry ground faster than you could have walked.'; } },
      { t:'Wait on the levee for the waters to fall', ok:(S, X, M) => { M.days(3); M.supply('food', -3); return 'Three days of mud and mosquitoes, but the dyke road opens again.'; } },
      { t:'Wade the flooded road', p:() => .6, ok:() => 'The water reaches your animals\' bellies, but you make it through.', bad:(S, X, M) => `The current takes a laden animal. ${M.loseAnimal()} ${M.loseGoodsFrac(.15)}` },
    ] },
  { id:'treasure_hunters', title:'Treasure Hunters of the Pyramids', npc:'traveller', w:1.5, where:X => EGYPT(X) && X.lat > 29.5,
    text:'A ragged man shows you a book of spells that, he swears, will open the hidden chambers of the ancients. "For a small share of the gold, I will lead you to a tomb no one has ever opened."',
    choices: [
      { t:'Go treasure hunting (two days)', p:() => .2, why:() => 'Most of these "treasure guides" are tricksters', ok:(S, X, M) => { M.days(2); const g = M.coins(140); return `Behind a fallen block you find a shaft and some old gold amulets. You sell them for ${g}.`; }, bad:(S, X, M) => { M.days(2); M.coins(-20); return 'Two days of digging in the sand. He asks for 20 dirhams for "incense for the spirits" and disappears at night.'; } },
      { t:'Buy his book of spells (15 dirhams)', req:S => S.coins >= 15, ok:(S, X, M) => { M.coins(-15); M.flag('spellbook'); return 'The book is full of drawings of lamps and serpents. It makes a fine curiosity.'; } },
      { t:'Laugh and ride on', ok:() => 'He shouts curses after you.' },
    ] },
  { id:'karimi', title:'A Karimi Merchant', npc:'caravan', w:2, where:X => EGYPT(X) || YEMEN(X) || inBox(X, 34, 12, 46, 31),
    text:'A merchant of the Karimi, the great spice guild of Cairo and Aden, rides up with a long string of camels. "You look like someone who knows the eastern roads. Will you carry my pepper as far as you are going, and split the profit?"',
    choices: [
      { t:'Take on 6 sacks of his pepper', req:(S) => true, ok:(S, X, M) => { M.addGood('pepper', 6); M.rep(3); return 'He hands you six sacks and a letter in his own hand. "Sell them for whatever you like. Your honesty will be repaid in Cairo and Aden."'; } },
      { t:'Sell him your eastern goods', ok:(S, X, M) => { const g = M.sellFrac(.3, 1.15, g => ['silk', 'porcelain', 'musk', 'ivory', 'aloeswood', 'spices', 'tea'].includes(g)); return g ? `He buys ${g}, paying better than the market.` : 'You have nothing he wants.'; } },
      { t:'Decline politely', ok:() => 'He bows and goes his way.' },
    ] },
  // ---------------- Arabia ----------------
  { id:'khafara', title:'Bedouin Riders', npc:'nomads', w:3, where:X => ARABIA(X) || inBox(X, 33.5, 28, 36, 31) || inBox(X, 40, 26, 45, 32.5),
    text:'Riders on fast camels come out of the dunes and circle your caravan. Their sheikh lowers his lance. "This is the land of our tribe. Those who cross it pay the khafara, the price of our protection."',
    choices: [
      { t:'Pay the khafara (8% of your goods\' value)', ok:(S, X, M) => { const v = Math.round(X.cargo * .08 + 10); M.coins(-v); M.rep(1); return `You pay ${v} dirhams. The sheikh rides beside you for a day, and no one else troubles you.`; } },
      { t:'Refuse and fight', p:(S, X) => fightP(X, banditStr(X, 1.2)), why:(S, X) => `Your strength ${X.str} against roughly ${banditStr(X, 1.2)}`, ok:(S, X, M) => { M.rep(3); return 'They test you, find you strong, and gallop off laughing.'; }, bad:(S, X, M) => `They strip the caravan with practised speed. ${M.loseGoodsFrac(.6)}` },
      { t:'Offer them dates and a story', p:() => .45, ok:(S, X, M) => { M.rep(2); return 'You talk of the cities you have seen until the stars come out. The sheikh lets you pass as a guest.'; }, bad:(S, X, M) => { const v = Math.round(X.cargo * .12 + 10); M.coins(-v); return `They enjoy the story, and take ${v} dirhams anyway.`; } },
    ] },
  { id:'sayl', title:'Flash Flood', w:2, where:X => ARABIA(X) || inBox(X, 33.5, 28, 36, 31),
    text:'Black clouds pile up over the mountains. The wadi you are crossing, dry as bone, begins to murmur. Then a wall of brown water comes roaring round the bend.',
    choices: [
      { t:'Scramble up the rocks with the animals', p:(S, X) => .45 + (X.speed - 20) / 50, why:(S, X) => `Depends on your caravan's speed (${mi(X.speed)} miles a day)`, ok:() => 'You reach the rocks just in time and watch the flood thunder past.', bad:(S, X, M) => `The flood catches your rearguard. ${M.loseAnimal()} ${M.loseGoodsFrac(.25)}` },
      { t:'Cut loose the heaviest loads and run', ok:(S, X, M) => `Everyone survives. ${M.loseGoodsFrac(.35)}` },
    ] },
  { id:'frankincense', title:'The Frankincense Harvest', npc:'nomads', w:3, where:X => inBox(X, 47, 14, 56, 18.5),
    text:'On the hills, Mahra tribesmen are scraping the bark of twisted little trees, and the milky resin hardens in "tears". They offer you this year\'s harvest straight from the trees.',
    choices: [
      { t:'Buy 8 sacks at the harvest price', ok:(S, X, M) => { const n = M.buyCheap('incense', 8, .55); return n ? `You buy ${n} sacks of white frankincense at half the market price.` : 'You cannot afford any, or have no room.'; } },
      { t:'Ride on', ok:() => 'The scent of the resin follows you down the valley.' },
    ] },
  { id:'hajj', title:'The Hajj Caravan', npc:'caravan', w:2.5, where:X => ARABIA(X) && X.lat > 20,
    text:'A huge pilgrim caravan is on the move: thousands of camels, a litter carrying the Sultan\'s mahmal, soldiers, water-carriers and pilgrims from every land. Its emir offers you a place in the column.',
    choices: [
      { t:'Travel with the pilgrims', ok:(S, X, M) => { M.days(1); M.rep(3); M.supply('water', 10); return 'You move slowly but safely. The pilgrims share their water, and bandits keep away.'; } },
      { t:'Sell them provisions', req:S => S.food >= 15, ok:(S, X, M) => { M.supply('food', -15); M.coins(60); return 'Food is scarce on the Hajj road. You sell 15 rations for 60 dirhams.'; } },
      { t:'Push ahead on your own', ok:() => 'You pass the slow column and leave its dust behind.' },
    ] },
  { id:'hegra', title:'The Cursed City', npc:'traveller', w:2, where:X => inBox(X, 36.5, 25.8, 39.6, 28.2),
    text:'Your guide refuses to camp near the great carved tombs of Hegra. "This is the city of the Thamud, whom God destroyed. Drink none of its water!" Your animals are thirsty, and the old wells are right there.',
    choices: [
      { t:'Water the animals at the old wells', p:() => .75, ok:(S, X, M) => { M.supply('water', 20); return 'The water is sweet. Your guide mutters prayers all night.'; }, bad:(S, X, M) => { M.supply('water', 10); M.rep(-2); return 'The water is brackish and the men are uneasy. Word spreads that you camped among the cursed.'; } },
      { t:'Respect the custom and press on', ok:(S, X, M) => { M.rep(2); M.supply('water', -5); return 'You make a dry camp further on.'; } },
    ] },
  { id:'aden_customs', title:'The Customs House of Aden', npc:'officials', w:2.5, where:X => inBox(X, 43.5, 12.4, 46, 14),
    text:'Rasulid customs officers search your bales and write down every item in a ledger. The duty is heavy. One clerk hints that his ledger can make mistakes, for a price.',
    choices: [
      { t:'Pay the full duty', ok:(S, X, M) => { const v = Math.round(X.cargo * .07 + 5); M.coins(-v); M.rep(2); return `You pay ${v} dirhams. The sultan's officers note your honesty.`; } },
      { t:'Bribe the clerk (30 dirhams)', req:S => S.coins >= 30, p:() => .7, ok:(S, X, M) => { M.coins(-30); return 'The ledger shows you carrying very little.'; }, bad:(S, X, M) => { M.coins(-30); const v = Math.round(X.cargo * .15 + 10); M.coins(-v); M.rep(-4); return `His superior catches you. You lose the bribe and pay a fine of ${v}.`; } },
    ] },
  // ---------------- India ----------------
  { id:'mongol_raid', title:'Mongol Raiders in the Punjab', npc:'soldiers', w:3, where:X => inBox(X, 69, 29, 76.5, 34.5),
    text:'Villagers run past, shouting. Mongol raiders from across the Indus have burned the next village, and their riders are fanning out over the plain. A Delhi garrison commander is gathering refugees inside a fort.',
    choices: [
      { t:'Shelter in the fort', ok:(S, X, M) => { M.days(2); M.supply('food', -4); return 'Two tense days behind the walls, then the raiders ride back west with their loot.'; } },
      { t:'Run for it across the plain', p:(S, X) => .4 + (X.speed - 20) / 40, why:(S, X) => `Depends on your caravan's speed (${mi(X.speed)} miles a day)`, ok:() => 'You outrun the dust clouds.', bad:(S, X, M) => S.paiza ? (M.losePaiza(), 'They catch you, but when you show your paiza they only take the tablet itself.') : `They catch you on the open plain. ${M.loseAllGoods()}` },
      { t:'Help defend the fort', p:(S, X) => fightP(X, 10), why:(S, X) => `Your strength ${X.str} on the walls`, ok:(S, X, M) => { M.rep(8); M.coins(60); return 'The raiders break against the walls. The commander rewards you in the Sultan\'s name.'; }, bad:(S, X, M) => { M.loseHireAny(); M.days(2); return 'The fort holds, but you lose a man on the walls.'; } },
    ] },
  { id:'monsoon', title:'The Monsoon Breaks', w:2.5, where:X => INDIA(X) || SEASIA(X),
    text:'After weeks of heat, the sky turns purple and the monsoon arrives in a roar of rain. Roads become rivers of mud and every stream is in flood.',
    choices: [
      { t:'Shelter in a village until it eases', ok:(S, X, M) => { M.days(4); M.supply('food', -4); return 'Four days under a dripping thatch roof.'; } },
      { t:'Slog on through the mud', p:() => .55, ok:(S, X, M) => { M.days(1); return 'Filthy, soaked and slowed, but you keep moving.'; }, bad:(S, X, M) => { M.days(2); return `A ford washes away under your animals. ${M.loseGoodsFrac(.15)}`; } },
    ] },
  { id:'mewati', title:'Mewati Bandits', npc:'bandits', w:2.5, where:X => inBox(X, 75.5, 26.5, 78.5, 29),
    text:'This is the bandit country south of Delhi. Sultan Balban cut down the jungles to root out the Mewatis, but here they come, out of the ravines with bows and spears.',
    choices: [
      { t:'Fight', p:(S, X) => fightP(X, banditStr(X, 1.1)), why:(S, X) => `Your strength ${X.str} against roughly ${banditStr(X, 1.1)}`, ok:(S, X, M) => { M.rep(5); return 'You beat them off. The Sultan\'s men will be glad to hear of it.'; }, bad:(S, X, M) => { M.loseHireAny(); return `They overrun you. ${M.loseAllGoods()}`; } },
      { t:'Pay them off', ok:(S, X, M) => `They take a share and melt away. ${M.loseGoodsFrac(.35)}` },
    ] },
  { id:'elephant_market', title:'An Elephant for Sale', npc:'traveller', w:1.5, where:X => (INDIA(X) && X.lon > 75) || SEASIA(X),
    text:'A mahout leads a young working elephant along the road. "Its owner died, and his widow must sell. Strong as ten oxen, sir, and gentle as a cow."',
    choices: [
      { t:'Buy the elephant (260 dirhams)', req:S => S.coins >= 260, ok:(S, X, M) => { M.coins(-260); S.pack.elephant = (S.pack.elephant || 0) + 1; return 'You have an elephant! Your caravan can carry a great deal more.'; } },
      { t:'No thank you', ok:() => 'The elephant flaps its ears at you as it passes.' },
    ] },
  { id:'tiger', title:'Tiger!', w:1.5, where:X => (INDIA(X) && (X.lat < 26 || X.lon > 84)) || SEASIA(X),
    text:'A sudden silence in the forest, then a cough-like roar. The animals panic. Something orange moves in the grass beside the road.',
    choices: [
      { t:'Light torches and stand together', p:(S, X) => .4 + X.str / 30, ok:(S, X, M) => { M.rep(2); return 'The tiger circles once, then slips away.'; }, bad:(S, X, M) => M.loseAnimal() },
      { t:'Drive the animals on at a run', p:() => .6, ok:() => 'You run until the forest thins.', bad:(S, X, M) => `In the stampede, loads tumble into the grass. ${M.loseGoodsFrac(.2)}` },
    ] },
  { id:'pearl_divers', title:'The Pearl Fishery', npc:'traveller', w:3, where:X => inBox(X, 77.5, 8, 79.5, 10.5),
    text:'Boats are coming in from the oyster banks. The divers, Polo wrote, are protected from sharks by Brahmin charmers, and the king takes one pearl in ten. The rest are sold on the beach.',
    choices: [
      { t:'Buy pearls on the beach', ok:(S, X, M) => { const n = M.buyCheap('pearls', 4, .6); return n ? `You buy ${n} pouches of pearls at a good price.` : 'You cannot afford any, or have no room.'; } },
      { t:'Ride on', ok:() => 'The beach smells of rotting oysters.' },
    ] },
  { id:'temple_festival', title:'A Temple Chariot Festival', npc:'monk', w:2, where:X => SINDIA(X) || inBox(X, 82, 24.5, 86, 26),
    text:'The road is blocked by a huge crowd pulling a towering wooden chariot carrying a god. Musicians, dancers and sellers of garlands surround it. A priest asks for a gift for the temple.',
    choices: [
      { t:'Give 20 dirhams to the temple', req:S => S.coins >= 20, ok:(S, X, M) => { M.coins(-20); M.rep(4); return 'The priest marks your forehead with sandal paste. The crowd cheers and makes way for you.'; } },
      { t:'Sell your goods to the festival crowd', ok:(S, X, M) => { const g = M.sellFrac(.2, 1.1); return g ? `The crowd buys ${g}.` : 'You have nothing to sell.'; } },
      { t:'Wait for it to pass', ok:(S, X, M) => { M.days(1); return 'It takes the whole day.'; } },
    ] },
  // ---------------- Indochina & Yunnan ----------------
  { id:'nat_shrine', title:'A Shrine to the Nats', npc:'monk', w:2, where:X => inBox(X, 93, 15.5, 99, 25),
    text:'At a big tree by the road stands a little spirit house hung with coconuts and red cloth. Your Burmese guide insists everyone should leave an offering to the nat spirits of the forest before going further.',
    choices: [
      { t:'Leave an offering (5 dirhams)', req:S => S.coins >= 5, ok:(S, X, M) => { M.coins(-5); M.rep(1); return 'Your guide is relieved. The road ahead is calm.'; } },
      { t:'Refuse', p:() => .6, ok:() => 'Nothing happens, though your men are jumpy all day.', bad:(S, X, M) => `That night a branch falls on the camp. ${M.loseAnimal()}` },
    ] },
  { id:'wild_elephants', title:'Wild Elephants', w:2, where:X => SEASIA(X) || inBox(X, 75, 8, 78, 13),
    text:'A herd of wild elephants is feeding across the road, breaking down bamboo. The matriarch raises her trunk and watches you.',
    choices: [
      { t:'Wait quietly until they move on', ok:(S, X, M) => { M.days(1); return 'After half a day they wander off into the forest.'; } },
      { t:'Bang drums to drive them off', p:() => .55, ok:() => 'They trumpet and crash away into the trees.', bad:(S, X, M) => `The herd charges. ${M.loseAnimal()} ${M.loseGoodsFrac(.2)}` },
    ] },
  { id:'jungle_fever', title:'Jungle Fever', w:2, where:WET,
    text:'In the steamy lowlands one of your men starts shaking with fever, burning hot and then freezing cold.',
    choices: [
      { t:'Rest and buy medicine from a village healer (15)', req:S => S.coins >= 15, p:() => .8, ok:(S, X, M) => { M.coins(-15); M.days(2); return 'After two days the fever breaks.'; }, bad:(S, X, M) => { M.coins(-15); M.days(2); M.loseHireAny(); return 'Despite everything, he dies. You bury him by the road.'; } },
      { t:'Push on and hope', p:() => .5, ok:() => 'He recovers on the march.', bad:(S, X, M) => { M.loseHireAny(); return 'He grows weaker and is left at a monastery.'; } },
    ] },
  { id:'kublai_envoys', title:'Envoys of the Great Khan', npc:'officials', w:3, where:X => inBox(X, 93, 18, 103, 27),
    text:'Mongol envoys are riding to Pagan to demand King Narathihapate\'s submission to Kublai Khan. Their leader is nervous: "The Burmese king is proud. Will you travel with us and speak for us in his court?"',
    choices: [
      { t:'Go with them', p:() => .55, ok:(S, X, M) => { M.rep(8); return 'The envoys are heard and sent home safely. In Khanbaliq, your name will be remembered.'; }, bad:(S, X, M) => { M.rep(-2); M.days(2); return 'The king will not even receive you. You are escorted out of the city.'; } },
      { t:'Avoid them: this will end in war', ok:() => 'You let them ride on. (In 1277 and 1283 the Mongols invaded Burma.)' },
    ] },
  { id:'khmer_procession', title:'A Royal Procession', npc:'officials', w:2, where:X => inBox(X, 101, 11, 106.5, 15),
    text:'Gongs and conches: a Khmer royal procession is coming down the road. Hundreds of palace women carry candles, and the king stands on an elephant with gilded tusks under white parasols. Everyone around you falls to the ground.',
    choices: [
      { t:'Prostrate yourself like everyone else', ok:(S, X, M) => { M.rep(2); return 'The procession passes in a cloud of incense.'; } },
      { t:'Offer a gift to the king\'s officers', ok:(S, X, M) => { const g = M.sellFrac(.15, 1.4); M.rep(4); return g ? `The officers accept ${g}, paying in gold.` : 'You have nothing worthy of a king.'; } },
    ] },
  { id:'cowrie_money', title:'Money Made of Shells', npc:'traveller', w:2, where:YUNNAN,
    text:'At the market in Yunnan, nobody wants your silver. Everything is priced in cowrie shells, eighty to a silver piece, just as Polo noted. A money-changer offers to change your coins at a terrible rate.',
    choices: [
      { t:'Change money (lose 5%)', ok:(S, X, M) => { const v = Math.round(S.coins * .05); M.coins(-v); return `You lose ${v} dirhams on the exchange, but now you can trade.`; } },
      { t:'Barter goods instead', ok:(S, X, M) => { const g = M.sellFrac(.15, .95); return g ? `You barter ${g}.` : 'You have nothing to barter.'; } },
    ] },
  { id:'ilkhan_search', title:'The Ilkhan\'s Inspectors', npc:'officials', w:(X, S) => S.cargo && S.cargo.letter && ['ilkhan', 'rum', 'georgia'].includes(X.realm) ? 5 : 0,
    text:'Mongol officials and a Persian secretary stop your caravan. "The Ilkhan has heard that the Mamluk sultan sends letters to Sarai. Open every bale." Your sealed letter is sewn into a saddle-cloth.',
    choices: [
      { t:'Stay calm and let them search', p:(S, X) => .55 + (S.hires && S.hires.guide ? .1 : 0), why:() => 'They are thorough, but it is well hidden (a guide helps)', ok:() => 'They turn out every sack and find nothing. You ride on with your heart pounding.', bad:(S, X, M) => { M.addGood('letter', -1); M.rep(-5); return 'A soldier slits the saddle-cloth and the letter falls out. They burn it in front of you and fine you. Return to Cairo for another copy.'; } },
      { t:'Bribe the secretary (60 dirhams)', req:S => S.coins >= 60, p:() => .75, ok:(S, X, M) => { M.coins(-60); return 'The secretary pockets the silver and waves you through.'; }, bad:(S, X, M) => { M.coins(-60); M.addGood('letter', -1); return 'He takes the silver and the letter. Return to Cairo for another copy.'; } },
      { t:'Burn the letter yourself', ok:(S, X, M) => { M.addGood('letter', -1); return 'You drop it into the cooking fire before they reach your bags. They find nothing, but you must go back to Cairo for another copy.'; } },
    ] },
);

// ============================================================
//  v11 EVENT CHAINS: recurring characters whose follow-ups depend on earlier choices
// ============================================================
const after = (S, k, days) => S.flags && S.flags[k] !== undefined && S.day - S.flags[k] >= days;
EVENTS.push(
  // ---- The Old Man of the Mountain ----
  { id:'om_fugitive', title:'A Fugitive from Girdkuh', npc:'traveller', once:true, w:(X, S) => after(S, 'om', 25) ? 4 : 0, where:X => inBox(X, 44, 30, 66, 40),
    text:'A gaunt man begs to join your caravan. He was a defender of Girdkuh, the last Ismaili fortress, which fell to the Mongols in 1270. Mongol officials are hunting the survivors, and there is a price on his head.',
    choices: [
      { t:'Hide him among your men', p:() => .7, ok:(S, X, M) => { S.flags.om_helped = S.day; M.rep(2); return 'You get him past the Mongol checkpoints. At the next town he vanishes, promising that his people never forget a debt.'; }, bad:(S, X, M) => { S.flags.om_helped = S.day; const c = M.coins(-60); return `A patrol searches your caravan and finds him. You pay a fine of ${c} to avoid being arrested yourself, and he escapes in the confusion.`; } },
      { t:'Hand him over for the reward', ok:(S, X, M) => { S.flags.om_betrayed = S.day; M.rep(-4); return `The Mongol darughachi pays you ${M.coins(80)}. The man looks at you once as they drag him away.`; } },
      { t:'Give him food and send him on his way', ok:(S, X, M) => { M.supply('food', -3); return 'He thanks you and disappears into the hills.'; } },
    ] },
  { id:'om_debt', title:'The Ismailis Repay a Debt', npc:'monk', once:true, w:(X, S) => after(S, 'om_helped', 40) ? 5 : 0,
    text:'A dervish stops your caravan and presses a sealed purse into your hand. "From those you sheltered on the road from Girdkuh. Our brothers are in every city. You will find doors open to you."',
    choices: [ { t:'Accept the gift', ok:(S, X, M) => { M.rep(6); return `The purse holds ${M.coins(150)}, and a token that wins you better treatment in the bazaars of Persia.`; } } ] },
  { id:'om_revenge', title:'A Knife in the Night', npc:'bandits', once:true, w:(X, S) => after(S, 'om_betrayed', 40) ? 5 : 0,
    text:'You wake to a shout. A man in dark clothes is standing over your bedding with a knife, and your guards are struggling with two more. The Ismailis have not forgotten whom you sold to the Mongols.',
    choices: [
      { t:'Fight for your life', p:(S, X) => fightP(X, 9), why:(S, X) => `Your strength ${X.str} against about 9`, ok:(S, X, M) => { M.rep(3); return 'You drive them off. One leaves a dagger stuck in your saddle, with a note: "Next time."'; }, bad:(S, X, M) => { M.loseHireAny(); return `They escape into the dark with a guard's life and your purse: ${M.coins(-Math.round(S.coins * .4))} gone.`; } },
      { t:'Flee into the night', p:(S, X) => .5, ok:() => 'You ride off in your nightclothes and lose them in the dark.', bad:(S, X, M) => `They catch the slowest animals. ${M.loseGoodsFrac(.4)}` },
    ] },
  // ---- The astronomers of Maragheh ----
  { id:'astro_gift', title:'A Gift from the Astronomers', npc:'monk', once:true, w:(X, S) => after(S, 'tables_done', 15) ? 6 : 0,
    text:'A messenger rides up from Samarkand with a gift from the scholars you served: a brass astrolabe made at Maragheh, with tables for finding your way by the stars.',
    choices: [ { t:'Learn to use it', ok:(S, X, M) => { S.flags.astrolabe = S.day; M.rep(3); return 'Your caravan master learns to plot the night marches by the stars. <b>Your caravan is 5% faster for the rest of the journey.</b>'; } },
      { t:'Sell it in the next bazaar', ok:(S, X, M) => `A collector pays ${M.coins(220)} for it on the spot.` } ] },
  { id:'astro_khan', title:'The Khan\'s Astronomer', npc:'officials', once:true, w:(X, S) => S.flags.astrolabe !== undefined ? 6 : 0, where:X => X.realm === 'yuan' && X.lon > 100,
    text:'Jamal al-Din, the Persian astronomer who runs Kublai\'s new observatory, has heard that you carry a Maragheh astrolabe. He wants news of his old colleagues, and he would love to own the instrument.',
    choices: [ { t:'Tell him the news and keep the astrolabe', ok:(S, X, M) => { M.rep(10); return 'He is delighted, and promises to mention you at court. (+10 reputation)'; } },
      { t:'Sell it to him for the Khan\'s observatory', ok:(S, X, M) => { delete S.flags.astrolabe; M.rep(6); return `He pays ${M.coins(420)} and speaks of you to the Khan. You lose the speed bonus.`; } } ] },
  { id:'astro_angry', title:'An Angry Scholar', npc:'monk', once:true, w:(X, S) => S.flags.tables !== undefined && !S.cargo.tables && S.flags.tables_done === undefined && S.day - S.flags.tables > 30 ? 4 : 0,
    text:'A scholar from Maragheh tracks you down. "The tables you were carrying to Samarkand never arrived. Do you know how many years of observations they held?"',
    choices: [ { t:'Apologise and pay for a new copy (60)', req:S => S.coins >= 60, ok:(S, X, M) => { M.coins(-60); return 'He is still unhappy, but he will not spread the story.'; } },
      { t:'Shrug', ok:(S, X, M) => { M.rep(-6); return 'He tells everyone on the road that you cannot be trusted. (−6 reputation)'; } } ] },
  // ---- Kaidu ----
  { id:'kd_token', title:'Kaidu\'s Officer Remembers You', npc:'soldiers', once:true, w:(X, S) => after(S, 'kd_paid', 20) ? 5 : 0, where:X => inBox(X, 60, 34, 95, 48),
    text:'One of Kaidu\'s officers recognises you as the merchant who paid tribute without trouble. He offers you a tamga, a token of Kaidu\'s protection, and a job: carry a sealed message east.',
    choices: [
      { t:'Take the token only', ok:(S, X, M) => { S.flags.kd_token = S.day; return 'With Kaidu\'s tamga, bandits in Chagatai lands leave you alone more often.'; } },
      { t:'Take the token and the message (pays 150)', ok:(S, X, M) => { S.flags.kd_token = S.day; S.flags.kd_message = S.day; return `He pays ${M.coins(150)} in advance. If Kublai's men catch you with it, you will be in trouble.`; } },
    ] },
  { id:'kd_caught', title:'Kublai\'s Men Search You', npc:'soldiers', once:true, w:(X, S) => S.flags.kd_message !== undefined ? 6 : 0, where:X => X.realm === 'yuan',
    text:'Yuan border guards search your caravan carefully. If they find Kaidu\'s sealed message, you will be treated as a spy.',
    choices: [
      { t:'Bluff it out', p:() => .6, ok:() => 'They find nothing. You burn the message that night.', bad:(S, X, M) => { M.rep(-12); if (S.paiza) M.losePaiza(); return `They find it. You are beaten and fined: ${M.coins(-Math.round(S.coins * .3))}. Your name is now on a list in Khanbaliq.`; } },
      { t:'Confess and hand it over', ok:(S, X, M) => { M.rep(8); return 'The commander is impressed by your honesty, and by the intelligence. He gives you a letter of commendation. (+8 reputation)'; } },
    ] },
  { id:'kd_revenge', title:'Kaidu\'s Revenge', npc:'soldiers', once:true, w:(X, S) => after(S, 'kd_enemy', 30) ? 6 : 0, where:X => inBox(X, 60, 34, 95, 48),
    text:'A much larger band of Kaidu\'s horsemen surrounds you. Their leader remembers the merchant who killed his men.',
    choices: [
      { t:'Fight again', p:(S, X) => fightP(X, banditStr(X, 2.2)), why:(S, X) => `Your strength ${X.str} against roughly ${banditStr(X, 2.2)}`, ok:(S, X, M) => { M.rep(8); return 'Against all odds you break them. Songs will be sung about this fight.'; }, bad:(S, X, M) => { M.loseHireAny(); return M.loseAllGoods(); } },
      { t:'Pay a heavy ransom (30% of your goods)', ok:(S, X, M) => { delete S.flags.kd_enemy; return `They take their price. ${M.loseGoodsFrac(.3)} The feud is over.`; } },
    ] },
);

