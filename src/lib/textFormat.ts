const CORPORATE_DESIGNATORS = new Set([
  'LLC', 'L.L.C.', 'LC', 'L.C.',
  'Inc', 'Inc.', 'Corp', 'Corp.', 'Ltd', 'Ltd.',
  'GP', 'LP', 'L.P.', 'LLP', 'L.L.P.', 'LLLP', 'L.L.L.P.',
  'PC', 'P.C.', 'PA', 'P.A.', 'PLLC', 'P.L.L.C.',
  'Chtd.', 'CHTD', 'SC', 'S.C.',
  'PBC', 'L3C', 'QSSS', 'SPV', 'SPAC', 'IBC',
]);

export function formatProperName(value: string): string {
  const endsWithSpace = value.endsWith(' ');
  const words = value.split(' ');

  return words
    .map((word, index) => {
      if (!word) return word;

      const isLastWord = index === words.length - 1;
      const isBeingTyped = isLastWord && !endsWithSpace;

      // Only match corporate designators on completed words (not while typing)
      const cleaned = word.replace(/[.,]/g, '').toUpperCase();
      if (cleaned.length >= 2 && !isBeingTyped) {
        for (const d of CORPORATE_DESIGNATORS) {
          if (d.replace(/[.,]/g, '').toUpperCase() === cleaned) {
            return d;
          }
        }
      }

      if (isBeingTyped) {
        return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
      }

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

export function formatProperNameFinal(value: string): string {
  return value.split(' ').map(word => {
    if (!word) return word;
    const cleaned = word.replace(/[.,]/g, '').toUpperCase();
    if (cleaned.length >= 2) {
      for (const d of CORPORATE_DESIGNATORS) {
        if (d.replace(/[.,]/g, '').toUpperCase() === cleaned) {
          return d;
        }
      }
    }
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

export function formatSentence(value: string): string {
  return value.replace(/(^\s*\w|[.!?]\s+\w)/g, char => char.toUpperCase());
}

export function formatEmail(value: string): string {
  return value.toLowerCase();
}
