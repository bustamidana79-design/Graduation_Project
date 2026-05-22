import DashboardUserProfile from "@/components/DashboardUserProfile";

export default function AdminUserProfilePage() {
  return <DashboardUserProfile backHref="/dashboard/admin" includeAllProfiles />;
}
