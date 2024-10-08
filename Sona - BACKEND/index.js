import { exec } from "child_process";
import cors from "cors";
import dotenv from "dotenv";
import voice from "elevenlabs-node";
import express from "express";
import axios from 'axios';
import { promises as fs } from "fs";
dotenv.config();

const elevenLabsApiKey = process.env.ELEVEN_LABS_API_KEY;
const voiceID = "03BNbP7BEX9vcs40ROPz";

const app = express();
app.use(express.json());
app.use(cors());
const port = 3000;

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.get("/voices", async (req, res) => {
  try {
    const voices = await voice.getVoices(elevenLabsApiKey);
    res.send(voices);
  } catch (error) {
    res.status(500).send({ error: "Failed to fetch voices" });
  }
});

const execCommand = (command) => {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) reject(error);
      resolve(stdout);
    });
  });
};

const lipSyncMessage = async (message) => {
  const mp3FileName = `audios/message_${message}.mp3`;
  const wavFileName = `audios/message_${message}.wav`;

  try {
    // Check if the MP3 file exists
    await fs.access(mp3FileName);
    console.log(`Converting ${mp3FileName} to WAV`);
    await execCommand(`ffmpeg -y -i ${mp3FileName} ${wavFileName}`);
    console.log(`Conversion done`);
    await execCommand(`./bin/Rhubarb-Lip-Sync-1.13.0-macOS/rhubarb -f json -o audios/message_${message}.json ${wavFileName} -r phonetic`);
    console.log(`Lip sync done`);
  } catch (error) {
    if (error.code === 'ENOENT') {
      console.error(`Audio file not found: ${mp3FileName}`);
      // Handle missing file case (e.g., return error or use default audio)
      return { error: "Audio file not generated" };
    } else {
      throw error; // Re-throw other errors
    }
  }
};

app.post("/chat", async (req, res) => {
  const userMessage = req.body.message;
  if (!userMessage) {
    res.send({
      messages: [
        {
          text: "Hey dear... How was your day?",
          audio: await audioFileToBase64("audios/intro_0.wav"),
          lipsync: await readJsonTranscript("audios/intro_0.json"),
          facialExpression: "smile",
          animation: "Talking_1",
        },
        {
          text: "I missed you so much... Please don't go for so long!",
          audio: await audioFileToBase64("audios/intro_1.wav"),
          lipsync: await readJsonTranscript("audios/intro_1.json"),
          facialExpression: "sad",
          animation: "Crying",
        },
      ],
    });
    return;
  }
  if (!elevenLabsApiKey) {
    res.send({
      messages: [
        {
          text: "Please my dear, don't forget to add your API keys!",
          audio: await audioFileToBase64("audios/api_0.wav"),
          lipsync: await readJsonTranscript("audios/api_0.json"),
          facialExpression: "angry",
          animation: "Angry",
        },
        {
          text: "You don't want to ruin Wawa Sensei with a crazy ChatGPT and ElevenLabs bill, right?",
          audio: await audioFileToBase64("audios/api_1.wav"),
          lipsync: await readJsonTranscript("audios/api_1.json"),
          facialExpression: "smile",
          animation: "Laughing",
        },
      ],
    });
    return;
  }

    // Send request to FastAPI server
    const response = await axios.post('http://localhost:8000/generate', { prompt: userMessage });

    // Ensure the response is in JSON format
    let responseData = response.data.text;

    try {
        let messages = JSON.parse(responseData);
        if (messages.messages) {
            messages = messages.messages;
        }
        for (let i = 0; i < messages.length; i++) {
            const message = messages[i];
            // generate audio file
            const fileName = `audios/message_${i}.mp3`; // The name of your audio file
            const textInput = message.text; // The text you wish to convert to speech
            await voice.textToSpeech(elevenLabsApiKey, voiceID, fileName, textInput);
            // generate lipsync
            await lipSyncMessage(i);
            message.audio = await audioFileToBase64(fileName);
            message.lipsync = await readJsonTranscript(`audios/message_${i}.json`);
        }

        res.send({ messages });
    } catch (error) {
        console.error("Error parsing JSON:", error);
        res.status(500).send({ error: "Failed to parse JSON response" });
    }

});

const readJsonTranscript = async (file) => {
  try {
    const data = await fs.readFile(file, "utf8");
    return JSON.parse(data);
  } catch (error) {
    console.error(`Error reading JSON transcript from ${file}:`, error);
    throw error;
  }
};

const audioFileToBase64 = async (file) => {
  try {
    const data = await fs.readFile(file);
    console.log(`Read file ${file} successfully.`);
    return data.toString("base64");
  } catch (error) {
    console.error(`Error reading audio file ${file}:`, error);
    throw error;
  }
};

app.listen(port, () => {
  console.log(`Virtual Girlfriend listening on port ${port}`);
});

