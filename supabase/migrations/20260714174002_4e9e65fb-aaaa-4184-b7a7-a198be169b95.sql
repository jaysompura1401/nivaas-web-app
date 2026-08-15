
-- Profiles
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  phone text,
  role text NOT NULL DEFAULT 'tenant' CHECK (role IN ('owner','tenant','agent','admin')),
  avatar_url text,
  city text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Profiles are viewable by everyone" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING (auth.uid() = id);

-- Trigger to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Properties
CREATE TABLE public.properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  property_type text NOT NULL,
  listing_type text NOT NULL CHECK (listing_type IN ('rent','sale','pg')),
  price numeric NOT NULL,
  deposit numeric,
  bedrooms int,
  bathrooms int,
  area_sqft numeric,
  furnished text,
  city text NOT NULL,
  locality text,
  address text,
  amenities text[],
  images text[],
  status text NOT NULL DEFAULT 'published' CHECK (status IN ('draft','published','rented','sold','archived')),
  verified boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.properties TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.properties TO authenticated;
GRANT ALL ON public.properties TO service_role;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Published properties are public" ON public.properties FOR SELECT USING (status = 'published' OR auth.uid() = owner_id);
CREATE POLICY "Owners can insert their own properties" ON public.properties FOR INSERT WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Owners can update their own properties" ON public.properties FOR UPDATE USING (auth.uid() = owner_id);
CREATE POLICY "Owners can delete their own properties" ON public.properties FOR DELETE USING (auth.uid() = owner_id);

-- Saved properties
CREATE TABLE public.saved_properties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, property_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.saved_properties TO authenticated;
GRANT ALL ON public.saved_properties TO service_role;
ALTER TABLE public.saved_properties ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own saved" ON public.saved_properties FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- Inquiries
CREATE TABLE public.inquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  property_id uuid NOT NULL REFERENCES public.properties(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  message text,
  visit_date timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','confirmed','cancelled','completed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inquiries TO authenticated;
GRANT ALL ON public.inquiries TO service_role;
ALTER TABLE public.inquiries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own inquiries or owner sees theirs" ON public.inquiries FOR SELECT USING (auth.uid() = user_id OR auth.uid() = owner_id);
CREATE POLICY "Users can create inquiries" ON public.inquiries FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Owner or user can update" ON public.inquiries FOR UPDATE USING (auth.uid() = user_id OR auth.uid() = owner_id);
