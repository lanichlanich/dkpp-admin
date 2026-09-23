export type RetirementAgeInput = {
  position: string;
  positionType: string;
  echelon: string;
};

function normalize(value: string) {
  return value.trim().toUpperCase().replace(/\s+/g, " ");
}

/**
 * Calculates the retirement age from the employee's current position data.
 * Unknown position categories deliberately return null so they can be reviewed
 * instead of receiving an unsafe default value.
 */
export function getRetirementAge({ position, positionType, echelon }: RetirementAgeInput): number | null {
  const normalizedPosition = normalize(position);
  const normalizedType = normalize(positionType);
  const normalizedEchelon = normalize(echelon);

  // Position-specific statutory exceptions published by BKN.
  if (/\b(GURU BESAR|PROFESOR)\b/.test(normalizedPosition)) return 70;
  if (/\b(PENELITI|PEREKAYASA)\b/.test(normalizedPosition) && /\bAHLI UTAMA\b/.test(normalizedPosition)) return 70;
  if (/\b(PENELITI|PEREKAYASA)\b/.test(normalizedPosition) && /\bAHLI MADYA\b/.test(normalizedPosition)) return 65;
  if (/\bDOSEN\b/.test(normalizedPosition)) return 65;
  if (/\bGURU\b/.test(normalizedPosition)) return 60;

  if (["JPT", "PIMPINAN TINGGI", "JABATAN PIMPINAN TINGGI"].includes(normalizedType)) return 60;

  if (["JS", "STRUKTURAL", "JABATAN STRUKTURAL"].includes(normalizedType)) {
    // Eselon I dan II merupakan Jabatan Pimpinan Tinggi; eselon III dan IV
    // merupakan jabatan administrasi.
    return /^(I|II)(?:\.|\s|$)/.test(normalizedEchelon) ? 60 : 58;
  }

  if (["JF", "FUNGSIONAL", "JABATAN FUNGSIONAL"].includes(normalizedType)) {
    if (/\bAHLI UTAMA\b/.test(normalizedPosition)) return 65;
    if (/\bAHLI MADYA\b/.test(normalizedPosition)) return 60;
    if (/\b(AHLI PERTAMA|AHLI MUDA|PEMULA|TERAMPIL|MAHIR|PENYELIA)\b/.test(normalizedPosition)) return 58;
    return null;
  }

  if (["JFU", "PELAKSANA", "ADMINISTRASI", "JABATAN ADMINISTRASI"].includes(normalizedType)) return 58;

  return null;
}

export function formatRetirementAge(age: number | null) {
  return age === null ? "Perlu ditentukan" : `${age} Tahun`;
}

type DateParts = {
  year: number;
  month: number;
  day: number;
};

function getBirthDatePartsFromNip(nip: string): DateParts | null {
  const digits = nip.replace(/\D/g, "");
  if (digits.length < 8) return null;

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));

  if (
    date.getUTCFullYear() !== year
    || date.getUTCMonth() !== month - 1
    || date.getUTCDate() !== day
  ) {
    return null;
  }

  return { year, month, day };
}

export function getBirthDateIsoFromNip(nip: string): string | null {
  const birthDate = getBirthDatePartsFromNip(nip);
  if (!birthDate) return null;

  return `${birthDate.year}-${String(birthDate.month).padStart(2, "0")}-${String(birthDate.day).padStart(2, "0")}`;
}

/**
 * Returns the retirement effective date (TMT) as YYYY-MM-DD.
 * TMT is the first day of the month following the employee's retirement-age
 * birthday. The birth date is read from the first eight digits of the NIP.
 */
export function getRetirementTmt(nip: string, retirementAge: number | null): string | null {
  if (retirementAge === null || !Number.isInteger(retirementAge) || retirementAge < 0) return null;

  const birthDate = getBirthDatePartsFromNip(nip);
  if (!birthDate) return null;

  const retirementBirthdayYear = birthDate.year + retirementAge;
  const tmtMonth = birthDate.month === 12 ? 1 : birthDate.month + 1;
  const tmtYear = birthDate.month === 12 ? retirementBirthdayYear + 1 : retirementBirthdayYear;

  return `${tmtYear}-${String(tmtMonth).padStart(2, "0")}-01`;
}
