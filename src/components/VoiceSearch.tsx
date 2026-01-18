import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Mic, MicOff, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface VoiceSearchProps {
  onResult: (transcript: string) => void;
  onSearchTrigger?: () => void;
}

export const VoiceSearch = ({ onResult, onSearchTrigger }: VoiceSearchProps) => {
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
  }, []);

  const startListening = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      toast.error("Voice search is not supported in your browser");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";

    recognition.onstart = () => {
      setIsListening(true);
      toast.info("Listening... Speak now");
    };

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setIsListening(false);
      toast.success(`Heard: "${transcript}"`);
      // Trigger search after getting result
      setTimeout(() => onSearchTrigger?.(), 100);
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied. Please enable it in your browser settings.");
      } else if (event.error === "no-speech") {
        toast.error("No speech detected. Please try again.");
      } else {
        toast.error(`Voice recognition error: ${event.error}`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognition.start();
  }, [onResult, onSearchTrigger]);

  if (!isSupported) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={startListening}
      disabled={isListening}
      className="relative"
      title="Voice search"
    >
      {isListening ? (
        <>
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
          <span className="absolute -top-1 -right-1 w-3 h-3 bg-destructive rounded-full animate-pulse" />
        </>
      ) : (
        <Mic className="w-5 h-5 text-muted-foreground hover:text-primary transition-colors" />
      )}
    </Button>
  );
};

// Type declarations for Web Speech API
interface SpeechRecognitionErrorEventCustom extends Event {
  error: string;
  message?: string;
}

interface SpeechRecognitionResultCustom {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionResultListCustom {
  length: number;
  item(index: number): SpeechRecognitionResultCustom[];
  [index: number]: SpeechRecognitionResultCustom[];
}

interface SpeechRecognitionEventCustom extends Event {
  results: SpeechRecognitionResultListCustom;
  resultIndex: number;
}

interface SpeechRecognitionCustom extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: ((this: SpeechRecognitionCustom, ev: Event) => any) | null;
  onresult: ((this: SpeechRecognitionCustom, ev: SpeechRecognitionEventCustom) => any) | null;
  onerror: ((this: SpeechRecognitionCustom, ev: SpeechRecognitionErrorEventCustom) => any) | null;
  onend: ((this: SpeechRecognitionCustom, ev: Event) => any) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognitionCustom;
    webkitSpeechRecognition: new () => SpeechRecognitionCustom;
  }
}
