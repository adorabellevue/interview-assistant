import request from 'supertest';
import { expect } from 'chai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit'; // Import PDFKit

// Import the app from server.js
import app from '../server.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadsDir = path.join(__dirname, '../uploads');

// !!! IMPORTANT: For testing purposes only. Do not commit API keys to version control.
// It's better to use a .env file and ensure it's in .gitignore.
// process.env.GEMINI_API_KEY = "AIzaSyA3gNKx25QFc65MlyKuyLzp64-fZ2YA0Yc"; // Removed, should be loaded from .env by dotenv

describe('POST /process-documents - Integration with Gemini API', () => {

  beforeEach(() => {
    // Ensure uploads directory exists for multer, or create it
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  });

  afterEach(() => {
    // Clean up files in the uploads directory
    try {
      const files = fs.readdirSync(uploadsDir);
      for (const file of files) {
        fs.unlinkSync(path.join(uploadsDir, file));
      }
    } catch (err) {
      console.error("Error cleaning up uploads directory during integration test:", err);
    }
  });

  it('should process a real PDF and job description, call Gemini, and return questions', async function() {
    // Increase timeout for this test as it involves a real API call
    this.timeout(20000); // 20 seconds

    // A very small, valid PDF content (from https://stackoverflow.com/a/28232720/1269900)
    // This is a single-page blank PDF.
    const minimalPdfBuffer = Buffer.from(
      '%PDF-1.0\n' +       // Header
      '1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n' + // Catalog
      '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' + // Pages
      '3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\n' + // Page
      'xref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000058 00000 n\n0000000111 00000 n\n' + // XRef
      'trailer<</Size 4/Root 1 0 R>>\n' + // Trailer
      'startxref\n147\n%%EOF', // End
      'ascii'
    );

    const jobDescriptionContent = "Software Engineer with 5 years of experience in Node.js and React. " +
                                  "Familiar with microservices architecture and cloud platforms like AWS. " +
                                  "Seeking a challenging role in a fast-paced environment.";

    const jobDescriptionBuffer = Buffer.from(jobDescriptionContent);

    let response;
    try {
      response = await request(app)
        .post('/process-documents')
        .attach('resume', minimalPdfBuffer, { filename: 'test_resume.pdf', contentType: 'application/pdf' })
        .attach('jobDescription', jobDescriptionBuffer, { filename: 'test_jd.txt', contentType: 'text/plain' });
    } catch (err) {
      console.error("Error during supertest request to /process-documents:", err);
      throw err; // Fail the test if the request itself errors out
    }

    console.log("Gemini API Response Body:", JSON.stringify(response.body, null, 2));

    expect(response.status).to.equal(200);
    expect(response.body).to.be.an('object');
    expect(response.body.type).to.equal('initial_questions');
    expect(response.body.questions).to.be.an('array').that.is.not.empty;

    response.body.questions.forEach(question => {
      expect(question).to.be.a('string');
      expect(question.length).to.be.greaterThan(0);
    });

    console.log("Generated Questions:");
    response.body.questions.forEach((q, i) => console.log(`${i + 1}. ${q}`));

  }).timeout(20000); // Increase timeout for the test case itself

  it('should process a simple mock PDF and job description, call Gemini, and return questions', async () => {
    // Create a dummy PDF file for resume using PDFKit
    const resumePath = path.join(uploadsDir, 'test-resume.pdf');
    const resumeContent = 'This is a test resume PDF content for a software engineer. Seeking a challenging position.'; // Simple text content
    
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(resumePath);
    doc.pipe(writeStream);
    doc.fontSize(10).text(resumeContent, { align: 'left' });
    doc.end();
    await new Promise((resolve, reject) => { // Wait for PDF to be written
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Create a dummy job description file
    const jdPath = path.join(uploadsDir, 'test-jd.txt');
    const jdContent = 'Job Description: Software Engineer with 5 years of experience in Node.js and React. Familiar with microservices architecture.';
    fs.writeFileSync(jdPath, jdContent);

    console.log('\n📄 Job Description Content (first 100 chars):', jdContent.substring(0, 100));


    const response = await request(app)
      .post('/process-documents')
      .attach('resume', resumePath)
      .attach('jobDescription', jdPath);

    expect(response.status).to.equal(200);
    expect(response.body).to.be.an('object');
    expect(response.body.questions).to.be.an('array').that.is.not.empty;

    console.log('Gemini API Response Body:', JSON.stringify(response.body, null, 2));
    console.log('Generated Questions:');
    response.body.questions.forEach((q, i) => console.log(`${i + 1}. ${q}`));
  }).timeout(30000); // Increase timeout for real API call

  it('should process a MORE REALISTIC PDF and job description, call Gemini, and return questions for evaluation', async () => {
    const realisticResumeContent = `
John Doe
Software Engineer
john.doe@email.com | (555) 123-4567 | linkedin.com/in/johndoe | github.com/johndoe

Summary
Highly motivated and results-oriented Software Engineer with 7+ years of experience in developing, testing, and deploying scalable web applications. Proficient in JavaScript, Python, and Java, with a strong background in cloud technologies (AWS, Azure) and DevOps practices. Proven ability to lead projects and collaborate effectively in agile environments. Seeking a challenging role to leverage expertise in building innovative solutions.

Experience
Senior Software Engineer | Tech Solutions Inc. | City, State | 2020 – Present
- Led the development of a new microservices-based e-commerce platform, resulting in a 30% increase in performance and scalability.
- Designed and implemented RESTful APIs for various internal and external services.
- Mentored junior engineers and conducted code reviews to ensure high-quality code.
- Utilized AWS services (EC2, S3, Lambda, RDS) for deployment and infrastructure management.

Software Engineer | Web Innovations LLC | City, State | 2017 – 2020
- Contributed to the development of a SaaS application for project management.
- Developed front-end components using React and Redux.
- Wrote unit and integration tests, achieving 90% code coverage.
- Participated in daily scrums and sprint planning in an Agile development environment.

Education
Master of Science in Computer Science | University of Advanced Technology | City, State | 2017
Bachelor of Science in Software Engineering | State University | City, State | 2015

Skills
Programming Languages: JavaScript (Node.js, React), Python (Django, Flask), Java (Spring)
Databases: PostgreSQL, MongoDB, MySQL, DynamoDB
Cloud Platforms: AWS (EC2, S3, Lambda, RDS, API Gateway), Azure
Tools & Technologies: Docker, Kubernetes, Jenkins, Git, Jira, Microservices, REST APIs
    `;
    const resumePath = path.join(uploadsDir, 'realistic-resume.pdf');
    
    // Generate a real PDF using PDFKit
    const doc = new PDFDocument();
    const writeStream = fs.createWriteStream(resumePath);
    doc.pipe(writeStream);
    doc.fontSize(10).text(realisticResumeContent, { align: 'left' });
    doc.end();

    // Wait for the PDF to be written to disk
    await new Promise((resolve, reject) => {
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    const realisticJdContent = `
Senior Full-Stack Engineer - Cloud Native Solutions

About Us:
We are a fast-growing technology company at the forefront of cloud-native application development. Our mission is to empower businesses with scalable, resilient, and innovative software solutions. We foster a collaborative and dynamic work environment where creativity and continuous learning are encouraged.

The Role:
We are seeking an experienced Senior Full-Stack Engineer to join our talented team. The ideal candidate will have a strong background in designing, developing, and deploying complex web applications using modern technologies. You will be responsible for both front-end and back-end development, working closely with product managers, designers, and other engineers to deliver high-quality software.

Responsibilities:
- Design, develop, and maintain robust and scalable full-stack applications.
- Architect and implement microservices and RESTful APIs.
- Work with cloud platforms (preferably AWS or GCP) for deploying and managing applications.
- Write clean, well-tested, and maintainable code.
- Collaborate with cross-functional teams to define, design, and ship new features.
- Participate in code reviews and contribute to a high standard of code quality.
- Troubleshoot and resolve complex technical issues.
- Stay up-to-date with emerging technologies and industry best practices.

Qualifications:
- Bachelor's or Master's degree in Computer Science, Engineering, or a related field.
- 5+ years of professional experience in full-stack development.
- Proficiency in JavaScript (Node.js, React/Angular/Vue) and at least one other back-end language (e.g., Python, Java, Go).
- Strong experience with relational and NoSQL databases.
- Hands-on experience with cloud platforms (AWS, GCP, or Azure), including services like EC2, S3, Lambda, Kubernetes, Docker.
- Solid understanding of software development principles, design patterns, and agile methodologies.
- Experience with CI/CD pipelines and DevOps practices.
- Excellent problem-solving and communication skills.
- Ability to work independently and as part of a team in a fast-paced environment.

Nice to Haves:
- Experience with serverless architectures.
- Contributions to open-source projects.
- Understanding of message queuing systems (e.g., Kafka, RabbitMQ).
    `;
    const jdPath = path.join(uploadsDir, 'realistic-jd.txt');
    fs.writeFileSync(jdPath, realisticJdContent);

    console.log('\n📝 REALISTIC RESUME CONTENT (SUMMARY):\n---');
    console.log(realisticResumeContent.substring(0, 400) + '...'); // Print first 400 chars as a summary
    console.log('---\\n');
    console.log('📄 REALISTIC JOB DESCRIPTION CONTENT:\n---');
    console.log(realisticJdContent);
    console.log('---\\n');

    const response = await request(app)
      .post('/process-documents')
      .attach('resume', resumePath)
      .attach('jobDescription', jdPath);

    expect(response.status).to.equal(200);
    expect(response.body).to.be.an('object');
    expect(response.body.questions).to.be.an('array').that.is.not.empty;
    
    console.log('\n✨ GEMINI GENERATED QUESTIONS (REALISTIC INPUT):\n---');
    response.body.questions.forEach((q, i) => console.log(`${i + 1}. ${q}`));
    console.log('---\\n');

  }).timeout(45000); // Increased timeout for potentially longer processing
});
