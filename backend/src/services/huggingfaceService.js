const axios = require('axios');

const HF_API = 'https://api-inference.huggingface.co/models';
const hasHFToken =
  !!process.env.HUGGINGFACE_API_TOKEN &&
  process.env.HUGGINGFACE_API_TOKEN !== 'hf_...' &&
  process.env.HUGGINGFACE_API_TOKEN.startsWith('hf_');

const hfHeaders = hasHFToken
  ? {
      Authorization: `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
      'Content-Type': 'application/json',
    }
  : null;

const categoriseDocument = async (text) => {
  const snippet = text.slice(0, 1500);
  const candidateLabels = [
    'financial report',
    'legal document',
    'research paper',
    'news article',
    'product documentation',
    'marketing content',
    'medical document',
    'academic paper',
    'business proposal',
    'personal letter',
    'technical specification',
  ];

  if (!hfHeaders) return fallbackCategorise(text);

  try {
    const response = await axios.post(
      `${HF_API}/facebook/bart-large-mnli`,
      {
        inputs: snippet,
        parameters: { candidate_labels: candidateLabels, multi_label: true },
      },
      { headers: hfHeaders, timeout: 30000 }
    );

    const results = response.data;
    const categories = results.labels
      .map((label, i) => ({ label, score: results.scores[i] }))
      .filter((item) => item.score > 0.25)
      .slice(0, 4)
      .map((item) => item.label);

    return categories.length > 0 ? categories : fallbackCategorise(text);
  } catch (err) {
    console.error('HuggingFace categorisation error:', err.message);
    return fallbackCategorise(text);
  }
};

const extractEntities = async (text) => {
  const snippet = text.slice(0, 512);

  if (!hfHeaders) return fallbackEntities(text);

  try {
    const response = await axios.post(
      `${HF_API}/dslim/bert-base-NER`,
      { inputs: snippet },
      { headers: hfHeaders, timeout: 30000 }
    );

    const typeMap = { PER: 'Person', ORG: 'Organization', LOC: 'Location', MISC: 'Topic' };
    const seen = new Set();
    const entities = [];

    for (const ent of response.data) {
      const label = ent.entity_group || ent.entity?.replace('B-', '').replace('I-', '');
      const value = ent.word?.replace(/^##/, '').trim();
      if (!value || seen.has(value)) continue;
      seen.add(value);
      entities.push({ type: typeMap[label] || label, value });
    }

    return entities.length > 0 ? entities.slice(0, 10) : fallbackEntities(text);
  } catch (err) {
    console.error('HuggingFace NER error:', err.message);
    return fallbackEntities(text);
  }
};

const fallbackCategorise = (text) => {
  const lower = text.toLowerCase();
  const categories = [];

  if (/revenue|profit|quarter|fiscal|earnings|retention|yoy/.test(lower)) categories.push('financial report');
  if (/whereas|hereinafter|liability|agreement|clause|party/.test(lower)) categories.push('legal document');
  if (/abstract|methodology|hypothesis|conclusion|experiment/.test(lower)) categories.push('research paper');
  if (/product|feature|specification|api|integration|release/.test(lower)) categories.push('technical specification');
  if (/customer|market|campaign|brand|conversion/.test(lower)) categories.push('marketing content');
  if (/proposal|roadmap|timeline|deliverable|stakeholder/.test(lower)) categories.push('business proposal');

  return categories.length > 0 ? categories.slice(0, 4) : ['general document'];
};

const fallbackEntities = (text) => {
  const entities = [];
  const seen = new Set();

  const addEntity = (type, value) => {
    if (!value) return;
    const trimmed = value.trim();
    const key = `${type}:${trimmed.toLowerCase()}`;
    if (!trimmed || seen.has(key)) return;
    seen.add(key);
    entities.push({ type, value: trimmed });
  };

  const dates = text.match(/\b(Q[1-4]\s*\d{4}|\d{4}|(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4})\b/g);
  if (dates) dates.slice(0, 4).forEach((date) => addEntity('Date', date));

  const metrics = text.match(/\b\d+(?:\.\d+)?%|\$\d[\d,]*(?:\.\d+)?[BMK]?\b/g);
  if (metrics) metrics.slice(0, 4).forEach((metric) => addEntity('Metric', metric));

  const people = text.match(/\b[A-Z][a-z]+ [A-Z][a-z]+\b/g);
  if (people) people.slice(0, 4).forEach((person) => addEntity('Person', person));

  const regions = text.match(/\b(?:North America|South America|Europe|Asia Pacific|APAC|EMEA|LATAM|United States|India|China|Germany|France|UK)\b/g);
  if (regions) regions.slice(0, 4).forEach((region) => addEntity('Region', region));

  const orgs = text.match(/\b[A-Z][A-Za-z]+(?:\s[A-Z][A-Za-z]+)*\s(?:Inc|Ltd|LLC|Corp|Corporation|Company)\b/g);
  if (orgs) orgs.slice(0, 3).forEach((org) => addEntity('Organization', org));

  return entities.slice(0, 10);
};

module.exports = { categoriseDocument, extractEntities };
