import { Card } from "@/components/ui/card";
import { AppHeader } from "@/components/AppHeader";
import { useAuth } from "@/contexts/AuthContext";
import { ShieldCheck, Sparkles, History } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";

const Dashboard = () => {
  const { profile, user } = useAuth();
  const name = profile?.display_name || profile?.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen bg-gradient-hero">
      <AppHeader />
      <main className="container mx-auto px-4 py-10 max-w-6xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold">Welcome back, {name}</h1>
          <p className="text-muted-foreground">Your forensic command center.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Card className="glass-panel p-6 animate-lift">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-success/15 p-2 rounded-lg"><ShieldCheck className="h-5 w-5 text-success" /></div>
              <span className="text-sm text-muted-foreground">Total scans</span>
            </div>
            <div className="text-3xl font-bold">0</div>
          </Card>
          <Card className="glass-panel p-6 animate-lift">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-warning/15 p-2 rounded-lg"><Sparkles className="h-5 w-5 text-warning" /></div>
              <span className="text-sm text-muted-foreground">Suspicious found</span>
            </div>
            <div className="text-3xl font-bold">0</div>
          </Card>
          <Card className="glass-panel p-6 animate-lift">
            <div className="flex items-center gap-3 mb-2">
              <div className="bg-primary/15 p-2 rounded-lg"><History className="h-5 w-5 text-primary" /></div>
              <span className="text-sm text-muted-foreground">Last scan</span>
            </div>
            <div className="text-3xl font-bold">—</div>
          </Card>
        </div>

        <Card className="glass-panel p-8 text-center animate-glass-fade">
          <Sparkles className="h-12 w-12 mx-auto text-primary mb-4" />
          <h2 className="text-xl font-bold mb-2">No scans yet</h2>
          <p className="text-muted-foreground mb-6">Run your first analysis to start building your trust dashboard.</p>
          <Button asChild className="bg-gradient-primary">
            <Link to="/">Start an analysis</Link>
          </Button>
        </Card>
      </main>
    </div>
  );
};

export default Dashboard;
