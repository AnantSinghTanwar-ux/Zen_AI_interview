import { PDFParse } from 'pdf-parse';
import axios from 'axios';
import FormData from 'form-data';

type ParsedExperienceItem = {
  company?: string;
  role?: string;
};

type ParsedEducationItem = {
  degree?: string;
  institution?: string;
};

export interface ParsedResume {
  rawText: string;
  skills: string[];
  emails: string[];
  phones: string[];
  name: string | null;
  experience: ParsedExperienceItem[];
  education: ParsedEducationItem[];
}

interface ParseResumeOptions {
  filename?: string;
  mimeType?: string;
}

type PythonParserResponse = {
  name?: unknown;
  email?: unknown;
  skills?: unknown;
  experience?: unknown;
  education?: unknown;
};

const COMMON_SKILLS = [
  'JavaScript',
  'TypeScript',
  'React',
  'Node.js',
  'Python',
  'Java',
  'Go',
  'Rust',
  'SQL',
  'PostgreSQL',
  'MongoDB',
  'Redis',
  'Docker',
  'Kubernetes',
  'AWS',
  'GCP',
  'Azure',
  'Git',
  'GraphQL',
  'REST',
  'HTML',
  'CSS',
  'Tailwind',
  'Next.js',
  'Vue',
  'Angular',
  'Spring',
  'Django',
  'FastAPI',
  'C++',
  'C#',
  'Swift',
  'Kotlin',
  'Flutter',
  'Machine Learning',
  'TensorFlow',
  'PyTorch',
  'Pandas',
  'NumPy',
  'Cloud Security',
  'Penetration Testing',
  'IAM',
  'Zero Trust',
  'DevSecOps',
  'SIEM',
  'SOC',
  'Nmap',
  'Burp Suite',
  'OWASP',
  'Kali Linux',
  'Terraform',
  'Ansible',
  'Linux',
  'Bash',
  'PowerShell',
  'Jenkins',
  'CI/CD',
];

const normalizeLines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter(Boolean);

const sectionHeaders = {
  skills: ['skills', 'technical skills', 'technologies', 'tech stack', 'core competencies', 'tools'],
  experience: ['experience', 'work experience', 'professional experience', 'employment history', 'work history'],
  education: ['education', 'academic background', 'qualifications'],
};

const dateRangeRegex =
  /(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}\s*[-–to]{1,3}\s*((jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\s+\d{4}|present|current)/i;

const likelyExperienceLine = (line: string): boolean => {
  const lower = line.toLowerCase();
  if (dateRangeRegex.test(lower)) return true;
  if (/(engineer|developer|analyst|manager|intern|consultant|specialist)/i.test(lower)) return true;
  if (/\b(at|@)\b/.test(lower) && /[a-z]/i.test(lower)) return true;
  return false;
};

const findSection = (lines: string[], headers: string[], maxLines = 14): string[] => {
  const idx = lines.findIndex((line) => headers.some((h) => line.toLowerCase() === h));
  if (idx < 0) return [];

  const result: string[] = [];
  for (let i = idx + 1; i < lines.length && result.length < maxLines; i += 1) {
    const candidate = lines[i];
    const lower = candidate.toLowerCase();
    const isNextHeader =
      sectionHeaders.skills.includes(lower) ||
      sectionHeaders.experience.includes(lower) ||
      sectionHeaders.education.includes(lower);
    if (isNextHeader) break;
    result.push(candidate);
  }
  return result;
};

const uniqueNormalized = (values: string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(value);
  }
  return out;
};

export async function parseResume(buffer: Buffer, options: ParseResumeOptions = {}): Promise<ParsedResume> {
  return parseResumeWithFallback(buffer, options);
}

async function parseResumeWithFallback(buffer: Buffer, options: ParseResumeOptions): Promise<ParsedResume> {
  const parserUrl = process.env.PYTHON_RESUME_PARSER_URL;

  if (parserUrl) {
    try {
      const parsed = await parseResumeWithPython(buffer, parserUrl, options);
      return parsed;
    } catch (error) {
      const message =
        axios.isAxiosError(error)
          ? error.response?.data?.detail || error.message
          : error instanceof Error
            ? error.message
            : 'Unknown parser error';
      console.warn('Python resume parser failed, falling back to local parser:', message);
    }
  }

  return parseResumeLocal(buffer);
}

async function parseResumeWithPython(
  buffer: Buffer,
  parserUrl: string,
  options: ParseResumeOptions,
): Promise<ParsedResume> {
  const form = new FormData();
  const filename = options.filename || 'resume.pdf';
  form.append('file', buffer, {
    filename,
    contentType: options.mimeType || 'application/octet-stream',
  });

  const parserHeaders = form.getHeaders();
  if (process.env.PYTHON_RESUME_PARSER_API_KEY) {
    parserHeaders['X-API-Key'] = process.env.PYTHON_RESUME_PARSER_API_KEY;
  }

  const response = await axios.post<PythonParserResponse>(parserUrl, form, {
    headers: parserHeaders,
    timeout: Number(process.env.PYTHON_RESUME_PARSER_TIMEOUT_MS || 8000),
    maxBodyLength: Infinity,
  });

  const payload = response.data || {};
  const skills = Array.isArray(payload.skills)
    ? Array.from(
        new Set(
          payload.skills
            .filter((v): v is string => typeof v === 'string' && v.trim().length > 0)
            .map((v) => v.trim()),
        ),
      )
    : [];
  const email = typeof payload.email === 'string' ? payload.email.trim() : '';
  const name = typeof payload.name === 'string' ? payload.name.trim() : null;

  const experience: ParsedExperienceItem[] = [];
  if (Array.isArray(payload.experience)) {
    for (const item of payload.experience) {
      if (typeof item === 'string' && item.trim().length > 0) {
        experience.push({ role: item.trim() });
      } else if (item && typeof item === 'object') {
        const obj = item as {
          role?: unknown;
          company?: unknown;
          title?: unknown;
          total_years?: unknown;
          years?: unknown;
        };
        const role = typeof obj.role === 'string' ? obj.role.trim() : typeof obj.title === 'string' ? obj.title.trim() : '';
        const company = typeof obj.company === 'string' ? obj.company.trim() : '';
        const years =
          typeof obj.total_years === 'number'
            ? `${obj.total_years} years`
            : typeof obj.total_years === 'string'
              ? obj.total_years.trim()
              : typeof obj.years === 'number'
                ? `${obj.years} years`
                : typeof obj.years === 'string'
                  ? obj.years.trim()
                  : '';
        if (role || company) {
          experience.push({ role: role || undefined, company: company || undefined });
        } else if (years) {
          experience.push({ role: years });
        }
      }
    }
  } else if (typeof payload.experience === 'number' && Number.isFinite(payload.experience)) {
    experience.push({ role: `${payload.experience} years` });
  } else if (typeof payload.experience === 'string' && payload.experience.trim().length > 0) {
    experience.push({ role: payload.experience.trim() });
  }

  const education: ParsedEducationItem[] = [];
  if (Array.isArray(payload.education)) {
    for (const item of payload.education) {
      if (typeof item === 'string' && item.trim().length > 0) {
        education.push({ institution: item.trim() });
      } else if (item && typeof item === 'object') {
        const obj = item as {
          degree?: unknown;
          institution?: unknown;
          school?: unknown;
          university?: unknown;
          name?: unknown;
        };
        const degree = typeof obj.degree === 'string' ? obj.degree.trim() : '';
        const institution =
          typeof obj.institution === 'string'
            ? obj.institution.trim()
            : typeof obj.school === 'string'
              ? obj.school.trim()
              : typeof obj.university === 'string'
                ? obj.university.trim()
                : typeof obj.name === 'string'
                  ? obj.name.trim()
                  : '';
        if (degree || institution) {
          education.push({ degree: degree || undefined, institution: institution || undefined });
        }
      }
    }
  }

  return {
    rawText: '',
    skills,
    emails: email ? [email] : [],
    phones: [],
    name,
    experience,
    education,
  };
}

async function parseResumeLocal(buffer: Buffer): Promise<ParsedResume> {
  const parser = new PDFParse({ data: new Uint8Array(buffer) });
  const data = await parser.getText();
  await parser.destroy().catch(() => undefined);
  const text = data.text;
  const lines = normalizeLines(text);

  // Extract emails
  const emails = Array.from(
    new Set(
      (text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) ?? []) as string[],
    ),
  );

  // Extract phones
  const phones = [
    ...new Set(
      (text.match(/[\+]?[(]?[0-9]{3}[)]?[-\s.]?[0-9]{3}[-\s.]?[0-9]{4,6}/g) ?? []) as string[],
    ),
  ];

  // Extract skills (case-insensitive match against known skills list)
  const upperText = text.toUpperCase();
  const matchedCommonSkills = COMMON_SKILLS.filter((s) => upperText.includes(s.toUpperCase()));
  const skillSectionLines = findSection(lines, sectionHeaders.skills, 24);
  const sectionSkills = skillSectionLines
    .join(' | ')
    .split(/[|,;/•·]/)
    .map((s) => s.trim())
    .filter((s) => s.length >= 2 && s.length <= 40 && /[a-zA-Z]/.test(s));
  const inlineSkillMatches = Array.from(
    new Set(
      lines
        .filter((line) => /\b(skills?|technologies|tools)\b\s*:/i.test(line))
        .flatMap((line) =>
          line
            .split(':')
            .slice(1)
            .join(':')
            .split(/[|,;/•·]/)
            .map((s) => s.trim())
            .filter((s) => s.length >= 2 && s.length <= 40 && /[a-zA-Z]/.test(s)),
        ),
    ),
  );
  const skills = uniqueNormalized([...matchedCommonSkills, ...sectionSkills, ...inlineSkillMatches]).slice(0, 60);

  const experienceSectionLines = findSection(lines, sectionHeaders.experience, 30)
    .filter((line) => line.length >= 4 && line.length <= 140)
    .slice(0, 16);
  const inlineExperienceLines = lines
    .filter((line) => line.length >= 4 && line.length <= 140)
    .filter((line) => likelyExperienceLine(line))
    .slice(0, 12);
  const combinedExperience = uniqueNormalized([...experienceSectionLines, ...inlineExperienceLines]).slice(0, 18);
  const experience: ParsedExperienceItem[] = combinedExperience.map((line) => ({ role: line }));

  const educationSectionLines = findSection(lines, sectionHeaders.education, 15)
    .filter((line) => line.length >= 4 && line.length <= 120)
    .slice(0, 10);
  const education: ParsedEducationItem[] = educationSectionLines.map((line) => ({ institution: line }));

  // Try to extract name from first non-empty line under 50 chars
  const firstLine = text
    .split('\n')
    .find((l: string) => l.trim().length > 2 && l.trim().length < 50);
  const name = firstLine?.trim() || null;

  return { rawText: text, skills, emails, phones, name, experience, education };
}
