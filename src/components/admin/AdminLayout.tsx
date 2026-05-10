import { Outlet } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AdminSidebar } from "./AdminSidebar";
import ProtectedRoute from "@/components/ProtectedRoute";
import Navigation from "@/components/ui/navigation";

export default function AdminLayout() {
  return (
    <ProtectedRoute>
      <Navigation />
      <SidebarProvider>
        <div className="flex min-h-[calc(100vh-4rem)] w-full pt-16">
          <AdminSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-12 flex items-center gap-2 border-b bg-background/80 backdrop-blur px-3 sticky top-16 z-30">
              <SidebarTrigger />
              <span className="text-sm text-muted-foreground">Painel Administrativo</span>
            </header>
            <main className="flex-1 w-full">
              <Outlet />
            </main>
          </div>
        </div>
      </SidebarProvider>
    </ProtectedRoute>
  );
}
