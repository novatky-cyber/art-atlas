// 各オープンアクセス API のアダプタ。すべて同じ「候補」形式を返す。
// 候補: { source, sourceId, title, artist, all, yearStart, yearEnd, ok, record }
//   ok     … パブリックドメイン（またはフリーライセンス）かつ画像あり
//   record … data/artworks.json に保存する事実・画像・出典（取得データのみ）
import { getJson } from './http.mjs';

const enc = encodeURIComponent;
const stripHtml = (s) => String(s ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

// ---------------- The Metropolitan Museum of Art ----------------
const MET = 'https://collectionapi.metmuseum.org/public/collection/v1';
function metCandidate(o) {
  if (!o || !o.objectID) return null;
  const artist = o.artistDisplayName || '';
  return {
    source: 'met',
    sourceId: String(o.objectID),
    title: o.title || '',
    artist,
    all: [o.title, artist, o.culture, o.period, o.dynasty, o.classification, o.objectName, o.medium, o.department, o.country, o.objectDate].join(' | '),
    yearStart: num(o.objectBeginDate),
    yearEnd: num(o.objectEndDate),
    ok: Boolean(o.isPublicDomain && (o.primaryImageSmall || o.primaryImage)),
    record: {
      facts: {
        title: o.title || '',
        artist: artist || null,
        artist_bio: o.artistDisplayBio || null,
        date: o.objectDate || null,
        culture: [o.culture, o.period, o.dynasty].filter(Boolean).join(' / ') || null,
        medium: o.medium || null,
        dimensions: o.dimensions || null,
        repository: 'The Metropolitan Museum of Art, New York',
        credit_line: o.creditLine || null,
        object_url: o.objectURL || `https://www.metmuseum.org/art/collection/search/${o.objectID}`,
      },
      image: {
        thumb: o.primaryImageSmall || o.primaryImage,
        large: o.primaryImage || o.primaryImageSmall,
        license: 'CC0 (Open Access)',
        credit: 'The Metropolitan Museum of Art',
        source_url: o.objectURL || null,
      },
      source: { name: 'The Metropolitan Museum of Art Collection API', id: String(o.objectID), api_url: `${MET}/objects/${o.objectID}` },
    },
  };
}
export const met = {
  async byId(id) {
    return metCandidate(await getJson(`${MET}/objects/${enc(id)}`));
  },
  async *search(q, max = 25) {
    const r = await getJson(`${MET}/search?hasImages=true&q=${enc(q)}`);
    for (const id of (r?.objectIDs ?? []).slice(0, max)) {
      const c = await this.byId(id);
      if (c) yield c;
    }
  },
};

// ---------------- Art Institute of Chicago ----------------
const AIC = 'https://api.artic.edu/api/v1';
const AIC_FIELDS = 'id,title,artist_display,artist_title,date_display,date_start,date_end,place_of_origin,medium_display,dimensions,credit_line,image_id,is_public_domain,classification_title,style_title,department_title';
const AIC_IIIF = 'https://www.artic.edu/iiif/2';
function aicCandidate(o) {
  if (!o || !o.id) return null;
  const artist = o.artist_title || o.artist_display || '';
  return {
    source: 'aic',
    sourceId: String(o.id),
    title: o.title || '',
    artist: [o.artist_title, o.artist_display].filter(Boolean).join(' / '),
    all: [o.title, o.artist_display, o.place_of_origin, o.classification_title, o.style_title, o.medium_display, o.department_title, o.date_display].join(' | '),
    yearStart: num(o.date_start),
    yearEnd: num(o.date_end),
    ok: Boolean(o.is_public_domain && o.image_id),
    record: {
      facts: {
        title: o.title || '',
        artist: artist ? (o.artist_display || artist) : null,
        artist_bio: null,
        date: o.date_display || null,
        culture: o.place_of_origin || null,
        medium: o.medium_display || null,
        dimensions: o.dimensions || null,
        repository: 'The Art Institute of Chicago',
        credit_line: o.credit_line || null,
        object_url: `https://www.artic.edu/artworks/${o.id}`,
      },
      image: {
        thumb: o.image_id ? `${AIC_IIIF}/${o.image_id}/full/400,/0/default.jpg` : null,
        large: o.image_id ? `${AIC_IIIF}/${o.image_id}/full/1686,/0/default.jpg` : null,
        license: 'CC0 (Public Domain)',
        credit: 'The Art Institute of Chicago',
        source_url: `https://www.artic.edu/artworks/${o.id}`,
      },
      source: { name: 'Art Institute of Chicago API', id: String(o.id), api_url: `${AIC}/artworks/${o.id}` },
    },
  };
}
export const aic = {
  async byId(id) {
    const r = await getJson(`${AIC}/artworks/${enc(id)}?fields=${AIC_FIELDS}`);
    return aicCandidate(r?.data);
  },
  async *search(q, max = 25) {
    const r = await getJson(`${AIC}/artworks/search?q=${enc(q)}&limit=${max}&fields=${AIC_FIELDS}`);
    for (const o of r?.data ?? []) {
      const c = aicCandidate(o);
      if (c) yield c;
    }
  },
};

// ---------------- Cleveland Museum of Art ----------------
const CMA = 'https://openaccess-api.clevelandart.org/api/artworks';
function cmaCandidate(o) {
  if (!o || !o.id) return null;
  const artist = (o.creators ?? []).map((c) => c.description).filter(Boolean).join('; ');
  const web = o.images?.web?.url;
  return {
    source: 'cleveland',
    sourceId: String(o.id),
    title: o.title || '',
    artist,
    all: [o.title, artist, (o.culture ?? []).join(' '), o.technique, o.type, o.department, o.collection, o.creation_date].join(' | '),
    yearStart: num(o.creation_date_earliest),
    yearEnd: num(o.creation_date_latest),
    ok: Boolean(o.share_license_status === 'CC0' && web),
    record: {
      facts: {
        title: o.title || '',
        artist: artist || null,
        artist_bio: null,
        date: o.creation_date || null,
        culture: (o.culture ?? []).join(' / ') || null,
        medium: o.technique || null,
        dimensions: o.measurements || null,
        repository: 'The Cleveland Museum of Art',
        credit_line: o.creditline || null,
        object_url: o.url || null,
      },
      image: {
        thumb: web,
        large: o.images?.print?.url || web,
        license: 'CC0',
        credit: 'The Cleveland Museum of Art',
        source_url: o.url || null,
      },
      source: { name: 'Cleveland Museum of Art Open Access API', id: String(o.id), api_url: `${CMA}/${o.id}` },
    },
  };
}
export const cleveland = {
  async byId(id) {
    const r = await getJson(`${CMA}/${enc(id)}`);
    return cmaCandidate(r?.data);
  },
  async *search(q, max = 25) {
    const r = await getJson(`${CMA}/?q=${enc(q)}&has_image=1&cc0=1&limit=${max}`);
    for (const o of r?.data ?? []) {
      const c = cmaCandidate(o);
      if (c) yield c;
    }
  },
};

// ---------------- Smithsonian (任意：SI_API_KEY がある場合のみ) ----------------
const SI = 'https://api.si.edu/openaccess/api/v1.0';
function siCandidate(row) {
  const c = row?.content;
  if (!c) return null;
  const media = (c.descriptiveNonRepeating?.online_media?.media ?? []).find((m) => m.type === 'Images' && m.usage?.access === 'CC0');
  const ft = c.freetext ?? {};
  const pick = (k) => (ft[k] ?? []).map((x) => x.content).join('; ');
  const dates = c.indexedStructured?.date ?? [];
  const decade = dates.length ? parseInt(dates[0], 10) : null;
  const link = c.descriptiveNonRepeating?.record_link || c.descriptiveNonRepeating?.guid || null;
  const thumb = media ? `${media.content}&max=640` : null;
  return {
    source: 'smithsonian',
    sourceId: row.id,
    title: row.title || '',
    artist: pick('name'),
    all: [row.title, pick('name'), pick('date'), pick('place'), pick('objectType'), pick('physicalDescription'), c.descriptiveNonRepeating?.data_source].join(' | '),
    yearStart: Number.isFinite(decade) ? decade : null,
    yearEnd: Number.isFinite(decade) ? decade + 9 : null,
    ok: Boolean(media),
    record: {
      facts: {
        title: row.title || '',
        artist: pick('name') || null,
        artist_bio: null,
        date: pick('date') || null,
        culture: pick('place') || null,
        medium: pick('physicalDescription') || null,
        dimensions: null,
        repository: c.descriptiveNonRepeating?.data_source || 'Smithsonian Institution',
        credit_line: pick('creditLine') || null,
        object_url: link,
      },
      image: {
        thumb,
        large: media?.content ?? null,
        license: 'CC0',
        credit: c.descriptiveNonRepeating?.data_source || 'Smithsonian Institution',
        source_url: link,
      },
      source: { name: 'Smithsonian Open Access API', id: row.id, api_url: `${SI}/content/${row.id}` },
    },
  };
}
export const smithsonian = {
  enabled: () => Boolean(process.env.SI_API_KEY),
  async byId(id) {
    if (!this.enabled()) return null;
    const r = await getJson(`${SI}/content/${enc(id)}?api_key=${process.env.SI_API_KEY}`);
    return siCandidate(r?.response);
  },
  async *search(q, max = 25) {
    if (!this.enabled()) return;
    const r = await getJson(`${SI}/search?q=${enc(q)}&rows=${max}&api_key=${process.env.SI_API_KEY}`);
    for (const row of r?.response?.rows ?? []) {
      const c = siCandidate(row);
      if (c) yield c;
    }
  },
};

// ---------------- Wikidata + Wikimedia Commons（建築など） ----------------
const WD = 'https://www.wikidata.org/w/api.php';
const COMMONS = 'https://commons.wikimedia.org/w/api.php';
const claimVals = (e, p) => (e.claims?.[p] ?? []).filter((c) => c.mainsnak?.datavalue).map((c) => c.mainsnak.datavalue.value);
const label = (e, lang) => e?.labels?.[lang]?.value ?? null;

async function wdEntities(ids) {
  if (!ids.length) return {};
  const r = await getJson(`${WD}?action=wbgetentities&ids=${ids.join('|')}&props=labels|descriptions|claims|aliases&languages=ja|en&format=json`);
  return r?.entities ?? {};
}
function wdYear(v) {
  // v: { time: "+1632-00-00T00:00:00Z", precision }
  const m = /^([+-])0*(\d+)-/.exec(v?.time ?? '');
  if (!m) return null;
  const y = Number(m[2]) * (m[1] === '-' ? -1 : 1);
  return { year: y, precision: v.precision };
}
function wdDateText(d) {
  if (!d) return null;
  const { year, precision } = d;
  const bc = year < 0;
  const a = Math.abs(year);
  if (precision >= 9) return bc ? `紀元前${a}年` : `${a}年`;
  if (precision === 8) return bc ? `紀元前${a}年代` : `${a}年代`;
  if (precision === 7) {
    const c = Math.floor((a - 1) / 100) + 1;
    return bc ? `紀元前${c}世紀` : `${c}世紀`;
  }
  return bc ? `紀元前${a}年頃` : `${a}年頃`;
}
async function commonsImage(file, width) {
  const r = await getJson(`${COMMONS}?action=query&format=json&prop=imageinfo&iiprop=url|extmetadata&iiurlwidth=${width}&titles=${enc('File:' + file)}`);
  const page = Object.values(r?.query?.pages ?? {})[0];
  return page?.imageinfo?.[0] ?? null;
}
async function wdCandidate(e) {
  if (!e || e.missing !== undefined) return null;
  const img = claimVals(e, 'P18')[0];
  const hasCoord = claimVals(e, 'P625').length > 0;
  const inception = claimVals(e, 'P571').map(wdYear).filter(Boolean);
  const d = inception[0] ?? null;
  const en = label(e, 'en') ?? '';
  const desc = e.descriptions?.en?.value ?? '';
  const aliases = (e.aliases?.en ?? []).map((a) => a.value).join(' ');
  const cand = {
    source: 'wikidata',
    sourceId: e.id,
    title: [en, aliases].join(' '),
    artist: '',
    all: [en, aliases, desc, label(e, 'ja')].join(' | '),
    yearStart: d?.year ?? null,
    yearEnd: d?.year ?? null,
    ok: false,
    record: null,
    // record は ok 判定後に遅延生成（追加 API 呼び出しを節約）
    async build() {
      const refIds = [...claimVals(e, 'P84'), ...claimVals(e, 'P131').slice(0, 1), ...claimVals(e, 'P17').slice(0, 1)].map((v) => v.id);
      const refs = await wdEntities([...new Set(refIds)]);
      const lbl = (id) => label(refs[id], 'ja') ?? label(refs[id], 'en');
      const architects = claimVals(e, 'P84').map((v) => lbl(v.id)).filter(Boolean);
      const place = [claimVals(e, 'P131')[0], claimVals(e, 'P17')[0]].map((v) => v && lbl(v.id)).filter(Boolean);
      const thumb = await commonsImage(img, 500);
      const large = await commonsImage(img, 1920);
      const meta = large?.extmetadata ?? thumb?.extmetadata ?? {};
      const licenseName = stripHtml(meta.LicenseShortName?.value);
      const free = /public domain|cc0|cc by|cc-by|pd/i.test(licenseName);
      if (!thumb?.thumburl || !free) return false;
      this.ok = true;
      this.record = {
        title_ja_fact: label(e, 'ja'),
        facts: {
          title: en,
          artist: architects.length ? architects.join('、') : null,
          artist_bio: null,
          date: wdDateText(d),
          culture: null,
          medium: null,
          dimensions: null,
          repository: place.join('、') || null,
          credit_line: null,
          object_url: `https://www.wikidata.org/wiki/${e.id}`,
        },
        image: {
          thumb: thumb.thumburl,
          large: large?.thumburl || thumb.thumburl,
          license: licenseName,
          credit: stripHtml(meta.Artist?.value) || stripHtml(meta.Credit?.value) || 'Wikimedia Commons',
          source_url: thumb.descriptionurl,
        },
        source: { name: 'Wikidata / Wikimedia Commons', id: e.id, api_url: `https://www.wikidata.org/wiki/Special:EntityData/${e.id}.json` },
      };
      return true;
    },
  };
  cand.ok = Boolean(img && hasCoord);
  return cand;
}
export const wikidata = {
  async byId(id) {
    const ents = await wdEntities([id]);
    return wdCandidate(ents[id]);
  },
  async *search(q, max = 10) {
    const r = await getJson(`${WD}?action=query&list=search&format=json&srlimit=${max}&srsearch=${enc(q + ' haswbstatement:P18')}`);
    const ids = (r?.query?.search ?? []).map((s) => s.title).filter((t) => /^Q\d+$/.test(t));
    const ents = await wdEntities(ids);
    for (const id of ids) {
      const c = await wdCandidate(ents[id]);
      if (c) yield c;
    }
  },
};

export const SOURCES = { met, aic, cleveland, smithsonian, wikidata };
export const MUSEUMS = ['met', 'aic', 'cleveland'];
