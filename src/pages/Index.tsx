import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowRight, Shield, Zap, Brain, Lock, Globe, Cloud, Sparkles, Mic } from "lucide-react";
import { Link } from "react-router-dom";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TrendingSearches } from "@/components/TrendingSearches";
import { UserMenu } from "@/components/UserMenu";
import { AIAssistant, AIAssistantTrigger } from "@/components/AIAssistant";
import alsamosLogo from "@/assets/alsamos-logo.png";
const Index = () => {
  const [assistantOpen, setAssistantOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-hero">
      {/* AI Assistant */}
      <AIAssistant isOpen={assistantOpen} onClose={() => setAssistantOpen(false)} />
      <AIAssistantTrigger onClick={() => setAssistantOpen(true)} />

      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-effect">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src={alsamosLogo} alt="Alsamos" className="w-8 h-8 object-contain" />
            <span className="text-2xl font-display font-bold gradient-text">Alsamos</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">Features</a>
            <a href="#ai" className="text-sm font-medium hover:text-primary transition-colors">AI Assistant</a>
            <Link to="/search">
              <Button variant="outline" size="sm" className="glass-effect">
                Search
              </Button>
            </Link>
            <Link to="/browser">
              <Button variant="outline" size="sm" className="glass-effect">
                Browser
              </Button>
            </Link>
            <Button 
              variant="outline" 
              size="sm" 
              className="glass-effect"
              onClick={() => setAssistantOpen(true)}
            >
              <Mic className="w-4 h-4 mr-2" />
              AI Assistant
            </Button>
            <ThemeToggle />
            <UserMenu />
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-6 pt-32 pb-20">
        <div className="max-w-4xl mx-auto text-center space-y-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass-effect text-sm font-medium mb-4">
            <Sparkles className="w-4 h-4 text-secondary" />
            <span>The Future of Intelligent Search</span>
          </div>
          
          <h1 className="text-6xl md:text-7xl font-display font-bold leading-tight">
            Alsamos
            <br />
            <span className="gradient-text">AI Search & Browser</span>
          </h1>
          
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Professional AI-powered search engine with voice assistant, 
            semantic search, and integrated web browser.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
            <Link to="/search">
              <Button size="lg" className="bg-gradient-primary hover:opacity-90 transition-opacity shadow-premium">
                Start Searching
                <ArrowRight className="ml-2 w-5 h-5" />
              </Button>
            </Link>
            <Link to="/auth">
              <Button size="lg" variant="outline" className="glass-effect">
                Create Account
              </Button>
            </Link>
          </div>
        </div>

        {/* Browser Preview */}
        <div className="max-w-6xl mx-auto mt-20 glass-effect rounded-2xl p-2 shadow-premium">
          <div className="bg-background/50 rounded-xl overflow-hidden">
            <div className="h-10 bg-muted/50 flex items-center gap-2 px-4">
              <div className="flex gap-2">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 ml-4 h-6 bg-background rounded flex items-center px-3 text-xs text-muted-foreground">
                https://browser.alsamos.com
              </div>
            </div>
            <div className="aspect-[16/9] bg-gradient-to-br from-primary/20 to-secondary/20 flex items-center justify-center">
              <img src={alsamosLogo} alt="Alsamos Browser" className="w-32 h-32 object-contain opacity-50" />
            </div>
          </div>
        </div>

        {/* Trending Searches */}
        <div className="max-w-4xl mx-auto mt-12">
          <TrendingSearches />
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-6 py-20">
        <h2 className="text-4xl font-display font-bold text-center mb-16">
          <span className="gradient-text">Powerful Features</span>
        </h2>
        
        <div className="grid md:grid-cols-3 gap-8">
          {[
            { icon: Brain, title: "AI Voice Assistant", desc: "Talk naturally with our AI assistant - like Google Assistant or Alisa" },
            { icon: Zap, title: "Lightning Fast Search", desc: "Optimized search algorithms deliver results in milliseconds" },
            { icon: Shield, title: "Privacy First", desc: "Your searches are encrypted and never sold to advertisers" },
            { icon: Mic, title: "Voice Commands", desc: "Search, navigate, and control with your voice - hands-free" },
            { icon: Globe, title: "Full Web Browser", desc: "Built-in browser to visit any website directly from search results" },
            { icon: Cloud, title: "Cloud Sync", desc: "Saved searches and bookmarks available across all devices" },
          ].map((feature, i) => (
            <div key={i} className="glass-effect rounded-2xl p-6 hover:shadow-hover transition-all duration-300 border border-border/50">
              <feature.icon className="w-12 h-12 text-primary mb-4" />
              <h3 className="text-xl font-display font-bold mb-2">{feature.title}</h3>
              <p className="text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI Section */}
      <section id="ai" className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-4xl font-display font-bold text-center mb-6">
            <span className="gradient-text">Alsamos AI Assistant</span>
          </h2>
          <p className="text-xl text-center text-muted-foreground mb-16">
            Your personal AI assistant - powered by advanced language models
          </p>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              "Voice Commands & Recognition",
              "Natural Conversation",
              "Web Search Integration",
              "Smart Navigation",
              "Multi-Language Support",
              "Real-Time Responses",
            ].map((feature, i) => (
              <div key={i} className="glass-effect rounded-xl p-6 flex items-center gap-4 border border-border/50 hover:shadow-hover transition-all">
                <div className="w-10 h-10 rounded-lg bg-gradient-primary flex items-center justify-center">
                  <Sparkles className="w-6 h-6 text-primary-foreground" />
                </div>
                <span className="font-display font-semibold">{feature}</span>
              </div>
            ))}
          </div>

          <div className="mt-12 text-center">
            <Button 
              size="lg" 
              className="bg-gradient-primary hover:opacity-90 transition-opacity shadow-premium"
              onClick={() => setAssistantOpen(true)}
            >
              <Mic className="w-5 h-5 mr-2" />
              Try AI Assistant
            </Button>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section id="cta" className="container mx-auto px-6 py-20">
        <div className="max-w-4xl mx-auto glass-effect rounded-3xl p-12 text-center shadow-premium border border-border/50">
          <h2 className="text-4xl font-display font-bold mb-6">
            <span className="gradient-text">Ready to Search Smarter?</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8">
            Join thousands of users enjoying AI-powered search
          </p>
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/auth">
              <Button size="lg" className="bg-gradient-primary hover:opacity-90 transition-opacity">
                Create Free Account
              </Button>
            </Link>
            <Link to="/search">
              <Button size="lg" variant="outline" className="glass-effect">
                Try Without Account
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border/50 py-12">
        <div className="container mx-auto px-6">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <img src={alsamosLogo} alt="Alsamos" className="w-6 h-6 object-contain" />
                <span className="text-xl font-display font-bold gradient-text">Alsamos</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Professional AI-powered search & browser
              </p>
            </div>
            
            <div>
              <h3 className="font-display font-semibold mb-4">Product</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-primary transition-colors">Features</a></li>
                <li><Link to="/search" className="hover:text-primary transition-colors">Search Engine</Link></li>
                <li><Link to="/browser" className="hover:text-primary transition-colors">Web Browser</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-display font-semibold mb-4">AI Features</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#ai" className="hover:text-primary transition-colors">AI Assistant</a></li>
                <li><Link to="/auth" className="hover:text-primary transition-colors">Sign Up</Link></li>
                <li><Link to="/settings" className="hover:text-primary transition-colors">Settings</Link></li>
              </ul>
            </div>

            <div>
              <h3 className="font-display font-semibold mb-4">Legal</h3>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#" className="hover:text-primary transition-colors">Privacy</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Terms</a></li>
                <li><a href="#" className="hover:text-primary transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-border/50 text-center text-sm text-muted-foreground">
            © 2025 Alsamos. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
