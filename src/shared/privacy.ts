import type {
  PrivacyDecision,
  PrivacyFinding,
  PrivacyFindingKind,
  StudentAlias,
} from './contracts';

interface FindingCandidate {
  kind: PrivacyFindingKind;
  label: string;
  value: string;
  replacement: string;
  start: number;
  end: number;
}

const privacyPatterns: Array<{
  kind: PrivacyFindingKind;
  label: string;
  replacement: string;
  pattern: RegExp;
  captureGroup?: number;
}> = [
  {
    kind: 'resident-number',
    label: '주민등록번호 형태',
    replacement: '[주민번호]',
    pattern: /(?<!\d)\d{6}[-\s]?[1-4]\d{6}(?!\d)/g,
  },
  {
    kind: 'phone',
    label: '전화번호',
    replacement: '[전화번호]',
    pattern: /(?<!\d)(?:01[016789][\s-]?\d{3,4}[\s-]?\d{4}|0\d{1,2}[\s-]?\d{3,4}[\s-]?\d{4})(?!\d)/g,
  },
  {
    kind: 'email',
    label: '이메일 주소',
    replacement: '[이메일]',
    pattern: /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,
  },
  {
    kind: 'address',
    label: '주소로 보이는 표현',
    replacement: '[주소]',
    pattern: /(?:주소|거주지)\s*[:：]\s*([^\n,]{4,80})/gi,
    captureGroup: 1,
  },
  {
    kind: 'account',
    label: '계정·계좌 정보로 보이는 표현',
    replacement: '[계정정보]',
    pattern: /(?:계좌(?:번호)?|아이디|ID|계정)\s*[:：]\s*([^\s,\n]{3,50})/gi,
    captureGroup: 1,
  },
];

export const getAcademicYear = (date = new Date()) =>
  date.getMonth() < 2 ? date.getFullYear() - 1 : date.getFullYear();

const lettersForIndex = (index: number) => {
  let remaining = index + 1;
  let result = '';
  while (remaining > 0) {
    remaining -= 1;
    result = String.fromCharCode(65 + (remaining % 26)) + result;
    remaining = Math.floor(remaining / 26);
  }
  return result;
};

export const createStudentAliasLabel = (index: number) => `학생 ${lettersForIndex(index)}`;

export const normalizeStudentName = (name: string) => name.trim().normalize('NFC');

export const inspectPrivacyContent = (
  content: string,
  aliases: Pick<StudentAlias, 'realName' | 'alias'>[],
) => {
  const candidates: FindingCandidate[] = [];

  for (const rule of privacyPatterns) {
    rule.pattern.lastIndex = 0;
    for (const match of content.matchAll(rule.pattern)) {
      const value = rule.captureGroup ? match[rule.captureGroup] : match[0];
      if (!value || match.index === undefined) {
        continue;
      }
      const offset = rule.captureGroup ? match[0].indexOf(value) : 0;
      const start = match.index + Math.max(offset, 0);
      candidates.push({
        kind: rule.kind,
        label: rule.label,
        value,
        replacement: rule.replacement,
        start,
        end: start + value.length,
      });
    }
  }

  for (const student of aliases) {
    const realName = normalizeStudentName(student.realName);
    if (realName.length < 2) {
      continue;
    }
    let start = content.indexOf(realName);
    while (start >= 0) {
      candidates.push({
        kind: 'student-name',
        label: '등록된 학생 이름',
        value: realName,
        replacement: student.alias,
        start,
        end: start + realName.length,
      });
      start = content.indexOf(realName, start + realName.length);
    }
  }

  const findings: PrivacyFinding[] = [];
  let occupiedUntil = -1;
  for (const candidate of candidates.sort((left, right) =>
    left.start - right.start || right.end - left.end,
  )) {
    if (candidate.start < occupiedUntil) {
      continue;
    }
    findings.push({
      ...candidate,
      id: `${candidate.kind}-${candidate.start}-${candidate.end}`,
    });
    occupiedUntil = candidate.end;
  }

  return findings;
};

export const applyPrivacyDecisions = (
  content: string,
  findings: PrivacyFinding[],
  decisions: PrivacyDecision[],
) => {
  const decisionsById = new Map(decisions.map((decision) => [decision.findingId, decision]));
  let result = content;

  for (const finding of [...findings].sort((left, right) => right.start - left.start)) {
    const decision = decisionsById.get(finding.id);
    if (!decision?.replace) {
      continue;
    }
    const replacement = decision.replacement.trim() || finding.replacement;
    result = `${result.slice(0, finding.start)}${replacement}${result.slice(finding.end)}`;
  }

  return result;
};
