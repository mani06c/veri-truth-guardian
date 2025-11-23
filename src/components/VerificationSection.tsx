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
            <TextVerification />
          </TabsContent>

          <TabsContent value="image" className="mt-0">
            <ImageVerification />
          </TabsContent>

          <TabsContent value="video" className="mt-0">
            <VideoVerification />
          </TabsContent>

          <TabsContent value="url" className="mt-0">
            <UrlVerification />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};
