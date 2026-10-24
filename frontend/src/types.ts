export type Role = "CUSTOMER" | "COURIER" | "ADMIN";
export type Status =
  | "PENDING"
  | "SEARCHING"
  | "ASSIGNED"
  | "PICKED_UP"
  | "IN_TRANSIT"
  | "DELIVERED"
  | "CANCELLED";
export interface User {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  role: Role;
  createdAt?: string;
}
export interface DeliveryEvent {
  id: string;
  status: Status;
  note?: string | null;
  createdAt: string;
}
export interface Delivery {
  id: string;
  customerId: string;
  courierId?: string | null;
  pickupAddress: string;
  dropoffAddress: string;
  pickupReference?: string | null;
  dropoffReference?: string | null;
  recipientName?: string | null;
  recipientPhone?: string | null;
  packageDescription?: string | null;
  distanceKm: string | number;
  totalAmount: string | number;
  status: Status;
  createdAt: string;
  updatedAt: string;
  customer?: { id: string; user: User };
  courier?: { id: string; user: User } | null;
  events?: DeliveryEvent[];
}
export interface Shift {
  id: string;
  courierId: string;
  openedAt: string;
  closedAt?: string | null;
  openedBy?: { name: string };
  closedBy?: { name: string } | null;
  courier?: { user: User };
}
export interface Courier {
  id: string;
  userId: string;
  isApproved: boolean;
  isAvailable: boolean;
  createdAt: string;
  user: User;
  shifts?: Shift[];
  activeDeliveries?: number;
}
export interface Summary {
  totalDeliveries: number;
  activeDeliveries: number;
  deliveredDeliveries: number;
  cancelledDeliveries: number;
  pendingCouriers: number;
  availableCouriers: number;
  totalRevenue: string;
}
export interface Quote {
  distanceKm: number;
  totalAmount: string;
  currency: string;
}
