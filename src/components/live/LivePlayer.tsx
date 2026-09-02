import { useState, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import MahimaGhostPlayer from "../video/MahimaGhostPlayer";

interface LivePlayerProps {
  youtubeId: string;
  title: string;
  recordingUrl?: string | null;
}

/**
 * LivePlayer — YouTube live stream ya recording, dono in-app hi chalein.
 * No external redirect to YouTube.
 */
const LivePlayer = ({ youtubeId, title, recordingUrl }: LivePlayerProps) => {
  const [playerKey, setPlayerKey] = useState(0);

  const handleReload = useCallback(() => {
    setPlayerKey((k) => k + 1);
  }, []);

  // Prefer recording when session ended and recording is available
  const videoUrl = recordingUrl && recordingUrl.trim().length > 0
    ? recordingUrl
    : `https://www.youtube.com/live/${youtubeId}`;

  return (
    <div className="relative w-full">
      <MahimaGhostPlayer
        key={playerKey}
        videoUrl={videoUrl}
        title={title}
      />

      {/* Reload — sirf yahi option, no external link */}
      <button
        onClick={handleReload}
        className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-video-scrim/40 hover:bg-video-scrim/60 text-video-scrim-foreground/70 hover:text-video-scrim-foreground transition-colors"
        title="Reload stream"
        aria-label="Reload stream"
      >
        <RefreshCw className="h-3.5 w-3.5" />
      </button>
    </div>
  );
};

export default LivePlayer;
