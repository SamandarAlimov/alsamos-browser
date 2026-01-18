import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { Plus, Loader2 } from "lucide-react";

export const UrlSubmit = () => {
  const { toast } = useToast();
  const [url, setUrl] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!url.trim()) {
      toast({
        title: "URL required",
        description: "Please enter a valid URL",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/submit-url`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: url.trim(), priority: 8 }),
        }
      );

      const data = await response.json();

      if (response.ok && data.success) {
        toast({
          title: "Success!",
          description: "Your URL has been added to the crawl queue",
        });
        setUrl("");
      } else {
        throw new Error(data.error || 'Failed to submit URL');
      }
    } catch (error: any) {
      console.error('Submit error:', error);
      toast({
        title: "Submission failed",
        description: error.message || "Unable to submit URL. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="glass-effect rounded-2xl p-6 shadow-glass">
      <h3 className="text-lg font-display font-semibold mb-4">Submit Your Website</h3>
      <p className="text-sm text-muted-foreground mb-4">
        Add your website to our index and make it searchable
      </p>
      
      <form onSubmit={handleSubmit} className="flex gap-2">
        <Input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://example.com"
          className="flex-1"
          disabled={isSubmitting}
        />
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-gradient-primary hover:opacity-90 transition-opacity"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Submitting...
            </>
          ) : (
            <>
              <Plus className="w-4 h-4 mr-2" />
              Submit
            </>
          )}
        </Button>
      </form>
    </div>
  );
};
