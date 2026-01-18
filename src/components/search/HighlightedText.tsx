import { useMemo } from "react";

interface HighlightedTextProps {
  text: string;
  query: string;
  className?: string;
}

export const HighlightedText = ({ text, query, className = "" }: HighlightedTextProps) => {
  const highlightedParts = useMemo(() => {
    if (!query.trim() || !text) {
      return [{ text, isHighlight: false }];
    }

    const queryWords = query.toLowerCase().split(/\s+/).filter(Boolean);
    const regex = new RegExp(`(${queryWords.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    
    const parts: { text: string; isHighlight: boolean }[] = [];
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      // Add non-matching text before this match
      if (match.index > lastIndex) {
        parts.push({
          text: text.slice(lastIndex, match.index),
          isHighlight: false,
        });
      }
      
      // Add the matching text
      parts.push({
        text: match[0],
        isHighlight: true,
      });
      
      lastIndex = match.index + match[0].length;
    }

    // Add any remaining text
    if (lastIndex < text.length) {
      parts.push({
        text: text.slice(lastIndex),
        isHighlight: false,
      });
    }

    return parts.length > 0 ? parts : [{ text, isHighlight: false }];
  }, [text, query]);

  return (
    <span className={className}>
      {highlightedParts.map((part, index) => (
        part.isHighlight ? (
          <mark 
            key={index} 
            className="bg-primary/20 text-foreground rounded px-0.5"
          >
            {part.text}
          </mark>
        ) : (
          <span key={index}>{part.text}</span>
        )
      ))}
    </span>
  );
};
