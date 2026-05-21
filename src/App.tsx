import React, { useState, useEffect, useRef } from "react";
import {
  Volume2,
  VolumeX,
  Mic,
  MicOff,
  Upload,
  BookOpen,
  RefreshCw,
  ChevronRight,
  Sparkles,
  Award,
  BookOpenCheck,
  Text,
  HelpCircle,
  CheckCircle2,
  AlertCircle
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

// Standard Sample Study Material Texts for instant testing
const PRELOADED_GUIDES = {
  biology: {
    title: "Biology: Photosynthesis and Cellular Respiration",
    text: `Photosynthesis is the highly coordinated biological process by which plants, algae, and some bacteria convert light energy into chemical energy. It occurs primarily inside the chloroplasts of plant cells, specifically utilizing the green pigment chlorophyll. The overall chemical equation is six molecules of carbon dioxide plus six molecules of water, in the presence of sunlight, yields one molecule of glucose and six molecules of oxygen gas. The process is divided into light-dependent reactions, which capture solar energy to produce ATP and NADPH, and light-independent reactions (also called the Calvin Cycle), which utilize that stored energy to split carbon dioxide and build organic sugars.
Cellular respiration is the complementary biochemical pathway by which organisms release the chemical energy stored in glucose to power cellular activities. It occurs in three major phases: glycolysis in the cytoplasm, the citric acid cycle (or Krebs cycle) in the mitochondrial matrix, and the oxidative phosphorylation chain on the inner mitochondrial membrane. During aerobic respiration, oxygen acts as the final electron acceptor, combining with free hydrogens to create water, while releasing approximately 32 to 36 molecules of adenosine triphosphate, or ATP, per molecule of glucose processed. Glycolysis requires no oxygen and is an anaerobic phase, yielding only two net ATP molecules, whereas the mitochondria-dependent phases are highly oxygen-dependent and yield the vast majority of cellular energy.`
  },
  history: {
    title: "World History: The Industrial Revolution",
    text: `The Industrial Revolution was a period of global economic and social transformation that began in Great Britain during the mid-eighteenth century (around 1760) and subsequently spread across Europe and North America. It marked the transition from agricultural, hand-crafted economies to industrial societies dominated by machine manufacturing and mechanized factories. The key driver of this change was the invention of the steam engine by James Watt, which allowed factories to be situated away from moving rivers and vastly magnified production capacities.
Another technological milestone was the mechanization of textiles, led by inventions like the spinning jenny and the power loom. Rapid industrialization stimulated the development of railways and steamships, facilitating the mass transport of goods and raw materials like coal and iron ore. These changes led to massive urbanization, as rural agricultural workers migrated in high density to manufacturing cities. However, this urbanization created severe social challenges, including crowded tenements, poor sanitation, and hazardous factory conditions for laborers, prompting the rise of labor unions and protective social legislation in the nineteenth century.`
  },
  compSci: {
    title: "Computer Science: Databases and Binary Search Trees",
    text: `A Database is an organized collection of structured information, or data, stored electronically in a computer system. Databases are typically controlled by a Database Management System, or DBMS. Data within the most common databases is modeled in rows and columns in tables to make processing and data querying highly efficient. Structured Query Language, or SQL, is widely used for writing and querying data. Relational databases enforce strict schemas, while Document databases or NoSQL engines support unstructured schemas.
A Binary Search Tree, or BST, is a node-based binary tree data structure which has the following properties: The left subtree of a node contains only nodes with keys lesser than the node's key. The right subtree of a node contains only nodes with keys greater than the node's key. Both the left and right subtrees must also be binary search trees. Searching a binary search tree has an average-case time complexity of O of log N, where N is the total number of items stored. In the worst case, if the tree becomes completely unbalanced and resembles a linear link list, tree lookup slows down to O of N complexity.`
  }
};



export default function App() {
  // Appearance & Accessibility States
  const [fontSize, setFontSize] = useState<"medium" | "large" | "xl">("large");
  const [theme, setTheme] = useState<"midnight" | "warm">("midnight");

  // RAG States
  const [hasDocument, setHasDocument] = useState<boolean>(false);
  const [documentName, setDocumentName] = useState<string>("");
  const [chunkCount, setChunkCount] = useState<number>(0);
  const [isIndexing, setIsIndexing] = useState<boolean>(false);
  const [inputText, setInputText] = useState<string>("");

  // Search Context Query States
  const [query, setQuery] = useState<string>("");
  const [answer, setAnswer] = useState<string>("");
  const [isQuerying, setIsQuerying] = useState<boolean>(false);
  const [retrievedContext, setRetrievedContext] = useState<any[]>([]);

  // Browser STT & TTS States
  const [isListening, setIsListening] = useState<boolean>(false);
  const [isSpeaking, setIsSpeaking] = useState<boolean>(false);
  const [voiceSpeed, setVoiceSpeed] = useState<number>(1.0); // 0.8 - slow, 1.0 - normal, 1.2 - fast
  const [feedbackMsg, setFeedbackMsg] = useState<string>("Ready to assist you.");

  // Speech Recognition / Synthesis Refs
  const recognitionRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Keyboard accessibility listeners
  useEffect(() => {
    // Announce initial welcome on load
    setTimeout(() => {
      announceAcoustically("Welcome to the Accessible Study Material Assistant. Tap the 'Spacebar' while focused to trigger voice questions, or press 'Escape' to silence my voice.");
    }, 1200);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        stopSpeaking();
        announceAcoustically("Speech paused.");
      }
      // Toggle microphone with Ctrl + Shift + S
      if (e.ctrlKey && e.key.toLowerCase() === "s") {
        e.preventDefault();
        toggleVoiceInput();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // Sync index status with the Express backend
  useEffect(() => {
    checkBackendStatus();
  }, []);

  const checkBackendStatus = async () => {
    try {
      const res = await fetch("/api/status");
      if (res.ok) {
        const data = await res.json();
        setHasDocument(data.hasDocument);
        setDocumentName(data.documentName);
        setChunkCount(data.chunkCount);
      }
    } catch (err) {
      console.error("Backend status fetch failed", err);
    }
  };

  // ==========================================
  // 🔊 SYSTEM SOUND GENERATOR (Web Audio API)
  // ==========================================
  const playSystemChime = (type: "beep" | "success" | "listen" | "off") => {
    try {
      if (!audioCtxRef.current) {
        audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioCtxRef.current;
      if (ctx.state === "suspended") {
        ctx.resume();
      }

      const osc = ctx.createOscillator();
      const gainNode = ctx.createGain();
      osc.connect(gainNode);
      gainNode.connect(ctx.destination);

      if (type === "listen") {
        // High rising beeps for voice listening
        osc.type = "sine";
        osc.frequency.setValueAtTime(440, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
        osc.start();
        osc.stop(ctx.currentTime + 0.16);
      } else if (type === "success") {
        // Double sweet chime
        osc.type = "sine";
        osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
        osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.start();
        osc.stop(ctx.currentTime + 0.35);
      } else if (type === "off") {
        // Falling de-escalating tone
        osc.type = "triangle";
        osc.frequency.setValueAtTime(550, ctx.currentTime);
        osc.frequency.linearRampToValueAtTime(220, ctx.currentTime + 0.2);
        gainNode.gain.setValueAtTime(0.15, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
        osc.start();
        osc.stop(ctx.currentTime + 0.22);
      } else {
        // Regular short notification beep
        osc.type = "sine";
        osc.frequency.setValueAtTime(600, ctx.currentTime);
        gainNode.gain.setValueAtTime(0.1, ctx.currentTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
        osc.start();
        osc.stop(ctx.currentTime + 0.11);
      }
    } catch (e) {
      console.warn("Audio Context beep unsupported or blocked by browser settings", e);
    }
  };

  // ==========================================
  // 🎙️ TEXT-TO-SPEECH (Browser Web Speech)
  // ==========================================
  const announceAcoustically = (text: string) => {
    if (!window.speechSynthesis) {
      setFeedbackMsg("Speech synthesis is not supported on this device.");
      return;
    }

    // Stop existing speech first
    window.speechSynthesis.cancel();

    // Clean text of visual markup
    const cleanSpeechText = text
      .replace(/[*#_`~]/g, "")
      .replace(/\[Page \d+\]/g, "Source notes page")
      .trim();

    const utterance = new SpeechSynthesisUtterance(cleanSpeechText);
    utterance.rate = voiceSpeed;
    utterance.pitch = 1.0;

    utterance.onstart = () => {
      setIsSpeaking(true);
    };

    utterance.onend = () => {
      setIsSpeaking(false);
    };

    utterance.onerror = () => {
      setIsSpeaking(false);
    };

    window.speechSynthesis.speak(utterance);
  };

  const stopSpeaking = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    setIsSpeaking(false);
  };

  // ==========================================
  // 🎤 SPEECH-TO-TEXT (Browser Web Speech)
  // ==========================================
  const toggleVoiceInput = () => {
    stopSpeaking();

    // Check availability
    const SpeechRecognitionClass =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      const errMsg = "Speech recognition is not supported in this browser. Please use keyboard input.";
      setFeedbackMsg(errMsg);
      announceAcoustically(errMsg);
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsListening(false);
      playSystemChime("off");
      setFeedbackMsg("Voice recording cancelled.");
      return;
    }

    playSystemChime("listen");
    setFeedbackMsg("Listening to your question now...");

    const recognition = new SpeechRecognitionClass();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setQuery(transcript);
      setFeedbackMsg(`Recognized: "${transcript}"`);
      playSystemChime("success");
      // Trigger RAG Query instantly for the transcribed question
      handleQuerySearch(transcript);
    };

    recognition.onerror = (event: any) => {
      console.error("Speech Recognition error", event);
      setIsListening(false);
      playSystemChime("off");
      if (event.error === "not-allowed") {
        setFeedbackMsg("Microphone permission denied.");
        announceAcoustically("Microphone access is blocked. Please unlock microphone settings in your browser.");
      } else {
        setFeedbackMsg("I could not hear any speech. Please try again.");
        announceAcoustically("I did not catch that. Please speak again.");
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // ==========================================
  // 📝 CHUNKING & DOCUMENT EMBEDDING
  // ==========================================
  const loadPreloadedGuide = async (key: "biology" | "history" | "compSci") => {
    stopSpeaking();
    setIsIndexing(true);
    setFeedbackMsg("Indexing study materials onto Gemini Cloud vectors. Please wait...");
    announceAcoustically(`Loading ${PRELOADED_GUIDES[key].title} guide. Creating vector embeddings now.`);

    const material = PRELOADED_GUIDES[key];
    const textData = material.text;

    // Local slider-window overlapping splitted chunks
    const chunks: { id: string; text: string; pageNumber: number }[] = [];
    const chunkSize = 400; // character length
    const overlap = 80;

    let index = 0;
    let pageCount = 1;
    let chunkCounter = 0;

    while (index < textData.length) {
      const textChunk = textData.substring(index, index + chunkSize).trim();
      if (textChunk.length > 20) {
        chunks.push({
          id: `chunk-${key}-${chunkCounter}`,
          text: textChunk,
          pageNumber: pageCount
        });
        chunkCounter++;
        // Simulate pages increment every 2 chunks
        if (chunkCounter % 2 === 0) pageCount++;
      }
      index += (chunkSize - overlap);
    }

    try {
      const response = await fetch("/api/index-document", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          documentName: material.title,
          chunks: chunks
        })
      });

      if (response.ok) {
        const data = await response.json();
        setHasDocument(true);
        setDocumentName(material.title);
        setChunkCount(data.chunkCount);
        setFeedbackMsg(`Successfully indexed study guide! Ready to answer in voice.`);
        playSystemChime("success");
        announceAcoustically(`System successfully loaded: ${material.title}. Spawning ${data.chunkCount} vector study fragments. Ask your question now.`);
      } else {
        throw new Error("Failed to post chunks");
      }
    } catch (err: any) {
      setFeedbackMsg("Error indexing document.");
      announceAcoustically("An error occurred during vector generation.");
    } finally {
      setIsIndexing(false);
    }
  };

  const handleCustomTextInputIndex = async () => {
    if (!inputText.trim()) {
      announceAcoustically("Please type or paste some text study material first.");
      return;
    }

    stopSpeaking();
    setIsIndexing(true);
    setFeedbackMsg("Analyzing and embedding study details...");
    announceAcoustically("Analyzing your copy pasted materials. Generating cloud search indexes.");

    // Local split
    const chunks: { id: string; text: string; pageNumber: number }[] = [];
    const paragraphs = inputText.split("\n\n").filter(p => p.trim().length > 10);

    paragraphs.forEach((p, idx) => {
      chunks.push({
        id: `custom-chunk-${idx}`,
        text: p,
        pageNumber: 1
      });
    });

    try {
      const response = await fetch("/api/index-document", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documentName: "Copy-Pasted Custom Notes",
          chunks: chunks
        })
      });

      if (response.ok) {
        const data = await response.json();
        setHasDocument(true);
        setDocumentName("Copy-Pasted Notes");
        setChunkCount(data.chunkCount);
        setInputText("");
        playSystemChime("success");
        announceAcoustically(`Successfully loaded pasted notes! I have categorized ${data.chunkCount} search points. Ask your study questions.`);
      }
    } catch (err) {
      announceAcoustically("Failed to process your notes. Confirm API keys in secrets.");
    } finally {
      setIsIndexing(false);
    }
  };

  const clearIndexedDocument = async () => {
    stopSpeaking();
    playSystemChime("off");
    try {
      await fetch("/api/clear", { method: "POST" });
      setHasDocument(false);
      setDocumentName("");
      setChunkCount(0);
      setAnswer("");
      setQuery("");
      setRetrievedContext([]);
      setFeedbackMsg("Memory cleared.");
      announceAcoustically("Study material cleared safely from memory.");
    } catch (e) {
      console.error(e);
    }
  };

  // ==========================================
  // 🔍 PROCESS QUERY / CHAT SCRIPT
  // ==========================================
  const handleQuerySearch = async (questionText: string) => {
    if (!questionText.trim()) return;

    stopSpeaking();
    setIsQuerying(true);
    setAnswer("");
    setFeedbackMsg("Consulting study materials...");
    announceAcoustically("Searching database and preparing explanation.");

    try {
      const response = await fetch("/api/query", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: questionText })
      });

      if (response.ok) {
        const data = await response.json();
        setAnswer(data.answer);
        setRetrievedContext(data.retrievedChunks || []);
        setFeedbackMsg("Answer generated successfully.");
        playSystemChime("success");
        // Speak response out loud!
        announceAcoustically(data.answer);
      } else {
        const data = await response.json();
        const errMessage = data.message || "Consulting study model failed.";
        setFeedbackMsg("Query failed.");
        announceAcoustically(errMessage);
      }
    } catch (e: any) {
      setFeedbackMsg("Query error.");
      announceAcoustically("Error searching document. Please verify your connection or Gemini key configuration.");
    } finally {
      setIsQuerying(false);
    }
  };

  // Dynamic style sizes based on large accessibility values
  const textStyles = {
    title: fontSize === "medium" ? "text-xl md:text-2xl" : fontSize === "large" ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl",
    heading: fontSize === "medium" ? "text-lg font-semibold" : fontSize === "large" ? "text-xl font-bold" : "text-2xl font-extrabold",
    body: fontSize === "medium" ? "text-sm" : fontSize === "large" ? "text-base" : "text-lg",
    largeText: fontSize === "medium" ? "text-base font-semibold" : fontSize === "large" ? "text-lg font-bold" : "text-2xl font-extrabold"
  };

  return (
    <div
      className={`min-h-screen transition-colors duration-300 font-sans ${
        theme === "midnight" ? "bg-[#0F172A] text-slate-100" : "bg-orange-50/70 text-slate-900"
      }`}
      style={{
        fontSize: fontSize === "medium" ? "15px" : fontSize === "large" ? "17px" : "19px"
      }}
    >
      {/* HEADER BAR FOR SLEEK INTERFACE */}
      <nav
        className={`border-b h-22 flex flex-col lg:flex-row items-center justify-between px-6 lg:px-10 py-4 gap-4 sticky top-0 z-50 transition-colors ${
          theme === "midnight" ? "border-slate-800 bg-[#0B1120]" : "border-slate-300 bg-white"
        }`}
      >
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-amber-500 rounded-full flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0">
            <svg viewBox="0 0 24 24" className="w-6 h-6 text-slate-900" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-1-13h2v6h-2zm0 8h2v2h-2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold tracking-tight font-display text-white">
              Aura <span className="text-amber-400 font-medium">Study Assistant</span>
            </h1>
            <p className={`text-[10.5px] uppercase tracking-wider ${theme === "midnight" ? "text-slate-500" : "text-slate-400"} font-mono`}>
              Optimized for Visually Impaired Learners • Real RAG Pipeline
            </p>
          </div>
        </div>

        {/* CONTROLS & STATUS */}
        <div className="flex flex-wrap items-center gap-3">
          {/* Active status pill */}
          <div className={`flex items-center gap-2 py-1.5 px-3.5 rounded-full border text-xs font-semibold ${
            theme === "midnight" ? "bg-slate-900/80 border-slate-700 text-slate-300" : "bg-slate-100 border-slate-300 text-slate-700"
          }`}>
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="uppercase tracking-wider">System Ready</span>
          </div>

          <div className="flex items-center bg-slate-800/40 p-1 rounded-xl border border-slate-700/80">
            <span className="text-[11px] text-slate-400 mr-2 font-mono font-medium pl-2">Size:</span>
            <button
              onClick={() => setFontSize("medium")}
              className={`px-2.5 py-0.5 rounded-lg text-xs transition font-semibold ${fontSize === "medium" ? "bg-amber-500 text-slate-950 font-black" : "text-slate-300 hover:bg-slate-700"}`}
              aria-label="Set Medium Text Size"
            >
              AA
            </button>
            <button
              onClick={() => setFontSize("large")}
              className={`px-2.5 py-0.5 rounded-lg text-xs transition font-bold ${fontSize === "large" ? "bg-amber-500 text-slate-950 font-black" : "text-slate-300 hover:bg-slate-700"}`}
              aria-label="Set Large Text Size"
            >
              AA
            </button>
            <button
              onClick={() => setFontSize("xl")}
              className={`px-2.5 py-0.5 rounded-lg text-xs transition font-extrabold ${fontSize === "xl" ? "bg-amber-500 text-slate-950 font-black" : "text-slate-300 hover:bg-slate-700"}`}
              aria-label="Set Extra Large Text Size"
            >
              AA
            </button>
          </div>

          {/* Contrast Theme Selector */}
          <div className="flex items-center bg-slate-800/40 p-1 rounded-xl border border-slate-700/80">
            <span className="text-[11px] text-slate-400 mr-2 font-mono pl-2">Contrast:</span>
            <button
              onClick={() => setTheme("midnight")}
              className={`w-5 h-5 rounded-full border border-slate-500 mr-1.5 bg-slate-950 ${theme === "midnight" ? "ring-2 ring-amber-500" : ""}`}
              title="Sleek Midnight Theme (High Contrast Dark)"
            />
            <button
              onClick={() => setTheme("warm")}
              className={`w-5 h-5 rounded-full border border-slate-500 bg-orange-100 ${theme === "warm" ? "ring-2 ring-amber-500" : ""}`}
              title="Warm Paper Theme (High Contrast Light)"
            />
          </div>

          {/* Speech Speed option */}
          <div className="flex items-center bg-slate-800/40 p-1 rounded-xl border border-slate-700/80 text-[11px]">
            <span className="text-slate-400 mr-1.5 font-mono pl-2">Speed:</span>
            <select
              value={voiceSpeed}
              onChange={(e) => setVoiceSpeed(parseFloat(e.target.value))}
              className="bg-[#0B1120] text-white rounded p-1 border border-slate-700 text-[11px] font-mono font-bold"
            >
              <option value="0.8">0.8x</option>
              <option value="1.0">1.0x</option>
              <option value="1.2">1.2x</option>
            </select>
          </div>
        </div>
      </nav>

      {/* QUICK STATUS MSG & SOUND CUE INDICATOR TO HELP SCREENREADERS */}
      <section
        className={`py-3 px-6 text-center text-sm font-semibold tracking-wide border-b border-opacity-30 ${
          theme === "midnight" ? "bg-amber-950/40 text-amber-200 border-amber-900/30" : "bg-amber-100/70 text-amber-900 border-amber-200"
        }`}
        aria-live="polite"
      >
        <span className="font-mono text-xs uppercase bg-amber-500 text-slate-950 px-2.5 py-0.5 mr-2 rounded font-extrabold">STATUS:</span>
        {feedbackMsg}
      </section>

      {/* MAIN CONTAINER CONTENT */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* LEFT INDEX PANEL (LOAD STUDY MATERIALS) */}
            <div className="lg:col-span-4 space-y-6">
              <div
                className={`p-6 rounded-2xl border ${
                  theme === "midnight" ? "bg-[#0B1120] border-slate-800" : "bg-white border-slate-200 shadow-sm"
                }`}
              >
                <h2 className={`${textStyles.heading} mb-2 flex items-center gap-2 font-display text-white`}>
                  <BookOpenCheck className="w-5 h-5 text-amber-500 flex-shrink-0" />
                  1. Study Material
                </h2>
                <p className={`text-xs ${theme === "midnight" ? "text-slate-400" : "text-slate-600"} mb-5`}>
                  Select a preloaded school study guide to index it with real-time vector embeddings, or paste custom notes.
                </p>
 
                {/* Pre-made Guide Cards */}
                <div className="space-y-3 mb-6">
                  <button
                    onClick={() => loadPreloadedGuide("biology")}
                    disabled={isIndexing}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      documentName.includes("Biology")
                        ? "bg-amber-500/10 border-amber-500/60 text-amber-400"
                        : theme === "midnight"
                        ? "bg-slate-800/30 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 text-slate-300"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    <span className="block font-bold text-sm">🎒 Biology Notes</span>
                    <span className="text-[11px] text-slate-400 block mt-1">Photosynthesis & Cell Respiration</span>
                  </button>
 
                  <button
                    onClick={() => loadPreloadedGuide("history")}
                    disabled={isIndexing}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      documentName.includes("History")
                        ? "bg-amber-500/10 border-amber-500/60 text-amber-400"
                        : theme === "midnight"
                        ? "bg-slate-800/30 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 text-slate-300"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    <span className="block font-bold text-sm">📜 World History Notes</span>
                    <span className="text-[11px] text-slate-400 block mt-1">Great British Industrial Revolution</span>
                  </button>
 
                  <button
                    onClick={() => loadPreloadedGuide("compSci")}
                    disabled={isIndexing}
                    className={`w-full text-left p-4 rounded-xl border transition-all ${
                      documentName.includes("Databases")
                        ? "bg-amber-500/10 border-amber-500/60 text-amber-400"
                        : theme === "midnight"
                        ? "bg-slate-800/30 border-slate-800 hover:border-slate-700 hover:bg-slate-800/50 text-slate-300"
                        : "bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100 text-slate-700"
                    }`}
                  >
                    <span className="block font-bold text-sm">💻 Computer Science</span>
                    <span className="text-[11px] text-slate-400 block mt-1">Databases & Search Tree Structures</span>
                  </button>
                </div>
 
                {/* CUSTOM PASTE AREA */}
                <div className="space-y-2 mt-4">
                  <span className="text-xs font-mono text-slate-400 block">Or paste custom text notes:</span>
                  <textarea
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Enter customized note paragraphs here..."
                    className={`w-full text-xs p-3 h-28 border rounded-xl outline-none transition-all ${
                      theme === "midnight"
                        ? "bg-slate-950/70 border-slate-800 focus:border-slate-700 text-slate-200"
                        : "bg-white border-slate-300 focus:border-slate-400 text-slate-900"
                    }`}
                  />
                  <button
                    onClick={handleCustomTextInputIndex}
                    disabled={isIndexing}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2.5 rounded-lg border border-slate-700 transition flex items-center justify-center gap-1.5"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    Index Pasted Notes
                  </button>
                </div>
 
                {/* DB CLEANSE */}
                {hasDocument && (
                  <button
                    onClick={clearIndexedDocument}
                    className="w-full mt-6 bg-red-950/30 text-red-400 border border-red-900/40 font-bold hover:bg-red-950/50 py-2 rounded-xl text-xs transition"
                  >
                    🗑️ Clear Study Materials
                  </button>
                )}
              </div>
 
              {/* AUDIT STATUS BOX */}
              <div
                className={`p-6 rounded-2xl border ${
                  theme === "midnight" ? "bg-[#0B1120] border-slate-800" : "bg-white border-slate-200 shadow-sm"
                }`}
              >
                <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3">RAG Pipeline Metrics:</h3>
                {hasDocument ? (
                  <div className="space-y-2.5 text-xs text-slate-300">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Indexed Document:</span>
                      <span className="font-bold text-slate-100">{documentName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Database Chunks:</span>
                      <span className="font-mono text-amber-400 font-extrabold">{chunkCount} blocks</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-800 pt-2 text-[11px]">
                      <span className="text-slate-400">Vector Model:</span>
                      <span className="text-slate-400">Google Gemini Embeds</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs text-slate-500">
                    <AlertCircle className="w-4 h-4" />
                    <span>No study guide vector index initialized.</span>
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT MAIN VOICE INTERACTIVE PORTAL */}
            <div className="lg:col-span-8 space-y-6">
              <div
                className={`p-6 md:p-8 rounded-3xl border transition-all ${
                  theme === "midnight" ? "bg-slate-800/20 border-slate-800" : "bg-white border-slate-200 shadow-md"
                }`}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className={`${textStyles.heading} flex items-center gap-2 text-amber-400 font-display`}>
                    <Sparkles className="w-5 h-5 animate-pulse text-amber-500" />
                    2. Study Assistant Core
                  </h2>
                  <div className={`flex items-center gap-1.5 text-xs font-mono px-3 py-1.5 rounded-full ${
                    theme === "midnight" ? "bg-slate-800 text-slate-300" : "bg-slate-100 text-slate-700"
                  }`}>
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                    <span>Acoustic Sync Live</span>
                  </div>
                </div>
 
                {!hasDocument ? (
                  <div className="text-center py-16 space-y-6">
                    <div className="w-20 h-20 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto text-amber-500 mb-2">
                      <BookOpen className="w-10 h-10" />
                    </div>
                    <div className="space-y-2">
                      <h3 className={`${textStyles.heading} font-sans`}>Assistant is waiting for materials...</h3>
                      <p className={`text-slate-400 text-sm max-w-md mx-auto ${textStyles.body}`}>
                        Select any of the 🎒 **Biology, History, or Science Study Guides** on the left menu. The system will slice and index them, allowing you to ask questions using the vocal mic.
                      </p>
                    </div>
                    <div>
                      <button
                        onClick={() => loadPreloadedGuide("biology")}
                        className="bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold px-6 py-3 rounded-2xl tracking-wide shadow-lg shadow-amber-500/10 text-sm transition-all cursor-pointer font-display"
                      >
                        🚀 Load Biology Study Guide Now
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {/* GIANT SLEEK HIGH-CONTRAST MICROPHONE SYSTEM WITH TRANSFORMS & OUTSET GLOWS */}
                    <div className="text-center space-y-4">
                      <p className={`text-slate-300 text-sm ${textStyles.body}`}>
                        Hold or tap the big microphone button to record your question, or use text search below.
                      </p>
 
                      <div className="flex justify-center py-6">
                        <button
                          onClick={toggleVoiceInput}
                          className="relative group cursor-pointer"
                          aria-label={isListening ? "Stop voice listening" : "Start voice listening"}
                        >
                          {/* Inner glowing effect container */}
                          <div className={`absolute -inset-4 rounded-full blur-xl transition-all duration-300 ${
                            isListening ? "bg-red-500/35 scale-110" : "bg-amber-500/20 group-hover:bg-amber-500/35"
                          }`}></div>
                          
                          <div className={`relative w-28 h-28 rounded-full flex flex-col items-center justify-center text-slate-950 shadow-2xl transition-all duration-300 ${
                            isListening
                              ? "bg-red-500 border border-red-400 text-white scale-105"
                              : "bg-amber-500 border border-amber-400 hover:bg-amber-600"
                          }`}>
                            {isListening ? (
                              <>
                                <MicOff className="w-9 h-9 mb-1 animate-pulse" />
                                <span className="text-[10px] font-black uppercase tracking-widest">STOP</span>
                              </>
                            ) : (
                              <>
                                <Mic className="w-9 h-9 mb-1" />
                                <span className="text-[10px] font-black uppercase tracking-widest">HOLD TO ASK</span>
                              </>
                            )}
                          </div>
                        </button>
                      </div>
 
                      {/* Real time transcription displaying */}
                      {query && (
                        <div className={`max-w-xl mx-auto p-4 rounded-xl border text-center ${
                          theme === "midnight" ? "bg-slate-950/80 border-slate-800" : "bg-white border-slate-300"
                        }`}>
                          <span className="text-xs font-mono text-slate-400 block mb-1">Detected Question Transcript:</span>
                          <span className={`${textStyles.largeText} text-amber-500 italic font-mono`}>"{query}"</span>
                        </div>
                      )}
                    </div>
 
                    {/* BACKUP TEXT INPUT */}
                    <div className={`border-t pt-6 space-y-3 ${theme === "midnight" ? "border-slate-800" : "border-slate-200"}`}>
                      <span className="text-xs font-mono text-slate-400 ml-1">Type question manually if preferred:</span>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={inputText}
                          onChange={(e) => setInputText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              setQuery(inputText);
                              handleQuerySearch(inputText);
                              setInputText("");
                            }
                          }}
                          placeholder="What would you like to understand about this chapter?"
                          className={`flex-1 px-4 py-3 rounded-2xl outline-none transition text-sm ${
                            theme === "midnight"
                              ? "bg-slate-950 border border-slate-800 focus:border-slate-700 text-slate-100"
                              : "bg-white border border-slate-300 focus:border-slate-400 text-slate-900"
                          }`}
                        />
                        <button
                          onClick={() => {
                            if (inputText.trim()) {
                              setQuery(inputText);
                              handleQuerySearch(inputText);
                              setInputText("");
                            }
                          }}
                          disabled={isQuerying}
                          className="px-6 py-3 rounded-2xl bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold text-sm transition-all cursor-pointer font-display"
                        >
                          Search
                        </button>
                      </div>
                    </div>
 
                    {/* INTERACTIVE GENERATION EXPLANATION BLOCK */}
                    <AnimatePresence mode="wait">
                      {(isQuerying || answer) && (
                        <motion.div
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0 }}
                          className={`p-6 rounded-2xl border ${
                            theme === "midnight" ? "bg-slate-900/60 border-slate-800" : "bg-orange-50/50 border-slate-300"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-4 pb-3 border-b border-slate-800/70">
                            <span className="text-xs font-mono font-bold tracking-wide text-amber-500 uppercase flex items-center gap-1.5 animate-pulse">
                              <Volume2 className="w-4 h-4" />
                              Study Explanation
                            </span>
                            <div className="flex gap-2">
                              {isSpeaking ? (
                                <button
                                  onClick={stopSpeaking}
                                  className="text-xs font-semibold px-3 py-1 bg-red-950/80 text-red-400 hover:bg-red-900 rounded-lg flex items-center gap-1 transition cursor-pointer"
                                >
                                  <VolumeX className="w-3.5 h-3.5" />
                                  Mute Speech
                                </button>
                              ) : (
                                answer && (
                                  <button
                                    onClick={() => announceAcoustically(answer)}
                                    className="text-xs font-semibold px-3 py-1 bg-emerald-950/80 text-emerald-400 hover:bg-emerald-900 rounded-lg flex items-center gap-1 transition cursor-pointer"
                                  >
                                    <Volume2 className="w-3.5 h-3.5" />
                                    Speak Answer
                                  </button>
                                )
                              )}
                            </div>
                          </div>
 
                          {isQuerying ? (
                            <div className="space-y-3 py-4">
                              <div className="flex items-center gap-2.5 text-sm text-slate-300">
                                <RefreshCw className="w-4 h-4 animate-spin text-amber-500" />
                                <span>Gemini is generating simplified study response...</span>
                              </div>
                              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                                <div className="h-full bg-amber-500 w-1/2 animate-shimmer" style={{ width: "80%" }} />
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-4">
                              <p className={`leading-relaxed font-sans font-medium text-slate-100 ${textStyles.body}`}>
                                {answer}
                              </p>
 
                              {/* AUDITING RELEVEL CHUNKS */}
                              {retrievedContext.length > 0 && (
                                <div className="mt-6 pt-5 border-t border-slate-800">
                                  <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-3">
                                    🔍 Study Sources consulted in database (RAG Context):
                                  </span>
                                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                                    {retrievedContext.map((c, i) => (
                                      <div
                                        key={i}
                                        className="p-3 bg-slate-900/40 rounded-xl border border-slate-800 text-[11px] hover:border-slate-700 transition"
                                      >
                                        <div className="flex justify-between text-slate-400 mb-1 font-mono">
                                          <span>Block {i + 1} - Page {c.pageNumber}</span>
                                          <span className="text-amber-400 font-bold">Similarity: {Math.round(c.similarity * 100)}%</span>
                                        </div>
                                        <span className="text-slate-300 leading-normal">{c.text}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}
              </div>
 
              {/* SHORTCUT GUIDANCE ACCESSIBILITY CARD */}
              <div
                className={`p-6 rounded-2xl border ${
                  theme === "midnight" ? "bg-[#0B1120] border-slate-800" : "bg-white border-slate-200"
                }`}
              >
                <h3 className="text-xs font-mono text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5 font-display text-white">
                  <HelpCircle className="w-4 h-4 text-amber-500" />
                  Visually Impaired Students Navigation Tips:
                </h3>
                <ul className="text-xs space-y-2 text-slate-400 leading-relaxed max-w-2xl">
                  <li>✨ <strong>Ctrl + S</strong>: Starts / stops the voice recognition recorder automatically from any screen context.</li>
                  <li>✨ <strong>Escape Key</strong>: Instantly silences any ongoing speech playbacks from the TTS system.</li>
                  <li>✨ The vector search uses <strong>strict text embeddings</strong>. It is completely safe to ask long, complex study guide contextual queries.</li>
                </ul>
              </div>
            </div>
          </div>
      </main>

      {/* FOOTER BAR FOR SLEEK INTERFACE */}
      <footer className={`h-14 border-t flex items-center justify-between px-6 md:px-10 flex-shrink-0 mt-12 transition-colors ${
        theme === "midnight" ? "bg-[#0B1120] border-slate-800 text-slate-400" : "bg-white border-slate-200 text-slate-600"
      }`}>
        <p className="text-[10px] uppercase font-bold tracking-widest font-mono">
          Powered by Google Gemini • Vector Engine: Gemini Embeddings
        </p>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-[10px] text-green-500 font-bold uppercase tracking-widest font-mono">Gemini API Active</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
