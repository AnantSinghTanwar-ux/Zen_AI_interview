import { ResumeDeleteResult, ResumeListItem, ResumeModel } from '../models/resume.model';
import { ApplicantProfileModel } from '../models/applicantProfile.model';
import { StorageService } from './storage.service';
import { withTransaction } from '../utils/transaction';
import fs from 'fs/promises';
import path from 'path';
import { parseResume } from '../utils/resumeParser';

export interface ATSResult {
  score: number;
  missingKeywords: string[];
  semanticSimilarityScore: number;
  sectionScores: {
    skillsScore: number;
    experienceScore: number;
    educationScore: number;
  };
  keywordDensity: Record<string, number>;
  explanation: string;
  feedback: {
    missingSections: string[];
    weakAreas: string[];
    improvements: string[];
  };
  qualityScore: number;
  rolePrediction: string;
  experience: string;
}

export const ResumeService = {
  audit(event: string, payload: Record<string, unknown>) {
    console.info('[AUDIT]', event, payload);
  },

  async getUserResumes(userId: string): Promise<ResumeListItem[]> {
    return ResumeModel.findByUserId(userId);
  },

  async getDefaultResume(userId: string): Promise<ResumeListItem> {
    const resume = await ResumeModel.findDefaultByUserId(userId);
    if (!resume) {
      throw Object.assign(new Error('No default resume found'), {
        statusCode: 404,
        code: 'DEFAULT_RESUME_NOT_FOUND',
      });
    }

    const { user_id: _omitUserId, updated_at: _omitUpdatedAt, ...rest } = resume;
    return rest;
  },

  async getUserResumeById(userId: string, resumeId: string) {
    const [resume, profile] = await Promise.all([
      ResumeModel.findByUserAndId(userId, resumeId),
      ApplicantProfileModel.findByUserId(userId),
    ]);

    if (!resume) {
      throw Object.assign(new Error('Resume not found'), {
        statusCode: 404,
        code: 'RESUME_NOT_FOUND',
      });
    }

    let parsedFromFile: {
      name: string | null;
      skills: string[];
      experience: unknown[];
      education: unknown[];
    } = {
      name: null,
      skills: [],
      experience: [],
      education: [],
    };

    try {
      const buffer = await ResumeService.loadResumeFileBuffer(resume.file_url);
      const parsed = await parseResume(buffer, {
        filename: resume.file_name,
        mimeType: resume.mime_type || undefined,
      });

      parsedFromFile = {
        name: parsed.name,
        skills: Array.isArray(parsed.skills) ? parsed.skills : [],
        experience: Array.isArray(parsed.experience) ? parsed.experience : [],
        education: Array.isArray(parsed.education) ? parsed.education : [],
      };
    } catch (err) {
      console.warn('Failed to parse resume file for detail view, falling back to profile data:', err);
    }

    const fallbackExperience = Array.isArray(profile?.experience) ? profile.experience : [];
    const fallbackEducation = Array.isArray(profile?.education) ? profile.education : [];
    const fallbackSkills = Array.isArray(profile?.skills) ? profile.skills : [];
    const fallbackName = profile?.name ?? null;

    return {
      ...resume,
      parsed: {
        name: parsedFromFile.name ?? fallbackName,
        skills: parsedFromFile.skills.length > 0 ? parsedFromFile.skills : fallbackSkills,
        experience: parsedFromFile.experience.length > 0 ? parsedFromFile.experience : fallbackExperience,
        education: parsedFromFile.education.length > 0 ? parsedFromFile.education : fallbackEducation,
      },
    };
  },

  async getResumeTextForUserResume(userId: string, resumeId: string): Promise<string> {
    const resume = await ResumeModel.findByUserAndId(userId, resumeId);
    if (!resume) {
      throw Object.assign(new Error('Resume not found'), {
        statusCode: 404,
        code: 'RESUME_NOT_FOUND',
      });
    }

    const buffer = await ResumeService.loadResumeFileBuffer(resume.file_url);
    const lowerName = (resume.file_name || '').toLowerCase();
    const mime = (resume.mime_type || '').toLowerCase();

    if (mime.includes('pdf') || lowerName.endsWith('.pdf')) {
      const pdfParse = require('pdf-parse');
      const parsedPdf = await pdfParse(buffer);
      const text = String(parsedPdf?.text || '').trim();
      if (text) return text;
    }

    const parsed = await parseResume(buffer, {
      filename: resume.file_name,
      mimeType: resume.mime_type || undefined,
    });

    const parsedText = [
      parsed.rawText,
      parsed.name || '',
      Array.isArray(parsed.skills) ? parsed.skills.join(', ') : '',
      Array.isArray(parsed.experience)
        ? parsed.experience
            .map((item) => [item.role || '', item.company || ''].filter(Boolean).join(' at '))
            .join('\n')
        : '',
      Array.isArray(parsed.education)
        ? parsed.education
            .map((item) => [item.degree || '', item.institution || ''].filter(Boolean).join(' - '))
            .join('\n')
        : '',
    ]
      .filter(Boolean)
      .join('\n\n')
      .trim();

    return parsedText;
  },

  async loadResumeFileBuffer(fileUrl: string): Promise<Buffer> {
    if (!fileUrl) {
      throw Object.assign(new Error('Resume file URL missing'), {
        statusCode: 400,
        code: 'RESUME_URL_MISSING',
      });
    }

    if (fileUrl.startsWith('/uploads/')) {
      const relativePath = fileUrl.replace(/^\/+/, '');
      const fullPath = path.join(__dirname, '../../', relativePath);
      return fs.readFile(fullPath);
    }

    const response = await fetch(fileUrl);
    if (response.ok) {
      const arrayBuffer = await response.arrayBuffer();
      return Buffer.from(arrayBuffer);
    }

    throw Object.assign(new Error('Failed to download resume file'), {
      statusCode: 502,
      code: 'RESUME_FILE_FETCH_FAILED',
      details: {
        storedUrl: fileUrl,
        lastStatus: response.status,
      },
    });
  },

  async setDefaultResume(userId: string, resumeId: string): Promise<ResumeListItem> {
    const resume = await withTransaction(async (client) => {
      return ResumeModel.setDefaultResume(userId, resumeId, client);
    });
    ResumeService.audit('resume.set_default', { userId, resumeId, newDefaultId: resume.id });
    return resume;
  },

  async deleteResume(userId: string, resumeId: string): Promise<Omit<ResumeDeleteResult, 'deletedUrl'>> {
    const result = await withTransaction(async (client) => {
      return ResumeModel.deleteResume(userId, resumeId, client);
    });

    await StorageService.deleteByUrl(result.deletedUrl).catch(() => undefined);

    const { deletedUrl: _omit, ...rest } = result;
    ResumeService.audit('resume.delete', {
      userId,
      deletedId: result.deletedId,
      reassignedDefaultId: result.newDefault?.id ?? null,
    });
    return rest;
  },

  async scoreATS(resumeText: string, jobDescription: string): Promise<ATSResult> {
    const defaultFail: ATSResult = {
      score: 0,
      missingKeywords: [],
      semanticSimilarityScore: 0,
      sectionScores: { skillsScore: 0, experienceScore: 0, educationScore: 0 },
      keywordDensity: {},
      explanation: "Analysis failed or missing data.",
      feedback: { missingSections: [], weakAreas: [], improvements: [] },
      qualityScore: 0,
      rolePrediction: "Unknown",
      experience: "Unknown"
    };

    if (!resumeText || !jobDescription) return defaultFail;

    try {
      const natural = require('natural');
      const sw = require('stopword');

      const tokenizer = new natural.WordTokenizer();
      const originalWordMap: Record<string, string> = {};
      
      const tokenizeAndClean = (text: string) => {
        const cleanText = text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ');
        const tokens = tokenizer.tokenize(cleanText) || [];
        const noStopWords = sw.removeStopwords(tokens);
        return noStopWords.map((word: string) => {
          const stem = natural.PorterStemmer.stem(word);
          if (!originalWordMap[stem] || originalWordMap[stem].length > word.length) {
            originalWordMap[stem] = word;
          }
          return stem;
        });
      };

      const jobTokens = tokenizeAndClean(jobDescription);
      const resumeTokens = tokenizeAndClean(resumeText);

      const TfIdf = natural.TfIdf;
      const tfidf = new TfIdf();
      tfidf.addDocument(jobTokens);
      tfidf.addDocument(resumeTokens);

      let dotProduct = 0;
      let jobNorm = 0;
      let resumeNorm = 0;

      const terms = Array.from(new Set([...jobTokens, ...resumeTokens]));
      const vecJob: Record<string, number> = {};
      
      terms.forEach(term => {
        const jTf = tfidf.tfidf(term, 0); 
        const rTf = tfidf.tfidf(term, 1); 
        vecJob[term] = jTf;
        dotProduct += jTf * rTf;
        jobNorm += jTf * jTf;
        resumeNorm += rTf * rTf;
      });

      const similarity = (jobNorm === 0 || resumeNorm === 0) ? 0 : dotProduct / (Math.sqrt(jobNorm) * Math.sqrt(resumeNorm));
      const semanticSimilarityScore = similarity > 0 ? Math.min(Math.log10(1 + similarity * 9) * 100, 100) : 0;
      const score = Math.round(semanticSimilarityScore);

      const missingKeywords: string[] = [];
      const jobTermsWithWeights = jobTokens.map((term: string) => ({ term, weight: vecJob[term] }));
      jobTermsWithWeights.sort((a: any, b: any) => b.weight - a.weight); 
      const uniqueJobTerms = Array.from(new Set(jobTermsWithWeights.map((t: any) => t.term))) as string[];
      
      for (const term of uniqueJobTerms) {
        if (!resumeTokens.includes(term) && originalWordMap[term] && originalWordMap[term].length > 2) {
          missingKeywords.push(originalWordMap[term]);
        }
      }

      const MathBase: ATSResult = {
        score: isNaN(score) ? 0 : Math.min(Math.max(score, 0), 100),
        missingKeywords: missingKeywords.slice(0, 10),
        semanticSimilarityScore: Math.round(semanticSimilarityScore),
        sectionScores: { skillsScore: 50, experienceScore: 50, educationScore: 50 },
        keywordDensity: {},
        explanation: "Analyzed purely mathematically using Cosine Similarity.",
        feedback: { missingSections: [], weakAreas: [], improvements: [] },
        qualityScore: 50,
        rolePrediction: "Analysis in progress",
        experience: "Unknown"
      };

      if (!process.env.OPENAI_API_KEY) {
        console.warn('No OPENAI API KEY, returning math-only results.');
        return MathBase;
      }

      try {
        const prompt = `You are a strict, senior technical recruiter AI parsing a resume string against a job description.
        You must output ONLY valid JSON without any markdown formatting.
        Analyze the exact raw resume text and job description provided below.
        
        Calculate based exactly on real industry expectations:
        1. sectionScores: out of 100 for skills, experience, and education.
        2. keywordDensity: top 3 most repeated tech skill keywords and their frequencies in the resume.
        3. explanation: highly specific 2-sentence rationale for the overall resume strength compared to the job description.
        4. feedback: { "missingSections": [], "weakAreas": [], "improvements": ["Actionable suggestion 1", "Suggestion 2"] }
        5. qualityScore: 0 to 100 purely based on grammar, wording, length optimization, and detail. Deduct heavily for duplicate filler content.
        6. rolePrediction: The best job title the candidate actually deserves based solely on the resume.
        7. experience: Calculate total years/months from chronological dates found in the resume (e.g. "5 Years 2 Months"). Return "0 Years" if none found.

        Resume Text: "${resumeText.substring(0, 3000)}"
        Job Description: "${jobDescription.substring(0, 1500)}"
        
        JSON schema required:
        {
          "sectionScores": { "skillsScore": number, "experienceScore": number, "educationScore": number },
          "keywordDensity": { "keywordString": number },
          "explanation": string,
          "feedback": { "missingSections": [string], "weakAreas": [string], "improvements": [string] },
          "qualityScore": number,
          "rolePrediction": string,
          "experience": string
        }`;

        const response = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            temperature: 0.1,
            response_format: { type: 'json_object' },
            messages: [{ role: 'system', content: prompt }]
          })
        });

        const data: any = await response.json();
        
        // Use Type Assertion to cleanly extract
        const p = JSON.parse(data.choices[0].message.content) as any;

        return {
          score: MathBase.score,
          missingKeywords: MathBase.missingKeywords,
          semanticSimilarityScore: MathBase.semanticSimilarityScore,
          sectionScores: p.sectionScores || MathBase.sectionScores,
          keywordDensity: p.keywordDensity || {},
          explanation: p.explanation || MathBase.explanation,
          feedback: p.feedback || MathBase.feedback,
          qualityScore: p.qualityScore || MathBase.qualityScore,
          rolePrediction: p.rolePrediction || MathBase.rolePrediction,
          experience: p.experience || MathBase.experience
        };

      } catch (llmError) {
        console.error('LLM ATS Analysis failed, falling back to Math:', llmError);
        return MathBase;
      }

    } catch (error) {
      console.error('NLP Error in scoreATS:', error);
      return defaultFail;
    }
  },
};
