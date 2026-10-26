# SmileScan AI — Science Fair Prototype

SmileScan AI is an educational science-fair demo that lets a user upload a dental photo or X-ray and receive an AI-generated, **non-diagnostic** explanation. It is not a medical device and cannot confirm or rule out cavities, infections, or any other dental condition. A licensed dentist must assess dental concerns.

## Features

- Responsive dental-health website with image upload and preview
- Server-side Gemini vision integration (API key stays on the server)
- Demo mode when no API key is configured
- Educational safety messaging and suggested next steps
- Research/experiment-friendly interface

## Requirements

- Node.js 20 or newer
- A Gemini API key for real AI analysis (optional; demo mode works without it)

## Run locally

1. Extract the ZIP and open a terminal in the `smilescan-ai` folder.
2. Install dependencies:

   ```bash
   npm install
   ```

3. Create your local environment file by copying `.env.example` to `.env`.
4. Open `.env` and replace `put_your_key_here` with your own Gemini API key. Keep `.env` private; never commit it to GitHub.
5. Start the website:

   ```bash
   npm start
   ```

6. Open `http://localhost:3000` in your browser.

Without a key, the app uses demo mode rather than making a real AI request.

## Publish the source on GitHub

Upload the project files and folders to your repository. Keep `.env` out of the repository; `.gitignore` excludes it. `.env.example` is safe to publish because it contains only a placeholder.

If you deploy the site, configure `GEMINI_API_KEY` in your hosting provider's environment-variable or secrets settings. Do not put the key in frontend JavaScript, HTML, screenshots, or public commits. If a key has already been exposed, revoke it and create a replacement.

## Safety, privacy, and limitations

- This is a school project and educational prototype, not a substitute for a dentist.
- AI outputs can be incorrect, incomplete, or misleading. Do not rely on them to make treatment decisions.
- Do not upload identifiable or sensitive dental images without informed permission. Use fictional, consented, or properly anonymized images for a science-fair demonstration.
- Do not promise that an image is stored nowhere unless you have verified the behavior of your deployment and hosting provider.
- If someone has severe dental pain, facial swelling, fever, or trouble swallowing or breathing, seek urgent professional medical/dental care.

## Check the code

```bash
npm run check
```
