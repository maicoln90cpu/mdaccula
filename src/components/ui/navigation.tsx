import { useState, useCallback } from "react";
import { NavLink } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Menu, X, Calendar, Users, MessageCircle, LogIn, LogOut, BookOpen, User, Settings, Link, Moon, Sun, Mic } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SearchBar } from "./SearchBar";
import { useTheme } from "next-themes";
import { supabase } from "@/integrations/supabase/client";

const Navigation = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { user, signOut, isAdmin } = useAuth();
  const { theme, setTheme } = useTheme();
  const queryClient = useQueryClient();

  // Lightweight prefetch for links only (blog and events removed - too heavy)
  const prefetchLinks = useCallback(() => {
    queryClient.prefetchQuery({
      queryKey: ['link-groups'],
      queryFn: async () => {
        const { data } = await supabase
          .from("link_groups")
          .select(`*, custom_links (*)`)
          .eq("enabled", true)
          .order("display_order", { ascending: true });
        return data || [];
      },
      staleTime: 2 * 60 * 1000,
    });
  }, [queryClient]);

  const navigationItems = [
    { name: "Eventos", href: "/eventos", icon: Calendar, prefetch: undefined },
    { name: "MDAcculaRadio", href: "/MDAcculaRadio", icon: Mic, prefetch: undefined },
    { name: "Blog", href: "/blog", icon: BookOpen, prefetch: undefined },
    { name: "Links", href: "/links", icon: Link, prefetch: prefetchLinks },
    { name: "Quem Somos", href: "/quem-somos", icon: Users, prefetch: undefined },
    { name: "Contato", href: "/contato", icon: MessageCircle, prefetch: undefined },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16 sm:h-14">
          {/* Logo */}
          <NavLink to="/" className="flex items-center space-x-2">
            <div className="text-xl font-bold logo-gradient">MDAccula</div>
          </NavLink>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-4">
            {navigationItems.map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onMouseEnter={item.prefetch}
                onFocus={item.prefetch}
                className={({ isActive }) =>
                  `nav-link flex items-center space-x-1 px-2 py-1 text-sm font-medium ${
                    isActive ? "text-primary active" : "text-foreground"
                  }`
                }
              >
                <item.icon className="w-4 h-4" />
                <span>{item.name}</span>
              </NavLink>
            ))}

            <SearchBar />

            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="relative"
            >
              <Sun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
              <Moon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              <span className="sr-only">Alternar tema</span>
            </Button>

            {user ? (
              <div className="flex items-center space-x-4">
                {isAdmin && (
                  <Button variant="outline" size="sm" asChild>
                    <NavLink to="/admin" className="flex items-center space-x-2">
                      <Settings className="w-4 h-4" />
                      <span>Admin</span>
                    </NavLink>
                  </Button>
                )}
                <span className="text-sm text-muted-foreground">{user.email}</span>
                <Button variant="outline" size="sm" onClick={signOut}>
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair
                </Button>
              </div>
            ) : (
              <Button variant="outline" asChild>
                <NavLink to="/auth" className="flex items-center space-x-2">
                  <User className="w-4 h-4" />
                  <span>Login</span>
                </NavLink>
              </Button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="md:hidden">
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="min-h-[48px] min-w-[48px]"
              aria-label={isMobileMenuOpen ? "Fechar menu" : "Abrir menu"}
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </Button>
          </div>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden">
            <div className="px-2 pt-2 pb-3 space-y-2 bg-card/95 backdrop-blur-md rounded-lg mt-2 border border-border shadow-lg">
              {navigationItems.map((item) => (
                <NavLink
                  key={item.name}
                  to={item.href}
                  className={({ isActive }) =>
                    `nav-link flex items-center space-x-3 px-4 py-3 text-base font-medium rounded-md min-h-[48px] transition-all ${
                      isActive ? "text-primary bg-primary/10" : "text-foreground hover:bg-muted"
                    }`
                  }
                  onClick={() => setIsMobileMenuOpen(false)}
                >
                  <item.icon className="w-5 h-5 flex-shrink-0" />
                  <span>{item.name}</span>
                </NavLink>
              ))}
              
              <Button
                variant="ghost"
                className="w-full justify-start"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              >
                {theme === "dark" ? (
                  <>
                    <Sun className="w-4 h-4 mr-2" />
                    Modo Claro
                  </>
                ) : (
                  <>
                    <Moon className="w-4 h-4 mr-2" />
                    Modo Escuro
                  </>
                )}
              </Button>
              
              <div className="pt-2">
                {user ? (
                  <div className="space-y-2">
                    {isAdmin && (
                      <Button variant="outline" className="w-full" asChild>
                        <NavLink to="/admin" onClick={() => setIsMobileMenuOpen(false)}>
                          <Settings className="w-4 h-4 mr-2" />
                          Admin
                        </NavLink>
                      </Button>
                    )}
                    <div className="text-sm text-muted-foreground text-center">{user.email}</div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        signOut();
                        setIsMobileMenuOpen(false);
                      }}
                    >
                      <LogOut className="w-4 h-4 mr-2" />
                      Sair
                    </Button>
                  </div>
                ) : (
                  <Button variant="outline" className="w-full" asChild>
                    <NavLink to="/auth" onClick={() => setIsMobileMenuOpen(false)}>
                      <User className="w-4 h-4 mr-2" />
                      Login
                    </NavLink>
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navigation;
