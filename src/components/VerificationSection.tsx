import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextVerification } from "./TextVerification";
import { ImageVerification } from "./ImageVerification";
import { VideoVerification } from "./VideoVerification";
import { UrlVerification } from "./UrlVerification";

export const VerificationSection = () => {
  const [activeTab, setActiveTab] = useState("text");

  return (
    <section id="verify" className="py-20 px-4 bg-background">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Verify Content</h2>
          <p className="text-lg text-muted-foreground">
            Analyze text, images, videos, or URLs to check their authenticity
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-4 max-w-3xl mx-auto mb-8">
            <TabsTrigger value="text" className="text-base">
              Text
            </TabsTrigger>
            <TabsTrigger value="image" className="text-base">
              Image
            </TabsTrigger>
            <TabsTrigger value="video" className="text-base">
              Video
            </TabsTrigger>
            <TabsTrigger value="url" className="text-base">
              URL
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="mt-0">
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-semibold mb-2">Text Fake News Detection</h3>
              <p className="text-muted-foreground">Analyze text content for misinformation and AI-generated content</p>
            </div>
            <TextVerification />
          </TabsContent>

          <TabsContent value="image" className="mt-0">
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-semibold mb-2">Image Deepfake Detection</h3>
              <p className="text-muted-foreground">Detect manipulated or AI-generated images</p>
            </div>
            <ImageVerification />
          </TabsContent>

          <TabsContent value="video" className="mt-0">
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-semibold mb-2">Video Deepfake Analysis</h3>
              <p className="text-muted-foreground">Identify deepfake videos and manipulation patterns</p>
            </div>
            <VideoVerification />
          </TabsContent>

          <TabsContent value="url" className="mt-0">
            <div className="mb-6 text-center">
              <h3 className="text-2xl font-semibold mb-2">URL Fact-Checking</h3>
              <p className="text-muted-foreground">Verify website credibility and content authenticity</p>
            </div>
            <UrlVerification />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};
