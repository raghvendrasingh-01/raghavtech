import { DemoStoreProvider } from "@/components/providers/demo-store";
import { AuthProvider } from "@/components/providers/auth-provider";
import { Sidebar } from "@/components/app/sidebar";
import { Topbar } from "@/components/app/topbar";
import { MobileNav } from "@/components/app/mobile-nav";

/** Authenticated app shell: persistent sidebar, topbar, and mobile nav. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
    <DemoStoreProvider>
      <div className="min-h-screen">
        <Sidebar />
        <div className="lg:pl-64">
          <div className="mx-auto max-w-[1400px] px-4 pb-28 sm:px-6 lg:pb-10">
            <Topbar />
            <main>{children}</main>
          </div>
        </div>
        <MobileNav />
      </div>
    </DemoStoreProvider>
    </AuthProvider>
  );
}
