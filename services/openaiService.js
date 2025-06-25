const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

const mockTranscriptions = [
  '25 OMR, ready in 2 days',
  '30 OMR, available next week',
  '20 OMR, can deliver tomorrow'
];

class OpenAIService {
  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.client = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      this.isMock = false;
    } else {
      this.isMock = true;
      console.log('⚠️ Running in MOCK mode - no OpenAI API key found');
    }
  }

  // Transcribe voice message using Whisper
  async transcribeVoice(audioBuffer, language = null) {
    if (this.isMock) {
      const text = mockTranscriptions[Math.floor(Math.random() * mockTranscriptions.length)];
      console.log(`[MOCK] Transcribed voice: ${text}`);
      return text;
    }

    try {
      // Create a temporary file for the audio
      const tempFile = path.join(__dirname, '../temp', `audio_${Date.now()}.wav`);
      
      // Ensure temp directory exists
      const tempDir = path.dirname(tempFile);
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Write audio buffer to file
      fs.writeFileSync(tempFile, audioBuffer);

      // Transcribe using Whisper
      const transcription = await this.client.audio.transcriptions.create({
        file: fs.createReadStream(tempFile),
        model: "whisper-1",
        language: language || undefined,
        response_format: "text"
      });

      // Clean up temporary file
      fs.unlinkSync(tempFile);

      console.log(`✅ Voice transcribed: ${transcription.substring(0, 100)}...`);
      return transcription;
    } catch (error) {
      console.error('❌ Error transcribing voice:', error);
      throw error;
    }
  }

  // Translate text to English if needed
  async translateText(text, sourceLanguage = null) {
    if (this.isMock) {
      // For demo, just return the text and fake language detection
      let language = 'english';
      if (/OMR|ready|deliver|available/i.test(text)) language = 'english';
      else if (/ورق|جاهز|غدًا/.test(text)) language = 'arabic';
      else if (/कागज|तैयार|कल/.test(text)) language = 'hindi';
      return { translated: text, original: text, language };
    }

    try {
      // If no source language specified, try to detect it
      if (!sourceLanguage) {
        const detection = await this.detectLanguage(text);
        sourceLanguage = detection.language;
      }

      // If already in English, return as is
      if (sourceLanguage === 'en' || sourceLanguage === 'english') {
        return { translated: text, original: text, language: 'english' };
      }

      // Translate to English
      const completion = await this.client.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `You are a professional translator. Translate the following text to English. 
            Maintain the original meaning and tone. If the text contains numbers, prices, or technical terms, 
            preserve them exactly. Only return the translated text, nothing else.`
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 500,
        temperature: 0.1
      });

      const translated = completion.choices[0].message.content.trim();

      console.log(`✅ Text translated from ${sourceLanguage} to English`);
      return {
        translated,
        original: text,
        language: sourceLanguage
      };
    } catch (error) {
      console.error('❌ Error translating text:', error);
      // Return original text if translation fails
      return {
        translated: text,
        original: text,
        language: 'unknown'
      };
    }
  }

  // Detect language of text
  async detectLanguage(text) {
    if (this.isMock) {
      let language = 'english';
      if (/OMR|ready|deliver|available/i.test(text)) language = 'english';
      else if (/ورق|جاهز|غدًا/.test(text)) language = 'arabic';
      else if (/कागज|तैयार|कल/.test(text)) language = 'hindi';
      return { language };
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `Detect the language of the following text. 
            Return only the language name in English (e.g., "english", "arabic", "hindi", "urdu"). 
            If you're unsure, return "unknown".`
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 10,
        temperature: 0
      });

      const language = completion.choices[0].message.content.trim().toLowerCase();
      return { language };
    } catch (error) {
      console.error('❌ Error detecting language:', error);
      return { language: 'unknown' };
    }
  }

  // Extract bid information from text
  async extractBidInfo(text) {
    if (this.isMock) {
      // Simple regex mock extraction
      const priceMatch = text.match(/(\d{2,})\s*(OMR|USD|EUR)?/i);
      const deliveryMatch = text.match(/(\d+\s*days?|next week|tomorrow)/i);
      return {
        price: priceMatch ? parseInt(priceMatch[1]) : 25,
        currency: priceMatch && priceMatch[2] ? priceMatch[2].toUpperCase() : 'OMR',
        delivery_time: deliveryMatch ? deliveryMatch[0] : '2 days',
        availability: /ready|available|stock/i.test(text) ? 'ready' : null,
        confidence: 'high'
      };
    }

    try {
      const completion = await this.client.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: `Extract bid information from the following text. 
            Look for:
            - Price (numbers followed by currency like OMR, USD, etc.)
            - Delivery time (days, weeks, months)
            - Availability (ready, available, stock, etc.)
            
            Return a JSON object with these fields:
            {
              "price": number or null,
              "currency": "OMR" or currency found,
              "delivery_time": string or null,
              "availability": string or null,
              "confidence": "high", "medium", or "low"
            }
            
            If no clear information is found, use null values and set confidence to "low".`
          },
          {
            role: "user",
            content: text
          }
        ],
        max_tokens: 200,
        temperature: 0.1
      });

      const result = completion.choices[0].message.content.trim();
      
      try {
        const parsed = JSON.parse(result);
        console.log(`✅ Bid info extracted: ${JSON.stringify(parsed)}`);
        return parsed;
      } catch (parseError) {
        console.error('❌ Error parsing bid info JSON:', parseError);
        return {
          price: null,
          currency: "OMR",
          delivery_time: null,
          availability: null,
          confidence: "low"
        };
      }
    } catch (error) {
      console.error('❌ Error extracting bid info:', error);
      return {
        price: null,
        currency: "OMR",
        delivery_time: null,
        availability: null,
        confidence: "low"
      };
    }
  }

  // Process voice message: transcribe + translate + extract bid info
  async processVoiceMessage(audioBuffer) {
    const transcribedText = await this.transcribeVoice(audioBuffer);
    const translation = await this.translateText(transcribedText);
    const bidInfo = await this.extractBidInfo(translation.translated);
    return {
      original: transcribedText,
      translated: translation.translated,
      language: translation.language,
      bidInfo
    };
  }

  // Process text message: translate + extract bid info
  async processTextMessage(text) {
    const translation = await this.translateText(text);
    const bidInfo = await this.extractBidInfo(translation.translated);
    return {
      original: text,
      translated: translation.translated,
      language: translation.language,
      bidInfo
    };
  }
}

module.exports = new OpenAIService(); 