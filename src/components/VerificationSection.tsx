import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TextVerification } from "./TextVerification";
import { ImageVerification } from "./ImageVerification";

export const VerificationSection = () => {
  const [activeTab, setActiveTab] = useState("text");

  return (
    <section id="verify" className="py-20 px-4 bg-background">
      <div className="container mx-auto max-w-5xl">
        <div className="text-center mb-12">
          <h2 className="text-4xl font-bold mb-4">Verify Content</h2>
          <p className="text-lg text-muted-foreground">
            Upload text or images to check their authenticity
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-2 max-w-md mx-auto mb-8">
            <TabsTrigger value="text" className="text-base">
              Text Analysis
            </TabsTrigger>
            <TabsTrigger value="image" className="text-base">
              Image Detection
            </TabsTrigger>
          </TabsList>

          <TabsContent value="text" className="mt-0">
            <TextVerification />
          </TabsContent>

          <TabsContent value="image" className="mt-0">
            <ImageVerification />
          </TabsContent>
        </Tabs>
      </div>
    </section>
  );
};
