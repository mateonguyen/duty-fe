export interface NotificationDto {
  id: string;
  title: string;
  message: string;
  createdAt: string; // ISO date string
  isRead: boolean;
  type?: string | null;
  linkUrl?: string | null;
}

export interface NotificationOverview {
  items: NotificationDto[];
  totalUnread: number;
}
