import { AlertTriangle, Shield, ShieldAlert, ShieldCheck, ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SafetyCheckResult } from "@/hooks/useSafeBrowsing";

interface SafeBrowsingWarningProps {
  isOpen: boolean;
  onClose: () => void;
  onProceed: () => void;
  url: string;
  safetyResult: SafetyCheckResult;
}

export const SafeBrowsingWarning = ({
  isOpen,
  onClose,
  onProceed,
  url,
  safetyResult,
}: SafeBrowsingWarningProps) => {
  const getRiskIcon = () => {
    switch (safetyResult.riskLevel) {
      case "high":
        return <ShieldAlert className="w-12 h-12 text-destructive" />;
      case "medium":
        return <AlertTriangle className="w-12 h-12 text-yellow-500" />;
      case "low":
        return <Shield className="w-12 h-12 text-orange-400" />;
      default:
        return <ShieldCheck className="w-12 h-12 text-green-500" />;
    }
  };

  const getRiskColor = () => {
    switch (safetyResult.riskLevel) {
      case "high":
        return "bg-destructive/10 border-destructive/50";
      case "medium":
        return "bg-yellow-500/10 border-yellow-500/50";
      case "low":
        return "bg-orange-400/10 border-orange-400/50";
      default:
        return "bg-green-500/10 border-green-500/50";
    }
  };

  const getRiskLabel = () => {
    switch (safetyResult.riskLevel) {
      case "high":
        return "High Risk";
      case "medium":
        return "Medium Risk";
      case "low":
        return "Low Risk";
      default:
        return "Safe";
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center justify-center mb-4">
            <div className={`p-4 rounded-full ${getRiskColor()}`}>
              {getRiskIcon()}
            </div>
          </div>
          <DialogTitle className="text-center text-xl">
            Security Warning
          </DialogTitle>
          <DialogDescription className="text-center">
            <span
              className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${getRiskColor()}`}
            >
              {getRiskLabel()}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <p className="text-sm text-muted-foreground text-center">
            You're about to visit:
          </p>
          <p className="text-sm font-mono bg-muted p-2 rounded break-all text-center">
            {url}
          </p>

          {safetyResult.warnings.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-medium">Potential issues detected:</p>
              <ul className="space-y-1">
                {safetyResult.warnings.map((warning, index) => (
                  <li
                    key={index}
                    className="text-sm text-muted-foreground flex items-start gap-2"
                  >
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 text-yellow-500 mt-0.5" />
                    {warning}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button onClick={onClose} variant="default" className="w-full">
            <X className="w-4 h-4 mr-2" />
            Go Back to Safety
          </Button>
          <Button
            onClick={onProceed}
            variant="outline"
            className="w-full text-muted-foreground"
          >
            <ExternalLink className="w-4 h-4 mr-2" />
            Proceed Anyway (Not Recommended)
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
