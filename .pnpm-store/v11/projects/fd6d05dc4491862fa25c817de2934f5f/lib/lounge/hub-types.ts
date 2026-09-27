export type UserMe = {
  id: string;
  email?: string | null;
  full_name: string | null;
  username?: string | null;
  preferred_currency?: string | null;
};

export type GroupMemberOut = {
  id: string;
  user_id: string;
  full_name: string;
  avatar_url?: string | null;
  role?: string;
  last_seen?: string | number | null;
};

export type GroupOut = {
  id: string;
  name: string;
  description: string | null;
  group_type?: string;
  invite_code?: string;
  created_by?: string;
  created_at?: string | number;
  members: GroupMemberOut[];
};

export type ChatInfo = {
  id: string;
  name: string;
  type: "group" | "individual";
  group_id?: string;
  members: string[];
  created_by: string;
  created_at: number;
  last_message?: string;
  last_message_time?: number;
  last_message_sender?: string;
  isBot?: boolean;
  isAnnouncement?: boolean;
  isDemo?: boolean;
  demoKind?: "arjun" | "priya" | "suresh" | "self";
  demoAvatarBg?: string;
  demoInitials?: string;
  displayTime?: string;
  displayPreview?: string;
  demoUnread?: number;
  listAvatarBg?: string;
  listInitials?: string;
  metadata?: {
    name?: string;
    profile_picture?: string | null;
    avatar_url?: string | null;
  };
};

export type ContactPerson = {
  id: string;
  full_name: string;
  username?: string | null;
  avatar_url?: string | null;
};

export type UserSearchFriendStatus =
  | "none"
  | "pending_sent"
  | "pending_received"
  | "accepted"
  | "blocked";

export type UserSearchResultRow = {
  id: string;
  full_name: string;
  username: string | null;
  email?: string | null;
  profile_picture: string | null;
  avatar_url: string | null;
  friend_status: UserSearchFriendStatus;
  is_verified?: boolean;
  plan?: string;
};

export type SelectedGroupParticipant = UserSearchResultRow & {
  isEmailInvite?: boolean;
  email?: string | null;
};

export type TripOut = {
  id: string;
  group_id: string;
  title: string;
  description?: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  created_at?: string;
};

export type UserProfileIdOut = {
  id: string;
  full_name: string;
  username: string | null;
  profile_picture?: string | null;
  avatar_url?: string | null;
};

export type TravelHubBootstrapOut = {
  user: UserMe;
  groups: GroupOut[];
  connections?: UserSearchResultRow[];
  server_time?: string;
};

export type TravelHubBootCache = {
  tokenKey: string;
  savedAt: number;
  user: UserMe;
  groups: GroupOut[];
  contacts: ContactPerson[];
  chats: ChatInfo[];
};

export type ChatMessage = {
  id: string;
  sender_id: string;
  sender_name?: string;
  sender_avatar?: string;
  text?: string;
  type?: string;
  timestamp: number;
  read_by?: Record<string, boolean>;
  metadata?: Record<string, unknown>;
};
