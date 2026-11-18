
// v15.1: lower-case a name for use mid-sentence without breaking proper nouns ("Chinese silk", "Mongol archer", "the Sultan's letter")
const LC_KEEP = new Set(['Chinese', 'Khotan', 'Samarkand', 'Turkoman', 'Damascus', 'Flemish', 'Baltic', 'Indian', 'Caspian', 'Erzincan', 'Gujarati', 'Malay', 'Egyptian', 'Yemeni', 'Changthang', 'Balas', 'Mongol', 'Ferghana', 'Arabian', 'Bactrian', 'Tibetan', 'Persian', 'Bucephalus\'s', 'Kārimī', 'Venetian', 'Genoese']);
function lcName(n) { if (!n) return n; const w = n.split(' ')[0]; return LC_KEEP.has(w) ? n : n.charAt(0).toLowerCase() + n.slice(1); }
function mi(km) { return Math.round(km * 0.621371); } // v14: distances are shown in miles
// ============================================================
//  SILK ROAD 1272 — geography, cities, roads, landmarks
//  Coordinates are [longitude, latitude].
// ============================================================

// size: 1 small town, 2 city, 3 great capital
// culture drives architecture: byz, rum, arab, armenian, georgian, persian,
// central, steppe, mongol, tarim, chinese, song, tibet
const CITIES = [
  // --- Byzantium & Anatolia ---
  { id:'constantinople', name:'Constantinople', modern:'Istanbul, Türkiye', polity:'Byzantine Empire', lon:28.98, lat:41.01, size:3, culture:'byz',
    blurb:'The Queen of Cities, retaken from the Latins in 1261 by Emperor Michael VIII Palaiologos. Venetian and Genoese merchants crowd its harbours.' },
  { id:'nicaea', name:'Nicaea', modern:'İznik, Türkiye', polity:'Byzantine Empire', lon:29.72, lat:40.43, size:1, culture:'byz',
    blurb:'Seat of the Byzantine emperors in exile during the Latin occupation (1204–1261), ringed by ancient Roman walls.' },
  { id:'smyrna', name:'Smyrna', modern:'İzmir, Türkiye', polity:'Byzantine Empire', lon:27.14, lat:38.42, size:1, culture:'byz',
    blurb:'An Aegean port on the frontier between Byzantium and the Turkish emirates of the interior.' },
  { id:'ancyra', name:'Ancyra', modern:'Ankara, Türkiye', polity:'Sultanate of Rûm (Ilkhanate vassal)', lon:32.86, lat:39.93, size:1, culture:'rum',
    blurb:'A hilltop citadel town of the Seljuk Turks, who have bowed to the Mongols since their defeat at Köse Dağ in 1243.' },
  { id:'iconium', name:'Konya (Iconium)', modern:'Konya, Türkiye', polity:'Sultanate of Rûm (Ilkhanate vassal)', lon:32.49, lat:37.87, size:2, culture:'rum',
    blurb:'Capital of the Seljuk Sultanate of Rûm. The poet and mystic Jalal al-Din Rumi is living here in 1272; he will die the following year.' },
  { id:'sinope', name:'Sinope', modern:'Sinop, Türkiye', polity:'Sultanate of Rûm (Ilkhanate vassal)', lon:35.15, lat:42.02, size:1, culture:'rum',
    blurb:'The Seljuks seized this Black Sea harbour in 1214, opening Anatolia to the northern trade.' },
  { id:'caesarea', name:'Kayseri (Caesarea)', modern:'Kayseri, Türkiye', polity:'Sultanate of Rûm (Ilkhanate vassal)', lon:35.49, lat:38.72, size:1, culture:'rum',
    blurb:'A Seljuk trading city beneath the snowy volcano Mount Erciyes, famous for its caravanserais and annual fairs.' },
  { id:'sivas', name:'Sivas', modern:'Sivas, Türkiye', polity:'Sultanate of Rûm (Ilkhanate vassal)', lon:37.02, lat:39.75, size:1, culture:'rum',
    blurb:'A crossroads of Anatolian caravan roads. Brand-new madrasas, completed in 1271, gleam with turquoise tile.' },
  { id:'trebizond', name:'Trebizond', modern:'Trabzon, Türkiye', polity:'Empire of Trebizond', lon:39.72, lat:41.00, size:1, culture:'byz',
    blurb:'A small Greek empire on the Black Sea, rich from the trade road to Tabriz. The Polos would sail home from here in 1295.' },
  { id:'erzincan', name:'Erzincan', modern:'Erzincan, Türkiye', polity:'Sultanate of Rûm (Ilkhanate vassal)', lon:39.49, lat:39.75, size:1, culture:'rum',
    blurb:'Marco Polo called it "Arzinga" and praised its fine buckram cloth.' },
  { id:'erzurum', name:'Erzurum', modern:'Erzurum, Türkiye', polity:'Ilkhanate (Seljuk lands)', lon:41.27, lat:39.90, size:1, culture:'rum',
    blurb:'A cold highland fortress city on the road from Anatolia to Persia. Polo mentions its silver mines.' },
  { id:'ayas', name:'Ayas (Laiazzo)', modern:'Yumurtalık, Türkiye', polity:'Armenian Kingdom of Cilicia', lon:35.78, lat:36.77, size:1, culture:'armenian',
    blurb:'The Polos sailed here from Acre in 1271 and began their overland journey to the court of Kublai Khan. Venetian galleys load spices and silk.' },
  // --- Levant & Mesopotamia ---
  { id:'aleppo', name:'Aleppo', modern:'Aleppo, Syria', polity:'Mamluk Sultanate', lon:37.16, lat:36.20, size:2, culture:'arab',
    blurb:'The Mongols sacked Aleppo in 1260, but the Mamluks took it back after their victory at Ain Jalut. Its citadel now faces the Mongol frontier.' },
  { id:'damascus', name:'Damascus', modern:'Damascus, Syria', polity:'Mamluk Sultanate', lon:36.29, lat:33.51, size:2, culture:'arab',
    blurb:'An ancient oasis city of orchards and markets, ruled by the Mamluk sultan Baybars.' },
  { id:'mosul', name:'Mosul', modern:'Mosul, Iraq', polity:'Ilkhanate', lon:43.13, lat:36.34, size:1, culture:'arab',
    blurb:'A city on the Tigris whose fine cotton cloth gave Europe the word "muslin". Marco Polo described it.' },
  { id:'baghdad', name:'Baghdad', modern:'Baghdad, Iraq', polity:'Ilkhanate', lon:44.36, lat:33.31, size:2, culture:'arab',
    blurb:'The old Abbasid capital, sacked by Hülegü Khan in 1258. Now a provincial Mongol city, slowly recovering.' },
  // --- Caucasus ---
  { id:'ani', name:'Ani', modern:'Ocaklı, Kars, Türkiye', polity:'Ilkhanate (Zakarid vassals)', lon:43.57, lat:40.51, size:1, culture:'armenian',
    blurb:'The "City of 1001 Churches", once the capital of Armenia. The Mongols took it in 1236.' },
  { id:'tiflis', name:'Tiflis', modern:'Tbilisi, Georgia', polity:'Kingdom of Georgia (Ilkhanate vassal)', lon:44.79, lat:41.72, size:1, culture:'georgian',
    blurb:'The Georgian capital, set in a gorge of the Kura river beneath the Narikala fortress.' },
  { id:'baku', name:'Baku', modern:'Baku, Azerbaijan', polity:'Shirvanshahs (Ilkhanate vassal)', lon:49.87, lat:40.41, size:1, culture:'persian',
    blurb:'Polo wrote of a spring nearby that gushed oil, "good to burn" and used against mange in camels.' },
  { id:'derbent', name:'Derbent', modern:'Derbent, Dagestan, Russia', polity:'Ilkhanate (Golden Horde frontier)', lon:48.29, lat:42.06, size:1, culture:'persian',
    blurb:'The Caspian Gates: Sasanian walls running from the mountains to the sea guard the frontier between the Ilkhanate and the Golden Horde.' },
  // --- Persia ---
  { id:'tabriz', name:'Tabriz', modern:'Tabriz, Iran', polity:'Ilkhanate — capital', lon:46.29, lat:38.08, size:2, culture:'persian',
    blurb:'Capital of Abaqa Khan\'s Ilkhanate and a great market for silk and gems, where Latin, Armenian and Persian merchants meet.' },
  { id:'rayy', name:'Rayy', modern:'Ray (Tehran), Iran', polity:'Ilkhanate', lon:51.43, lat:35.59, size:1, culture:'persian',
    blurb:'Once one of the largest cities in Islam, it was ruined by the Mongols in 1220. Tehran is still a village in its suburbs.' },
  { id:'hamadan', name:'Hamadan', modern:'Hamadan, Iran', polity:'Ilkhanate', lon:48.51, lat:34.80, size:1, culture:'persian',
    blurb:'Ancient Ecbatana, summer capital of the Medes. The philosopher Avicenna is buried here.' },
  { id:'isfahan', name:'Isfahan', modern:'Isfahan, Iran', polity:'Ilkhanate', lon:51.67, lat:32.65, size:2, culture:'persian',
    blurb:'Former Seljuk capital, whose great Friday Mosque has brick domes built in the 1080s.' },
  { id:'yazd', name:'Yazd', modern:'Yazd, Iran', polity:'Ilkhanate (Atabegs of Yazd)', lon:54.36, lat:31.90, size:1, culture:'persian',
    blurb:'A desert city of windcatchers and silk weavers. Polo admired its "Yasdi" silk cloth. Zoroastrian communities still live here.' },
  { id:'kerman', name:'Kerman', modern:'Kerman, Iran', polity:'Qutlugh-Khanids (Ilkhanate vassal)', lon:57.08, lat:30.28, size:1, culture:'persian',
    blurb:'Polo noted its turquoise mines and the fine embroidery made by its women.' },
  { id:'hormuz', name:'Hormuz', modern:'Minab, Iran', polity:'Kingdom of Hormuz (Ilkhanate vassal)', lon:57.08, lat:27.15, size:1, culture:'persian',
    blurb:'A sweltering port for ships from India. The Polos came here hoping to sail east, but disliked the stitched-plank ships and turned back to go overland.' },
  { id:'nishapur', name:'Nishapur', modern:'Nishapur, Iran', polity:'Ilkhanate', lon:58.80, lat:36.21, size:1, culture:'persian',
    blurb:'The city of Omar Khayyam, famous for its turquoise. Destroyed by the Mongols in 1221, it has been partly rebuilt.' },
  { id:'merv', name:'Merv', modern:'Mary, Turkmenistan', polity:'Ilkhanate', lon:61.83, lat:37.66, size:1, culture:'central',
    blurb:'Perhaps the world\'s largest city in the 1100s; sacked in 1221. The great Mausoleum of Sultan Sanjar still stands among the ruins.' },
  { id:'herat', name:'Herat', modern:'Herat, Afghanistan', polity:'Kart dynasty (Ilkhanate vassal)', lon:62.20, lat:34.35, size:1, culture:'persian',
    blurb:'An oasis city of Khorasan, rebuilt under the Kart princes.' },
  // --- Central Asia ---
  { id:'bukhara', name:'Bukhara', modern:'Bukhara, Uzbekistan', polity:'Chagatai Khanate', lon:64.42, lat:39.77, size:2, culture:'central',
    blurb:'Marco Polo\'s father Niccolò and uncle Maffeo were stranded here for three years (1262–65). Genghis Khan spared only its great minaret.' },
  { id:'samarkand', name:'Samarkand', modern:'Samarkand, Uzbekistan', polity:'Chagatai Khanate', lon:66.96, lat:39.65, size:2, culture:'central',
    blurb:'Polo called it "a very large and splendid city". The old city on Afrasiyab hill lies ruined since 1220; a new town grows to the south.' },
  { id:'urgench', name:'Gurganj (Urgench)', modern:'Köneürgenç, Turkmenistan', polity:'Golden Horde', lon:59.15, lat:42.33, size:1, culture:'central',
    blurb:'Capital of the Khwarazm Shahs until 1221, when the Mongols flooded it by breaking the dams of the Oxus.' },
  { id:'balkh', name:'Balkh', modern:'Balkh, Afghanistan', polity:'Ilkhanate', lon:66.90, lat:36.76, size:1, culture:'central',
    blurb:'The "Mother of Cities". Polo found its marble palaces lying ruined by the Mongols.' },
  { id:'kabul', name:'Kabul', modern:'Kabul, Afghanistan', polity:'Chagatai Khanate (Qara\'unas)', lon:69.17, lat:34.53, size:1, culture:'persian',
    blurb:'A mountain-ringed trading town between Khorasan and India.' },
  { id:'badakhshan', name:'Badakhshan', modern:'Fayzabad, Afghanistan', polity:'Mirs of Badakhshan (Mongol vassals)', lon:70.58, lat:37.12, size:1, culture:'central',
    blurb:'Land of lapis lazuli and "balas rubies". Marco Polo fell ill here and spent a year recovering in the mountain air.' },
  { id:'tashkurgan', name:'Tashkurgan', modern:'Taxkorgan, Xinjiang, China', polity:'Chagatai Khanate', lon:75.23, lat:37.77, size:1, culture:'tarim',
    blurb:'The "Stone Tower", an ancient fortress guarding the passes of the Pamirs.' },
  { id:'khujand', name:'Khujand', modern:'Khujand, Tajikistan', polity:'Chagatai Khanate', lon:69.62, lat:40.28, size:1, culture:'central',
    blurb:'Gateway to the Fergana valley, heroically defended against the Mongols in 1220 by Timur Malik.' },
  { id:'osh', name:'Osh', modern:'Osh, Kyrgyzstan', polity:'Chagatai Khanate', lon:72.80, lat:40.53, size:1, culture:'central',
    blurb:'A Fergana market town beneath the sacred rock of Sulaiman-Too, a pilgrimage site for centuries.' },
  { id:'tashkent', name:'Chach (Tashkent)', modern:'Tashkent, Uzbekistan', polity:'Chagatai Khanate', lon:69.24, lat:41.30, size:1, culture:'central',
    blurb:'An oasis on the Chirchik river where caravans from the steppe meet those from Transoxiana.' },
  { id:'otrar', name:'Otrar', modern:'Otyrar, Kazakhstan', polity:'Chagatai Khanate', lon:68.30, lat:42.85, size:1, culture:'central',
    blurb:'In 1218 its governor massacred a Mongol caravan, provoking Genghis Khan\'s invasion of Central Asia.' },
  { id:'taraz', name:'Talas (Taraz)', modern:'Taraz, Kazakhstan', polity:'Chagatai Khanate', lon:71.37, lat:42.90, size:1, culture:'central',
    blurb:'A steppe-edge trading town known for the Aisha Bibi mausoleum, whose terracotta tiles are carved like lace.' },
  { id:'balasagun', name:'Balasagun', modern:'near Tokmok, Kyrgyzstan', polity:'Chagatai Khanate', lon:75.25, lat:42.75, size:1, culture:'central',
    blurb:'Old capital of the Karakhanids and the Kara-Khitai. The Mongols called it "Gobalik", the good city.' },
  { id:'almaliq', name:'Almaliq', modern:'near Huocheng, Xinjiang, China', polity:'Chagatai Khanate — capital', lon:80.87, lat:44.05, size:1, culture:'mongol',
    blurb:'Seat of the Chagatai khans in the Ili valley, among apple orchards ("alma" means apple).' },
  // --- Steppe ---
  { id:'sarai', name:'Sarai', modern:'Selitrennoye, Russia', polity:'Golden Horde — capital', lon:47.42, lat:46.95, size:2, culture:'mongol',
    blurb:'Batu Khan\'s capital on the Volga. In 1260 Niccolò and Maffeo Polo traded jewels here with Berke Khan.' },
  // v17: the Black Sea ports of the Italian merchants
  { id:'caffa', name:'Caffa', modern:'Feodosia, Crimea', polity:'Golden Horde (Genoese colony)', lon:35.25, lat:45.05, size:1, culture:'byz',
    blurb:'A Greek fishing town where the Genoese, with the Horde\'s leave, have just opened a trading post. Within a century it will be the greatest port on the Black Sea. Along the coast at Soldaia, the Polo brothers\' elder brother keeps a house.' },
  { id:'tana', name:'Tana', modern:'Azov, Russia', polity:'Golden Horde', lon:39.42, lat:47.12, size:1, culture:'mongol',
    blurb:'A Tatar market at the mouth of the Don, where furs, wax and slaves come down from the north. Venetian and Genoese factors both trade here, and watch each other closely.' },
  { id:'saraichik', name:'Saraichik', modern:'Saraishyk, Kazakhstan', polity:'Golden Horde', lon:51.53, lat:47.50, size:1, culture:'mongol',
    blurb:'"Little Sarai", a caravan town on the Ural river and a burial place of Golden Horde khans.' },
  // --- Tarim Basin ---
  { id:'kashgar', name:'Kashgar', modern:'Kashi, Xinjiang, China', polity:'Chagatai Khanate', lon:75.99, lat:39.47, size:2, culture:'tarim',
    blurb:'Polo\'s "Cascar": "from this country many merchants go forth about the world". Here the northern and southern Tarim roads begin.' },
  { id:'yarkand', name:'Yarkand', modern:'Shache, Xinjiang, China', polity:'Chagatai Khanate', lon:77.24, lat:38.41, size:1, culture:'tarim',
    blurb:'A green oasis famous for its fruit, on the southern Tarim road.' },
  { id:'khotan', name:'Khotan', modern:'Hotan, Xinjiang, China', polity:'Chagatai Khanate', lon:79.92, lat:37.11, size:1, culture:'tarim',
    blurb:'For two thousand years the source of China\'s jade, found in the rivers that flow down from the Kunlun.' },
  { id:'cherchen', name:'Cherchen', modern:'Qiemo, Xinjiang, China', polity:'Contested (Yuan–Chagatai)', lon:85.53, lat:38.13, size:1, culture:'tarim',
    blurb:'Polo\'s "Ciarcian", a sandy province where rivers carry jasper and chalcedony.' },
  { id:'lop', name:'Lop (Charklik)', modern:'Ruoqiang, Xinjiang, China', polity:'Yuan dynasty', lon:88.17, lat:39.03, size:1, culture:'tarim',
    blurb:'The last town before the Desert of Lop. Polo warned that spirits call travellers by name and lure them away from the caravan.' },
  { id:'aksu', name:'Aksu', modern:'Aksu, Xinjiang, China', polity:'Chagatai Khanate', lon:80.26, lat:41.17, size:1, culture:'tarim',
    blurb:'"White Water", an oasis below the glaciers of the Tian Shan.' },
  { id:'kucha', name:'Kucha', modern:'Kuqa, Xinjiang, China', polity:'Chagatai Khanate', lon:82.96, lat:41.72, size:1, culture:'tarim',
    blurb:'Once a great Buddhist kingdom whose musicians were celebrated at the Tang court.' },
  { id:'korla', name:'Korla', modern:'Korla, Xinjiang, China', polity:'Uyghur Idiqut (Yuan vassal)', lon:86.15, lat:41.76, size:1, culture:'tarim',
    blurb:'A small town by the Iron Gate Pass, where the Konqi river cuts through the mountains.' },
  { id:'qocho', name:'Qocho (Gaochang)', modern:'Turpan, Xinjiang, China', polity:'Uyghur Idiqut (Yuan vassal)', lon:89.53, lat:42.85, size:1, culture:'tarim',
    blurb:'The Uyghur capital in the scorching Turpan depression, home to Buddhists, Manichaeans and Christians. Polo called it "Carachoco".' },
  { id:'beshbalik', name:'Beshbalik', modern:'Jimsar, Xinjiang, China', polity:'Uyghur Idiqut (Yuan vassal)', lon:89.17, lat:44.12, size:1, culture:'tarim',
    blurb:'"Five Cities", the Uyghurs\' northern capital on the steppe road.' },
  { id:'hami', name:'Kumul (Hami)', modern:'Hami, Xinjiang, China', polity:'Yuan dynasty', lon:93.51, lat:42.83, size:1, culture:'tarim',
    blurb:'Polo\'s "Camul": an oasis of melons and grapes between two deserts.' },
  { id:'dunhuang', name:'Shazhou (Dunhuang)', modern:'Dunhuang, Gansu, China', polity:'Yuan dynasty', lon:94.66, lat:40.14, size:1, culture:'tarim',
    blurb:'Polo\'s "Sachiu", where the northern and southern desert roads meet. The Buddhist caves of Mogao lie nearby.' },
  // --- Hexi Corridor & North China ---
  { id:'jiuquan', name:'Suzhou (Jiuquan)', modern:'Jiuquan, Gansu, China', polity:'Yuan dynasty', lon:98.49, lat:39.73, size:1, culture:'chinese',
    blurb:'Polo\'s "Succiu", where the mountains grow the finest rhubarb, carried west by merchants all over the world.' },
  { id:'zhangye', name:'Ganzhou (Zhangye)', modern:'Zhangye, Gansu, China', polity:'Yuan dynasty', lon:100.45, lat:38.93, size:1, culture:'chinese',
    blurb:'Polo\'s "Campichu", where Marco and his uncle lived for a year. He described its great reclining Buddhas.' },
  { id:'wuwei', name:'Liangzhou (Wuwei)', modern:'Wuwei, Gansu, China', polity:'Yuan dynasty', lon:102.64, lat:37.93, size:1, culture:'chinese',
    blurb:'A garrison city of the Hexi Corridor. In 1247 the Tibetan lama Sakya Pandita met the Mongol prince Köten here.' },
  { id:'lanzhou', name:'Lanzhou', modern:'Lanzhou, Gansu, China', polity:'Yuan dynasty', lon:103.83, lat:36.06, size:1, culture:'chinese',
    blurb:'A crossing of the Yellow River, ferried by rafts of inflated sheepskins.' },
  { id:'xining', name:'Xining', modern:'Xining, Qinghai, China', polity:'Yuan dynasty', lon:101.78, lat:36.62, size:1, culture:'tibet',
    blurb:'Polo\'s "Silingiu", a frontier town where Tibetan herders bring yaks and musk to market.' },
  { id:'xingqing', name:'Xingqing (Yinchuan)', modern:'Yinchuan, Ningxia, China', polity:'Yuan dynasty', lon:106.27, lat:38.47, size:1, culture:'chinese',
    blurb:'Former capital of the Western Xia kingdom, destroyed in 1227 during the campaign in which Genghis Khan died.' },
  { id:'datong', name:'Datong', modern:'Datong, Shanxi, China', polity:'Yuan dynasty', lon:113.30, lat:40.08, size:1, culture:'chinese',
    blurb:'The Liao "Western Capital", near the Yungang Grottoes, where colossal Buddhas were carved in the 400s.' },
  { id:'shangdu', name:'Shangdu (Xanadu)', modern:'Zhenglan Banner, Inner Mongolia, China', polity:'Yuan dynasty — summer capital', lon:116.18, lat:42.36, size:2, culture:'mongol',
    blurb:'Kublai Khan\'s summer capital, built in 1256. Here Polo saw the marble palace and the gilded "cane palace" of bamboo.' },
  { id:'khanbaliq', name:'Khanbaliq (Dadu)', modern:'Beijing, China', polity:'Yuan dynasty — capital', lon:116.40, lat:39.90, size:3, culture:'chinese',
    blurb:'Kublai Khan\'s new capital, under construction since 1267. He proclaimed the Yuan dynasty in 1271. Journey\'s end for Marco Polo in 1275.' },
  { id:'zhending', name:'Zhending', modern:'Zhengding, Hebei, China', polity:'Yuan dynasty', lon:114.57, lat:38.15, size:1, culture:'chinese',
    blurb:'Home of the Longxing Monastery and its towering bronze Guanyin, cast in 971.' },
  { id:'jingzhao', name:"Chang'an (Jingzhao)", modern:"Xi'an, Shaanxi, China", polity:'Yuan dynasty', lon:108.94, lat:34.34, size:2, culture:'chinese',
    blurb:'The old Tang capital and eastern end of the classic Silk Road. Polo\'s "Quengianfu", ruled by Kublai\'s son Manggala.' },
  { id:'luoyang', name:'Luoyang', modern:'Luoyang, Henan, China', polity:'Yuan dynasty', lon:112.45, lat:34.62, size:1, culture:'chinese',
    blurb:'An ancient capital of thirteen dynasties, near the Longmen Grottoes.' },
  { id:'kaifeng', name:'Bianliang (Kaifeng)', modern:'Kaifeng, Henan, China', polity:'Yuan dynasty', lon:114.31, lat:34.80, size:2, culture:'chinese',
    blurb:'The glittering Northern Song capital until 1127. It fell to the Mongols in 1233.' },
  { id:'chengdu', name:'Chengdu', modern:'Chengdu, Sichuan, China', polity:'Yuan dynasty', lon:104.07, lat:30.67, size:2, culture:'chinese',
    blurb:'Polo\'s "Sindufu", the brocade city of Sichuan, devastated in the long Mongol–Song wars.' },
  // --- Southern Song ---
  { id:'xiangyang', name:'Xiangyang', modern:'Xiangyang, Hubei, China', polity:'Southern Song (under siege)', lon:112.14, lat:32.04, size:1, culture:'song',
    blurb:'Besieged by the Mongols since 1268. Persian engineers sent from the Ilkhanate are building counterweight trebuchets that will break the city in 1273.' },
  { id:'ezhou', name:'Ezhou (Wuchang)', modern:'Wuhan, Hubei, China', polity:'Southern Song', lon:114.30, lat:30.55, size:1, culture:'song',
    blurb:'A Yangtze river port crowned by the Yellow Crane Tower, celebrated by Tang poets.' },
  { id:'yangzhou', name:'Yangzhou', modern:'Yangzhou, Jiangsu, China', polity:'Southern Song', lon:119.42, lat:32.39, size:1, culture:'song',
    blurb:'A rich salt and canal city. Polo would later claim (doubtfully) to have governed it for three years.' },
  { id:'quinsai', name:"Quinsai (Lin'an)", modern:'Hangzhou, Zhejiang, China', polity:'Southern Song — capital', lon:120.16, lat:30.27, size:3, culture:'song',
    blurb:'The Song capital, perhaps the largest city on earth. Polo called it "beyond dispute the finest and noblest city in the world".' },
  { id:'fuzhou', name:'Fuzhou', modern:'Fuzhou, Fujian, China', polity:'Southern Song', lon:119.30, lat:26.08, size:1, culture:'song',
    blurb:'A Fujian river city of sugar, ginger and shipbuilding.' },
  { id:'zaitun', name:'Zaitun (Quanzhou)', modern:'Quanzhou, Fujian, China', polity:'Southern Song', lon:118.59, lat:24.91, size:2, culture:'song',
    blurb:'One of the greatest ports in the world, full of Arab, Persian and Indian traders. The Polos would sail home from here in 1291.' },
  // --- Tibet ---
  { id:'ngari', name:'Ngari (Rutog)', modern:'Rutog, Tibet, China', polity:'Sakya Tibet (under Yuan)', lon:79.70, lat:33.40, size:1, culture:'tibet',
    blurb:'A remote high-desert outpost of western Tibet, where salt and wool are traded across the mountains.' },
  { id:'sakya', name:'Sakya', modern:'Sakya, Tibet, China', polity:'Sakya Tibet (under Yuan)', lon:88.02, lat:28.90, size:1, culture:'tibet',
    blurb:'Seat of the Sakya lamas, who rule Tibet for the Mongols. Phagpa, Kublai\'s Imperial Preceptor, belongs to this school.' },
  { id:'lhasa', name:'Lhasa', modern:'Lhasa, Tibet, China', polity:'Sakya Tibet (under Yuan)', lon:91.13, lat:29.65, size:1, culture:'tibet',
    blurb:'The "Place of the Gods", centred on the Jokhang temple founded in the 600s.' },
];

// Route groups, matching the colours of the reference map
const ROUTE_GROUPS = {
  silk:    { name:'Main Silk Road',          color:'#d9822b' },
  steppe:  { name:'Northern Steppe Road',    color:'#d0402e' },
  pontic:  { name:'Black Sea & Caucasus Road', color:'#8c2a1f' },
  persian: { name:'Persian Road',            color:'#6f8a3a' },
  tibet:   { name:'Tibetan Plateau Road',    color:'#2a9d8f' },
  china:   { name:'Roads of China',          color:'#d65db1' },
};

// [cityA, cityB, group, via points]
const EDGES = [
  // Anatolia
  ['constantinople','nicaea','silk',[[29.35,40.93],[29.95,40.73]]],
  ['nicaea','ancyra','silk',[[30.52,39.78],[31.9,39.75]]],
  ['nicaea','smyrna','silk',[[29.06,40.19],[27.9,39.6],[27.18,39.12]]],
  ['smyrna','iconium','silk',[[28.3,38.35],[29.6,38.0],[31.2,38.05]]],
  ['iconium','caesarea','silk',[[33.55,38.25],[34.03,38.37]]],
  ['iconium','ayas','silk',[[33.25,37.3],[34.78,37.28],[35.3,37.0]]],
  ['ancyra','sivas','silk',[[34.2,40.0],[35.8,40.0]]],
  ['ancyra','sinope','pontic',[[33.6,40.7],[34.5,41.4]]],
  ['caesarea','sivas','silk',[]],
  ['sivas','erzincan','silk',[[38.3,39.85]]],
  ['erzincan','erzurum','silk',[]],
  ['erzurum','tabriz','silk',[[42.6,39.75],[44.05,39.45],[44.95,38.6]]],
  ['ayas','aleppo','silk',[[36.4,36.7]]],
  ['aleppo','damascus','silk',[[36.75,35.15],[36.7,34.6]]],
  // Black Sea & Caucasus
  ['sinope','trebizond','pontic',[[36.3,41.25],[37.6,40.98],[38.7,40.95]]],
  ['trebizond','erzurum','pontic',[[40.0,40.6],[40.6,40.15]]],
  ['erzurum','ani','pontic',[[42.4,40.25]]],
  ['ani','tiflis','pontic',[[43.9,41.05]]],
  ['tiflis','baku','pontic',[[46.2,41.2],[47.6,40.75],[48.9,40.45]]],
  ['baku','derbent','pontic',[[49.2,41.05],[48.6,41.6]]],
  // Mesopotamia & Persia
  ['aleppo','mosul','persian',[[38.6,36.55],[40.5,36.75],[42.0,36.6]]],
  ['mosul','baghdad','persian',[[43.6,35.4]]],
  ['baghdad','hamadan','persian',[[45.4,34.1],[46.9,34.35]]],
  ['tabriz','hamadan','persian',[[46.3,37.4],[47.1,36.1]]],
  ['hamadan','rayy','persian',[[49.7,35.3]]],
  ['hamadan','isfahan','persian',[[49.6,33.9]]],
  ['isfahan','yazd','persian',[[52.8,32.3]]],
  ['yazd','kerman','persian',[[55.8,31.1]]],
  ['kerman','hormuz','persian',[[57.4,29.2],[57.2,28.0]]],
  ['tabriz','rayy','silk',[[47.6,37.2],[48.5,36.7],[50.0,36.27]]],
  ['rayy','nishapur','silk',[[52.6,35.6],[54.35,36.17],[56.0,36.25],[57.7,36.2]]],
  ['nishapur','merv','silk',[[60.0,36.6],[61.0,37.15]]],
  ['nishapur','herat','silk',[[60.2,35.3]]],
  ['herat','kabul','silk',[[64.4,33.2],[66.4,32.6],[68.4,33.55]]],
  ['kabul','balkh','silk',[[68.6,34.7],[67.83,34.83],[68.05,35.6],[68.0,36.25]]],
  ['merv','balkh','silk',[[63.6,37.25],[65.4,36.85]]],
  // Central Asia
  ['merv','bukhara','silk',[[62.9,38.5],[63.6,39.1]]],
  ['bukhara','samarkand','silk',[[65.6,39.85]]],
  ['balkh','samarkand','silk',[[67.28,37.25],[67.05,38.3],[66.85,39.0]]],
  ['samarkand','khujand','silk',[[68.2,39.95]]],
  ['khujand','osh','silk',[[70.9,40.45],[71.8,40.55]]],
  ['osh','kashgar','silk',[[73.4,40.0],[73.9,39.75],[75.0,39.6]]],
  ['balkh','badakhshan','silk',[[68.86,36.73],[69.9,36.9]]],
  ['badakhshan','tashkurgan','silk',[[71.5,36.75],[72.6,36.95],[73.6,37.2],[74.5,37.45]]],
  ['tashkurgan','kashgar','silk',[[75.0,38.45],[75.55,39.0]]],
  // Steppe
  ['derbent','sarai','steppe',[[47.3,43.3],[46.6,44.7],[46.8,46.0]]],
  ['sarai','saraichik','steppe',[[49.5,47.4]]],
  ['sarai','tana','steppe',[[45.6,47.45],[43.4,47.6],[41.3,47.35]]],
  ['tana','caffa','pontic',[[38.3,47.2],[37.0,47.1],[35.6,46.85],[34.5,46.4],[34.2,46.05],[34.3,45.6],[34.8,45.3]]],
  ['saraichik','urgench','steppe',[[54.0,45.6],[55.6,44.3],[57.6,43.4]]],
  ['urgench','bukhara','steppe',[[61.0,41.6],[62.8,40.6]]],
  ['saraichik','otrar','steppe',[[55.5,47.9],[60.0,47.6],[63.5,46.2],[66.2,44.7]]],
  ['otrar','tashkent','steppe',[[68.9,42.1]]],
  ['tashkent','samarkand','steppe',[[68.7,40.6],[67.9,40.0]]],
  ['tashkent','taraz','steppe',[[70.2,42.2]]],
  ['otrar','taraz','steppe',[[69.8,43.0]]],
  ['taraz','balasagun','steppe',[[73.2,42.95]]],
  ['balasagun','almaliq','steppe',[[77.0,43.35],[79.0,43.65]]],
  ['almaliq','beshbalik','steppe',[[83.0,44.55],[86.4,44.2]]],
  ['beshbalik','qocho','steppe',[[89.3,43.5]]],
  // Tarim
  ['kashgar','yarkand','silk',[]],
  ['yarkand','khotan','silk',[[78.6,37.75]]],
  ['khotan','cherchen','silk',[[82.0,37.2],[83.9,37.7]]],
  ['cherchen','lop','silk',[[86.9,38.6]]],
  ['lop','dunhuang','silk',[[91.0,39.55],[93.0,39.85],[94.05,39.93]]],
  ['kashgar','aksu','silk',[[76.3,39.65],[78.0,40.1],[79.3,40.75]]],
  ['aksu','kucha','silk',[[81.6,41.45]]],
  ['kucha','korla','silk',[[84.6,41.75]]],
  ['korla','qocho','silk',[[86.5,42.25],[87.6,42.6],[88.65,42.79]]],
  ['qocho','hami','silk',[[91.3,42.7]]],
  ['hami','dunhuang','silk',[[93.6,41.4],[93.9,40.5]]],
  // Hexi Corridor
  ['dunhuang','jiuquan','silk',[[95.8,40.45],[97.3,40.0]]],
  ['jiuquan','zhangye','silk',[[99.4,39.4]]],
  ['zhangye','wuwei','silk',[[101.5,38.5]]],
  ['wuwei','lanzhou','silk',[[103.3,37.0]]],
  ['lanzhou','jingzhao','silk',[[104.9,35.5],[105.7,34.58],[107.3,34.4]]],
  ['jingzhao','luoyang','silk',[[110.3,34.55],[111.4,34.75]]],
  ['luoyang','kaifeng','silk',[[113.4,34.75]]],
  ['kaifeng','yangzhou','silk',[[116.0,34.2],[117.3,33.6],[118.6,32.9]]],
  ['yangzhou','quinsai','silk',[[119.45,31.9],[120.3,31.2],[120.3,30.7]]],
  // China
  ['wuwei','xingqing','china',[[104.0,37.6],[105.2,37.55]]],
  ['xingqing','datong','china',[[107.6,39.2],[109.5,39.8],[111.4,40.1]]],
  ['datong','khanbaliq','china',[[114.7,40.45],[115.6,40.35]]],
  ['datong','shangdu','china',[[114.5,41.2]]],
  ['shangdu','khanbaliq','china',[[116.0,41.2],[116.2,40.6]]],
  ['khanbaliq','zhending','china',[[115.9,39.4],[115.2,38.8]]],
  ['zhending','kaifeng','china',[[114.5,37.0],[114.4,35.8]]],
  ['jingzhao','chengdu','china',[[107.6,33.6],[107.03,33.07],[105.55,32.2],[104.6,31.4]]],
  ['jingzhao','xiangyang','china',[[109.9,33.9],[110.9,33.4],[111.6,32.6]]],
  ['xiangyang','ezhou','china',[[112.6,31.3],[113.4,30.75]]],
  ['ezhou','quinsai','china',[[115.4,29.7],[116.6,29.5],[117.8,29.6],[119.1,30.0]]],
  ['quinsai','fuzhou','china',[[119.8,29.3],[119.6,28.2],[119.4,27.1]]],
  ['fuzhou','zaitun','china',[[119.0,25.5]]],
  // Tibet
  ['khotan','ngari','tibet',[[79.9,36.2],[79.5,35.2],[79.6,34.2]]],
  ['ngari','sakya','tibet',[[80.3,32.5],[81.0,31.5],[81.8,30.85],[83.5,29.9],[85.5,29.4],[87.0,29.1]]],
  ['sakya','lhasa','tibet',[[88.88,29.27],[90.0,29.35]]],
  ['lhasa','xining','tibet',[[91.4,30.6],[92.05,31.47],[91.9,32.9],[93.0,34.2],[94.9,36.4],[97.4,36.5],[99.6,36.45],[100.8,36.55]]],
  ['xining','lanzhou','tibet',[[102.8,36.3]]],
];

// Mountain ranges: [points, height (world units), half-width (degrees)]
const RANGES = [
  [[[29.5,37.4],[31.5,37.1],[33.5,36.9],[35.0,37.4],[36.6,37.9],[38.5,38.3],[40.5,38.5],[42.5,38.2]], 48, .55], // Taurus
  [[[31.5,41.0],[34,41.25],[36.5,40.7],[39,40.65],[41.5,41.0],[42.3,41.3]], 42, .42], // Pontic
  [[[37.5,44.6],[40,43.5],[42.5,42.9],[44.5,42.6],[46.5,41.95],[47.7,41.45]], 105, .6], // Caucasus
  [[[43,40.9],[45,40.8],[46.5,39.8]], 50, .42], // Lesser Caucasus
  [[[44.3,39.72]], 150, .32], // Ararat
  [[[35.45,38.5]], 105, .26], // Erciyes
  [[[44.5,37.3],[45.8,36],[47,34.6],[48.5,33.2],[50.5,31.2],[52.5,29.8],[54.5,28.6],[56.3,28.2]], 62, .85], // Zagros
  [[[47.5,37.6],[49,36.9],[50.5,36.35],[52,36.05],[53.8,36.45],[56,37.4]], 92, .36], // Alborz
  [[[52.1,35.95]], 165, .22], // Damavand
  [[[56,38.2],[58,37.9],[60,37.1],[61,36.4]], 52, .38], // Kopet Dag
  [[[66.5,35.2],[68.2,35.35],[69.8,35.7],[71.3,36.3],[73,36.6]], 135, .62], // Hindu Kush
  [[[63.5,34.6],[66,34.68],[67.5,34.55]], 75, .45], // Koh-i-Baba
  [[[69,33.9],[71,34.1]], 70, .35], // Safed Koh
  [[[72.3,38.4],[73.4,38.9],[74.3,38.6],[74.6,37.9],[74.0,37.25]], 150, .75], // Pamir
  [[[74.85,38.25]], 205, .25], // Muztagh Ata
  [[[75.48,38.66]], 195, .25], // Kongur
  [[[69.5,39.45],[71.5,39.5],[73.5,39.55]], 95, .45], // Alay
  [[[67.6,39.4],[69.4,39.7]], 58, .33], // Turkestan range
  [[[71.5,41.6],[74,41.3],[76.5,41.3],[78.5,41.9],[80.5,42.4],[82.5,42.65],[84.5,43.1],[86.5,43.3],[88.5,43.55],[90.5,43.55],[92.5,43.55],[94,43.5]], 125, .85], // Tian Shan
  [[[80,44.9],[82.5,44.65],[84.5,44.15]], 85, .42], // Borohoro
  [[[72.5,42.25],[74.5,42.35]], 72, .33], // Kyrgyz Ala-Too
  [[[76.5,42.0],[79,42.1]], 95, .33], // Terskey
  [[[76.5,36.9],[78.5,36.4],[80.5,36.2],[83,36.0],[85.5,36.4],[88,36.6],[91,36.0],[94,35.8],[97,35.3]], 145, .85], // Kunlun
  [[[88.5,38.35],[90.5,38.6],[92.5,39.0],[94,39.25]], 62, .38], // Altun Shan
  [[[95,39.0],[97.5,38.85],[99.5,38.25],[101.5,37.55],[102.8,37.0]], 118, .52], // Qilian
  [[[73.5,35.6],[75.5,34.5],[78,32.6],[80.5,30.6],[83,29.1],[85.5,28.2],[88,27.85],[90.5,27.9],[93,28.1],[95.5,29]], 215, .78], // Himalaya
  [[[80,31.8],[84,30.95],[88,30.35],[91,30.35]], 85, .48], // Gangdise
  [[[81.31,31.07]], 135, .2], // Kailash
  [[[74.5,36.4],[76.5,35.7],[78,35.1]], 195, .55], // Karakoram
  [[[104.5,34.0],[106.5,33.8],[108.5,33.8],[110.5,33.7],[112,33.45]], 80, .48], // Qinling
  [[[106.5,32.4],[108.5,32.0],[110.5,31.6]], 58, .42], // Daba
  [[[114.75,39.75],[114.0,38.5],[113.6,37.0],[113.2,35.6]], 66, .42], // Taihang
  [[[115.8,40.6],[117.5,40.65],[119,40.35]], 58, .38], // Yan
  [[[107.5,41.2],[110,41.1],[112,41.3],[114,41.55]], 52, .42], // Yin
  [[[105.85,39.2],[105.95,38.5],[105.75,37.8]], 58, .2], // Helan
  [[[111.2,38.8],[111.5,36.8]], 42, .38], // Luliang
  [[[35.8,33.2],[36.3,34.0],[36.6,34.6]], 42, .24], // Lebanon
  [[[116.8,26.5],[117.8,27.4],[118.6,28.2]], 52, .48], // Wuyi
  [[[89.25,42.97],[90.25,42.92]], 26, .1], // Flaming Mountains
  [[[95.5,30.5],[98,30],[99.5,28]], 120, .9], // Hengduan
];

// Broad elevation: [lon, lat, rx, ry, height]
const PLATEAUS = [
  [34,39.2,5,1.6,13],[43.5,39.6,2.5,1.2,20],[54,33,6,3,13],[67,34.6,3.5,1.6,24],[73.6,38,1.8,1.3,38],
  [78,41.8,4,.9,16],[86,32.5,10,3.2,68],[98,35.5,4,1.8,44],[108,42,9,2.2,16],[107,36.3,4,1.5,15],
  [83,39.5,7,2,5],[99,39,4,1.2,13],[113,40,2,1,13],[47.5,38.5,2,1.2,12],
];

// Seas at level 0. Polygons [lon,lat]. land:true carves islands.
const SEAS = [
  { name:'Mediterranean', pts:[[20,30],[20,40.8],[23.5,40.6],[26.0,40.75],[26.6,40.45],[27.5,40.98],[28.6,40.97],[29.0,40.95],[29.4,40.82],[29.9,40.72],[29.2,40.42],[28.0,40.38],[27.3,40.35],[26.7,40.25],[26.3,40.05],[26.2,39.5],[26.8,39.3],[26.7,38.6],[27.0,38.45],[26.5,38.2],[27.2,37.9],[27.3,37.2],[28.0,36.8],[29.2,36.5],[30.4,36.3],[30.6,36.85],[31.5,36.75],[32.6,36.1],[33.8,36.2],[34.6,36.75],[35.5,36.6],[35.95,36.85],[36.15,36.55],[35.85,35.85],[35.9,35.2],[35.5,33.9],[35.05,33.1],[34.6,31.9],[34.3,31.3],[33.0,31.1],[32.2,31.3],[31.0,31.6],[29.8,31.2],[25,31.8]] },
  { name:'Cyprus', land:true, pts:[[32.3,35.1],[33.0,35.4],[34.6,35.7],[34.0,35.0],[33.0,34.6],[32.4,34.75]] },
  { name:'Black Sea', pts:[[28.05,41.6],[27.9,42.7],[28.6,43.9],[29.7,45.2],[30.8,46.5],[31.8,46.6],[33.5,46.0],[32.5,45.4],[33.4,44.5],[34.9,44.8],[36.5,45.3],[37.8,46.6],[39.2,47.2],[38.5,46.0],[37.8,44.7],[39.5,43.5],[41.5,42.0],[41.65,41.6],[40.5,41.12],[39.5,41.15],[38.2,41.05],[37.0,41.15],[36.0,41.7],[35.5,41.75],[35.25,42.05],[34.8,42.0],[33.3,42.0],[31.5,41.25],[29.2,41.25]] },
  { name:'Caspian Sea', pts:[[49.0,46.5],[47.5,45.5],[47.6,44.0],[47.5,43.0],[48.5,41.8],[49.6,40.4],[50.4,40.3],[49.3,39.3],[49.0,38.0],[49.6,37.4],[51.0,36.7],[53.9,36.9],[53.9,37.5],[53.6,39.0],[53.0,40.0],[53.0,40.8],[52.7,41.6],[52.4,42.8],[51.3,43.2],[50.7,44.5],[51.4,45.3],[53.0,45.2],[53.2,46.6],[51.5,46.95],[50.0,46.7]] },
  { name:'Aral Sea', pts:[[58.3,46.5],[61.0,46.7],[61.6,45.5],[60.5,44.0],[59.0,43.5],[58.2,44.6]] },
  { name:'Persian Gulf', pts:[[47.8,30.2],[49.0,30.0],[50.3,29.8],[51.2,28.3],[52.6,27.4],[54.4,26.6],[56.0,27.05],[56.9,26.85],[57.3,25.8],[58.6,23.8],[62.0,22.5],[62.0,18.0],[50.0,18.0],[50.0,25.5],[49.0,27.0],[48.2,28.6]] },
  { name:'East China Sea', pts:[[117.6,39.1],[118.8,39.2],[119.6,39.9],[121.2,40.9],[122.2,40.5],[121.2,39.0],[122.4,37.4],[120.7,36.4],[119.4,35.1],[120.25,34.3],[120.85,32.6],[121.8,31.75],[121.9,30.95],[121.0,30.65],[120.6,30.38],[121.6,29.95],[122.1,29.0],[121.5,28.2],[120.6,27.3],[119.75,26.3],[119.65,25.5],[118.85,24.75],[117.6,23.75],[116.0,22.8],[114.0,22.3],[112,21.6],[110,21],[110,15],[130,15],[130,42],[123,41.5]] },
];

// Lakes (own water level): [name, lon, lat, rx, ry]
const LAKES = [
  ['Lake Van',42.9,38.65,.45,.27],['Lake Urmia',45.45,37.7,.24,.6],['Lake Sevan',45.3,40.35,.2,.14],
  ['Issyk-Kul',77.3,42.42,1.45,.3],['Lake Balkhash',75.5,46.6,2.5,.33],['Kokonor (Qinghai Lake)',100.2,36.9,.48,.25],
  ['Lop Nur',90.3,40.45,.35,.3],['Bosten Lake',87.05,41.97,.33,.14],['Lake Manasarovar',81.45,30.62,.16,.12],
  ['Namtso',90.6,30.7,.4,.15],['Dongting Lake',112.9,29.3,.5,.3],['Poyang Lake',116.3,29.05,.28,.5],
  ['Lake Tai',120.2,31.2,.3,.28],['Lake Tuz',33.4,38.8,.28,.4],
];

// Rivers, source to mouth: [name, width(world units), points]
const RIVERS = [
  ['Euphrates',4.5,[[38.9,39.3],[38.8,38.8],[38.3,37.6],[38.05,36.85],[38.15,36.3],[39.0,35.95],[40.2,35.3],[41.0,34.5],[42.0,34.2],[43.2,33.4],[44.3,32.5],[45.5,31.5],[46.6,31.0],[47.6,30.6],[48.4,29.9]]],
  ['Tigris',4,[[40.2,38.0],[41.5,37.5],[42.4,37.1],[43.1,36.4],[43.35,35.5],[43.9,34.5],[44.4,33.4],[45.2,32.6],[46.4,31.8],[47.3,31.0],[47.7,30.4]]],
  ['Kızılırmak (Halys)',3,[[38.5,39.6],[37.0,39.45],[35.8,39.05],[34.8,38.95],[34.0,39.5],[33.6,40.4],[34.2,41.0],[35.2,41.4],[35.95,41.8]]],
  ['Kura',3,[[43.0,41.6],[44.4,41.9],[44.8,41.6],[45.8,41.2],[47.5,40.7],[48.9,39.8],[49.4,39.2]]],
  ['Volga',6.5,[[46.0,49.8],[46.7,48.4],[47.3,47.3],[47.8,46.7],[48.1,46.1],[48.6,45.6]]],
  ['Ural',3.5,[[52.0,50.5],[51.6,49.3],[51.8,48.2],[51.6,47.3],[51.8,46.7]]],
  ['Amu Darya (Oxus)',5.5,[[69.5,37.3],[68.3,37.1],[67.3,37.2],[66.4,37.6],[65.0,38.4],[63.6,39.1],[62.3,40.0],[61.2,41.2],[60.3,42.0],[59.5,42.8],[59.0,43.7]]],
  ['Syr Darya (Jaxartes)',4.5,[[71.5,40.9],[70.5,40.4],[69.6,40.3],[68.8,40.7],[68.4,41.6],[68.1,42.6],[67.0,43.7],[65.5,44.6],[64.0,45.0],[62.0,46.0],[60.9,46.2]]],
  ['Ili',3.5,[[81.6,43.9],[80.5,43.88],[79.0,44.0],[77.5,43.9],[76.0,44.5],[75.0,45.5],[74.6,46.3]]],
  ['Yellow River',5,[[96,35.0],[100,35.8],[101.7,36.0],[103.0,35.9],[103.8,36.1],[104.6,36.6],[105.2,37.5],[106.0,38.3],[106.5,39.2],[107.0,40.2],[108.5,40.8],[110.5,40.6],[111.2,39.6],[110.6,37.5],[110.4,35.6],[111.2,34.85],[112.5,34.9],[113.8,34.95],[114.8,34.85],[116.2,34.5],[117.2,34.25],[118.5,33.8],[119.5,34.0],[120.4,34.1]]],
  ['Yangtze',7,[[104.0,28.8],[105.5,28.9],[106.6,29.6],[108.4,30.8],[110.3,31.0],[111.3,30.7],[112.3,30.3],[113.2,29.6],[114.3,30.6],[115.5,30.0],[116.4,29.8],[117.2,30.6],[118.4,31.4],[118.8,32.1],[119.5,32.25],[120.5,31.9],[121.5,31.6],[121.95,31.3]]],
  ['Qiantang',4,[[118.2,29.6],[119.3,29.8],[119.9,30.1],[120.3,30.22],[120.9,30.35]]],
  ['Yongding',3,[[115.3,40.3],[115.65,40.0],[115.85,39.75],[115.95,39.5],[116.3,39.25],[117.0,39.05],[117.75,38.98]]],
];

// Biomes
const BIOMES = {
  thrace:     { g:[.55,.63,.31], a:[.72,.67,.38], rough:7,  dunes:0,   snow:999, density:.6,  trees:{umbrella:.3, cypress:.3, olive:.2, plane:.15, oak:.15, shrub:.25} },
  anatolia:   { g:[.80,.68,.40], a:[.68,.60,.36], rough:9,  dunes:0,   snow:70,  density:.22, trees:{oak:.25, juniper:.2, shrub:.4, rock:.35} },
  pontic:     { g:[.35,.55,.30], a:[.30,.47,.27], rough:12, dunes:0,   snow:70,  density:1.0, trees:{fir:.5, beech:.5, broad:.15} },
  caucasus:   { g:[.40,.58,.31], a:[.50,.60,.34], rough:12, dunes:0,   snow:58,  density:.8,  trees:{fir:.45, beech:.4, rock:.2} },
  hyrcanian:  { g:[.30,.52,.26], a:[.38,.56,.30], rough:12, dunes:0,   snow:999, density:1.0, trees:{beech:.5, oak:.3, plane:.2} },
  levant:     { g:[.80,.70,.47], a:[.68,.64,.40], rough:7,  dunes:0,   snow:999, density:.32, trees:{olive:.45, cypress:.15, cedar:.12, shrub:.3} },
  mesopotamia:{ g:[.86,.76,.54], a:[.78,.70,.48], rough:2,  dunes:.1,  snow:999, density:.18, trees:{date:.6, tamarisk:.3, shrub:.15} },
  iran:       { g:[.84,.67,.46], a:[.74,.56,.41], rough:10, dunes:0,   snow:72,  density:.13, trees:{pistachio:.35, juniper:.2, shrub:.3, rock:.45} },
  sand:       { g:[.94,.77,.50], a:[.89,.68,.43], rough:2,  dunes:1,   snow:999, density:.04, trees:{saxaul:.4, tamarisk:.25, rock:.08} },
  oasis:      { g:[.50,.64,.31], a:[.62,.68,.36], rough:3,  dunes:0,   snow:999, density:.45, trees:{poplar:.4, mulberry:.3, plane:.2, fruit:.2} },
  steppe:     { g:[.71,.73,.41], a:[.60,.66,.34], rough:4,  dunes:0,   snow:999, density:.3,  trees:{tuft:.7, shrub:.2, rock:.08, birch:.03} },
  alpine:     { g:[.44,.57,.33], a:[.56,.54,.42], rough:12, dunes:0,   snow:50,  density:.6,  trees:{spruce:.8, juniper:.2, rock:.35} },
  gobi:       { g:[.74,.63,.48], a:[.60,.52,.42], rough:4,  dunes:.15, snow:999, density:.07, trees:{rock:.5, saxaul:.3} },
  tibet:      { g:[.63,.61,.40], a:[.55,.49,.37], rough:8,  dunes:0,   snow:74,  density:.12, trees:{rock:.6, tuft:.4, juniper:.05} },
  loess:      { g:[.86,.73,.47], a:[.67,.65,.37], rough:8,  dunes:0,   snow:999, density:.22, terr:.95, trees:{fruit:.3, shrub:.3, poplar:.2} },
  northchina: { g:[.58,.65,.35], a:[.75,.69,.41], rough:3,  dunes:0,   snow:999, density:.4,  trees:{willow:.4, poplar:.3, sophora:.3} },
  southchina: { g:[.33,.56,.30], a:[.42,.62,.32], rough:10, dunes:0,   snow:999, density:.75, terr:.6, trees:{bamboo:.4, pine:.3, camphor:.3} },
  flaming:    { g:[.80,.40,.24], a:[.70,.33,.21], rough:10, dunes:0,   snow:999, density:0,   trees:{} },
};

// Biome anchors: [lon, lat, biome, sigma(deg)]
const BIOME_ANCHORS = [
  [51.5,36.75,'hyrcanian',.55],[53.5,36.8,'hyrcanian',.5],[49.8,37.2,'hyrcanian',.5],[48.9,38.4,'hyrcanian',.4],
  [28,41.3,'thrace',1.4],[27.5,38.6,'thrace',1.2],[30,40.3,'thrace',1.0],
  [33,39.3,'anatolia',2],[36,39,'anatolia',2],[38.5,39.6,'anatolia',1.5],[41,39.7,'anatolia',1.3],[44,39.5,'anatolia',1.1],[47.2,38.1,'anatolia',1.2],
  [35.5,41.6,'pontic',1],[38.5,40.8,'pontic',.8],[41.5,41.4,'pontic',.9],
  [44.5,42.0,'caucasus',1.1],[46.5,41.6,'caucasus',.9],[40,43.5,'caucasus',1.5],
  [35.5,35.5,'levant',1.3],[36.5,33.3,'levant',1.0],[37.4,36.4,'levant',1.1],
  [43.5,35,'mesopotamia',1.8],[45.5,32.5,'mesopotamia',1.8],[57,27.5,'mesopotamia',1.0],
  [50,36,'iran',2],[53,34,'iran',2.3],[55,31,'iran',2.3],[58,29,'iran',2],[58.5,35.8,'iran',1.6],[62,34.5,'iran',2],[68.5,34.4,'iran',1.4],[49.8,40.6,'iran',.9],
  [60,39.5,'sand',2.2],[63,41.5,'sand',2],[56,41,'gobi',1.5],[42,30,'sand',3.5],[36,30,'sand',2],
  [61.8,37.65,'oasis',.55],[64.4,39.8,'oasis',.8],[67,39.6,'oasis',.8],[71.5,40.6,'oasis',1.0],[69.3,41.3,'oasis',.7],[59.2,42.0,'oasis',.7],[66.9,36.8,'oasis',.6],
  [48,47,'steppe',2.5],[53,47.5,'steppe',2.5],[59,47.5,'steppe',2.5],[65,46,'steppe',2.5],[68.5,43.5,'steppe',1.5],[72,43.3,'steppe',1.3],[76,43.6,'steppe',1.3],[81,44.3,'steppe',1.4],[88.5,44.6,'steppe',1.6],[116,42.3,'steppe',1.6],[111,41.6,'steppe',2],
  [73.5,38.5,'alpine',1.3],[71,37,'alpine',1.1],[69.5,35.3,'alpine',1.0],[78,42.3,'alpine',1.2],[84,43,'alpine',1.4],[74.5,40,'alpine',.9],[100.5,38,'alpine',1.0],
  [83,39.5,'sand',3],[79,38.5,'sand',1.5],[87,40,'sand',1.8],
  [76,39.45,'oasis',.55],[77.2,38.4,'oasis',.45],[79.9,37.1,'oasis',.45],[80.3,41.2,'oasis',.45],[83,41.7,'oasis',.45],[93.5,42.85,'oasis',.4],
  [89.8,42.95,'flaming',.3],
  [92,42,'gobi',2],[95.5,41,'gobi',1.5],[94.7,39.95,'sand',.5],[90,40.6,'gobi',1.5],
  [98.5,39.9,'gobi',1.1],[100.4,38.95,'oasis',.5],[102.6,37.95,'oasis',.5],[104,40,'gobi',2],[106.3,38.5,'northchina',.7],
  [86,32,'tibet',4],[93,33,'tibet',3],[81,32,'tibet',2.5],[91,29.6,'tibet',1.2],[97,35,'tibet',2],[101.5,36.5,'tibet',1.1],
  [104,35.5,'loess',1.5],[108,36.6,'loess',2],[111,37,'loess',1.5],[113,40,'loess',1.2],
  [109,34.4,'northchina',1.2],[112.5,34.6,'northchina',1.2],[115,35.5,'northchina',1.6],[116,38.5,'northchina',1.6],[117,39.9,'northchina',1.2],[118.5,33.5,'northchina',1.5],
  [107,33.3,'southchina',1.3],[104,30.7,'southchina',1.5],[112,32,'southchina',1.0],[114,30.5,'southchina',1.5],[117,30,'southchina',1.5],[120,30.3,'southchina',1.2],[119,27,'southchina',1.8],[119.5,32.4,'southchina',1.0],
];

// Landmarks. Either city:'id' (built in the city) or lon/lat (placed beside the nearest road).
const LANDMARKS = [
  { city:'constantinople', type:'hagiaSophia', name:'Hagia Sophia', blurb:'Justinian\'s great church, finished in 537. Its dome seems to float on light. In 1272 it has no minarets; those come after 1453.' },
  { city:'constantinople', type:'obelisk', name:'The Hippodrome', blurb:'An Egyptian obelisk and the bronze Serpent Column from Delphi stand on the old chariot-racing track.' },
  { city:'nicaea', type:'church', p:{style:'byz'}, name:'Church of Hagia Sophia, Nicaea', blurb:'Site of the Second Council of Nicaea in 787.' },
  { city:'smyrna', type:'citadel', p:{hill:7, r:9}, name:'Castle of Mount Pagus', blurb:'An ancient hilltop citadel above the harbour.' },
  { city:'ancyra', type:'citadel', p:{hill:9, r:10}, name:'Ankara Citadel', blurb:'Walls of Byzantine and Seljuk stone crown the rocky hill.' },
  { city:'iconium', type:'mosque', p:{dome:5, minarets:1, domeColor:'lead', style:'seljuk'}, name:'Alaeddin Mosque', blurb:'The Seljuk sultans\' Friday mosque, completed around 1221 on the city\'s central hill.' },
  { lon:33.55, lat:38.25, type:'caravanserai', p:{size:16}, name:'Sultan Han', blurb:'A huge Seljuk caravanserai built in 1229. Caravans rest here behind fortress walls, a day apart along the road.' },
  { city:'caesarea', type:'mosque', p:{dome:3.5, minarets:1, domeColor:'lead', style:'seljuk'}, name:'Huand Hatun Complex', blurb:'A mosque and madrasa built in 1238 by a Seljuk queen.' },
  { city:'sivas', type:'madrasa', p:{tile:'turq'}, name:'Gök Medrese', blurb:'The "Blue Madrasa", completed in 1271. Its twin minarets are faced with turquoise tile.' },
  { city:'erzurum', type:'citadel', p:{hill:6, r:8}, name:'Erzurum Citadel', blurb:'The fortress of "Arzrum", guarding the high road to Persia.' },
  { city:'erzincan', type:'kumbet', name:'Seljuk Tomb Tower', blurb:'Conical-roofed tomb towers (kümbet) like this are typical of Seljuk Anatolia.' },
  { lon:44.15, lat:39.5, type:'label', name:'Mount Ararat', blurb:'Polo wrote that Noah\'s Ark rests on this mountain, whose snows never melt.' },
  { city:'trebizond', type:'church', p:{style:'byz', big:true}, name:'Hagia Sophia of Trebizond', blurb:'Built around 1250–1260 by Emperor Manuel I, its walls are painted with brilliant frescoes.' },
  { city:'sinope', type:'citadel', p:{hill:3, r:9}, name:'Sinope Fortress', blurb:'Seljuk walls guard the isthmus of this Black Sea harbour.' },
  { city:'ayas', type:'harbor', p:{ship:'galley'}, name:'Harbour of Laiazzo', blurb:'Venetian and Genoese galleys unload here. The Polos landed here in 1271.' },
  { city:'ayas', type:'citadel', p:{hill:2, r:7}, name:'Castle of Ayas', blurb:'An Armenian sea castle defending the busiest port in the eastern Mediterranean.' },
  { lon:34.78, lat:37.28, type:'gate', name:'The Cilician Gates', blurb:'A narrow gorge through the Taurus Mountains used by armies since Alexander the Great.' },
  { city:'aleppo', type:'citadel', p:{hill:10, r:13, glacis:true}, name:'Citadel of Aleppo', blurb:'A fortress on a huge mound with a sloping stone glacis, rebuilt by the Ayyubids around 1200.' },
  { city:'damascus', type:'mosque', p:{dome:5, minarets:3, domeColor:'lead', style:'umayyad'}, name:'Umayyad Mosque', blurb:'Built in 715 on the site of a Roman temple and a church of John the Baptist. One of the oldest great mosques.' },
  { city:'mosul', type:'minaret', p:{h:22, r:1.5, lean:.12, color:'brick'}, name:'Al-Hadba Minaret', blurb:'The "Hunchback", the leaning minaret of the Great Mosque of al-Nuri, built in 1172.' },
  { city:'baghdad', type:'madrasa', p:{tile:'brick'}, name:'Mustansiriya Madrasa', blurb:'Founded in 1233, one of the few great Abbasid buildings to survive the Mongol sack of 1258.' },
  { city:'baghdad', type:'ruins', name:'Ruins of the Round City', blurb:'Palaces and libraries of the caliphs lie in ruins. Chroniclers said the Tigris ran black with the ink of books.' },
  { city:'ani', type:'church', p:{style:'armenian', big:true}, name:'Cathedral of Ani', blurb:'Completed in 1001 by the architect Trdat, it has pointed arches long before Gothic Europe.' },
  { city:'ani', type:'ruins', name:'Walls of Ani', blurb:'Massive double walls of red and black volcanic stone.' },
  { city:'tiflis', type:'citadel', p:{hill:8, r:8}, name:'Narikala Fortress', blurb:'A fortress on the ridge above the Kura river and the sulphur baths.' },
  { city:'baku', type:'tower', p:{h:14, r:3.2, color:'stone', buttress:true}, name:'Maiden Tower', blurb:'A mysterious 12th-century stone tower by the Caspian shore.' },
  { city:'derbent', type:'citadel', p:{hill:5, r:9}, name:'Naryn-Kala & the Caspian Gates', blurb:'Sasanian walls of the 500s run from this citadel down into the sea to block nomads from the north.' },
  { city:'tabriz', type:'yurtPalace', p:{gold:true}, name:'Camp of Abaqa Khan', blurb:'The Ilkhan\'s court still lives partly in great felt tents beside the city\'s bazaars.' },
  { city:'tabriz', type:'mosque', p:{dome:4.5, minarets:2, domeColor:'turq'}, name:'Friday Mosque of Tabriz', blurb:'The city\'s main mosque, surrounded by one of the richest bazaars in Asia.' },
  { lon:46.24, lat:37.39, type:'observatory', name:'Maragheh Observatory', blurb:'Founded in 1259 by Nasir al-Din Tusi for Hülegü, the most advanced astronomical observatory of its age.' },
  { city:'rayy', type:'tower', p:{h:12, r:3, color:'brick', fluted:true}, name:'Toghrul Tower', blurb:'A fluted brick tomb tower built in 1139 for the Seljuk sultan Toghrul.' },
  { city:'rayy', type:'ruins', name:'Ruins of old Rayy', blurb:'The Mongols destroyed the city in 1220.' },
  { lon:52.1, lat:35.8, type:'label', name:'Mount Damavand', blurb:'The tallest mountain in Persia. In legend the demon-king Zahhak is chained inside it.' },
  { lon:54.35, lat:36.17, type:'mosque', p:{dome:0, minarets:1, domeColor:'brick'}, name:'Tarikhaneh Mosque, Damghan', blurb:'One of the oldest mosques in Iran, from the 700s, built of fired brick.' },
  { city:'hamadan', type:'mausoleum', p:{color:'brick', dome:'lead', conical:true}, name:'Tomb of Avicenna', blurb:'The physician and philosopher Ibn Sina died in Hamadan in 1037.' },
  { city:'isfahan', type:'mosque', p:{dome:6, minarets:2, domeColor:'brick', style:'iwan'}, name:'Friday Mosque of Isfahan', blurb:'Its great brick domes were built in the 1080s under the Seljuk vizier Nizam al-Mulk.' },
  { city:'yazd', type:'dakhma', name:'Zoroastrian Tower of Silence', blurb:'Zoroastrians lay out their dead on these round towers so the elements stay pure.' },
  { city:'kerman', type:'mosque', p:{dome:3.5, minarets:1, domeColor:'turq'}, name:'Mosque of the Qutlugh-Khanids', blurb:'Kerman\'s rulers are descended from Kara-Khitai princes.' },
  { city:'hormuz', type:'harbor', p:{ship:'dhow'}, name:'Harbour of Hormuz', blurb:'Ships from India bring spices, pearls and ivory. Polo found them "wretched", sewn together with coconut fibre.' },
  { city:'nishapur', type:'ruins', name:'Ruins of Nishapur', blurb:'Destroyed in 1221 in revenge for the death of Genghis Khan\'s son-in-law.' },
  { city:'nishapur', type:'mausoleum', p:{color:'tile', dome:'turq'}, name:'Tomb of Omar Khayyam', blurb:'The poet and astronomer (died 1131) asked to be buried where blossoms would fall on his grave.' },
  { city:'merv', type:'mausoleum', p:{color:'brick', dome:'turq', big:true}, name:'Mausoleum of Sultan Sanjar', blurb:'Built in 1157. Its double dome was said to be visible a day\'s march away.' },
  { city:'merv', type:'ruins', name:'Ruins of Merv', blurb:'The Mongols reportedly killed its whole population in 1221.' },
  { city:'herat', type:'citadel', p:{hill:7, r:10}, name:'Citadel of Herat', blurb:'Fortress of the Kart princes.' },
  { city:'bukhara', type:'minaret', p:{h:30, r:2.1, color:'brick', lantern:true}, name:'Kalyan Minaret', blurb:'Built in 1127. Legend says Genghis Khan was so impressed that he spared it when he burned the city in 1220.' },
  { city:'bukhara', type:'mausoleum', p:{color:'brick', dome:'brick', samanid:true}, name:'Samanid Mausoleum', blurb:'A 10th-century masterpiece of patterned brick.' },
  { city:'samarkand', type:'ruins', name:'Afrasiyab', blurb:'The old city on the hill, abandoned after the Mongol siege of 1220.' },
  { city:'samarkand', type:'mausoleum', p:{color:'tile', dome:'turq'}, name:'Shrine of Shah-i-Zinda', blurb:'The shrine of the "Living King", Qusam ibn Abbas, a cousin of the Prophet.' },
  { city:'urgench', type:'kumbet', p:{color:'brick', roof:'turq'}, name:'Mausoleum of Fakhr al-Din Razi', blurb:'A tent-roofed tomb from the Khwarazmian golden age.' },
  { city:'urgench', type:'ruins', name:'Flooded Gurganj', blurb:'The Mongols diverted the Oxus to drown the city in 1221.' },
  { city:'balkh', type:'ruins', name:'Ruins of Balkh', blurb:'The "Mother of Cities", sacked by Genghis Khan in 1220.' },
  { lon:67.28, lat:37.25, type:'label', name:'Oxus Crossing at Termez', blurb:'The great river Amu Darya, known to the Greeks as the Oxus.' },
  { lon:67.05, lat:38.3, type:'gate', name:'The Iron Gate', blurb:'A narrow defile in the Baysun mountains, the ancient border between Bactria and Sogdiana.' },
  { lon:67.83, lat:34.83, type:'bamiyan', name:'Buddhas of Bamiyan', blurb:'Two colossal Buddhas, 55 and 38 metres tall, carved into the cliff in the 500s. They will stand until 2001.' },
  { city:'kabul', type:'citadel', p:{hill:7, r:9}, name:'Bala Hisar', blurb:'Kabul\'s ancient fortress on the hill.' },
  { city:'badakhshan', type:'citadel', p:{hill:5, r:8}, name:'Fort of Badakhshan', blurb:'Polo said its horses descended from Alexander\'s steed Bucephalus.' },
  { lon:73.4, lat:37.2, type:'cairn', p:{horns:true}, name:'The Pamir: Roof of the World', blurb:'Polo wrote of wild sheep with horns six palms long and noted that fire burns less hot this high. The great sheep are now named Ovis ammon polii.' },
  { city:'tashkurgan', type:'citadel', p:{hill:5, r:9, ruin:true}, name:'Stone City', blurb:'An ancient fortress of the kingdom of Sarikol.' },
  { lon:76.25, lat:39.62, type:'stupa', p:{style:'ruin'}, name:'Mor Stupa', blurb:'Ruins of a Buddhist stupa from Kashgar\'s Buddhist age, before the Karakhanids converted to Islam.' },
  { city:'kashgar', type:'mosque', p:{dome:3.5, minarets:2, domeColor:'turq'}, name:'Friday Mosque of Kashgar', blurb:'Kashgar is a centre of Islamic learning under the Karakhanid and Chagatai rulers.' },
  { city:'khotan', type:'stupa', p:{style:'ruin', big:true}, name:'Rawak Stupa', blurb:'A great Buddhist stupa half-buried in the desert sand.' },
  { city:'osh', type:'mountainRock', name:'Sulaiman-Too', blurb:'A sacred rock above the town, where pilgrims have prayed for centuries.' },
  { city:'otrar', type:'ruins', name:'Ruins of Otrar', blurb:'The city fell after a five-month siege in 1219.' },
  { city:'taraz', type:'mausoleum', p:{color:'terracotta', dome:'brick'}, name:'Aisha Bibi Mausoleum', blurb:'A tomb from the 11th–12th century, covered in carved terracotta tiles.' },
  { city:'balasagun', type:'minaret', p:{h:13, r:2.2, color:'brick', truncated:true}, name:'Burana Tower', blurb:'An 11th-century Karakhanid minaret, already shortened by earthquakes.' },
  { city:'almaliq', type:'yurtPalace', p:{gold:false}, name:'Court of the Chagatai Khans', blurb:'The khans prefer their tents to the town\'s houses.' },
  { city:'sarai', type:'yurtPalace', p:{gold:true}, name:'Golden Palace of the Horde', blurb:'The khan\'s pavilion is crowned with gold, giving the "Golden Horde" its name.' },
  { city:'saraichik', type:'kumbet', p:{color:'brick', roof:'brick'}, name:'Tombs of the Khans', blurb:'Golden Horde rulers will be buried here.' },
  { lon:82.5, lat:41.78, type:'caves', p:{w:30, h:12, rows:2, cols:9}, name:'Kizil Caves', blurb:'Hundreds of Buddhist cave-temples painted with lapis-blue murals from the 200s onward.' },
  { lon:86.1, lat:41.9, type:'gate', name:'Iron Gate Pass of Korla', blurb:'A fortified gorge on the road between Korla and Turpan.' },
  { lon:89.7, lat:42.95, type:'caves', p:{w:26, h:10, rows:1, cols:8, red:true}, name:'Bezeklik Caves & the Flaming Mountains', blurb:'Uyghur Buddhist cave-temples in red sandstone hills that shimmer like fire in the heat.' },
  { city:'qocho', type:'ruins', p:{mud:true}, name:'Walls of Gaochang', blurb:'Mud-brick walls of a city that has stood since the Han dynasty.' },
  { city:'qocho', type:'stupa', p:{style:'ruin'}, name:'Great Stupa of Gaochang', blurb:'The Chinese monk Xuanzang preached here in 630.' },
  { city:'beshbalik', type:'stupa', p:{style:'ruin'}, name:'Buddhist Temple of Beshbalik', blurb:'The Uyghur nobility are mostly Buddhist.' },
  { lon:93.86, lat:40.35, type:'beacon', p:{gate:true}, name:'Jade Gate Pass (Yumen)', blurb:'The Han dynasty\'s gateway to the Western Regions, through which jade came from Khotan.' },
  { lon:94.05, lat:39.93, type:'beacon', p:{gate:true}, name:'Yang Pass', blurb:'"West of the Yang Pass there are no old friends," wrote the Tang poet Wang Wei.' },
  { lon:94.85, lat:40.04, type:'caves', p:{w:40, h:13, rows:3, cols:12}, name:'Mogao Caves', blurb:'Nearly 500 cave-temples carved over a thousand years and painted with Buddhist murals.' },
  { city:'dunhuang', type:'lake', p:{r:5, crescent:true}, name:'Crescent Moon Spring', blurb:'A crescent-shaped spring among the Singing Sand Dunes.' },
  { city:'jiuquan', type:'pagoda', p:{tiers:5, sides:4, color:'brick', w:4.5}, name:'Jiuquan Pagoda', blurb:'The "Wine Spring" city, named for a spring into which a Han general poured the emperor\'s wine.' },
  { city:'zhangye', type:'hall', p:{w:20, d:12, color:'red', roof:'gray', double:true}, name:'Great Buddha Temple', blurb:'Built in 1098 by the Western Xia; inside lies a reclining Buddha 35 metres long, which Polo described.' },
  { city:'wuwei', type:'pagoda', p:{tiers:9, sides:8, color:'brick', w:3.5}, name:'Luoshi Pagoda', blurb:'Said to hold the tongue of the great translator Kumarajiva.' },
  { city:'lanzhou', type:'stupa', p:{style:'tibetan'}, name:'White Pagoda', blurb:'A Tibetan-style stupa on the hill above the Yellow River.' },
  { lon:105.95, lat:38.4, type:'tombs', name:'Western Xia Tombs', blurb:'Beehive-shaped tombs of the Tangut emperors at the foot of the Helan Mountains.' },
  { city:'xingqing', type:'pagoda', p:{tiers:11, sides:8, color:'white', w:3.5}, name:'Haibao Pagoda', blurb:'An ancient pagoda of the Western Xia capital.' },
  { lon:113.1, lat:40.1, type:'caves', p:{w:40, h:16, rows:2, cols:10, buddha:'seated'}, name:'Yungang Grottoes', blurb:'Over 50,000 Buddhist statues carved by the Northern Wei in the 400s. The tallest is 17 metres.' },
  { city:'datong', type:'hall', p:{w:18, d:11, color:'red', roof:'gray'}, name:'Huayan Monastery', blurb:'A Liao-dynasty temple, one of the largest Buddhist halls in China.' },
  { city:'shangdu', type:'palace', p:{cane:true}, name:'Palace of Xanadu', blurb:'Kublai\'s marble palace. In the park stands a portable "cane palace" of gilded bamboo, held up by 200 silk cords.' },
  { city:'khanbaliq', type:'palace', p:{}, name:'Palace of Kublai Khan', blurb:'Polo wrote that its hall could seat 6,000 for dinner and that its roof shone with every colour.' },
  { city:'khanbaliq', type:'stupa', p:{style:'tibetan', big:true}, name:'White Stupa (Miaoying Temple)', blurb:'Under construction since 1271 by the Nepalese architect Araniko; it will be finished in 1279.' },
  { city:'zhending', type:'pavilion', p:{levels:3, w:12}, name:'Longxing Monastery', blurb:'Its Hall of Great Mercy houses a 21-metre bronze Guanyin cast in 971.' },
  { city:'kaifeng', type:'pagoda', p:{tiers:13, sides:8, color:'iron', w:3.6}, name:'Iron Pagoda', blurb:'Built in 1049 of rust-coloured glazed brick that looks like iron.' },
  { lon:112.47, lat:34.56, type:'caves', p:{w:36, h:16, rows:3, cols:10, buddha:'seated'}, name:'Longmen Grottoes', blurb:'Cliffs on the Yi river carved with tens of thousands of Buddhas. Empress Wu sponsored the giant Vairocana (676).' },
  { city:'luoyang', type:'pagoda', p:{tiers:7, sides:4, color:'brick', w:4}, name:'White Horse Temple', blurb:'Traditionally the first Buddhist temple in China, founded in 68 AD.' },
  { city:'jingzhao', type:'pagoda', p:{tiers:7, sides:4, color:'brick', w:7, big:true}, name:'Big Wild Goose Pagoda', blurb:'Built in 652 to hold the sutras that the monk Xuanzang brought back from India.' },
  { lon:105.55, lat:32.2, type:'gate', p:{chinese:true}, name:'Jianmen Pass', blurb:'"Sword Gate", the narrowest pass on the plank roads into Sichuan.' },
  { city:'chengdu', type:'hall', p:{w:16, d:10, color:'red', roof:'gray'}, name:'Temple of Marquis Wu', blurb:'A shrine to Zhuge Liang, the strategist of the Three Kingdoms.' },
  { city:'xiangyang', type:'siege', name:'Mongol Siege Lines', blurb:'Counterweight trebuchets designed by the Persian engineers Ismail and Ala al-Din. Polo would later falsely claim to have built them.' },
  { city:'ezhou', type:'pavilion', p:{levels:3, w:9, yellow:true}, name:'Yellow Crane Tower', blurb:'A legendary tower on Snake Hill above the Yangtze.' },
  { city:'yangzhou', type:'pagoda', p:{tiers:5, sides:8, color:'white', w:3.5}, name:'Pagoda of Yangzhou', blurb:'Yangzhou lies where the Grand Canal meets the Yangtze.' },
  { city:'quinsai', type:'lake', p:{r:14}, name:'West Lake', blurb:'Pleasure boats drift among willows, pavilions and causeways.' },
  { city:'quinsai', type:'pagoda', p:{tiers:5, sides:8, color:'brick', w:5}, name:'Leifeng Pagoda', blurb:'Built in 975 on the shore of West Lake.' },
  { city:'quinsai', type:'pagoda', p:{tiers:7, sides:8, color:'wood', w:6, big:true}, name:'Liuhe Pagoda', blurb:'The "Six Harmonies" pagoda (970, rebuilt 1165) stands by the Qiantang river to calm its tidal bore.' },
  { city:'quinsai', type:'hall', p:{w:18, d:11, color:'red', roof:'gray', double:true}, name:'Song Imperial Palace', blurb:'Palace of the boy-emperor Duzong\'s court, on Phoenix Hill.' },
  { city:'fuzhou', type:'pagoda', p:{tiers:7, sides:8, color:'white', w:3.5}, name:'White Pagoda of Fuzhou', blurb:'A pagoda first built in 904.' },
  { city:'zaitun', type:'pagoda', p:{tiers:5, sides:8, color:'stone', w:4.5, twin:true}, name:'Twin Pagodas of Kaiyuan Temple', blurb:'Stone pagodas finished in 1237 and 1250, among the tallest stone pagodas in China.' },
  { city:'zaitun', type:'harbor', p:{ship:'junk'}, name:'Port of Zaitun', blurb:'Ibn Battuta would later count a hundred great junks here.' },
  { city:'ngari', type:'stupa', p:{style:'tibetan'}, name:'Chorten of Rutog', blurb:'Ancient rock carvings line the cliffs nearby.' },
  { lon:81.6, lat:30.9, type:'cairn', p:{flags:true}, name:'Mount Kailash & Lake Manasarovar', blurb:'A peak sacred to Buddhists, Hindus, Jains and Bön followers. Pilgrims walk around it.' },
  { city:'sakya', type:'sakya', name:'Sakya Monastery', blurb:'Founded in 1073; its grey walls bear red and white stripes. It is the seat of Tibet\'s rulers under the Yuan.' },
  { city:'lhasa', type:'jokhang', name:'Jokhang Temple', blurb:'Tibet\'s holiest temple, founded in the 600s by King Songtsen Gampo.' },
  { lon:91.9, lat:32.9, type:'cairn', p:{flags:true}, name:'Tanggula Pass', blurb:'A high pass on the road from Lhasa to the north, marked with prayer flags and mani stones.' },
  { lon:99.6, lat:36.45, type:'cairn', p:{flags:true}, name:'Kokonor', blurb:'The great blue salt lake of the Tibetan plateau.' },
];

// Bridges at named river crossings
const NAMED_BRIDGES = [
  { river:'Yongding', edge:['khanbaliq','zhending'], name:'Lugou Bridge (Marco Polo Bridge)', style:'lugou',
    blurb:'Built 1189–1192, with hundreds of carved stone lions. Polo praised it as a bridge with "very few equals in the world".' },
];

// City size tier, by estimated population around 1272 (5 = among the largest cities on earth)
const CITY_TIER = {
  quinsai: 5, khanbaliq: 5,
  constantinople: 4, tabriz: 4, zaitun: 4, yangzhou: 4,
  damascus: 3, aleppo: 3, baghdad: 3, sarai: 3, samarkand: 3, bukhara: 3, jingzhao: 3, kaifeng: 3, fuzhou: 3, ezhou: 3, iconium: 3, isfahan: 3, chengdu: 3,
  mosul: 2, sivas: 2, trebizond: 2, kashgar: 2, tiflis: 2, hamadan: 2, kerman: 2, yazd: 2, merv: 2, nishapur: 2, balkh: 2, khotan: 2, zhangye: 2, lanzhou: 2,
  datong: 2, luoyang: 2, shangdu: 2, almaliq: 2, lhasa: 2, xiangyang: 2, caesarea: 2, ancyra: 2, herat: 2, urgench: 2, tashkent: 2, khujand: 2, kabul: 2,
  hormuz: 2, caffa: 2, ayas: 2, wuwei: 2, xingqing: 2, zhending: 2, qocho: 2,
};

// Where people lived densely in 1272: [lon, lat, sigma(deg), density, nomad?]
const VILLAGE_DENSITY = [
  [28,40.3,1.4,.65],[30,38.6,1.4,.45],[33,38,1.3,.35],[36,39.2,1.4,.3],[38.5,39.8,1.1,.3],[37,41,1.1,.4],[43.6,40.4,.9,.4],[44.6,41.8,.9,.55],[48.5,40.6,.9,.35],
  [36.6,34.5,1.3,.6],[37.1,36.3,.9,.6],[39.5,36.8,1.3,.35],[43.1,36.3,.7,.45],[44.3,33.2,1.1,.5],[46.3,38.0,1.1,.6],[48.5,34.8,.9,.45],[50.4,36.1,1.1,.4],
  [51.7,32.6,.9,.5],[54.4,31.9,.6,.3],[57.1,30.3,.6,.3],[58.8,36.2,1.1,.45],[62.2,34.4,.7,.45],[61.8,37.6,.5,.35],[65.7,39.7,1.2,.8],[71.5,40.6,1.1,.75],
  [69.3,41.3,.7,.55],[59.4,42.1,.7,.55],[66.9,36.8,.6,.45],[69.2,34.5,.5,.35],[76,39.4,.5,.5],[77.2,38.4,.4,.45],[79.9,37.1,.4,.45],[80.3,41.2,.35,.35],
  [83,41.7,.35,.35],[89.5,42.9,.45,.4],[93.5,42.8,.3,.3],[94.7,40.1,.35,.35],[98.5,39.7,.35,.35],[100.4,38.9,.4,.45],[102.6,37.9,.4,.45],[103.8,36.1,.45,.45],
  [101.8,36.6,.35,.3],[106.3,38.5,.6,.45],[108.6,34.4,1.2,.8],[113.4,34.7,1.4,.85],[115.5,37.5,1.8,.8],[116.4,39.8,.9,.75],[113.3,40.1,.7,.45],
  [104.3,30.6,1.2,.8],[112,32,1.1,.6],[114.3,30.4,1.4,.8],[119.8,31,1.4,1.0],[119.2,32.8,1.1,.85],[120,29.5,1.1,.75],[119,25.5,.9,.7],[117,29.7,1.2,.7],
  [91.1,29.65,.45,.25],[88.9,29.27,.35,.2],
  [47.5,46.9,1.5,.35,1],[51.5,47.5,1.3,.25,1],[80,44,1.4,.3,1],[75,43,1.3,.25,1],[116,42.3,1,.35,1],[62,47,3,.12,1],[110,41.3,1.5,.2,1],[71.5,43.2,1.2,.25,1],
];

// Extra historically grounded city buildings (v3)
LANDMARKS.push(
  { city:'constantinople', type:'aqueduct', name:'Aqueduct of Valens', blurb:'A Roman aqueduct finished in 378, still carrying water to the city in 1272.' },
  { city:'constantinople', type:'column', p:{ h:24, color:'porphyry' }, name:'Column of Constantine', blurb:'A column of purple porphyry raised in 330 when Constantine founded his new capital.' },
  { city:'constantinople', type:'church', p:{ style:'byz', big:true }, name:'Hagia Irene', blurb:'The "Church of Holy Peace", rebuilt by Justinian, beside Hagia Sophia.' },
  { city:'constantinople', type:'citadel', p:{ hill:3, r:12 }, name:'Blachernae Palace', blurb:'The emperors\' residence by the land walls, home of Michael VIII Palaiologos.' },
  { city:'constantinople', type:'harbor', p:{ ship:'galley' }, name:'The Golden Horn', blurb:'Venetian and Genoese galleys crowd the harbour. In 1267 the Genoese were granted the suburb of Galata across the water.' },
  { city:'iconium', type:'madrasa', p:{ tile:'turq' }, name:'Karatay Madrasa', blurb:'Built in 1251, famous for its dome of turquoise and black tile mosaic.' },
  { city:'sivas', type:'madrasa', p:{ tile:'brick' }, name:'Çifte Minareli Medrese', blurb:'The "Twin-Minaret Madrasa", also finished in 1271.' },
  { city:'bukhara', type:'citadel', p:{ hill:7, r:14 }, name:'The Ark of Bukhara', blurb:'The massive mud-brick fortress of Bukhara\'s rulers, inhabited since the 5th century.' },
  { city:'aleppo', type:'minaret', p:{ h:26, r:2.2, color:'stone', square:true }, name:'Minaret of the Great Mosque', blurb:'A square Seljuk minaret of 1090, carved in bands of inscriptions.' },
  { city:'damascus', type:'citadel', p:{ hill:2, r:12 }, name:'Citadel of Damascus', blurb:'Rebuilt by the Ayyubids; Baybars is restoring it after the Mongol occupation of 1260.' },
  { city:'jingzhao', type:'pagoda', p:{ tiers:13, sides:4, color:'brick', w:4.5 }, name:'Small Wild Goose Pagoda', blurb:'A 15-storey brick pagoda of 707, cracked but standing after many earthquakes.' },
  { city:'kaifeng', type:'pagoda', p:{ tiers:6, sides:6, color:'brick', w:5 }, name:'Po Pagoda', blurb:'A hexagonal pagoda of 974, covered with tiles bearing images of the Buddha.' },
  { city:'khanbaliq', type:'pavilion', p:{ levels:2, w:16 }, name:'Drum Tower of Dadu', blurb:'Built in 1272 at the centre of Kublai\'s new city to beat out the hours.' },
  { city:'khanbaliq', type:'scaffold', name:'Walls under Construction', blurb:'Dadu\'s rammed-earth walls, 17 miles round, are still being raised in 1272.' },
  { city:'zaitun', type:'mosque', p:{ dome:0, minarets:0, style:'qingjing' }, name:'Qingjing Mosque', blurb:'Founded in 1009 by Arab merchants, built of granite in the style of their homeland.' },
  { city:'quinsai', type:'canalbridge', name:'Canals of Quinsai', blurb:'Polo claimed the city had 12,000 bridges over its canals.' },
  { city:'lhasa', type:'jokhang', name:'Ramoche Temple', blurb:'Founded in the 600s by the Chinese princess Wencheng.' },
  { city:'tabriz', type:'bazaar', name:'Bazaar of Tabriz', blurb:'One of the greatest covered markets on the Silk Road, trading silk, pearls and Indian spices.' },
  { city:'isfahan', type:'bazaar', name:'Great Bazaar of Isfahan', blurb:'Vaulted brick arcades running from the Friday Mosque.' },
  { city:'samarkand', type:'bazaar', name:'Samarkand Bazaar', blurb:'Samarkand paper, a technique learned from Chinese prisoners in 751, is sold here.' },
  { city:'yangzhou', type:'canalbridge', name:'Grand Canal at Yangzhou', blurb:'Grain barges move along the canal between the Yangtze and the Huai.' },
  { city:'sarai', type:'mosque', p:{ dome:4, minarets:1, domeColor:'turq' }, name:'Friday Mosque of Sarai', blurb:'Berke Khan, Batu\'s brother, converted to Islam and built mosques in Sarai.' },
);

// ============================================================
//  BUILD 2 — Egypt & the Levant, Arabia, India, Indochina & Yunnan (1272)
//  Overland routes only. Appended to the arrays in data.js.
// ============================================================
(function () {
  const C = (id, name, modern, polity, lon, lat, tier, culture, blurb, extra) => Object.assign({ id, name, modern, polity, lon, lat, size: tier >= 4 ? 3 : tier >= 2 ? 2 : 1, culture, blurb, tierS: tier }, extra || {});
  const add = [
    // --- Egypt & the Levant ---
    C('cairo', 'Cairo (al-Qāhira)', 'Cairo, Egypt', 'Mamluk Sultanate — capital', 31.25, 30.05, 5, 'arab',
      'Seat of Sultan Baybars and of the puppet Abbasid caliphs he rescued after Baghdad fell. With Fustat, perhaps the largest city west of China.'),
    C('alexandria', 'Alexandria', 'Alexandria, Egypt', 'Mamluk Sultanate', 29.92, 31.20, 3, 'arab',
      'Venetian, Genoese and Catalan merchants keep fondaci here to buy Indian pepper. The ancient Pharos lighthouse still stands, though damaged.'),
    C('qus', 'Qūṣ', 'Qus, Egypt', 'Mamluk Sultanate', 32.76, 25.91, 2, 'arab',
      'Upper Egypt\'s great entrepôt. Karimi spice caravans leave for the Red Sea port of Aydhab here, and so do pilgrims bound for Mecca.'),
    C('aswan', 'Aswan', 'Aswan, Egypt', 'Mamluk Sultanate (Nubian frontier)', 32.90, 24.09, 1, 'arab',
      'The First Cataract and the frontier with Christian Makuria. Baybars is preparing a campaign south into Nubia (1276).'),
    C('gaza', 'Gaza', 'Gaza', 'Mamluk Sultanate', 34.46, 31.50, 2, 'arab',
      'The last town before the Sinai crossing on the Way of the Sea, the post road that Baybars\' barid couriers ride between Cairo and Damascus.'),
    C('jerusalem', 'Jerusalem (al-Quds)', 'Jerusalem', 'Mamluk Sultanate', 35.23, 31.78, 2, 'arab',
      'Under Mamluk rule. Pilgrims of three faiths still come. In 1271 the Polos came here to fetch oil from the lamp of the Holy Sepulchre for Kublai Khan.'),
    C('acre', 'Acre (Saint-Jean d\'Acre)', 'Akko, Israel', 'Kingdom of Jerusalem (Crusader)', 35.07, 32.93, 3, 'byz',
      'Capital of what is left of the Crusader kingdom. Venetian, Genoese and Pisan quarters crowd inside its double walls. The Polos set out from here in 1271.'),
    C('karak', 'Karak', 'Al-Karak, Jordan', 'Mamluk Sultanate', 35.70, 31.18, 1, 'arab',
      'A huge Crusader castle on a ridge over the Dead Sea, taken by Baybars in 1263. It guards the King\'s Highway.'),
    C('ayla', 'Ayla (Aqaba)', 'Aqaba, Jordan', 'Mamluk Sultanate', 35.00, 29.53, 1, 'arab',
      'A small fort at the head of the gulf where the Egyptian Hajj road meets the King\'s Highway.'),
    // --- Arabia ---
    C('tabuk', 'Tabūk', 'Tabuk, Saudi Arabia', 'Bedouin tribes', 36.57, 28.38, 1, 'arab',
      'A well and a small fort on the Syrian Hajj road. The Prophet led an expedition here in 630.'),
    C('ula', 'al-ʿUlā', 'AlUla, Saudi Arabia', 'Bedouin tribes', 37.92, 26.62, 1, 'arab',
      'A walled oasis town of mud-brick houses. Beside it are the tombs of Hegra, cut into the rock by the Nabataeans 1,200 years ago.'),
    C('khaybar', 'Khaybar', 'Khaybar, Saudi Arabia', 'Bedouin tribes', 39.29, 25.70, 1, 'arab',
      'An oasis of date palms in a field of black lava, famous since the Prophet\'s time.'),
    C('medina', 'Medina (al-Madīna)', 'Medina, Saudi Arabia', 'Hejaz — Emirate of Medina', 39.61, 24.47, 2, 'arab',
      'The City of the Prophet. In 1272 his tomb has no dome yet; Sultan Qalawun will build the first one in 1279. Only Muslims may enter.', { holy: true }),
    C('mecca', 'Mecca (Makka)', 'Mecca, Saudi Arabia', 'Hejaz — Sharifate of Mecca', 39.83, 21.42, 2, 'arab',
      'The holiest city of Islam, ruled by Sharif Abu Numayy I. Hajj caravans from Cairo, Damascus and Baghdad meet here. Only Muslims may enter.', { holy: true }),
    C('taif', 'aṭ-Ṭāʾif', 'Taif, Saudi Arabia', 'Hejaz — Sharifate of Mecca', 40.55, 21.27, 1, 'arab',
      'A cool mountain town of roses, raisins and pomegranates, where the people of Mecca spend the summer.'),
    C('faid', 'Fayd', 'Fayd, Saudi Arabia', 'Bedouin tribes', 41.43, 27.12, 1, 'arab',
      'A fortified halt halfway along the Darb Zubayda, the pilgrim road from Iraq, with cisterns built by Queen Zubayda in the 800s.'),
    C('najran', 'Najrān', 'Najran, Saudi Arabia', 'Bedouin tribes', 44.13, 17.49, 1, 'yemen',
      'An old oasis on the incense road. It had a Christian community until the 600s.'),
    C('sanaa', 'Ṣanʿāʾ', 'Sanaa, Yemen', 'Rasulid Sultanate', 44.21, 15.35, 2, 'yemen',
      'An ancient highland city of tall tower houses with white-painted windows, under the Rasulid sultan al-Muzaffar Yusuf.'),
    C('taizz', 'Taʿizz', 'Taiz, Yemen', 'Rasulid Sultanate — capital', 44.02, 13.58, 2, 'yemen',
      'The Rasulid capital under Mount Sabir. Sultan al-Muzaffar Yusuf (ruled 1249–1295) was a scholar and astronomer, and Yemen grew rich on the Indian trade.'),
    C('aden', 'Aden', 'Aden, Yemen', 'Rasulid Sultanate', 45.03, 12.79, 3, 'yemen',
      'A port in an extinct volcanic crater. Polo said its sultan grew rich on tolls from the ships between India and Egypt.'),
    C('shibam', 'Shibām', 'Shibam, Yemen', 'Hadramawt (local sultans)', 48.63, 15.93, 1, 'yemen',
      'The "Manhattan of the desert": a walled town of mud-brick tower houses up to eight storeys high, in the Wadi Hadramawt.'),
    C('shihr', 'ash-Shiḥr', 'Ash Shihr, Yemen', 'Hadramawt (local sultans)', 49.60, 14.76, 1, 'yemen',
      'A Hadrami port shipping frankincense and Arabian horses to India.'),
    C('zafar', 'Ẓafār (Dhofar)', 'Salalah, Oman', 'Dhofar (Manjawi rulers)', 54.08, 17.00, 2, 'yemen',
      'The frankincense coast. The trees grow on the hills behind the town. Polo described Zafar\'s white incense and its horses.'),
    // --- Persia to India ---
    C('zaranj', 'Zaranj (Sistan)', 'Zaranj, Afghanistan', 'Ilkhanate (Sistan maliks)', 61.86, 30.96, 1, 'persian',
      'The capital of Sistan, a land of windmills and canals fed by the Helmand River, ruled by Mihrabanid maliks who submit to the Mongols.'),
    C('kandahar', 'Qandahār', 'Kandahar, Afghanistan', 'Ilkhanate (Kart maliks)', 65.71, 31.61, 2, 'persian',
      'A frontier fortress between Persia and India. The Mongols and the Delhi sultans fight over the lands to the east.'),
    C('multan', 'Multān', 'Multan, Pakistan', 'Delhi Sultanate (Mongol frontier)', 71.47, 30.20, 2, 'indian',
      'A Sufi city of shrines, held for Delhi against yearly Mongol raids. Sheikh Bahauddin Zakariya, who died in 1262, taught here.'),
    C('lahore', 'Lahore', 'Lahore, Pakistan', 'Delhi Sultanate (Mongol frontier)', 74.34, 31.55, 2, 'indian',
      'The Mongols sacked it in 1241. Sultan Balban rebuilt its walls and fort in 1270.'),
    C('delhi', 'Delhi (Dihlī)', 'Delhi, India', 'Delhi Sultanate — capital', 77.21, 28.52, 4, 'indian',
      'Capital of Sultan Ghiyas ud-din Balban, a former slave who rules with an iron hand. Refugees from the Mongol conquests, among them poets, scholars and princes, fill the city.'),
    C('ajmer', 'Ajmer', 'Ajmer, India', 'Delhi Sultanate', 74.64, 26.45, 1, 'indian',
      'The old Chauhan capital. It has the shrine of the Sufi saint Moinuddin Chishti, who died in 1236.'),
    C('chittor', 'Chittor (Chitrakūṭa)', 'Chittorgarh, India', 'Mewar (Guhila Rajputs)', 74.65, 24.88, 2, 'indian',
      'A vast Rajput fort on a mesa, the seat of the Guhila ranas of Mewar.'),
    C('anhilwara', 'Anhilwāra (Paṭṭan)', 'Patan, Gujarat, India', 'Vaghela Gujarat — capital', 72.12, 23.85, 3, 'indian',
      'Capital of the Vaghela kings of Gujarat, a city of Jain merchants, carved temples and stepwells.'),
    C('cambay', 'Cambay (Khambhāt)', 'Khambhat, India', 'Vaghela Gujarat', 72.62, 22.31, 3, 'indian',
      'India\'s great cloth and indigo port. Arab, Persian and Jewish merchants live here alongside Hindu and Jain traders. Polo praised its leather and cotton.'),
    C('thana', 'Thāna', 'Thane, India', 'Yadava kingdom', 72.97, 19.20, 1, 'indian',
      'A Konkan port where incense, cotton and teak are traded. Polo said pirates from here raided shipping.'),
    C('devagiri', 'Devagiri', 'Daulatabad, India', 'Yadava kingdom — capital', 75.21, 19.94, 3, 'indian',
      'Capital of the rich Yadava king Ramachandra (ruled 1271–1311). A fortress carved out of a conical hill.'),
    C('pandharpur', 'Paṇḍharpur', 'Pandharpur, India', 'Yadava kingdom', 75.33, 17.68, 1, 'indian',
      'A pilgrimage town on the Bhima River, sacred to the god Vithoba. The poet-saints of the Varkari movement are about to make it famous.'),
    C('dvarasamudra', 'Dvārasamudra', 'Halebidu, India', 'Hoysala kingdom — capital', 75.99, 13.21, 2, 'indian',
      'The Hoysala capital, beside a great reservoir, with temples carved from soft soapstone.'),
    C('kanchipuram', 'Kāñchīpuram', 'Kanchipuram, India', 'Pandya Kingdom', 79.60, 12.83, 2, 'indian',
      'The "city of a thousand temples", a centre of Sanskrit learning and silk weaving. The Pandyas took it in 1258.'),
    C('mylapore', 'Mylapore', 'Chennai, India', 'Pandya Kingdom', 80.27, 13.03, 1, 'indian',
      'A small coastal town with the shrine of St Thomas the Apostle, visited by Christians, Muslims and Hindus alike. Polo describes it.'),
    C('thanjavur', 'Thanjāvūr', 'Thanjavur, India', 'Chola (Pandya vassal)', 79.13, 10.79, 2, 'indian',
      'Old capital of the Cholas, now vassals of the Pandyas. The great Brihadisvara temple of 1010 towers over the Kaveri delta.'),
    C('madurai', 'Madurai', 'Madurai, India', 'Pandya Kingdom — capital', 78.12, 9.92, 3, 'indian',
      'Capital of Maravarman Kulasekara Pandya, then the most powerful king in the south. The city is laid out in concentric squares around the temple of Meenakshi.'),
    C('kayal', 'Kāyal', 'Kayalpatnam, India', 'Pandya Kingdom', 78.12, 8.57, 1, 'indian',
      'Polo\'s "Cail", the Pandya pearl and horse port, where Arabian horses are landed for the king.'),
    C('mathura', 'Mathurā', 'Mathura, India', 'Delhi Sultanate', 77.67, 27.49, 1, 'indian',
      'An ancient city on the Yamuna, the legendary birthplace of Krishna.'),
    C('kanauj', 'Kanauj', 'Kannauj, India', 'Delhi Sultanate', 79.92, 27.05, 2, 'indian',
      'Once the imperial capital of northern India, now a Sultanate garrison town famous for its perfumes.'),
    C('varanasi', 'Vārāṇasī (Benares)', 'Varanasi, India', 'Delhi Sultanate', 83.00, 25.32, 3, 'indian',
      'The holiest Hindu city, with stepped ghats down to the Ganges. The Buddha preached his first sermon at nearby Sarnath.'),
    C('bihar', 'Bihār', 'Bihar Sharif, India', 'Delhi Sultanate', 85.52, 25.20, 1, 'indian',
      'A garrison town named after the Buddhist monasteries (vihāras) that once filled the area. The great university of Nalanda nearby has lain in ruins since about 1200.'),
    C('lakhnauti', 'Lakhnautī (Gaur)', 'Gaur, West Bengal, India', 'Bengal (Delhi governor)', 88.13, 24.87, 3, 'indian',
      'Capital of Muslim Bengal, ruled by governors who keep rebelling against Delhi. Tughral Tughan Khan will declare himself sultan in 1275.'),
    C('sonargaon', 'Sonārgāon', 'Sonargaon, Bangladesh', 'Deva kingdom of Bengal', 90.60, 23.65, 1, 'indian',
      'An eastern Bengal town famous for muslin so fine that a whole length could pass through a ring.'),
    C('chittagong', 'Chittagong', 'Chattogram, Bangladesh', 'Deva kingdom of Bengal', 91.83, 22.33, 1, 'indian',
      'A port at the edge of the Arakan hills, between the Bengali and Burmese worlds.'),
    C('kathmandu', 'Kāntipur (Kathmandu)', 'Kathmandu, Nepal', 'Nepal (Malla)', 85.31, 27.70, 2, 'indian',
      'A valley of pagoda temples and stupas. In 1260 the young Nepali artist Arniko went from here to Kublai\'s court, where he would design Khanbaliq\'s White Stupa.'),
    // --- Yunnan & Indochina ---
    C('jianchang', 'Jianchang (Caindu)', 'Xichang, Sichuan, China', 'Yuan Dynasty (Yunnan)', 102.26, 27.89, 1, 'chinese',
      'Polo\'s "Caindu", a land of salt money, turquoise and cinnamon by Lake Qionghai.'),
    C('yachi', 'Yachi (Kunming)', 'Kunming, Yunnan, China', 'Yuan Dynasty (Yunnan)', 102.71, 25.04, 2, 'chinese',
      'Polo\'s "Yachi", where cowrie shells are used as money. The Muslim governor Sayyid Ajall will make it Yunnan\'s capital in 1274.'),
    C('dali', 'Dali', 'Dali, Yunnan, China', 'Yuan Dynasty (Yunnan)', 100.16, 25.69, 2, 'chinese',
      'Capital of the Dali kingdom until Kublai himself conquered it in 1253. It lies between Erhai Lake and the Cang Mountains.'),
    C('yongchang', 'Yongchang (Vochan)', 'Baoshan, Yunnan, China', 'Yuan Dynasty (Yunnan)', 99.17, 25.12, 1, 'chinese',
      'Polo\'s "Vochan", a frontier town of gold-toothed people. In 1277 the Mongols will defeat Burmese war elephants here.'),
    C('bhamo', 'Kaungsin (Bhamo)', 'Bhamo, Myanmar', 'Pagan Kingdom', 97.24, 24.27, 1, 'sea',
      'A Burmese fort on the upper Irrawaddy guarding the road from Yunnan. The Mongols will storm it in 1283.'),
    C('pagan', 'Pagan (Bagan)', 'Bagan, Myanmar', 'Pagan Kingdom — capital', 94.86, 21.17, 4, 'sea',
      'Capital of King Narathihapate, on a plain of thousands of brick temples. Kublai\'s envoys came here in 1271 to demand tribute. Polo calls it "Mien".'),
    C('pegu', 'Pegu (Hanthawaddy)', 'Bago, Myanmar', 'Pagan Kingdom', 96.48, 17.34, 2, 'sea',
      'A Mon city under Pagan rule, with the great Shwemawdaw stupa.'),
    C('martaban', 'Martaban', 'Mottama, Myanmar', 'Pagan Kingdom', 97.63, 16.53, 1, 'sea',
      'A Mon port at the mouth of the Salween, famous for its huge glazed storage jars.'),
    C('sukhothai', 'Sukhothai', 'Sukhothai, Thailand', 'Sukhothai Kingdom', 99.70, 17.02, 2, 'sea',
      'A young Tai kingdom that threw off Khmer rule around 1240. Its prince Ram Khamhaeng will create the Thai alphabet.'),
    C('lavo', 'Lavo (Lopburi)', 'Lopburi, Thailand', 'Lavo (Khmer vassal)', 100.61, 14.80, 2, 'sea',
      'An old Mon-Khmer city of laterite prangs, which sends its own embassies to China.'),
    C('angkor', 'Yaśodharapura (Angkor)', 'Siem Reap, Cambodia', 'Khmer Empire — capital', 103.87, 13.41, 4, 'sea',
      'The Khmer capital under Jayavarman VIII: Angkor Thom\'s walls and moats, the Bayon\'s stone faces and, to the south, Angkor Wat.'),
    C('vijaya', 'Vijaya (Chà Bàn)', 'Quy Nhon, Vietnam', 'Champa', 109.05, 13.90, 2, 'sea',
      'Capital of Champa, a Hindu kingdom of brick towers that trades in aloeswood, ivory and rhinoceros horn.'),
    C('tambralinga', 'Tambralinga (Nakhon)', 'Nakhon Si Thammarat, Thailand', 'Tambralinga', 99.96, 8.43, 2, 'sea',
      'Kingdom of Chandrabhanu, who raided Sri Lanka in 1247 and 1262. It is a centre of Theravada Buddhism with a great bell-shaped stupa.'),
    C('kedah', 'Kedah (Kadaram)', 'Lembah Bujang, Malaysia', 'Kedah (Srivijaya vassal)', 100.40, 5.68, 1, 'sea',
      'An ancient port of Hindu-Buddhist temples near Mount Jerai. Ships trade tin and jungle produce here for Indian cloth.'),
    C('thanglong', 'Thăng Long', 'Hanoi, Vietnam', 'Đại Việt (Trần)', 105.85, 21.03, 3, 'song',
      'Capital of Trần Đại Việt, which drove off a Mongol invasion in 1258 and will do so twice more. It has the One Pillar Pagoda and the Temple of Literature.'),
    // --- South China ---
    C('yongzhou', 'Yongzhou (Nanning)', 'Nanning, Guangxi, China', 'Southern Song', 108.32, 22.82, 1, 'song',
      'A Song frontier town that buys horses from the southwestern tribes.'),
    C('guangzhou', 'Guangzhou (Canton)', 'Guangzhou, Guangdong, China', 'Southern Song', 113.26, 23.13, 4, 'song',
      'A great southern port with a foreign quarter of Arab and Persian merchants, centred on the Huaisheng Mosque and its lighthouse minaret.'),
    C('tanzhou', 'Tanzhou (Changsha)', 'Changsha, Hunan, China', 'Southern Song', 112.94, 28.23, 3, 'song',
      'Capital of Hunan, home of the Yuelu Academy where Zhu Xi lectured. Rice and lacquer come down the Xiang River.'),
  ];
  for (const c of add) { CITY_TIER[c.id] = c.tierS; delete c.tierS; CITIES.push(c); }

  Object.assign(ROUTE_GROUPS, {
    nile:      { name:'Nile & Hajj Road',               color:'#c9a227' },
    incense:   { name:'Incense Road',                   color:'#b5651d' },
    india:     { name:'Grand Road of India',            color:'#3f7fbf' },
    yunnan:    { name:'Southwestern Silk Road',         color:'#7b5ea7' },
    indochina: { name:'Roads of the Irrawaddy & Mekong', color:'#2e9b5f' },
  });

  EDGES.push(
    // Egypt & Levant
    ['acre','damascus','nile',[[35.55,32.95],[35.95,33.15]]],
    ['acre','jerusalem','nile',[[35.1,32.5],[35.15,32.1]]],
    ['jerusalem','gaza','nile',[[34.95,31.65]]],
    ['gaza','cairo','nile',[[33.8,31.12],[32.6,31.0],[31.9,30.75],[31.56,30.42]]],
    ['cairo','alexandria','nile',[[31.13,29.99],[30.85,30.25],[30.5,30.6],[30.47,31.03],[30.1,31.15]]],
    ['cairo','qus','nile',[[31.5,29.6],[31.25,28.9],[31.15,28.2],[31.2,27.5],[31.6,27.0],[32.0,26.6],[32.35,26.35],[32.9,26.05]]],
    ['qus','aswan','nile',[[32.85,25.7],[32.72,25.45],[32.78,25.3],[32.98,25.05],[33.05,24.7],[33.0,24.3]]],
    ['cairo','ayla','nile',[[31.8,30.05],[32.4,30.05],[33.75,29.9],[34.6,29.7]]],
    ['damascus','karak','nile',[[36.1,32.6],[35.95,31.9]]],
    ['jerusalem','karak','nile',[[35.45,31.86],[35.75,31.62]]],
    ['karak','ayla','nile',[[35.6,30.65],[35.48,30.33],[35.3,30.0]]],
    // Arabia
    ['ayla','tabuk','incense',[[35.4,29.05],[36.1,28.6]]],
    ['tabuk','ula','incense',[[37.0,27.8],[37.6,27.05],[37.95,26.8]]],
    ['ula','khaybar','incense',[[38.4,26.25],[38.9,25.9]]],
    ['khaybar','medina','incense',[[39.45,25.05]]],
    ['khaybar','taif','incense',[[40.15,24.4],[40.55,23.1],[40.65,22.0]]],
    ['baghdad','faid','incense',[[44.35,32.0],[43.6,30.8],[42.9,29.45],[42.1,28.2]]],
    ['faid','taif','incense',[[41.6,25.8],[41.25,24.2],[40.95,22.4]]],
    ['taif','mecca','incense',[[40.2,21.36]]],
    ['taif','najran','incense',[[41.5,20.0],[42.6,18.65],[43.5,17.8]]],
    ['najran','sanaa','incense',[[43.9,16.9],[44.0,16.0]]],
    ['sanaa','taizz','incense',[[44.2,14.6],[44.1,14.0]]],
    ['taizz','aden','incense',[[44.45,13.2]]],
    ['aden','shihr','incense',[[46.2,13.45],[47.5,13.95],[48.7,14.25]]],
    ['sanaa','shibam','incense',[[45.0,15.4],[45.32,15.45],[46.5,15.25],[47.8,15.65]]],
    ['shibam','shihr','incense',[[49.0,15.35]]],
    ['shihr','zafar','incense',[[51.0,15.35],[52.3,16.05],[53.3,16.65]]],
    // Persia to India
    ['kerman','zaranj','india',[[58.36,29.1],[59.8,29.4],[60.9,30.45]]],
    ['zaranj','kandahar','india',[[62.7,31.05],[63.6,31.25],[64.36,31.55],[65.0,31.6]]],
    ['herat','kandahar','india',[[62.15,32.4],[63.3,32.25],[64.4,31.85]]],
    ['kandahar','multan','india',[[66.6,30.6],[67.0,30.2],[67.6,29.55],[68.0,29.45],[69.3,29.6],[70.6,30.05]]],
    ['kabul','lahore','india',[[70.45,34.43],[71.15,34.08],[71.57,34.01],[72.25,33.9],[72.85,33.73],[73.7,32.95],[74.07,32.5]]],
    ['lahore','multan','india',[[73.5,31.0],[72.4,30.5]]],
    ['lahore','delhi','india',[[75.0,31.05],[76.4,30.65],[76.97,29.39]]],
    ['delhi','ajmer','india',[[76.8,28.1],[75.8,27.2],[75.0,26.7]]],
    ['ajmer','chittor','india',[[74.6,25.6]]],
    ['chittor','anhilwara','india',[[73.7,24.6],[72.9,24.55],[72.5,24.2]]],
    ['anhilwara','cambay','india',[[72.4,23.3],[72.6,22.7]]],
    ['cambay','thana','india',[[72.95,22.2],[73.05,21.7],[72.95,20.6],[73.05,19.7]]],
    ['thana','devagiri','india',[[73.45,19.7],[73.55,20.2],[74.3,20.25],[74.9,20.1]]],
    ['devagiri','pandharpur','india',[[75.4,18.9],[75.3,18.2]]],
    ['pandharpur','dvarasamudra','india',[[75.7,16.8],[75.95,15.3],[76.1,14.2]]],
    ['dvarasamudra','kanchipuram','india',[[77.2,13.0],[78.2,12.85],[79.1,12.9]]],
    ['kanchipuram','mylapore','india',[[80.0,13.0]]],
    ['kanchipuram','thanjavur','india',[[79.6,12.1],[79.4,11.4]]],
    ['thanjavur','madurai','india',[[78.7,10.4]]],
    ['madurai','kayal','india',[[78.1,9.2]]],
    ['delhi','mathura','india',[[77.4,28.0]]],
    ['mathura','kanauj','india',[[78.4,27.2],[79.2,27.1]]],
    ['kanauj','varanasi','india',[[80.4,26.75],[81.2,26.3],[81.9,25.75],[82.5,25.5]]],
    ['varanasi','bihar','india',[[83.6,25.2],[84.4,24.85],[84.99,24.72],[85.3,24.95]]],
    ['bihar','lakhnauti','india',[[86.4,25.25],[87.3,25.2],[87.9,24.95]]],
    ['lakhnauti','sonargaon','india',[[88.8,24.5],[89.7,24.0],[90.3,23.75]]],
    ['sonargaon','chittagong','india',[[91.0,23.4],[91.4,22.9]]],
    ['bihar','kathmandu','india',[[85.3,26.1],[85.6,26.7],[85.1,27.3],[85.25,27.6]]],
    ['kathmandu','sakya','tibet',[[85.6,27.9],[86.0,28.25],[86.6,28.6],[87.6,28.8]]],
    ['chittagong','pagan','indochina',[[92.3,21.6],[93.3,20.8],[93.6,20.1],[94.4,19.9],[94.85,20.6]]],
    // Yunnan & Indochina
    ['chengdu','jianchang','yunnan',[[103.0,30.0],[102.6,29.4],[102.4,28.6]]],
    ['jianchang','yachi','yunnan',[[102.3,27.0],[102.5,26.2]]],
    ['yachi','dali','yunnan',[[101.55,25.04],[101.0,25.3],[100.5,25.6]]],
    ['dali','yongchang','yunnan',[[99.8,25.5],[99.4,25.3]]],
    ['yongchang','bhamo','yunnan',[[98.5,25.0],[97.9,24.5]]],
    ['bhamo','pagan','indochina',[[96.4,23.4],[96.1,22.0],[95.5,21.5]]],
    ['pagan','pegu','indochina',[[95.4,20.2],[95.9,19.0],[96.3,18.0]]],
    ['pegu','martaban','indochina',[[97.0,17.1]]],
    ['martaban','sukhothai','indochina',[[98.0,16.6],[98.6,16.7],[99.1,16.9]]],
    ['sukhothai','lavo','indochina',[[100.15,16.85],[100.45,16.2],[100.5,15.5]]],
    ['lavo','angkor','indochina',[[101.5,14.4],[102.6,13.9],[103.2,13.6]]],
    ['lavo','tambralinga','indochina',[[100.3,13.8],[99.9,12.5],[99.6,11.0],[99.2,10.0]]],
    ['tambralinga','kedah','indochina',[[100.3,7.6],[100.5,6.6]]],
    ['angkor','vijaya','indochina',[[104.8,13.6],[106.0,13.9],[107.5,14.0],[108.5,13.9]]],
    ['thanglong','vijaya','indochina',[[105.8,19.8],[105.7,18.7],[106.4,17.5],[107.6,16.4],[108.2,15.9],[108.8,14.9]]],
    ['yachi','thanglong','yunnan',[[103.3,24.2],[103.9,23.4],[104.6,22.6],[105.2,21.9],[105.6,21.35]]],
    ['thanglong','yongzhou','china',[[106.3,21.4],[106.76,21.85],[107.4,22.2],[107.9,22.6]]],
    ['yongzhou','guangzhou','china',[[109.4,23.2],[110.3,23.85],[111.3,23.8],[112.3,23.45],[112.9,23.4]]],
    ['guangzhou','zaitun','china',[[114.4,23.1],[115.4,23.0],[116.6,23.4],[117.6,24.5]]],
    ['guangzhou','tanzhou','china',[[113.4,24.1],[113.55,24.8],[113.0,25.8],[112.65,26.9],[112.95,27.6]]],
    ['tanzhou','ezhou','china',[[113.3,28.9],[113.9,29.6],[114.2,30.2]]],
  );

  RANGES.push(
    [[[35.6,28.6],[36.4,27.4],[37.2,26.2],[38.2,24.8],[39.2,23.4],[40.2,21.8],[41.2,20.4],[42.2,19.0],[43.2,17.6],[43.7,16.4],[43.9,15.0],[44.0,13.8]], 46, .55], // Hejaz & Asir (Sarawat)
    [[[43.6,16.5],[44.1,15.2],[44.4,14.2]], 40, .5], // Yemen highlands
    [[[33.9,28.6],[34.2,29.2],[34.6,29.8]], 42, .35], // Sinai
    [[[32.8,27.8],[33.4,26.6],[34.2,25.2],[35.0,24.0]], 34, .4], // Red Sea Hills
    [[[35.55,30.0],[35.65,30.9],[35.8,31.9]], 22, .25], // Edom & Moab
    [[[54.0,17.25],[55.0,17.4]], 28, .25], // Dhofar hills
    [[[47.0,14.4],[48.5,14.7],[50.0,15.2]], 26, .35], // Hadramawt jol
    [[[69.6,32.8],[69.9,31.6],[69.9,30.5],[69.3,29.6]], 52, .4], // Sulaiman
    [[[66.9,29.9],[67.3,28.5],[67.6,27.2],[67.5,26.0]], 34, .3], // Kirthar & Brahui
    [[[72.8,24.6],[73.6,25.1],[74.3,25.9],[75.2,26.9],[76.3,27.9]], 18, .3], // Aravalli
    [[[72.78,24.6]], 32, .15], // Mount Abu
    [[[75.0,22.8],[77.0,23.2],[79.0,23.6],[81.0,24.4]], 14, .35], // Vindhya
    [[[74.6,21.6],[76.5,21.5],[78.5,21.9]], 18, .3], // Satpura
    [[[73.6,21.0],[73.6,19.5],[73.8,18.0],[74.0,16.5],[74.4,15.0],[74.9,13.6],[75.5,12.3],[76.4,11.2],[77.0,10.0],[77.3,8.6]], 36, .3], // Western Ghats
    [[[76.7,11.4]], 48, .3], // Nilgiri
    [[[78.4,15.6],[79.2,14.2],[78.8,12.8],[78.3,12.0]], 15, .3], // Eastern Ghats (south)
    [[[83.0,18.5],[84.0,19.6],[85.0,20.6]], 18, .35], // Eastern Ghats (north)
    [[[91.0,25.3],[92.0,25.4]], 30, .3], // Khasi hills
    [[[92.4,24.0],[93.0,22.5],[93.8,21.0],[94.4,19.5],[94.8,18.0],[94.8,16.8]], 38, .45], // Arakan & Chin hills
    [[[93.4,24.5],[93.8,22.8]], 50, .3], // Chin peaks
    [[[97.5,23.5],[98.0,21.5],[98.6,19.5]], 24, .5], // Shan hills
    [[[98.5,18.5],[98.6,16.5],[98.8,14.5],[99.0,12.0],[99.2,10.5]], 26, .35], // Tenasserim
    [[[103.8,22.5],[105.0,20.3],[105.6,19.0],[106.5,17.5],[107.3,16.0],[107.8,14.5],[108.3,13.0],[108.3,12.0]], 40, .55], // Annamite
    [[[102.8,12.0],[103.6,11.8]], 22, .35], // Cardamom
    [[[101.0,7.0],[101.4,5.5],[101.8,4.0],[102.2,2.8]], 32, .35], // Malay main range
    [[[100.43,5.8]], 22, .1], // Gunung Jerai
    [[[98.6,28.0],[98.7,26.5],[98.6,25.2]], 90, .4], // Gaoligong
    [[[100.1,26.2],[100.1,25.5]], 70, .15], // Cang Shan (Dali)
    [[[100.9,24.8],[101.7,23.5],[102.6,22.6]], 36, .35], // Ailao
    [[[102.4,28.6],[102.8,27.2]], 40, .3], // Daliang
    [[[110.0,25.8],[112.0,25.3],[114.0,25.0],[116.0,24.8]], 34, .45], // Nanling
  );
  PLATEAUS.push(
    [42.5,24.5,5,4,13], [44.5,15.2,1.6,1.6,30], [36.0,30.8,.8,1.3,14], [37.5,27.5,2,1.5,10],
    [66.5,31.3,1.8,1.0,15], [61.5,29.5,2.5,1.5,9],
    [76.8,17.5,3.8,3.2,8], [75.8,23.6,2.5,1.0,6], [76.5,13.0,1.5,1.2,12], [85.3,27.7,.4,.25,8],
    [101.8,25.6,2.4,1.6,28], [98.0,21.5,1.6,2.4,14], [107.8,14.0,.9,1.0,10],
  );

  Object.assign(BIOMES, {
    nile:     { g:[.42,.62,.27], a:[.56,.62,.33], rough:2,  dunes:0,   snow:999, density:.5,  trees:{date:.55, acacia:.25, sycamore:.2} },
    nafud:    { g:[.93,.66,.42], a:[.88,.58,.36], rough:2,  dunes:1,   snow:999, density:.03, trees:{acacia:.3, rock:.1} },
    hejaz:    { g:[.66,.52,.40], a:[.52,.42,.34], rough:13, dunes:0,   snow:999, density:.05, trees:{acacia:.45, rock:.6} },
    yemen:    { g:[.60,.58,.37], a:[.58,.50,.36], rough:12, dunes:0,   snow:999, density:.28, terr:.85, trees:{acacia:.3, fruit:.2, shrub:.3, rock:.3} },
    indoplain:{ g:[.52,.63,.30], a:[.70,.66,.38], rough:2,  dunes:0,   snow:999, density:.55, trees:{mango:.3, banyan:.22, acacia:.18, palm:.12} },
    thar:     { g:[.87,.73,.49], a:[.80,.66,.44], rough:3,  dunes:.5,  snow:999, density:.08, trees:{acacia:.45, shrub:.3, tuft:.2} },
    deccan:   { g:[.62,.58,.33], a:[.66,.55,.36], rough:7,  dunes:0,   snow:999, density:.32, trees:{acacia:.3, banyan:.15, teak:.2, rock:.3} },
    tropical: { g:[.26,.53,.24], a:[.33,.57,.26], rough:9,  dunes:0,   snow:999, density:1.1, trees:{coconut:.25, teak:.2, banyan:.15, bamboo:.3, broad:.2} },
    dryzone:  { g:[.70,.60,.38], a:[.62,.56,.34], rough:4,  dunes:0,   snow:999, density:.25, trees:{palm:.4, acacia:.35, tuft:.2} },
  });
  BIOME_ANCHORS.push(
    // Egypt & Levant
    [31.0,30.9,'nile',.55],[31.2,29.6,'nile',.18],[30.9,28.4,'nile',.2],[31.2,27.2,'nile',.2],[32.2,26.2,'nile',.2],[32.7,25.4,'nile',.18],[32.9,24.3,'nile',.15],
    [29.5,27.5,'sand',2.5],[33.5,26.5,'hejaz',1.2],[34.0,29.3,'hejaz',.7],[33.0,30.4,'sand',.9],[35.0,31.9,'levant',.5],[35.7,31.0,'iran',.4],
    // Arabia
    [41,28,'nafud',2.0],[45,22,'sand',3.5],[50,19,'sand',3.0],[37.3,27.2,'hejaz',1.2],[39.5,24.5,'hejaz',1.4],[41,21,'hejaz',1.1],[42.5,18.6,'hejaz',.9],
    [44.2,15.0,'yemen',.9],[44.0,13.7,'yemen',.5],[48.6,15.9,'oasis',.35],[54.0,17.2,'yemen',.4],[39.6,24.45,'oasis',.25],[39.3,25.7,'oasis',.2],[37.9,26.6,'oasis',.15],
    // Persia–India
    [62.0,30.6,'sand',1.2],[64.5,30.5,'sand',1.2],[65.7,31.6,'iran',.8],[61.86,30.96,'oasis',.3],[67.5,29.5,'iran',1.0],
    [71,27,'thar',2.0],[70.5,25.5,'thar',1.5],[72.5,30.8,'indoplain',1.3],[75,31,'indoplain',1.2],[77,29,'indoplain',1.1],[79.5,27,'indoplain',1.4],[82.5,25.8,'indoplain',1.4],
    [85.5,25.6,'indoplain',1.2],[88.2,24.8,'tropical',1.0],[90.4,23.7,'tropical',.9],[91.8,22.6,'tropical',.6],[72.5,23.2,'indoplain',.9],[74.4,25.2,'deccan',1.0],
    [75.5,19.5,'deccan',1.6],[76.5,16.5,'deccan',1.8],[78,14.5,'deccan',1.4],[76.2,13.2,'deccan',.9],[79.4,11.5,'indoplain',.9],[78.4,9.6,'deccan',.8],[73.2,19.0,'tropical',.6],
    [74.2,15.5,'tropical',.6],[75.6,11.5,'tropical',.6],[76.6,9.5,'tropical',.6],[80.1,13.0,'indoplain',.5],[85.3,27.7,'southchina',.4],[84.5,27.5,'tropical',.6],[83,21.8,'tropical',1.4],
    // Indochina & Yunnan
    [94.9,21.2,'dryzone',.9],[95.6,22.6,'dryzone',.8],[96.3,24.0,'tropical',.8],[96.3,17.6,'tropical',1.0],[98.0,16.6,'tropical',.9],[99.7,17.2,'tropical',.9],
    [100.5,14.8,'indoplain',.9],[102.2,14.6,'deccan',1.3],[103.9,13.3,'tropical',.9],[100.0,9.5,'tropical',1.2],[100.6,6.2,'tropical',.9],[106.8,14.0,'tropical',1.4],
    [108.4,15.6,'tropical',1.0],[105.9,20.9,'southchina',.8],[106.2,18.5,'tropical',.9],[102.5,25.4,'southchina',1.2],[100.2,25.7,'southchina',.7],[99.2,25.1,'southchina',.6],
    [102.4,27.8,'southchina',.8],[108.5,22.9,'southchina',1.2],[112.0,23.3,'southchina',1.4],[113.2,23.1,'tropical',.6],[112.9,27.5,'southchina',1.5],[116.0,23.6,'southchina',1.2],
  );

  VILLAGE_DENSITY.push(
    [31.0,30.9,.6,.95],[31.2,29.5,.25,.75],[30.9,28.4,.25,.7],[31.1,27.3,.25,.7],[32.1,26.2,.22,.7],[32.7,25.4,.2,.6],[34.9,31.9,.5,.5],[35.6,31.4,.35,.25],
    [44.2,14.6,.8,.5],[48.7,15.9,.3,.35],
    [73.5,31.2,1.3,.7],[71.5,30.0,.7,.45],[77.5,28.4,1.0,.8],[80.0,26.9,1.3,.8],[83.0,25.5,1.3,.85],[86.0,25.3,1.2,.85],[88.4,24.6,1.0,.85],[90.4,23.7,.8,.8],
    [72.4,23.0,1.0,.6],[74.6,25.5,1.0,.35],[75.5,19.2,1.4,.4],[75.6,16.5,1.2,.35],[76.2,13.2,1.0,.45],[79.3,11.2,1.0,.75],[78.3,9.8,.7,.6],[79.8,12.8,.6,.7],[85.3,27.7,.25,.6],
    [95.0,21.3,.8,.6],[96.3,17.4,.7,.5],[100.3,15.0,1.0,.45],[99.8,17.0,.5,.45],[103.9,13.4,.6,.65],[105.9,20.9,.6,.9],[100.2,25.7,.35,.55],[102.7,25.0,.4,.5],
    [113.2,23.1,.8,.75],[112.9,28.0,1.0,.7],[108.5,23.0,.8,.4],[109.0,13.9,.5,.4],[100.0,8.5,.4,.4],
  );

  // Holy oil can also be had in Jerusalem itself
  LANDMARKS.push(
    // Egypt
    { city:'cairo', type:'citadel', p:{ hill:6, r:15 }, name:'Citadel of the Mountain', blurb:'Saladin\'s citadel on the Muqattam spur, seat of the Mamluk sultans.' },
    { city:'cairo', type:'mosque', p:{ dome:3.5, minarets:1, style:'umayyad' }, name:'Mosque of Baybars', blurb:'Sultan Baybars\' new congregational mosque, finished in 1269.' },
    { city:'cairo', type:'spiralMinaret', name:'Mosque of Ibn Tulun', blurb:'Built in 879 around a vast courtyard, with an outside stair winding up its minaret like the one at Samarra.' },
    { city:'cairo', type:'madrasa', p:{ tile:'stone' }, name:'Al-Azhar', blurb:'Founded by the Fatimids in 970. Baybars restored Friday prayers here in 1266.' },
    { city:'cairo', type:'bazaar', name:'Bayn al-Qasrayn', blurb:'"Between the Two Palaces": the old Fatimid ceremonial street, now Cairo\'s richest market of spices, sugar and cloth.' },
    { lon:31.13, lat:29.98, type:'pyramids', name:'Pyramids of Giza', blurb:'Already 3,800 years old. Medieval writers called them the granaries of Joseph. Their smooth limestone casing is being stripped for Cairo\'s buildings.' },
    { city:'alexandria', type:'pharos', name:'Pharos of Alexandria', blurb:'One of the Seven Wonders. Its upper storeys have fallen in earthquakes, but the great square base still stands. A quake in 1303 will finish it.' },
    { city:'alexandria', type:'column', p:{ h:20, color:'granite' }, name:'Pompey\'s Pillar', blurb:'A red granite column raised for Emperor Diocletian in 297.' },
    { city:'alexandria', type:'harbor', p:{ ship:'galley' }, name:'Eastern Harbour', blurb:'Venetian galleys load pepper and ginger that Karimi merchants brought up the Nile.' },
    { lon:32.66, lat:25.72, type:'karnak', name:'Karnak', blurb:'Ancient Thebes: a forest of gigantic carved columns half buried in sand, which the villagers of Luxor call "the palaces".' },
    { city:'qus', type:'mosque', p:{ dome:0, minarets:1, style:'umayyad' }, name:'Great Mosque of Qus', blurb:'A Fatimid-era mosque in the trading town of Upper Egypt.' },
    { city:'aswan', type:'ruins', name:'Monastery of St Simeon', blurb:'A fortified Coptic monastery on the desert bank of the Nile, abandoned about now.' },
    { city:'jerusalem', type:'domeRock', name:'Dome of the Rock', blurb:'Built in 691 over the rock of the Temple Mount, with a golden dome and tiled walls.' },
    { city:'jerusalem', type:'church', p:{ style:'byz', big:true }, name:'Church of the Holy Sepulchre', blurb:'The tomb of Christ. The Polos took oil from its lamp to Kublai Khan.' },
    { city:'jerusalem', type:'citadel', p:{ hill:2, r:9 }, name:'Tower of David', blurb:'The citadel at the Jaffa Gate.' },
    { city:'acre', type:'citadel', p:{ hill:1, r:12 }, name:'Hospitaller Fortress', blurb:'The great hall and fortress of the Knights of St John.' },
    { city:'acre', type:'church', p:{ style:'byz', big:true }, name:'Cathedral of the Holy Cross', blurb:'The Crusader cathedral of Acre, seat of the patriarch of Jerusalem in exile.' },
    { city:'acre', type:'harbor', p:{ ship:'galley' }, name:'Harbour of Acre', blurb:'The main port of the Crusader East. The Polos sailed from here in 1271 with letters from the new Pope, Gregory X.' },
    { city:'karak', type:'citadel', p:{ hill:7, r:16 }, name:'Kerak Castle', blurb:'Raynald of Châtillon\'s fortress, now held by Baybars.' },
    { city:'gaza', type:'mosque', p:{ dome:0, minarets:1, style:'umayyad' }, name:'Great Mosque of Gaza', blurb:'A Crusader church of St John, turned into a mosque.' },
    { lon:35.44, lat:30.33, type:'rockFacade', p:{ style:'petra' }, name:'Petra', blurb:'The Nabataeans\' rock-cut city in its rose-red gorge, all but forgotten. Baybars rode through it in 1276.' },
    // Arabia
    { lon:37.95, lat:26.79, type:'rockFacade', p:{ style:'hegra' }, name:'Hegra (Mada\'in Salih)', blurb:'More than a hundred Nabataean tombs carved into sandstone outcrops. Pilgrims avoid them as the cursed city of the Thamud.' },
    { city:'medina', type:'mosque', p:{ dome:0, minarets:4, style:'umayyad' }, name:'Mosque of the Prophet', blurb:'Rebuilt after a fire in 1256. The Prophet\'s tomb lies within, with no dome until 1279.' },
    { city:'mecca', type:'haram', name:'Masjid al-Haram and the Kaaba', blurb:'The Kaaba in its black kiswa, ringed by arcades. Abbasid, and now Mamluk, sultans compete to send its covering each year.' },
    { city:'taif', type:'tower', name:'Rose gardens', blurb:'Walled gardens and watchtowers on the edge of the escarpment.' },
    { city:'faid', type:'caravanserai', name:'Fortress of Fayd', blurb:'A walled halt with great stone cisterns on the Darb Zubayda.' },
    { city:'sanaa', type:'mosque', p:{ dome:0, minarets:2, style:'umayyad' }, name:'Great Mosque of Sanaa', blurb:'Said to have been founded in the Prophet\'s lifetime. Stones from the ruined Ghumdan Palace are built into it.' },
    { city:'taizz', type:'mosque', p:{ dome:4, minarets:2, style:'iwan' }, name:'Al-Muzaffar Mosque', blurb:'Built by the reigning sultan al-Muzaffar Yusuf, with many small domes.' },
    { city:'taizz', type:'citadel', p:{ hill:6, r:12 }, name:'Cairo Citadel of Taizz', blurb:'The Rasulid fortress on its rock above the town.' },
    { city:'aden', type:'harbor', p:{ ship:'dhow' }, name:'Port of Aden', blurb:'Dhows from Gujarat, Malabar and Zafar unload pepper, cloth and horses.' },
    { city:'aden', type:'citadel', p:{ hill:5, r:10 }, name:'Sira Fort', blurb:'A fort on the island guarding the crater harbour.' },
    { lon:45.33, lat:15.41, type:'ruins', name:'Great Dam of Marib', blurb:'The broken dam of the Queen of Sheba\'s kingdom. Its collapse around 570 is remembered in the Qur\'an.' },
    { city:'shibam', type:'towerCluster', name:'Tower houses of Shibam', blurb:'Some 500 mud-brick houses, five to eight storeys tall, packed inside a single wall.' },
    { city:'shihr', type:'harbor', p:{ ship:'dhow' }, name:'Harbour of al-Shihr', blurb:'Horses and incense are shipped to India from here.' },
    { city:'zafar', type:'ruins', name:'Sumhuram', blurb:'Ruins of an ancient incense port on the lagoon at Khor Rori.' },
    { city:'zafar', type:'harbor', p:{ ship:'dhow' }, name:'Port of Zafar', blurb:'Frankincense from the Dhofar hills is loaded here.' },
    // India
    { city:'delhi', type:'qutb', name:'Qutb Minar', blurb:'Begun by Qutb ud-din Aibak in 1199 and finished by Iltutmish: a fluted victory tower 72 m tall.' },
    { city:'delhi', type:'column', p:{ h:7.2, color:'iron' }, name:'Iron Pillar', blurb:'A rust-free iron pillar of the Gupta age (c. 400 CE), moved here centuries ago.' },
    { city:'delhi', type:'mosque', p:{ dome:0, minarets:0, style:'iwan' }, name:'Quwwat al-Islam Mosque', blurb:'Built from the pillars of 27 demolished temples, with a great carved screen.' },
    { city:'delhi', type:'mausoleum', p:{ tile:'stone' }, name:'Tomb of Iltutmish', blurb:'The sultan who died in 1236, buried under richly carved red sandstone.' },
    { city:'lahore', type:'citadel', p:{ hill:2, r:13 }, name:'Lahore Fort', blurb:'Its walls were rebuilt by Balban in 1270 after the Mongol sack.' },
    { city:'multan', type:'mausoleum', p:{ tile:'turq' }, name:'Shrine of Bahauddin Zakariya', blurb:'Tomb of the great Suhrawardi Sufi master, who died in 1262.' },
    { city:'ajmer', type:'mosque', p:{ dome:0, minarets:2, style:'iwan' }, name:'Adhai Din ka Jhonpra', blurb:'A mosque built in 1199 from temple columns, with a screen of seven arches.' },
    { city:'chittor', type:'citadel', p:{ hill:9, r:18 }, name:'Fort of Chittor', blurb:'A 280-hectare fortress on a 180-metre-high mesa.' },
    { city:'chittor', type:'tower', p:{ h:22, style:'jain' }, name:'Kirti Stambha', blurb:'A seven-storey Jain "tower of fame" of the 1100s.' },
    { lon:72.78, lat:24.6, type:'shikhara', p:{ style:'jain' }, name:'Dilwara Temples, Mount Abu', blurb:'Jain temples of dazzling white marble lacework. The Luna Vasahi was built by the Vaghela ministers in 1230.' },
    { city:'anhilwara', type:'stepwell', name:'Rani ki Vav', blurb:'A queen\'s stepwell of the 1000s, seven storeys deep and lined with hundreds of sculptures.' },
    { city:'anhilwara', type:'shikhara', p:{ style:'nagara' }, name:'Temple of Patan', blurb:'A Solanki-style temple of the Gujarati kings.' },
    { city:'cambay', type:'shikhara', p:{ style:'nagara' }, name:'Jain temple of Cambay', blurb:'Built by the city\'s rich Jain merchants.' },
    { city:'cambay', type:'harbor', p:{ ship:'dhow' }, name:'Port of Cambay', blurb:'Ships for Aden and Hormuz load cotton cloth, indigo and leather.' },
    { city:'thana', type:'harbor', p:{ ship:'dhow' }, name:'Thana Creek', blurb:'Ships from Arabia land horses here.' },
    { lon:75.18, lat:20.03, type:'caves', name:'Ellora Caves', blurb:'Hindu, Buddhist and Jain temples cut into the cliff, including the Kailasa temple, carved down from a single rock in the 700s.' },
    { city:'devagiri', type:'citadel', p:{ hill:12, r:16 }, name:'Fort of Devagiri', blurb:'A hill whose sides were cut sheer, with a single tunnel to the top.' },
    { city:'pandharpur', type:'shikhara', p:{ style:'nagara' }, name:'Vithoba Temple', blurb:'The temple of Vithoba on the Bhima River.' },
    { city:'dvarasamudra', type:'shikhara', p:{ style:'hoysala' }, name:'Hoysaleswara Temple', blurb:'A twin temple of the 1100s on star-shaped platforms, covered in carved friezes of elephants, lions and gods.' },
    { city:'kanchipuram', type:'gopuram', p:{ tiers:7 }, name:'Ekambareswarar Temple', blurb:'A temple of Shiva, with tall gate towers being added by its royal patrons.' },
    { city:'kanchipuram', type:'shikhara', p:{ style:'dravida', h:16 }, name:'Kailasanathar Temple', blurb:'A Pallava sandstone temple of about 700.' },
    { city:'mylapore', type:'church', p:{ style:'nestorian' }, name:'Shrine of St Thomas', blurb:'Polo saw Christians and Muslims alike come here on pilgrimage and take earth from the tomb as a cure.' },
    { city:'thanjavur', type:'shikhara', p:{ style:'dravida', h:42 }, name:'Brihadisvara Temple', blurb:'Rajaraja Chola\'s temple of 1010. Its granite tower rises 66 m to a capstone said to weigh 80 tonnes.' },
    { city:'madurai', type:'gopuram', p:{ tiers:9 }, name:'Meenakshi Temple', blurb:'The goddess Meenakshi\'s temple, its gate towers being raised by the Pandya kings.' },
    { city:'kayal', type:'harbor', p:{ ship:'dhow' }, name:'Pearl fishery of Kayal', blurb:'Divers bring up pearls from the oyster banks of the Gulf of Mannar.' },
    { city:'mathura', type:'ghat', name:'Vishram Ghat', blurb:'Steps down to the Yamuna, where Krishna is said to have rested.' },
    { city:'kanauj', type:'ruins', name:'Palace of the Pratiharas', blurb:'Ruins of the imperial capital of northern India.' },
    { city:'varanasi', type:'ghat', name:'Ghats of the Ganges', blurb:'Pilgrims bathe at dawn, and the dead are cremated at Manikarnika.' },
    { city:'varanasi', type:'shikhara', p:{ style:'nagara' }, name:'Temple of Vishwanath', blurb:'The temple of Shiva, Lord of the Universe, rebuilt after it was sacked in 1194.' },
    { lon:83.03, lat:25.38, type:'stupa', p:{ big:true }, name:'Dhamek Stupa, Sarnath', blurb:'Marks the deer park where the Buddha gave his first sermon.' },
    { lon:84.99, lat:24.70, type:'shikhara', p:{ style:'mahabodhi' }, name:'Mahabodhi Temple, Bodh Gaya', blurb:'Built where the Buddha attained enlightenment under the Bodhi tree. Burmese kings are paying to restore it.' },
    { lon:85.44, lat:25.13, type:'ruins', name:'Ruins of Nalanda', blurb:'The greatest Buddhist university in the world until about 1200. Its library is said to have burned for months.' },
    { city:'lakhnauti', type:'mosque', p:{ dome:3, minarets:0, style:'iwan' }, name:'Mosque of Lakhnauti', blurb:'A brick mosque of the Bengal governors.' },
    { city:'sonargaon', type:'shikhara', p:{ style:'nagara' }, name:'Temple of Sonargaon', blurb:'A brick temple of the Deva kings.' },
    { city:'kathmandu', type:'pagoda', p:{ tiers:3, sides:4, color:'brick', w:6, newar:true }, name:'Pashupatinath', blurb:'A Newar-style temple with tiered roofs. Arniko\'s Nepali craftsmen took this kind of building to China.' },
    { city:'kathmandu', type:'stupa', p:{ big:true, eyes:true }, name:'Swayambhunath', blurb:'A white stupa on a hill above the valley, painted with the watching eyes of the Buddha.' },
    { lon:72.83, lat:33.74, type:'ruins', name:'Ruins of Taxila', blurb:'The Gandharan city of monasteries where Alexander once rested his army.' },
    // Yunnan & Indochina
    { city:'dali', type:'pagoda', p:{ tiers:16, sides:4, color:'white', w:5.5 }, name:'Qianxun Pagoda', blurb:'The tallest of Dali\'s Three Pagodas (c. 840), a slender white tower facing Erhai Lake.' },
    { city:'yachi', type:'pagoda', p:{ tiers:13, sides:4, color:'brick', w:4 }, name:'West Temple Pagoda', blurb:'A Nanzhao-era brick pagoda.' },
    { city:'pagan', type:'zedi', p:{ style:'zedi', h:24, gold:true }, name:'Shwezigon Pagoda', blurb:'A gilded bell-shaped stupa begun by King Anawrahta, Pagan\'s first king, in the 1000s.' },
    { city:'pagan', type:'pahto', name:'Ananda Temple', blurb:'A white cruciform temple of 1105 with four giant standing Buddhas.' },
    { city:'pagan', type:'zedi', p:{ style:'zedi', h:20, terraces:5 }, name:'Mingalazedi', blurb:'The last great stupa of Pagan, being built right now by Narathihapate (1268–1274).' },
    { lon:95.05, lat:21.0, type:'zediField', name:'Plain of Pagan', blurb:'More than 2,000 brick temples and stupas across the plain.' },
    { city:'pegu', type:'zedi', p:{ style:'zedi', h:26, gold:true }, name:'Shwemawdaw Pagoda', blurb:'A Mon stupa said to hold two hairs of the Buddha.' },
    { city:'martaban', type:'harbor', p:{ ship:'junk' }, name:'Martaban jars', blurb:'Huge glazed jars are sold here as far as Arabia.' },
    { city:'sukhothai', type:'zedi', p:{ style:'lotus' }, name:'Wat Mahathat', blurb:'The royal temple, with a lotus-bud chedi rising over rows of Buddhas.' },
    { city:'lavo', type:'zedi', p:{ style:'prang', triple:true }, name:'Phra Prang Sam Yot', blurb:'Three laterite Khmer-style towers joined by corridors.' },
    { city:'angkor', type:'templeMountain', p:{ style:'bayon' }, name:'The Bayon', blurb:'Jayavarman VII\'s state temple at the heart of Angkor Thom, with 200 serene stone faces.' },
    { lon:103.87, lat:13.36, type:'templeMountain', p:{ style:'angkorwat' }, name:'Angkor Wat', blurb:'Suryavarman II\'s temple to Vishnu (c. 1150), its five lotus towers mirrored in a moat 190 m wide.' },
    { city:'angkor', type:'gate', p:{ faces:true }, name:'Gate of Angkor Thom', blurb:'The gateways are crowned with four-faced towers, and the causeways are lined with giants pulling a naga.' },
    { city:'vijaya', type:'zedi', p:{ style:'cham' }, name:'Cham towers', blurb:'Brick kalan towers of Champa\'s gods, on a hill above the city.' },
    { city:'tambralinga', type:'zedi', p:{ style:'bell', h:22 }, name:'Wat Phra Mahathat', blurb:'A great bell-shaped stupa, rebuilt in the Sri Lankan style.' },
    { city:'kedah', type:'ruins', name:'Candi of Bujang', blurb:'Hindu-Buddhist shrines of the ancient port.' },
    { city:'thanglong', type:'pavilion', p:{ levels:1, w:6, onePillar:true }, name:'One Pillar Pagoda', blurb:'Built in 1049 like a lotus rising from a pond.' },
    { city:'thanglong', type:'hall', name:'Temple of Literature', blurb:'Vietnam\'s first university (1076), dedicated to Confucius.' },
    { city:'guangzhou', type:'pagoda', p:{ tiers:9, sides:8, color:'red', w:6 }, name:'Flower Pagoda', blurb:'The tall pagoda of the Temple of the Six Banyan Trees.' },
    { city:'guangzhou', type:'minaret', p:{ h:24, r:2.0, color:'stone' }, name:'Huaisheng Lighthouse Minaret', blurb:'A smooth minaret that guided ships up the Pearl River. Its mosque is said to date to the 600s.' },
    { city:'tanzhou', type:'hall', name:'Yuelu Academy', blurb:'One of the Four Great Academies of the Song, on Mount Yuelu.' },
  );
  NAMED_BRIDGES.push(
    { river:'Nile', edge:['cairo','alexandria'], name:'Pontoon bridge to Giza', style:'stone', blurb:'Boats chained together carry the road across the Nile to Giza.' },
  );
})();

