/**
 * PHASE 1/5 — company content extraction.
 *
 * Handles the structures the generic page walker cannot model: the jumbotron
 * page headers (the only place the source carries a real per-page title and
 * description), the history timeline, the global network, office locations and
 * the PR video library.
 *
 * Copy is preserved verbatim. Only markup is normalised.
 */
import fs from 'node:fs/promises';
import * as cheerio from 'cheerio';
import { ORIGIN, get } from './lib/fetcher.mjs';

const EXTRACTED_AT = new Date().toISOString().slice(0, 10);
const oneLine = (s) => (s ?? '').replace(/ /g, ' ').replace(/\s+/g, ' ').trim();

function normalizeAsset(raw) {
  if (!raw) return null;
  let u = raw.trim();
  if (u.startsWith('//')) u = 'https:' + u;
  else if (u.startsWith('/')) u = ORIGIN + u;
  u = u.replace(/^http:\/\//i, 'https://').replace(/(https:\/\/[^/]+)\/{2,}/, '$1/');
  return u;
}

function bgUrl(style) {
  const m = /background-image\s*:\s*url\(\s*(['"]?)([^'")\s]+)/i.exec(style || '');
  return m ? normalizeAsset(m[2]) : null;
}

/** Text that is Korean-only is untranslated leakage on the English site. */
const isKorean = (s) => /[ㄱ-ㆎ가-힣]/.test(s || '');

/** Multi-line WYSIWYG HTML -> array of paragraph strings, de-duplicated. */
function htmlToParagraphs(html) {
  if (!html) return [];
  const $ = cheerio.load(`<div id="r">${html}</div>`);
  $('#r br').replaceWith('\n');
  const out = [];
  const push = (t) => {
    for (const line of (t || '').split('\n').map(oneLine)) if (line.length > 1) out.push(line);
  };
  const nodes = $('#r div, #r p');
  if (nodes.length) nodes.each((_, el) => push($(el).clone().children('div,p').remove().end().text()));
  else push($('#r').text());
  const seen = new Set();
  return out.filter((p) => !seen.has(p) && seen.add(p));
}

/* ------------------------------------------------------------------ */

/**
 * Every section page carries its real subject in `.jumbotron-header h2.title`
 * and a human summary in `p.title-desc`, while `<title>` is the constant
 * "GLOBAL NONGSHIM" (finding, §7). This is the honest source for per-page
 * titles and meta descriptions — no copy is invented.
 */
function extractHeader($) {
  const jt = $('.jumbotron-header, .board-header').first();
  if (!jt.length) return null;
  const hero = bgUrl(jt.find('.wrap, .header-img').attr('style'));
  const descEl = jt.find('.title-desc').first();
  // The source's title-desc contains <br class="hidden-desktop"> style tags;
  // strip any tag, not just bare <br>, so no markup leaks into a description.
  const desc = descEl.length ? oneLine((descEl.html() ?? '').replace(/<[^>]+>/g, ' ')) : null;
  return {
    heading: oneLine(jt.find('h2, h1').first().text()) || null,
    description: desc || null,
    heroImage: hero,
  };
}

async function extractHeaders(paths) {
  const out = {};
  for (const p of paths) {
    const res = await get(ORIGIN + p);
    if (res.status !== 200) continue;
    const $ = cheerio.load(res.body);
    const h = extractHeader($);
    if (h?.heading) out[p] = h;
  }
  return out;
}

/* ------------------------------------------------------------------ */

async function extractHistory() {
  const res = await get(`${ORIGIN}/about/history`);
  const $ = cheerio.load(res.body);
  const eras = [];

  $('.history-view-item').each((_, era) => {
    const $era = $(era);
    const entries = [];
    let currentYear = null;

    $era.find('.timeline-item').each((_, ti) => {
      const $ti = $(ti);
      const eraLabel = oneLine($ti.find('.year').first().text());
      const yearLabel = oneLine($ti.find('.year-sub').first().text());
      if (yearLabel) currentYear = yearLabel;

      $ti.find('.month-item').each((_, mi) => {
        const $mi = $(mi);
        const month = oneLine($mi.find('.month').first().text());
        $mi.find('.issue-item').each((_, ii) => {
          const $ii = $(ii);
          const caption = oneLine($ii.find('.caption').text());
          if (!caption || isKorean(caption)) return;
          const img = normalizeAsset($ii.find('img').attr('src')) || bgUrl($ii.find('.thumb').attr('style'));
          entries.push({
            era: eraLabel || null,
            year: currentYear,
            month: /^\d{1,2}$/.test(month) ? month.padStart(2, '0') : null,
            caption,
            image: img,
          });
        });
      });
    });

    if (entries.length) {
      eras.push({
        id: $era.attr('id') ?? null,
        label: entries[0].era,
        entries,
      });
    }
  });

  return {
    ...extractHeader($),
    eras,
    provenance: {
      sourceUrls: [`${ORIGIN}/about/history`],
      sourceChecked: EXTRACTED_AT,
      transformation: 'structure-only: timeline DOM flattened to year/month/caption records; untranslated Korean entries omitted',
    },
  };
}

/* ------------------------------------------------------------------ */

async function extractGlobalNetwork() {
  const res = await get(`${ORIGIN}/about/globalNongshim`);
  const $ = cheerio.load(res.body);
  const subsidiaries = [];

  // #network_01 groups four China subsidiaries in nested `.item` blocks; the
  // remaining regions put their `<dl>` directly on the `.network-item`.
  $('.network-item').each((_, ni) => {
    const $ni = $(ni);
    const nested = $ni.children('.item');
    const blocks = nested.length ? nested.toArray() : [ni];
    for (const item of blocks) {
      const $item = $(item);
      const name = oneLine($item.children('dl').find('dt').first().text());
      if (!name) continue;
      const dd = $item.children('dl').find('dd').first();
      const lead = oneLine(dd.find('strong').first().text());
      const body = dd
        .find('p')
        .map((_, p) => oneLine($(p).text()))
        .get()
        .filter((t) => t && !isKorean(t));

      const images = $item
        .find('.swiper-item')
        .map((_, s) => bgUrl($(s).attr('style')))
        .get()
        .filter(Boolean);

      const links = $item
        .find('.network-info a[href]')
        .map((_, a) => {
          const href = $(a).attr('href');
          const label = oneLine($(a).text());
          return href && !href.startsWith('javascript') ? { href, label: isKorean(label) ? null : label } : null;
        })
        .get()
        .filter(Boolean);

      subsidiaries.push({
        id: $item.attr('id') ?? $ni.attr('id') ?? null,
        name,
        lead: lead || null,
        body,
        images: [...new Set(images)],
        links,
      });
    }
  });

  // Address / Tel pairs live in a separate definition list further down.
  const contacts = [];
  $('#content-block dl').each((_, dl) => {
    const $dl = $(dl);
    const pairs = {};
    $dl.find('dt').each((_, dt) => {
      const k = oneLine($(dt).text()).toLowerCase();
      const v = oneLine($(dt).next('dd').text());
      if (k && v) pairs[k] = v;
    });
    if (pairs.address || pairs.tel) contacts.push(pairs);
  });

  return {
    ...extractHeader($),
    subsidiaries,
    contacts,
    provenance: {
      sourceUrls: [`${ORIGIN}/about/globalNongshim`],
      sourceChecked: EXTRACTED_AT,
      transformation: 'structure-only; untranslated Korean strings omitted',
    },
  };
}

/* ------------------------------------------------------------------ */

async function extractOffices() {
  const res = await get(`${ORIGIN}/contact/location`);
  const $ = cheerio.load(res.body);
  const offices = [];

  $('.factory-item').each((_, el) => {
    const $el = $(el);
    const name = oneLine($el.find('.heading h2, .heading h3').first().text());
    if (!name) return;
    const phoneEl = $el.find('.phone-number').first();
    const phoneNote = oneLine(phoneEl.find('span').text());
    const phone = oneLine(phoneEl.clone().children('span').remove().end().text());
    const mapSrc = $el.find('iframe').attr('src') ?? null;
    offices.push({
      id: $el.attr('id') ?? null,
      name,
      address: oneLine($el.find('.address').first().text()) || null,
      phone: phone || null,
      phoneNote: phoneNote || null,
      image: bgUrl($el.find('.img-container').attr('style')),
      mapEmbed: mapSrc,
    });
  });

  return {
    ...extractHeader($),
    offices,
    provenance: {
      sourceUrls: [`${ORIGIN}/contact/location`],
      sourceChecked: EXTRACTED_AT,
      transformation: 'structure-only: office cards normalised to JSON',
    },
  };
}

/* ------------------------------------------------------------------ */

/** The PR video library is served as JSON; use it directly. */
async function extractVideos() {
  const videos = [];
  for (let page = 1; page <= 20; page++) {
    const res = await get(`${ORIGIN}/pr/ajax.indexList?page=${page}&tabType=`);
    let rows;
    try {
      rows = JSON.parse(res.body);
    } catch {
      break;
    }
    if (!Array.isArray(rows) || !rows.length) break;
    for (const row of rows) {
      if (row.viewYn !== 'Y' || row.isYoutube !== 'Y' || !row.linkUrl) continue;
      const title = oneLine(row.enTitle || '');
      if (!title || isKorean(title)) continue;
      videos.push({
        id: String(row.groupId),
        title,
        youtubeId: row.linkUrl,
        transcript: htmlToParagraphs(row.enSubtitle).filter((t) => !isKorean(t)),
        publishedAt: row.regDate ? row.regDate.slice(0, 10) : null,
      });
    }
    if (rows.length < 9) break;
  }
  const seen = new Set();
  const unique = videos.filter((v) => !seen.has(v.id) && seen.add(v.id));
  const header = extractHeader(cheerio.load((await get(`${ORIGIN}/pr/tv`)).body));
  return {
    ...header,
    videos: unique,
    provenance: {
      sourceUrls: [`${ORIGIN}/pr/tv`, `${ORIGIN}/pr/ajax.indexList`],
      sourceChecked: EXTRACTED_AT,
      transformation: 'structure-only: public JSON list consumed directly; untranslated Korean records omitted',
    },
  };
}

/* ------------------------------------------------------------------ */

async function main() {
  const pages = JSON.parse(await fs.readFile('data/pages.json', 'utf8'));
  await fs.mkdir('data', { recursive: true });

  console.log('-> page headers');
  const headers = await extractHeaders(pages.map((p) => p.path));
  await fs.writeFile('data/page-headers.json', JSON.stringify(headers, null, 2));
  console.log(`   ${Object.keys(headers).length} headers with a real heading`);
  console.log(`   ${Object.values(headers).filter((h) => h.description).length} carry a description`);

  console.log('-> history timeline');
  const history = await extractHistory();
  await fs.writeFile('data/history.json', JSON.stringify(history, null, 2));
  console.log(`   ${history.eras.length} eras, ${history.eras.reduce((n, e) => n + e.entries.length, 0)} entries`);

  console.log('-> global network');
  const global = await extractGlobalNetwork();
  await fs.writeFile('data/global-network.json', JSON.stringify(global, null, 2));
  console.log(`   ${global.subsidiaries.length} subsidiaries, ${global.contacts.length} contact blocks`);

  console.log('-> office locations');
  const offices = await extractOffices();
  await fs.writeFile('data/offices.json', JSON.stringify(offices, null, 2));
  console.log(`   ${offices.offices.length} offices`);

  console.log('-> PR video library');
  const videos = await extractVideos();
  await fs.writeFile('data/videos.json', JSON.stringify(videos, null, 2));
  console.log(`   ${videos.videos.length} videos (${videos.videos.filter((v) => v.transcript.length).length} with transcript)`);
}

main();
