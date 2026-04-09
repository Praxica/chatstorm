-- Create RoundType enum
CREATE TYPE round_type AS ENUM (
  'debate',
  'brainstorm',
  'dialogue',
  'explore',
  'critique',
  'summarize'
);

-- Create DepthLevel enum
CREATE TYPE depth_level AS ENUM (
  'minimal',
  'brief',
  'medium',
  'thorough',
  'exhaustive'
);

-- Create LengthType enum
CREATE TYPE length_type AS ENUM (
  'total',
  'rounds',
  'moderator'
);

-- Create chat_rounds table
CREATE TABLE chat_rounds (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  chat_id UUID NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
  type round_type NOT NULL,
  depth depth_level NOT NULL,
  length_type length_type NOT NULL,
  length_number INTEGER,
  length_rounds INTEGER,
  sequence INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create junction table for round participants
CREATE TABLE chat_round_participants (
  round_id UUID NOT NULL REFERENCES chat_rounds(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  PRIMARY KEY (round_id, agent_id)
);

-- Create index for efficient lookups
CREATE INDEX chat_rounds_chat_id_idx ON chat_rounds(chat_id);

-- Add trigger to update updated_at timestamp
CREATE TRIGGER set_timestamp
  BEFORE UPDATE ON chat_rounds
  FOR EACH ROW
  EXECUTE PROCEDURE trigger_set_timestamp(); 