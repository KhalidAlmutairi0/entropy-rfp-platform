import useSWR from "swr";
import { notificationApi } from "@/lib/api";

export function useNotifications(refreshInterval = 30000) {
  const { data, mutate } = useSWR(
    "notifications-count",
    () => notificationApi.list({ unreadOnly: true }).then((r) => r.data),
    { refreshInterval }
  );

  const unreadCount = data?.total ?? 0;

  const markRead = async (id: string) => {
    await notificationApi.markRead(id);
    await mutate();
  };

  const markAllRead = async () => {
    await notificationApi.markAllRead();
    await mutate();
  };

  return { unreadCount, markRead, markAllRead };
}
