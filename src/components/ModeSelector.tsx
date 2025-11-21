import { FileText, Image, Video, Link2 } from "lucide-react";
import { Card } from "@/components/ui/card";

interface ModeSelectorProps {
  onSelectMode: (mode: "text" | "image" | "video" | "url") => void;
}

export const ModeSelector = ({ onSelectMode }: ModeSelectorProps) => {
  const modes = [
    {
      id: "image" as const,
      icon: Image,
      title: "Image Analysis",
      description: "Detect deepfakes and manipulated images",
    },
    {
      id: "text" as const,
      icon: FileText,
      title: "Text Fake-News Detection",
      description: "Analyze text content for misinformation",
    },
    {
      id: "video" as const,
      icon: Video,
      title: "Video Deepfake Check",
      description: "Identify manipulated video content",
    },
    {
      id: "url" as const,
      icon: Link2,
      title: "URL Fact-Check",
      description: "Verify website credibility and content",
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-hero">
      <div className="w-full max-w-6xl">
        <div className="text-center mb-12 animate-glass-fade">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-primary bg-clip-text text-transparent">
            AI Detection Platform
          </h1>
          <p className="text-xl text-muted-foreground">
            Choose your analysis mode
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {modes.map((mode, index) => (
            <Card
              key={mode.id}
              onClick={() => onSelectMode(mode.id)}
              className="glass-panel animate-lift cursor-pointer p-8 border-2 hover:border-primary/50 transition-all"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-2xl bg-gradient-primary glass-glow">
                  <mode.icon className="w-12 h-12 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-semibold mb-2">{mode.title}</h3>
                  <p className="text-muted-foreground">{mode.description}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
};
