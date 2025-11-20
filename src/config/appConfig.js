import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CONFIG_DIR = path.join(__dirname);
const CONFIG_PATH = path.join(CONFIG_DIR, 'app.config.json');

const DEFAULTS = {
  testMessageTemplate: '🤖 *Teste de Conexão - Amigo Secreto*\n\nOlá *{{nome}}*, este é um teste de verificação de número. Por favor, *responda OK* para confirmar que seu número está correto no sistema.',
  // Mantém o mesmo texto padrão atual (src/util/mensagem.js) porém parametrizado
  drawMessageTemplate: '*AMIGO SECRETO 2023 teste*\n\nOlá *{{participante}}*, o seu amigo secreto é: {{amigo}}. \n\n*Essa é uma mensagem automtática*'
};

function ensureConfigFile() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) {
      fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2), 'utf-8');
    }
  } catch (_) {
    // Silencia erros de criação; usaremos defaults em memória
  }
}

export function getTestMessageTemplate() {
  try {
    ensureConfigFile();
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const json = JSON.parse(raw);
    return (json && typeof json.testMessageTemplate === 'string' && json.testMessageTemplate.trim() !== '')
      ? json.testMessageTemplate
      : DEFAULTS.testMessageTemplate;
  } catch (e) {
    return DEFAULTS.testMessageTemplate;
  }
}

export function setTestMessageTemplate(template) {
  const safe = (typeof template === 'string' && template.trim() !== '')
    ? template
    : DEFAULTS.testMessageTemplate;
  let data = { ...DEFAULTS };
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      data = { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch (_) {}

  data.testMessageTemplate = safe;

  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

export function getDrawMessageTemplate() {
  try {
    ensureConfigFile();
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    const json = JSON.parse(raw);
    return (json && typeof json.drawMessageTemplate === 'string' && json.drawMessageTemplate.trim() !== '')
      ? json.drawMessageTemplate
      : DEFAULTS.drawMessageTemplate;
  } catch (e) {
    return DEFAULTS.drawMessageTemplate;
  }
}

export function setDrawMessageTemplate(template) {
  const safe = (typeof template === 'string' && template.trim() !== '')
    ? template
    : DEFAULTS.drawMessageTemplate;
  let data = { ...DEFAULTS };
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
      data = { ...DEFAULTS, ...JSON.parse(raw) };
    }
  } catch (_) {}

  data.drawMessageTemplate = safe;

  try {
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(data, null, 2), 'utf-8');
    return true;
  } catch (e) {
    return false;
  }
}

export function renderTemplate(template, context) {
  // Substitui chaves simples {{chave}}
  let output = template || '';
  const map = context || {};
  output = output.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key) => {
    const val = map[key];
    return (val === undefined || val === null) ? '' : String(val);
  });
  return output;
}
