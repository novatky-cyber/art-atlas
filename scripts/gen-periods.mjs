// periods.json の元定義。編集後 `node scripts/gen-periods.mjs` で data/periods.json を再生成。
import { readFileSync, writeFileSync } from 'node:fs';
const BG = JSON.parse(readFileSync(new URL('./period-backgrounds.json', import.meta.url), 'utf8'));
const P = (scheme, id, name_ja, name_en, start, end) => ({ id: `${scheme}:${id}`, scheme, name_ja, name_en, start, end, background: BG[`${scheme}:${id}`] ?? null, ai_generated: true });
const periods = [
  // world: 全地域共通の大きな時代区分（探索フィルタ・図鑑・同時代比較で使用）
  P('world', 'prehistory', '先史〜古代前期', 'Prehistory–Early Antiquity', -40000, -1001),
  P('world', 'antiquity', '古代', 'Antiquity', -1000, 499),
  P('world', 'early-medieval', '中世前期', 'Early Middle Ages', 500, 999),
  P('world', 'high-medieval', '中世後期', 'High & Late Middle Ages', 1000, 1399),
  P('world', 'early-modern-1', '15〜16世紀', '15th–16th c.', 1400, 1599),
  P('world', 'early-modern-2', '17〜18世紀', '17th–18th c.', 1600, 1799),
  P('world', 'c19', '19世紀', '19th c.', 1800, 1899),
  P('world', 'c20', '20世紀前半', 'Early 20th c.', 1900, 1960),
  // western
  P('western', 'early-christian', '初期キリスト教・ビザンティン初期', 'Early Christian', 300, 799),
  P('western', 'early-medieval', '中世前期（カロリング・オットー朝）', 'Early Medieval', 800, 1049),
  P('western', 'romanesque', 'ロマネスク期（11〜12世紀）', 'Romanesque era', 1050, 1199),
  P('western', 'gothic', 'ゴシック期（13〜14世紀）', 'Gothic era', 1200, 1399),
  P('western', 'c15', '15世紀', '15th century', 1400, 1499),
  P('western', 'c16', '16世紀', '16th century', 1500, 1599),
  P('western', 'c17', '17世紀', '17th century', 1600, 1699),
  P('western', 'c18', '18世紀', '18th century', 1700, 1799),
  P('western', 'c19a', '19世紀前半', 'Early 19th century', 1800, 1849),
  P('western', 'c19b', '19世紀後半', 'Late 19th century', 1850, 1899),
  P('western', 'c20', '20世紀前半', 'Early 20th century', 1900, 1960),
  // japan
  P('japan', 'jomon', '縄文時代', 'Jōmon', -14000, -301),
  P('japan', 'yayoi', '弥生時代', 'Yayoi', -300, 249),
  P('japan', 'kofun', '古墳時代', 'Kofun', 250, 537),
  P('japan', 'asuka', '飛鳥時代', 'Asuka', 538, 709),
  P('japan', 'nara', '奈良時代', 'Nara', 710, 793),
  P('japan', 'heian', '平安時代', 'Heian', 794, 1184),
  P('japan', 'kamakura', '鎌倉時代', 'Kamakura', 1185, 1332),
  P('japan', 'muromachi', '南北朝・室町時代', 'Nanbokuchō–Muromachi', 1333, 1572),
  P('japan', 'momoyama', '安土桃山時代', 'Momoyama', 1573, 1614),
  P('japan', 'edo', '江戸時代', 'Edo', 1615, 1867),
  P('japan', 'meiji', '明治時代以降', 'Meiji and later', 1868, 1960),
  // china
  P('china', 'neolithic', '新石器時代', 'Neolithic', -7000, -1601),
  P('china', 'shang', '殷（商）', 'Shang', -1600, -1047),
  P('china', 'zhou', '周（西周・春秋・戦国）', 'Zhou', -1046, -222),
  P('china', 'qin-han', '秦・漢', 'Qin–Han', -221, 219),
  P('china', 'six-dynasties', '六朝・南北朝', 'Six Dynasties', 220, 580),
  P('china', 'sui-tang', '隋・唐', 'Sui–Tang', 581, 906),
  P('china', 'five-dynasties-song', '五代・宋', 'Five Dynasties–Song', 907, 1270),
  P('china', 'yuan', '元', 'Yuan', 1271, 1367),
  P('china', 'ming', '明', 'Ming', 1368, 1643),
  P('china', 'qing', '清', 'Qing', 1644, 1911),
  P('china', 'republic', '中華民国期', 'Republic', 1912, 1960),
  // korea
  P('korea', 'three-kingdoms', '三国時代', 'Three Kingdoms', -57, 667),
  P('korea', 'unified-silla', '統一新羅', 'Unified Silla', 668, 917),
  P('korea', 'goryeo', '高麗', 'Goryeo', 918, 1391),
  P('korea', 'joseon', '朝鮮王朝', 'Joseon', 1392, 1897),
  P('korea', 'modern', '近代', 'Modern', 1898, 1960),
  // islamic
  P('islamic', 'early', '初期イスラーム（ウマイヤ・アッバース朝）', 'Early Islamic', 622, 999),
  P('islamic', 'medieval', '中期（セルジューク・ファーティマ・アイユーブ朝）', 'Middle period', 1000, 1249),
  P('islamic', 'mongol-timurid', 'モンゴル〜ティムール朝期・マムルーク朝', 'Mongol–Timurid', 1250, 1499),
  P('islamic', 'gunpowder-empires', '三大帝国期（サファヴィー・オスマン・ムガル）', 'Safavid–Ottoman', 1500, 1799),
  P('islamic', 'modern', '近代（ガージャール朝・オスマン後期）', 'Qajar & late Ottoman', 1800, 1960),
  // south-asia
  P('south-asia', 'ancient', '古代（インダス〜マウリヤ）', 'Ancient', -3000, -185),
  P('south-asia', 'kushan', 'シュンガ・クシャーン朝', 'Shunga–Kushan', -184, 319),
  P('south-asia', 'gupta', 'グプタ朝', 'Gupta', 320, 599),
  P('south-asia', 'medieval', '中世（パッラヴァ・チョーラ・パーラ等）', 'Medieval', 600, 1205),
  P('south-asia', 'sultanate', 'デリー・スルタン朝期', 'Sultanate', 1206, 1525),
  P('south-asia', 'mughal', 'ムガル朝・ラージプート諸国', 'Mughal', 1526, 1857),
  P('south-asia', 'colonial', '英領期', 'Colonial', 1858, 1960),
  // southeast-asia
  P('southeast-asia', 'early', '初期（扶南・ドヴァーラヴァティー等）', 'Early', -500, 699),
  P('southeast-asia', 'classical', '古典期（シャイレーンドラ・前アンコール）', 'Classical', 700, 899),
  P('southeast-asia', 'angkor', 'アンコール・パガン期', 'Angkor–Bagan', 900, 1299),
  P('southeast-asia', 'post-classical', 'スコータイ・アユタヤ・マジャパヒト期', 'Post-classical', 1300, 1767),
  P('southeast-asia', 'modern', '近代', 'Modern', 1768, 1960),
  // egypt
  P('egypt', 'predynastic', '先王朝・初期王朝', 'Predynastic–Early Dynastic', -5000, -2687),
  P('egypt', 'old-kingdom', '古王国', 'Old Kingdom', -2686, -2161),
  P('egypt', 'middle-kingdom', '中王国（第1中間期含む）', 'Middle Kingdom', -2160, -1651),
  P('egypt', 'new-kingdom', '新王国（第2中間期含む）', 'New Kingdom', -1650, -1070),
  P('egypt', 'late', '第3中間期・末期王朝', 'Third Intermediate–Late', -1069, -333),
  P('egypt', 'ptolemaic-roman', 'プトレマイオス朝・ローマ支配期', 'Ptolemaic–Roman', -332, 400),
  // near-east
  P('near-east', 'sumer-akkad', 'シュメール・アッカド', 'Sumer–Akkad', -4000, -2001),
  P('near-east', 'babylon', '古バビロニア・ヒッタイト', 'Old Babylonian–Hittite', -2000, -1001),
  P('near-east', 'assyria', '新アッシリア・新バビロニア', 'Neo-Assyrian', -1000, -551),
  P('near-east', 'achaemenid', 'アケメネス朝', 'Achaemenid', -550, -331),
  P('near-east', 'parthian-sasanian', 'パルティア・ササン朝', 'Parthian–Sasanian', -330, 650),
  // greco-roman
  P('greco-roman', 'aegean', 'エーゲ文明（キクラデス・ミノア・ミケーネ）', 'Aegean Bronze Age', -3200, -1101),
  P('greco-roman', 'geometric', '幾何学様式期', 'Geometric', -1100, -701),
  P('greco-roman', 'archaic', 'アルカイック期', 'Archaic', -700, -481),
  P('greco-roman', 'classical', 'クラシック期', 'Classical', -480, -324),
  P('greco-roman', 'hellenistic', 'ヘレニズム期', 'Hellenistic', -323, -32),
  P('greco-roman', 'roman-imperial', 'ローマ帝政期', 'Roman Imperial', -31, 500),
  // americas
  P('americas', 'preclassic', '先古典期', 'Preclassic', -2000, 249),
  P('americas', 'classic', '古典期', 'Classic', 250, 899),
  P('americas', 'postclassic', '後古典期（アステカ・インカ）', 'Postclassic', 900, 1550),
  P('americas', 'colonial', '植民地期以降', 'Colonial and later', 1551, 1960),
];
writeFileSync(new URL('../data/periods.json', import.meta.url), JSON.stringify(periods, null, 2) + '\n');
console.log(`periods: ${periods.length}`);
