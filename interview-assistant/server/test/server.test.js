import request from 'supertest';
import { expect } from 'chai';
import sinon from 'sinon';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';


import app from '../server.js'; 

import { geminiService } from '../route.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../uploads');

describe('POST /process-documents', () => {
  let askGeminiStub;

  beforeEach(() => {
    // Stub the askGemini function before each test
    askGeminiStub = sinon.stub(geminiService, 'askGemini');

    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Restore the original function after each test
    askGeminiStub.restore();

    // Clean up files in the uploads directory
    fs.readdirSync(uploadsDir).forEach(file => {
      try {
        fs.unlinkSync(path.join(uploadsDir, file));
      } catch (err) {
        // Ignore errors if file already deleted or not accessible
        console.error(`Error cleaning up file ${file}:`, err.message);
      }
    });
  });

  it('should process resume and job description and return questions', async () => {
    const mockQuestions = [
      "Generated question 1 based on PDF and JD?",
      "Generated question 2 based on PDF and JD?"
    ];
    const llmResponseText = mockQuestions.map(q => `QUESTION: ${q}`).join('\n');
    askGeminiStub.resolves(llmResponseText);

    // Create a simple buffer for the PDF (content doesn't matter much as askGemini is stubbed)
    // Making it slightly more PDF-like by having PDF header.
    const resumeBuffer = Buffer.from('%PDF-1.4\n%Test PDF content'); 
    const jobDescriptionBuffer = Buffer.from('This is a test job description.');

    const response = await request(app)
      .post('/process-documents')
      .attach('resume', resumeBuffer, { filename: 'test_resume.pdf', contentType: 'application/pdf' })
      .attach('jobDescription', jobDescriptionBuffer, { filename: 'test_jd.txt', contentType: 'text/plain' });

    expect(response.status).to.equal(200);
    expect(response.body).to.be.an('object');
    expect(response.body.type).to.equal('initial_questions');
    expect(response.body.questions).to.deep.equal(mockQuestions);
    expect(askGeminiStub.calledOnce).to.be.true;

    // Verify the structure of the call to askGemini
    const expectedCallArgs = askGeminiStub.firstCall.args[0];
    expect(expectedCallArgs).to.be.an('object');
    expect(expectedCallArgs.contents).to.be.an('array').with.lengthOf(1);
    expect(expectedCallArgs.contents[0].parts).to.be.an('array').with.lengthOf(2);

    // Check the text part (main prompt + job description)
    const textPart = expectedCallArgs.contents[0].parts[0];
    expect(textPart.text).to.include('Based on the provided resume (which is a PDF document) and the job description');
    expect(textPart.text).to.include(jobDescriptionBuffer.toString());

    // Check the inlineData part (PDF)
    const pdfPart = expectedCallArgs.contents[0].parts[1];
    expect(pdfPart.inlineData.mimeType).to.equal('application/pdf');
    expect(pdfPart.inlineData.data).to.equal(resumeBuffer.toString('base64'));
  });

  it('should return 400 if resume is not a PDF', async () => {
    const jobDescriptionBuffer = Buffer.from('This is a test job description.');
    // Try to upload a .txt file as a resume
    const notAPdfBuffer = Buffer.from('This is not a PDF.');

    const response = await request(app)
      .post('/process-documents')
      .attach('resume', notAPdfBuffer, { filename: 'test_resume.txt', contentType: 'text/plain' })
      .attach('jobDescription', jobDescriptionBuffer, { filename: 'test_jd.txt', contentType: 'text/plain' });

    expect(response.status).to.equal(400); // Multer error due to fileFilter
    if(response.body && response.body.error) {
         expect(response.body.error).to.include('Resume must be a PDF file.');
    } else {
        // If not a JSON error, check if the response text contains the error.
        // This can happen if an error handler isn't set up to convert MulterError to JSON
        expect(response.text).to.include('Resume must be a PDF file.');
    }
  });

  it('should return 400 if resume file is missing', async () => {
    const jobDescriptionBuffer = Buffer.from('This is a test job description.');

    const response = await request(app)
      .post('/process-documents')
      .attach('jobDescription', jobDescriptionBuffer, 'test_jd.txt'); // No resume attached

    expect(response.status).to.equal(400);
    expect(response.body).to.be.an('object');
    expect(response.body.error).to.equal('Both resume (PDF) and job description (text file) are required.');
  });

  it('should return 400 if job description file is missing', async () => {
    const resumeBuffer = Buffer.from('%PDF-1.4\n%Test PDF content');

    const response = await request(app)
      .post('/process-documents')
      .attach('resume', resumeBuffer, { filename: 'test_resume.pdf', contentType: 'application/pdf' }); // No JD attached

    expect(response.status).to.equal(400);
    expect(response.body).to.be.an('object');
    expect(response.body.error).to.equal('Both resume (PDF) and job description (text file) are required.');
  });

  // Add more tests: e.g., what happens if askGemini throws an error?
  it('should handle errors from askGemini', async () => {
    askGeminiStub.rejects(new Error('LLM unavailable'));

    const resumeBuffer = Buffer.from('%PDF-1.4\n%Test PDF content');
    const jobDescriptionBuffer = Buffer.from('This is a test job description.');

    const response = await request(app)
      .post('/process-documents')
      .attach('resume', resumeBuffer, { filename: 'test_resume.pdf', contentType: 'application/pdf' })
      .attach('jobDescription', jobDescriptionBuffer, { filename: 'test_jd.txt', contentType: 'text/plain' });

    expect(response.status).to.equal(500);
    expect(response.body).to.be.an('object');
    expect(response.body.error).to.equal('Failed to process documents.');
  });
}); 