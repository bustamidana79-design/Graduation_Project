export function getProfileRoute(userType?: string | null, userId?: string | null) {
  if (!userId) return "/profile";

  switch (userType) {
    case "supplier":
      return `/dashboard/supplier/profile/${userId}`;
    case "merchant":
    case "small_business":
      return `/dashboard/small-business/profile/${userId}`;
    case "delivery":
      return `/dashboard/shipping-company/profile/${userId}`;
    case "supporter":
      return `/dashboard/supporter/profile/${userId}`;
    default:
      return `/profile/${userId}`;
  }
}

export function getDashboardMessagesRoute(userType?: string | null) {
  switch (userType) {
    case "supplier":
    case "merchant":
      return "/dashboard/supplier/messages";
    case "small_business":
      return "/dashboard/small-business/messages";
    case "delivery":
      return "/dashboard/shipping-company/messages";
    case "supporter":
      return "/dashboard/supporter/messages";
    default:
      return "/dashboard/small-business/messages";
  }
}
