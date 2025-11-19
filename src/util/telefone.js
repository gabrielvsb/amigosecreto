export function formatarTelefone(telefone) {
  if (!telefone && telefone !== 0) return null;
  const raw = String(telefone);
  let num = raw.replace(/\D/g, '');
  // Se for um número válido (com DDD) e não tiver DDI '55', adiciona.
  if (num.length >= 10 && !num.startsWith('55')) {
    num = '55' + num;
  }
  return num || null;
}
