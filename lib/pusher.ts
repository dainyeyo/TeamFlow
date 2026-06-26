import Pusher from "pusher";

export const pusherServer = new Pusher({
  appId: process.env.PUSHER_APP_ID || "local_appid",
  key: process.env.NEXT_PUBLIC_PUSHER_KEY || "local_key",
  secret: process.env.PUSHER_SECRET || "local_secret",
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER || "ap3",
  useTLS: true,
});
