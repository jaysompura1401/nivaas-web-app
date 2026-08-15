import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getToken } from "@/lib/api";
import { fetchProfile } from "@/lib/auth-cache";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const token = getToken();
    if (!token) throw redirect({ to: "/auth" });

    // Validate token is still good by fetching profile
    const profile = await fetchProfile();
    if (!profile) throw redirect({ to: "/auth" });

    return { user: profile };
  },
  component: () => <Outlet />,
});
