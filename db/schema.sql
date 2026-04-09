CREATE TABLE chat_rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('debate', 'brainstorm', 'dialogue', 'explore', 'critique', 'review')),
  depth TEXT NOT NULL CHECK (depth IN ('minimal', 'brief', 'medium', 'thorough', 'exhaustive')),
  length_type TEXT NOT NULL CHECK (length_type IN ('total', 'rounds', 'moderator')),
  length_number INTEGER,
  length_rounds INTEGER,
  sequence INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Junction table for round participants
CREATE TABLE chat_round_participants (
  round_id UUID NOT NULL REFERENCES chat_rounds(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  PRIMARY KEY (round_id, agent_id)
);

-- Index for efficient lookups
CREATE INDEX chat_rounds_chat_id_idx ON chat_rounds(chat_id); 