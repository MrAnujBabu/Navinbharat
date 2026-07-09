import { Menu, User } from "lucide-react";
import { Button } from "../ui/button";
import { Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useIsMobile } from "../../hooks/use-mobile";
import { selectionHaptic } from "../../lib/native/haptics";
import logoIcon from "../../assets/branding/nb-fist-logo.webp";
import NotificationDropdown from "./NotificationDropdown";
import ProfileAvatar from "../profile/ProfileAvatar";

interface HeaderProps {
  onMenuClick: () => void;
  userName?: string;
}

const Header = ({ onMenuClick, userName }: HeaderProps) => {
  const { user, profile, isAuthenticated } = useAuth();
  const isMobile = useIsMobile();
  const displayName = profile?.fullName ?? userName;

  return (
    <>
    <header
      className="fixed left-0 right-0 top-0 z-40 flex items-center justify-between px-2 pl-safe-l pr-safe-r md:px-4 py-1.5 pt-safe-t bg-card border-b border-border min-h-[calc(env(safe-area-inset-top,0px)+52px)] md:min-h-[calc(env(safe-area-inset-top,0px)+60px)] shadow-sm"
    >
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { void selectionHaptic(); onMenuClick(); }}
          className="text-foreground hover:bg-muted h-8 w-8 active:scale-[0.94] transition-transform duration-150 ease-out"
        >
          <Menu className="h-4.5 w-4.5" />
        </Button>
        <Link to="/" onClick={() => { void selectionHaptic(); }} className="flex items-center gap-2 active:scale-[0.98] transition-transform duration-150 ease-out" style={{ padding: '0 2px' }}>
          <img
            src={logoIcon}
            alt="Naveen Bharat"
            className="h-8 w-8 rounded-full object-contain"
            width={32}
            height={32}
          />
          {!isMobile && (
            <span className="font-semibold text-lg text-foreground">
              Naveen Bharat
            </span>
          )}
        </Link>
      </div>

      <div className="flex items-center gap-2">
        <NotificationDropdown />
        {isAuthenticated ? (
          <Link to="/profile" onClick={() => { void selectionHaptic(); }}>
            <Button variant="ghost" size="icon" className="text-foreground hover:bg-muted relative active:scale-[0.94] transition-transform duration-150 ease-out">
              <ProfileAvatar
                avatarUrl={profile?.avatarUrl ?? null}
                fullName={displayName}
                userId={user?.id}
                size="sm"
              />
            </Button>
          </Link>
        ) : (
          <Link to="/login" onClick={() => { void selectionHaptic(); }}>
            <Button variant="ghost" size="icon" className="text-foreground hover:bg-muted active:scale-[0.94] transition-transform duration-150 ease-out">
              <User className="h-5 w-5" />
            </Button>
          </Link>
        )}
      </div>
    </header>
    <div aria-hidden="true" className="shrink-0 min-h-[calc(env(safe-area-inset-top,0px)+52px)] md:min-h-[calc(env(safe-area-inset-top,0px)+60px)]" />
    </>
  );
};

export default Header;
