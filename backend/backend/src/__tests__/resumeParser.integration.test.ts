import http from 'http';
import { AddressInfo } from 'net';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';
import { parseResume } from '../utils/resumeParser';

describe('resume parser integration (backend -> python parser endpoint)', () => {
  let server: http.Server;
  let parserUrl: string;
  const originalParserUrl = process.env.PYTHON_RESUME_PARSER_URL;
  const originalParserApiKey = process.env.PYTHON_RESUME_PARSER_API_KEY;

  beforeAll(async () => {
    server = http.createServer((req, res) => {
      if (req.method !== 'POST' || req.url !== '/parse') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ message: 'Not found' }));
        return;
      }

      // Validate backend forwards optional parser auth header.
      if (req.headers['x-api-key'] !== 'test-parser-key') {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ detail: 'Invalid parser API key' }));
        return;
      }

      const chunks: Buffer[] = [];
      req.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      req.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf8');
        // Ensure multipart payload from backend reached parser endpoint.
        expect(body).toContain('Content-Disposition: form-data; name="file"; filename="resume.pdf"');

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            name: 'Parser Candidate',
            email: 'candidate@example.com',
            skills: ['TypeScript', 'Node.js'],
            experience: [{ role: 'Backend Engineer', company: 'Jobyt' }],
            education: [{ degree: 'B.Tech', institution: 'ABC University' }],
          }),
        );
      });
    });

    await new Promise<void>((resolve) => {
      server.listen(0, '127.0.0.1', () => resolve());
    });

    const address = server.address() as AddressInfo;
    parserUrl = `http://127.0.0.1:${address.port}/parse`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve, reject) => {
      server.close((err) => (err ? reject(err) : resolve()));
    });

    if (originalParserUrl === undefined) {
      delete process.env.PYTHON_RESUME_PARSER_URL;
    } else {
      process.env.PYTHON_RESUME_PARSER_URL = originalParserUrl;
    }

    if (originalParserApiKey === undefined) {
      delete process.env.PYTHON_RESUME_PARSER_API_KEY;
    } else {
      process.env.PYTHON_RESUME_PARSER_API_KEY = originalParserApiKey;
    }
  });

  it('parses resume data through configured parser endpoint', async () => {
    process.env.PYTHON_RESUME_PARSER_URL = parserUrl;
    process.env.PYTHON_RESUME_PARSER_API_KEY = 'test-parser-key';

    const fakePdf = Buffer.from('%PDF-1.4 fake pdf content');
    const parsed = await parseResume(fakePdf, {
      filename: 'resume.pdf',
      mimeType: 'application/pdf',
    });

    expect(parsed.name).toBe('Parser Candidate');
    expect(parsed.emails).toEqual(['candidate@example.com']);
    expect(parsed.skills).toEqual(['TypeScript', 'Node.js']);
    expect(parsed.experience).toHaveLength(1);
    expect(parsed.education).toHaveLength(1);
  });
});
