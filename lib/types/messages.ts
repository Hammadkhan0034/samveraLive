export type MessageThreadType = 'dm' | 'class' | 'announcement';

export interface MessageThread {
  id: string;
  org_id: string;
  thread_type: MessageThreadType;
  subject: string | null;
  created_by: string | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MessageParticipant {
  id: string;
  org_id: string;
  message_id: string;
  user_id: string;
  role: string | null;
  unread: boolean;
  created_at: string;
  updated_at: string;
}

export interface MessageItem {
  id: string;
  org_id: string;
  message_id: string;
  author_id: string | null;
  body: string | null;
  created_at: string;
  edit_history: any[];
  attachments: any[];
  deleted_at: string | null;
  updated_at: string;
}

export interface MessageThreadWithParticipants extends MessageThread {
  participants?: MessageParticipant[];
  latest_item?: MessageItem;
  unread?: boolean;
  unread_count?: number;
  other_participant?: {
    id: string;
    first_name: string;
    last_name: string | null;
    email: string;
    role: string | null;
  };
}

