// Hook + re-export from context for backward compatibility
// This allows existing components to continue working without changes
import { useContext } from "react";
import { SiteSettingsContext, type SiteSettingsContextType } from "@/contexts/siteSettingsContextValue";

export const useSiteSettingsContext = (): SiteSettingsContextType => {
  const context = useContext(SiteSettingsContext);
  if (context === undefined) {
    throw new Error("useSiteSettingsContext must be used within a SiteSettingsProvider");
  }
  return context;
};

export { useSiteSettingsContext as useSiteSettings };
export type { SiteSettings } from "@/contexts/siteSettingsContextValue";
