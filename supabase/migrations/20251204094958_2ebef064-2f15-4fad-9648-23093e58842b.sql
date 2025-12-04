-- Enable Row Level Security (RLS) on newly created tables

alter table public.profiles enable row level security;
alter table public.users    enable row level security;
alter table public.rooms    enable row level security;
alter table public.messages enable row level security;