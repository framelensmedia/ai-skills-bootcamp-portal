-- Create blog_posts table
CREATE TABLE IF NOT EXISTS public.blog_posts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    slug text NOT NULL UNIQUE,
    content text,
    excerpt text,
    featured_image_url text,
    is_published boolean DEFAULT false,
    published_at timestamp with time zone,
    author_id uuid REFERENCES auth.users(id),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    tags text[] DEFAULT '{}'::text[]
);

-- Create resources table
CREATE TABLE IF NOT EXISTS public.resources (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    title text NOT NULL,
    description text,
    url text NOT NULL,
    type text, -- 'pdf', 'image', 'link', 'video', etc.
    is_public boolean DEFAULT true,
    file_size_bytes bigint,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    downloads_count integer DEFAULT 0
);

-- Enable RLS
ALTER TABLE public.blog_posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Policies for blog_posts
CREATE POLICY "Public can view published blog posts" ON public.blog_posts
    FOR SELECT USING (is_published = true);

CREATE POLICY "Staff can view all blog posts" ON public.blog_posts
    FOR SELECT USING (public.is_staff_or_higher(auth.uid()));

CREATE POLICY "Staff can insert blog posts" ON public.blog_posts
    FOR INSERT WITH CHECK (public.is_staff_or_higher(auth.uid()));

CREATE POLICY "Staff can update blog posts" ON public.blog_posts
    FOR UPDATE USING (public.is_staff_or_higher(auth.uid()));

CREATE POLICY "Staff can delete blog posts" ON public.blog_posts
    FOR DELETE USING (public.is_staff_or_higher(auth.uid()));

-- Policies for resources
CREATE POLICY "Public can view public resources" ON public.resources
    FOR SELECT USING (is_public = true);

CREATE POLICY "Staff can view all resources" ON public.resources
    FOR SELECT USING (public.is_staff_or_higher(auth.uid()));

CREATE POLICY "Staff can manage resources" ON public.resources
    FOR ALL USING (public.is_staff_or_higher(auth.uid()));

-- Add trigger for updated_at
CREATE TRIGGER set_blog_posts_updated_at
    BEFORE UPDATE ON public.blog_posts
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_resources_updated_at
    BEFORE UPDATE ON public.resources
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
