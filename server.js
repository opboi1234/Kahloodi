import 'dotenv/config';
import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import { GoogleGenAI } from '@google/genai';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = Number(process.env.PORT || 3000);
const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const MAX_BYTES = 8 * 1024 * 1024;
const allowedTypes = new Set(['image/jpeg', 'image/png', 'image/webp']);

app.disable('x-powered-by');
app.use(helmet({
  // The browser app uses inline SVG icons and local CSS/JS only.
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      imgSrc: ["'self'", 'blob:', 'data:'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'"],
      objectSrc: ["'none'"],
      upgradeInsecureRequests: null
    }
  }
}));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_BYTES, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!allowedTypes.has(file.mimetype)) {
      return cb(new Error('Please upload a JPG, PNG, or WebP image.'));
    }
    cb(null, true);
  }
});

const prompt = `You are helping with an EDUCATIONAL SCIENCE FAIR prototype called SmileScan AI.
You are not a dentist, and this is not a clinical diagnostic system. Analyze the supplied image cautiously.
The user selects whether the image is an ordinary mouth/teeth photo or a dental X-ray. Treat that selection as unverified context, and do not assume the image is actually that type.
Return valid JSON only with this exact schema:
{
 "imageType": "ordinary_photo" | "dental_xray" | "unclear",
 "quality": {"rating":"Suitable for limited visual review" | "Limited" | "Unsuitable", "reason":"short plain-language explanation"},
 "observations": [{"title":"short", "detail":"what is directly visible, without diagnosis"}],
 "possibleConcerns": [{"title":"short", "detail":"careful uncertainty language; why a dentist might check"}],
 "nextSteps": ["general educational next step"],
 "limitations": ["specific limitation"]
}
Rules:
- If the image is blurry, too dark, cropped, obstructed, or does not show teeth/mouth clearly, set quality to Limited or Unsuitable and say what prevents review. Do not guess.
- Do not diagnose cavities, gum disease, infection, or any other condition. You may describe visible features that could warrant a professional check.
- Do not infer a cavity from dark pixels alone. Ordinary photos cannot reliably show hidden decay or diagnose between teeth.
- Dental X-rays require specialized clinical interpretation. If you cannot reasonably interpret the radiograph, say so and keep findings minimal. Never claim X-ray interpretation is validated.
- Do not provide numeric confidence scores or medical severity scores.
- Observations must be grounded in visible details. If no concern is clear, say that no obvious concern can be identified in this image, not that teeth are healthy.
- Keep language simple for a general audience and Grade 7 science fair.
- Never request personal information.
- If this is not a dental image, state that clearly and recommend uploading an appropriate image.
- Limit each list to at most 5 items. Use empty arrays when appropriate.
`;

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    mode: process.env.GEMINI_API_KEY ? 'ai' : 'demo',
    model: process.env.GEMINI_API_KEY ? MODEL : null,
    maxUploadMB: MAX_BYTES / 1024 / 1024
  });
});

app.post('/api/analyze', (req, res) => {
  upload.single('image')(req, res, async (err) => {
    if (err) {
      const message = err.code === 'LIMIT_FILE_SIZE'
        ? 'That image is too large. Please choose an image smaller than 8 MB.'
        : err.message || 'The image could not be uploaded.';
      return res.status(400).json({ error: message });
    }
    try {
      if (!req.file) return res.status(400).json({ error: 'Choose an image first.' });
      const imageKind = req.body.imageKind === 'xray' ? 'dental X-ray' : 'ordinary teeth/mouth photo';

      if (!process.env.GEMINI_API_KEY) {
        return res.json({
          mode: 'demo',
          report: {
            imageType: 'unclear',
            quality: {
              rating: 'Demo mode — not assessed',
              reason: 'No Gemini API key is configured, so this image was not analyzed. This is a demonstration placeholder, not an AI result.'
            },
            observations: [],
            possibleConcerns: [],
            nextSteps: ['Configure GEMINI_API_KEY in your local .env file to enable real AI image analysis.'],
            limitations: ['Demo mode does not inspect the image or produce findings.', 'This website is an educational prototype, not a medical device.']
          }
        });
      }

      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const base64 = req.file.buffer.toString('base64');
      const response = await ai.models.generateContent({
        model: MODEL,
        contents: [{
          role: 'user',
          parts: [
            { text: `The user selected this image type: ${imageKind}. Analyze cautiously under the instructions. Return JSON only.` },
            { inlineData: { mimeType: req.file.mimetype, data: base64 } },
            { text: prompt }
          ]
        }],
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2
        }
      });

      const raw = response.text;
      if (!raw) throw new Error('The AI returned an empty response. Try again with a different image.');
      let report;
      try {
        report = JSON.parse(raw);
      } catch {
        throw new Error('The AI response could not be read. Please try again.');
      }
      // Validate the minimum expected structure before sending it to the browser.
      if (!report.quality || !Array.isArray(report.observations) ||
          !Array.isArray(report.possibleConcerns) || !Array.isArray(report.nextSteps)) {
        throw new Error('The AI returned an incomplete report. Please try again.');
      }
      res.json({ mode: 'ai', model: MODEL, report });
    } catch (error) {
      console.error('Analysis error:', error?.message || error);
      const status = /API key|PERMISSION_DENIED|UNAUTHENTICATED/i.test(error?.message || '') ? 502 : 500;
      res.status(status).json({
        error: status === 502
          ? 'The AI service could not authenticate. Check the API key in .env and restart the server.'
          : 'Analysis failed. Check your internet connection, model availability, and API quota, then try again.'
      });
    }
  });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

app.listen(PORT, () => {
  console.log(`SmileScan AI is running at http://localhost:${PORT}`);
  console.log(process.env.GEMINI_API_KEY
    ? `AI mode enabled with model ${MODEL}`
    : 'DEMO MODE: no API key configured; images are not analyzed.');
});
