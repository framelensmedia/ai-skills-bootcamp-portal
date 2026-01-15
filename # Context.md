# Context Document

# AI Skills Bootcamp

## Vision, System Architecture, and Product Roadmap

---

## 1. High-Level Vision

AI Skills Bootcamp is not just a course platform.
It is an **AI-powered learning and creation ecosystem** designed for everyday entrepreneurs, creators, and business owners who want professional results without becoming technical experts.

The core promise:

> *“You don’t learn AI just to understand it.
> You learn AI to create, deploy, and win in the real world.”*

The platform is built to remove complexity, reduce friction, and give users **confidence through outcomes**, not theory.

---

## 2. The Two-Layer System (Core Architecture)

AI Skills Bootcamp is intentionally designed as a **two-layer system** that feeds into itself.

### Layer 1: Bootcamps (Learning + Coaching Layer)

This layer handles:

* Education
* Guidance
* Strategy
* Context

**What it includes**

* Short-form bootcamps (3–5 min lessons)
* Topic-focused programs (content, branding, ads, local business, etc.)
* Coaches and instructors (including future partners)
* Clear “what to do next” direction

**Purpose**
Bootcamps teach users:

* What AI can do for them
* How to think about using AI in business and creative work
* When and why to use specific tools or workflows

Bootcamps do **not** aim to make users technical.
They aim to make users **effective**.

---

### Layer 2: Prompt Studio (Creation + Execution Layer)

This is the heart of the platform.

The Prompt Studio is where users:

* Create real assets
* Edit and remix visuals
* Apply what they learned immediately
* Produce business-ready outputs

**Key idea**
Users are not “prompting from scratch.”
They are **editing proven templates**.

The Prompt Studio functions more like:

* Photoshop + Canva + AI
  and less like:
* A raw AI playground

**What the Prompt Studio does**

* Uses high-quality template images as the starting point
* Allows guided remixing through structured edits
* Preserves identity, pose, body type, and camera angle
* Produces studio-quality results without guesswork

This is where learning becomes **action**.

---

## 3. Core Differentiator

Most AI platforms are built for:

* Power users
* Tinkerers
* Technical creators

AI Skills Bootcamp is built for:

* Everyday entrepreneurs
* Small business owners
* Creators who want results, not knobs

The platform prioritizes:

* Confidence over control
* Outcomes over options
* Guardrails over freedom

---

## 4. Prompt Studio Philosophy (Why It Works)

### Reference-First, Not Prompt-First

Instead of asking users to describe what they want, the system:

* Starts with a proven template image
* Treats that image as the composition blueprint
* Applies controlled edits based on user intent

Users are effectively saying:

> “Change this, keep everything else the same.”

This dramatically improves:

* Consistency
* Likeness preservation
* Trust in results

---

### Strict Identity Preservation (V1 Rule)

In V1:

* Uploaded photos are treated as the **sole identity source**
* No face blending
* No body reshaping
* No pose reinterpretation
* No beautification layers yet

This makes outputs feel like:

> “Photoshop-level edits, not AI guesses.”

---

## 5. MVP Game Plan (V1)

### Goals of the MVP

* Prove the two-layer system works
* Deliver immediate user wins
* Keep scope tight and reliable

---

### MVP Features

#### Bootcamp Layer

* Core AI Skills Bootcamp content
* Clear guidance on how to use the Prompt Studio
* Focus on practical outcomes (content, branding, ads)

#### Prompt Studio (MVP Scope)

* Template-based image creation
* Guided Remix chat (edit instead of prompt)
* Subject replacement with strict identity rules
* Headline, subheadline, CTA editing
* Contact info and social link updates
* Edit Remix vs New Remix flows
* Prompt copying (user-visible edit summary only)
* Hidden global system prompts (secret sauce)

#### What MVP Does NOT Include

* Face training or cameo models
* Beautification or enhancement layers
* Complex expert controls
* Video generation (yet)

---

### MVP Success Criteria

* Users say “that looks like me”
* Users can create something useful in under 5 minutes
* Users understand what to do next without guessing
* Prompt Studio feels easier than typing prompts elsewhere

---

## 6. Monetization & Positioning (MVP)

AI Skills Bootcamp is positioned as:

* Education + execution
* Not just a tool, not just a course

Initial monetization levers:

* Paid bootcamps
* Studio usage tiers
* Limited free access with clear upgrade paths

The platform is designed so:

* Free users can create
* Paid users gain leverage, speed, and depth

---

## 7. Big Ideas for V2 (Expansion Phase)

V2 builds on the same foundation without changing the mental model.

### 1. Identity & Cameo System

* Optional user identity packs
* Multiple reference photos
* Eventually video-based identity consistency
* Still privacy-first and opt-in

### 2. Controlled Enhancement Layers

* Optional polish modes:

  * Clean
  * Studio
  * Editorial
* Never identity-changing
* Always reversible

### 3. Video Templates

* Reference-first video generation
* Pose and angle preservation over time
* Same remix philosophy applied to motion

### 4. Partner & Coach Ecosystem

* Guest instructors
* Industry-specific bootcamps
* Revenue sharing model
* “Record label” approach to courses

### 5. AI Operators & Automation

* Move from creation to deployment
* Content agents
* Marketing agents
* Local business agents
* Direct integration with AI Biz Flow

---

## 8. Long-Term Vision

AI Skills Bootcamp evolves into:

> **A creative operating system for entrepreneurs.**

Where users:

* Learn → Create → Deploy → Scale
  all inside one ecosystem.

The end goal is not to teach AI.

The goal is to:

> **Help people build real businesses and creative leverage using AI without fear or friction.**



Feature: Persistent AI Assistant Chat Bubble + Conversational Onboarding

Purpose
AI Skills Bootcamp should feel like users are actively interacting with AI from the moment they arrive. The AI Assistant is the “heartbeat” of the platform and establishes conversation as the primary interaction model across onboarding, learning, and guidance.

UI Component
A persistent floating AI chat bubble appears across authenticated pages.

Behavior States

Standby (default): bubble remains visible but dimmed so it is present without being intrusive.

Active: bubble expands into a chat panel using the same chat UI style as the Guided Remix chat.

Contextual highlight (rare): bubble briefly brightens to nudge, then returns to standby. No auto-opening after onboarding completion.

Conversational Onboarding
On account creation and on every login until onboarding is completed, the assistant automatically opens into a small, non-blocking welcome chat panel.

User can always minimize.

Until onboarding is completed, the welcome chat reappears on every login.

If the user minimizes, the bubble remains in standby and provides subtle reminders after meaningful interactions.

Once onboarding is completed, the assistant no longer auto-opens on login and remains minimized by default unless the user opens it or a contextual state triggers it.

Placeholder Welcome Copy (editable later)
“Welcome. I’ll help you get set up so this works for you. This will only take a minute.”
Buttons: “Let’s start” and “Minimize”

Placeholder Onboarding Questions (editable later)

“What are you here to work on?” (Business / Content / Both)

“Do you already have a business?” (Yes / No)

“What best describes you?” (Entrepreneur / Creator / Small business owner)

MVP Notes
This phase is about UI behavior, state tracking, and flow consistency. Final copy, triggers, and assistant intelligence will be refined later. Track a simple boolean flag: onboarding_completed.

Future Expansion (not required for MVP)
Conversational search through the user’s asset library, campaign planning assistance, content organization, and memory-based recommendations.

Feature: Staff Prompt Editor Redesign for Template Import (Image + JSON → Drafts)

Purpose
Scale template production by allowing staff to upload a featured template image and a JSON “template package” generated by the Template Builder. Import should create draft template records that fully populate the existing CMS form fields so staff can review, tweak, and publish like a normal post.

New Import Workflow
Inside the staff CMS “Prompt Editor,” add an “Import Template” flow that accepts:

Featured image upload (png/jpg/webp)

JSON upload (.json) containing either a single template or a template pack

Import Behavior

If JSON contains a single template, create 1 CMS record with status draft.

If JSON contains a template pack, create multiple CMS records (one per template) as draft. Optionally store pack metadata or just associate via pack_id.

All fields from JSON should map into the standard CMS form fields so staff can edit everything. Nothing should be locked.

After import, show confirmation “Created X draft templates” and route staff to drafts or open the first draft for editing.

Guided Remix Sync Requirement
The imported JSON must include editable_fields[] that will drive dynamic Guided Remix questions on the front end. No hard-coded remix questions. The system should use editable_fields[] as the source of truth.

MVP Notes
Implement the import pipeline, draft creation, and field mapping now. Exact schema refinements will be made later. Include basic JSON validation, and fail gracefully without creating drafts if JSON is invalid.


Feature: Remix Feed + Public / Private Visibility Controls (MVP)
Feature Purpose

The Remix Feed is a logged-in-only discovery surface that showcases real user creations to drive inspiration, trust, and organic growth.

This feed is not a social network.
It is proof-of-work visibility.

Visibility control doubles as a monetization lever and a trust mechanism, ensuring users always feel ownership over what they create.

Core Concepts

Every remix has a visibility state:

Public: visible in the Remix Feed

Private: visible only in the user’s library

Visibility is per remix, not global

Feed access is restricted to authenticated users only

Visibility Rules (MVP)
Feed Access

Remix Feed is visible only to logged-in users

No public browsing

No guest access

Public / Private Logic

Free users:

Remixes default to Public

Visibility status is visible in their library

(Optional restriction: toggling to Private may be limited or prompt upgrade)

Pro users:

Can toggle Public / Private per remix at any time

Changes apply immediately

Private Remixes

Never appear in the Remix Feed

Never appear in trending

Always remain visible in the user’s personal library

Remix Feed (Logged-In Only)
Feed Content

Each feed item displays:

Generated image

Username

Profile image (or fallback avatar)

Template name

Timestamp

Upvote count

Action: Remix this

Feed Behavior

Sorting options:

Newest (default)

Trending (upvotes over time)

Pagination or infinite scroll required

No comments (MVP)

No followers (MVP)

No public profile pages (MVP)

User Library (Visibility Management)
Purpose

The user library is the source of truth for remix ownership and visibility.

Library Requirements

Each remix in the user library must show:

Generated image

Template name

Timestamp

Visibility badge:

Public

Private

Visibility Controls

Pro users can toggle visibility per remix

Toggle updates is_public flag immediately

Feed reflects changes instantly (no delay or caching mismatch)

UX Principles

Visibility state must be obvious at a glance

No warning modals required

No shame language

Optional helper text:

“Public remixes appear in the community feed.”

Upvotes (MVP)

Logged-in users can upvote public remixes

One upvote per user per remix

Upvotes stored in a separate table

Total upvotes displayed on feed items

Private remixes cannot receive upvotes

Monetization Tie-In

Privacy is positioned as control, not restriction

Pro tier unlocks:

Public / Private toggling

Future expansion (analytics, profiles, etc.)

Free users still benefit from visibility and discovery

Data Model (High-Level)
Remix

remix_id

user_id

template_id

output_asset_url

is_public (boolean)

created_at

Remix Upvotes

remix_id

user_id

created_at

User Profile (extension)

username

display_name

profile_image_url

MVP Scope Guardrails

Explicitly excluded:

Comments

Followers

Notifications

Public profiles

Sharing outside platform

The Learning Flow™ (MVP System)

(Name is solid. Simple. Ownable.)

Learn briefly → Create immediately → Save permanently → Repeat consistently

This is the core engine of AI Skills Bootcamp.

1. Learning Flow – High-Level Definition

Learning Flow is a structured, repeatable loop used across all bootcamps where:

The user learns one focused concept (≤ 5 minutes)

The user immediately creates a real asset (≤ 2 minutes)

The asset is saved to their library

The user sees visible progress

The loop repeats

No passive learning.
No long lectures.
No overwhelm.

2. The Learning Flow Loop (Step-by-Step)
Step 1: Learn (≤ 5 minutes)

Format

Short video OR short text lesson

One idea only

Clear outcome

Lesson framing

“By the end of this lesson, you will have created: ___”

No theory dumping.
No history lessons.

Step 2: Create (≤ 2 minutes)

Immediately after the lesson:

Show a single CTA

“Create this now”

Launch:

Prompt Studio

Template pack

Guided Remix

The user does not type prompts.
They answer guided questions or upload an image.

This creates a win fast moment.

Step 3: Save (Automatic)

Output is automatically saved to:

User’s Remix Library

The user sees:

Thumbnail

Template used

Timestamp

Optional microcopy:

“Saved. You can reuse or remix this anytime.”

This reinforces ownership.

Step 4: Reflect (Optional, 10 seconds)

A short, optional AI nudge:

“Want to tweak this or move to the next step?”

No quizzes.
No homework.

Step 5: Repeat

User clicks:

“Next lesson”

OR

“Create another version”

Both paths are wins.

3. Why Learning Flow Works (Founder-Level Insight)

This system solves 4 problems at once:

Short attention spans

AI intimidation

Lack of confidence

Low retention in online courses

Users don’t feel like they’re learning.
They feel like they’re building.

4. Learning Flow as a Product Standard

Every bootcamp lesson must follow this rule:

If there is no “Create” step, the lesson does not ship.

This keeps quality high and content aligned with outcomes.

5. Learning Flow Data Model (MVP)

To support this system technically:

Lesson Fields (Add or Ensure)

lesson_id

title

duration_minutes (target ≤ 5)

learning_objective (string)

create_action_type:

prompt_template

template_pack

guided_remix

create_action_payload:

template_id(s)

pack_id

auto_save_output (boolean = true)

This lets you standardize execution.

6. Learning Flow in the UI (User Experience)
Lesson View Layout

Lesson content (video/text)

Clear divider

“Create Now” section

Primary CTA button

Secondary CTA:

“Skip for now” (no guilt)

After creation:

Show success state

Progress bar increments

“Next lesson” button appears

7. Learning Flow Example (Concrete)

Lesson: “Create Your First Agency Promo”

Learn (4 min video):

What a promo is

Why it matters

One example shown

Create (2 min):

Click “Create Promo”

Prompt Studio opens with Agency Promo template

User answers 3 questions

Save:

Promo saved to library

Shown in thumbnail view

Repeat:

Next lesson: “Create 3 Social Posts”

This is rinse-and-repeat gold.

8. Internal Rule for Your Team

When creating bootcamp content:

“If the user doesn’t leave with something saved, the lesson isn’t done.”

That’s how you maintain discipline as you scale.

9. How Learning Flow Becomes IP

This isn’t just UX. This is:

a method

a system

a repeatable framework

Later this becomes:

a selling point

a licensing opportunity

part of the acquisition narrative

“We didn’t just teach AI. We built a learning-to-creation system.”

That’s boardroom language.

Context Doc Update
Learning Flow™ System + CMS Architecture (Locked)

Last updated: January 11, 2026

1. Core Concept: Learning Flow™

A Learning Flow™ is the atomic unit of education on AI Skills Bootcamp.

A Learning Flow combines:

Micro-learning (AI avatar videos + text)

Immediate creation using AI tools

Automatic saving and progress tracking

Learning Flows are:

Built by staff in the CMS

Assembled into Bootcamps

Experienced by users as Missions

Users never see the term “Learning Flow.”
They see Bootcamps → Missions.

2. Learning Flow Structure (Final)

Each Learning Flow consists of three required sections:

A) Learn

Delivered via 2–5 AI avatar micro-videos

Each video ~45–75 seconds

One idea per video

Optional supporting text (recap, checklist, examples)

Total learning time target: ≤5 minutes

Purpose:
Prepare the user to create without overwhelm.

B) Create

Exactly one create action per Learning Flow

Launches the AI creation experience

Uses existing Prompt Studio templates

Create actions support:

Single template

Template pack

Guided Remix mode

Create actions are never blank canvases.

C) Outcome

Output is automatically saved to the user’s Library

Mission is marked complete (or skipped)

Progress updates instantly

“Next Mission” CTA is shown

No quizzes.
No grades.
Completion is action-based.

3. Mission Studio (Learning Flow Creation Experience)

To guarantee reliable completion tracking, Learning Flows use a dedicated Mission Studio route.

Mission Studio

Route: /studio/mission/[lessonId]

UI is the same Guided Remix experience

Difference from regular Studio:

Always launched with mission context

Always saves output

Always marks mission complete

Always redirects back to the mission

Mission Studio behavior:

Load Learning Flow by lessonId

Load referenced template(s)

Run Guided Remix as normal

On save:

Save to Library

Complete mission

Redirect back to bootcamp mission page

Generic /studio remains unchanged.

4. Templates in Learning Flows

Templates are unified across the platform.

There is no separate “mission template” type.

Template Visibility

Templates have a visibility setting:

public – visible in Studio browsing

learning_only – hidden from public, used only in Learning Flows

staff_only – internal use

Learning Flow Template Selection

Inside the Learning Flow builder, staff can:

Select an existing Learning Only template

Select an existing Public template

Upload a new template (image + JSON) directly in the builder

Upload behavior:

Uses the same import pipeline as the Prompt Editor

Defaults visibility to learning_only

Auto-selects the new template for the Learning Flow

Learning-only templates never appear in public Studio browsing but are fully usable in Mission Studio.

5. CMS: Learning Flow Builder (Staff Experience)

The CMS is updated to be Learning Flow–first.

CMS Terminology

“Lessons” → Learning Flows

Public UI: Learning Flows appear as Missions

Learning Flow Editor Capabilities

Manage micro-videos (add, edit, reorder)

Add supporting text

Configure exactly one Create Action

Select or upload templates inline

Preview selected template

Set duration targets

Publish or draft flows

Staff never need to leave the builder to create a complete Learning Flow.

6. Gamified, Premium Learning Experience

The learning UI is:

Modern

Clean

Lightly gamified (Duolingo-inspired, not childish)

Key elements:

Mission Cards with status pills

Progress HUD showing next action

Micro-celebrations on completion

“Flow Streak” (lightweight, optional)

Gamification reinforces momentum, not competition.

7. Notifications & Re-engagement
In-App Notifications (MVP)

Resume banners for unfinished missions

Onboarding nudges for new users

Contextual prompts via assistant bubble

Triggers include:

Mission started but not completed

Returning users with unfinished missions

New bootcamp availability

Automation-Ready Event System

The app emits structured events for:

mission_started

mission_completed

mission_skipped

bootcamp_started

bootcamp_completed

mission_incomplete_24h

user_inactive_24h

These events will later connect to GoHighLevel webhooks for email and SMS automation.

No email logic is hardcoded into the app.

8. Future-Ready (Not MVP)

Interface tour missions

Advanced analytics on learning flows

AI assistant function calling

User content organization and search

Social remix feed enhancements

––––––––––––––––––––
CONTEXT DOC UPDATE
Feature: Instructor-Led Bootcamp Hero Slider (Coming Soon)
––––––––––––––––––––

Overview
The homepage hero currently displays a featured prompt slider. This slider will be extended to support a new content type called Instructor-Led Bootcamps. The goal is to tease premium bootcamps, capture interest, and build anticipation without changing the existing homepage layout or visual design.

This update does not replace any existing functionality and should reuse the same slider component, transitions, animations, and layout.

––––––––––––––––––––
Hero Slider Behavior (Instructor-Led Bootcamps)
––––––––––––––––––––

Purpose
Instructor-Led Bootcamps represent high-value, premium courses that will be launched as events. They are not part of the Basic Training or learning flow system and should feel exclusive and aspirational.

Visual Changes (Minimal and Targeted)

When a slider item is an Instructor-Led Bootcamp:

• The category pill at the top of the card should display:
Instructor Led Bootcamp

• The bottom info bar label should change from:
Featured Prompt
to:
Instructor Led Bootcamp

• The main title should display the bootcamp title, for example:
Start a Kids Clothing Brand with AI
Start a Social Content Agency with AI
Start a YouTube Sleep Music Channel with AI

• The action button text should change from:
Open →
to:
Coming Soon

• The action button should appear disabled visually but remain clickable.

––––––––––––––––––––
Click Behavior
––––––––––––––––––––

Clicking an Instructor-Led Bootcamp card routes the user to a dedicated landing page at:
/bootcamps/[slug]

This page exists even if the bootcamp is not live.

––––––––––––––––––––
Instructor-Led Bootcamp Landing Page
––––––––––––––––––––

Each Instructor-Led Bootcamp has a simple “Coming Soon” landing page with the following elements:

• Featured image (4:5 aspect ratio)
• Bootcamp title
• Short teaser description
• Status indicator: Coming Soon
• Primary call-to-action button: Get Notified

There is no access, purchase, or content visible at this stage.

––––––––––––––––––––
Get Notified Behavior
––––––––––––––––––––

When a user clicks Get Notified:

• If logged in: associate interest with their user ID
• If logged out: collect email address

The action should trigger a webhook (GoHighLevel integration to be connected later) and tag the user with:

• interest_instructor_bootcamp
• the specific bootcamp slug

This allows segmented launch campaigns later.

––––––––––––––––––––
Data Model (Lightweight)
––––––––––––––––––––

Instructor-Led Bootcamps are stored separately from learning flows and prompt templates.

Fields include:

• id
• title
• slug
• description
• featured_image_url
• status (coming_soon)
• notify_enabled (true)

Instructor-Led Bootcamps do NOT appear in:

• Prompt marketplace
• Learning flows
• Prompt Studio
• Basic Training

They only appear in:

• Homepage hero slider
• Their own landing pages

––––––––––––––––––––
Relationship to Basic Training
––––––––––––––––––––

Basic Training:

• Free
• Always available
• Designed to get users creating immediately
• Displayed directly under the homepage hero

Instructor-Led Bootcamps:

• Premium
• Event-based launches
• Marketed separately
• Teased in the hero slider only

This separation is intentional and should remain strict.

––––––––––––––––––––
Strategic Notes
––––––––––––––––––––

This feature:

• Signals a long-term roadmap without slowing MVP delivery
• Creates a second acquisition funnel beyond free tools
• Builds an interest list before content is released
• Allows future instructor drops to feel like events
• Matches how real education startups structure premium offerings

No other homepage sections should be modified as part of this update.

––––––––––––––––––––

If you want, next I can:
• Write the copy for each “Coming Soon” bootcamp page
• Draft the GoHighLevel automation logic
• Or help you define how a bootcamp transitions from Coming Soon to Live without breaking URLs


CONTEXT DOC UPDATE
Feature: Template Pack Upload Pipeline (Staff CMS)
––––––––––––––––––––

Overview
The goal of the Template Pack pipeline is to allow staff to upload multiple prompt templates at once using a single folder. A template pack consists of one JSON file that defines the pack and its templates, plus one featured image per template. Staff should be able to upload the folder and have the system automatically create all templates, associate them with a pack, and map the correct featured images without any manual entry.

This system must support both single-template uploads and multi-template pack uploads.

––––––––––––––––––––
Core Use Case
––––––––––––––––––––

Staff workflow:

Staff prepares a folder on their computer.

The folder contains:

One JSON file named pack.json

One featured image per template

Staff uploads the folder using the CMS.

The system:

Reads pack.json

Detects how many templates to create based on templates array length

Uploads all images

Creates one pack record

Creates one template record per template entry

Links each template to the correct featured image using a naming convention

No manual creation of templates. No manual UUIDs.

––––––––––––––––––––
Folder Structure and Naming Convention
––––––––––––––––––––

Folder example:

RestaurantPack/

pack.json

01_featured.webp

02_featured.webp

03_featured.webp

Image naming convention:

Each template references its featured image using the exact file name.

Example: featured_image_file = "01_featured.webp"

This avoids guessing or implicit ordering.

––––––––––––––––––––
Pack JSON Contract
––––––––––––––––––––

The pack.json file contains:

A single pack object with metadata

A templates array

The number of templates created equals templates.length

Required structure:

pack:

title

slug

summary

category

tags

version

templates[]:

title

slug

summary

featured_image_file (must match a file in the folder)

prompt_text

output_type (image or video)

aspect_ratios

variables (editable fields)

guided_remix config

visibility flags (draft, pack_only)

Templates can be marked as pack-only so they do not appear in the global template marketplace unless published separately.

––––––––––––––––––––
Upload Modes (CMS UI)
––––––––––––––––––––

The Staff Prompt Editor must support two upload modes:

Upload Single Template

Existing behavior remains unchanged

Drag image + JSON for one template

Upload Template Pack (Folder)

Provide a dedicated “Upload Folder” option

Use browser folder selection (webkitdirectory)

Drag-and-drop folders is optional but not required

––––––––––––––––––––
Template Pack Upload Behavior
––––––––––––––––––––

When uploading a folder:

Validate:

Exactly one pack.json file exists

pack.json parses correctly

Each template has featured_image_file defined

Each referenced image exists in the folder

Preview:

Display “N templates detected”

Show template titles and matched image filenames

On confirm:

Upload all images to storage

Create pack record in database

Create template records in draft state

Link templates to pack with ordering

Mark templates as pack_only by default

If validation fails:

Show clear error messages

Do not create partial records

Pack uploads should be treated as atomic operations.

––––––––––––––––––––
Building Packs from Existing Templates
––––––––––––––––––––

Staff should also be able to create packs from templates already in the system.

Required features:

Search templates

Filter by category, tags, output type

Multi-select templates

“Create Pack from Selection” action

Ability to reorder templates inside the pack

Save pack as draft or publish later

This allows flexible curation without reuploading assets.

––––––––––––––––––––
Data Model Notes
––––––––––––––––––––

Recommended additions:

template_packs table:

id

title

slug

summary

category

tags

featured_image_url (optional)

is_published

created_at

template_pack_items table:

id

pack_id

template_id

sort_index

Optional template fields:

pack_only (boolean, default false)

Templates marked pack_only should not appear in the global marketplace.

––––––––––––––––––––
Visibility Rules
––––––––––––––––––––

Pack-only templates:

Visible inside their pack

Visible in learning flow builder (if selected)

Visible in staff editor

Hidden from public marketplace

Packs can be published or kept in draft state.

––––––––––––––––––––
Design and UX Expectations
––––––––––––––––––––

Staff should never need to manually paste UUIDs.

Pack upload should feel fast, safe, and predictable.

Errors must be explicit and non-destructive.

Draft-first workflow allows staff to review and tweak before publishing.

––––––––––––––––––––
END CONTEXT DOC UPDATE
––––––––––––––––––––

––––––––––––––––––––
PROMPT FOR ANTIGRAVITY (COPY / PASTE)
––––––––––––––––––––

We need to finish the Template Pipeline to support uploading Template Packs in one action.

Current state: the Staff Prompt Editor supports drag-and-drop upload for a single template only.

Goal:
Staff should be able to upload a folder that contains:

one pack.json file

one featured image per template

The system must:

read pack.json

determine how many templates to create based on templates.length

upload all images

create one template pack record

create individual template records linked to the pack

map each template to the correct featured image using featured_image_file

UI changes required:

Add an Upload Type selector:

Upload Single Template

Upload Template Pack (Folder)

For Template Pack uploads:

Provide a reliable folder upload using input type webkitdirectory

Validate presence of exactly one pack.json

Validate that each featured_image_file exists in the folder

Show a preview listing detected templates and matched image filenames

On confirm, upload assets and create records

Add ability to create packs from existing templates:

Search and filter templates

Multi-select templates

“Create Pack from Selection”

Reorder templates inside a pack

Save pack as draft or publish

Data model:

Add template_packs table

Add template_pack_items table

Add optional pack_only flag on templates to control visibility

Behavior requirements:

Pack uploads should be atomic

If validation fails, do not partially create records

Pack-only templates should not appear in the global marketplace unless published separately

No manual UUID entry anywhere in this flow.

––––––––––––––––––––

Yes. This is a clean upgrade and it’ll make the library feel like a real product.

Here’s the spec to drop into your context doc + a prompt for Antigravity.

---

## Context doc update: Prompt Packs in Library + CMS

Goal: Add first-class “Prompt Packs” to the Prompt Library and Staff Prompt Editor. Packs should be browseable on the Prompts page above single templates and displayed as an inline horizontal swipe row. Staff must be able to upload a Pack thumbnail image during pack upload. Each template must indicate which pack it belongs to, and staff can click to view the pack details.

### User-facing (Prompts page)

1. Add a “Prompt Packs” section above single prompts.
2. Display packs as a horizontal swipe carousel (inline swipe cards).
3. Each pack card includes:

   * Pack thumbnail
   * Pack name
   * Short description
   * Template count
   * Category and/or tags
   * Access badge (Free or Pro)
4. Clicking a pack opens a Pack detail page:

   * Pack header (thumbnail, title, summary, tags)
   * Grid/list of templates in the pack
   * “Remix” starts remix from the selected template (not from the pack itself)

### Staff CMS (Prompt Editor + Pack Manager)

1. Add Pack entity and pack CRUD:

   * Create pack
   * Upload pack thumbnail
   * Add/edit title, summary, category, tags, access level
2. Pack upload flow supports:

   * Upload a folder or zip containing:

     * pack.json
     * pack thumbnail (ex: pack_thumb.png)
     * per-template featured images (naming convention)
   * System creates:

     * 1 pack record
     * N template records linked to that pack
3. Prompt Editor changes:

   * Staff can filter view mode: “All / Templates / Packs”
   * Templates show “Pack: [Pack Name]” (clickable)
   * Pack detail view shows all member templates and allows reordering/removal
4. Template records store pack reference:

   * pack_id nullable FK
   * pack_order_index for ordering within pack

### Data model (minimum)

Add a packs table and link templates to packs.

packs:

* id (uuid)
* title
* slug
* summary
* category
* tags (text[])
* access_level (free/pro)
* thumbnail_url
* is_published
* created_at / updated_at

prompt_templates (existing):

* pack_id (uuid nullable FK to packs.id)
* pack_order_index (int nullable)
* existing fields unchanged

Rules:

* A template can belong to 0 or 1 pack (MVP)
* Packs contain many templates
* Pack publish state controls visibility of pack and its templates as a group (optional: templates also have their own publish state)

### JSON pack format update

pack.json should support pack metadata + template array.

Required:

* pack: { title, summary, category, tags, access_level, thumbnail_filename }
* templates: [ { title, slug, summary, tags, category, featured_image_filename, template_config_json, prompt_text } ]

Upload logic maps:

* thumbnail_filename -> packs.thumbnail_url
* featured_image_filename -> template.featured_image_url
* templates[] length -> number of templates to create

---

## Prompt for Antigravity (copy/paste)

Add first-class Prompt Packs to the platform.

1. Create a new `packs` table (uuid id, title, slug unique, summary, category, tags text[], access_level enum free/pro, thumbnail_url, is_published boolean, created_at, updated_at). Add `pack_id` (uuid FK) and `pack_order_index` (int) to existing prompt_templates table.

2. Update Prompts page UI: add a “Prompt Packs” section above single templates. Render packs as a horizontal swipe carousel (inline swipe cards). Each pack card shows pack thumbnail, title, summary, template count, access badge. Clicking opens /prompts/packs/[slug] showing pack detail and the list/grid of templates inside it. Remix happens at the template level.

3. Update Staff CMS: add “Packs” management view and allow pack upload with a pack thumbnail. Staff should be able to toggle list view: All / Templates / Packs. In template editor, show “Pack: [Pack Name]” if pack_id is set, and make it clickable to open the pack.

4. Update pack upload pipeline: accept pack.json containing pack metadata and templates array. Support pack thumbnail filename in pack.json. On upload, create 1 pack record + N template records linked via pack_id, set pack_order_index based on templates array order. Map filenames to uploaded storage URLs.

5. Ensure templates display pack membership everywhere: prompt cards show a small “In Pack: [Pack Name]” label and allow click to view the pack.

---

If you want my opinion on the cleanest UX: keep the Prompts page exactly like you described (packs row above templates), and on each template card only show the pack label on hover or as a small pill, so it feels premium and not cluttered.


Edit Mode v1: Bubble-Gated + Multi-Change Queue
Core rule

Users do not see the edit chat input until they choose an Edit Bubble.
Choosing a bubble sets the edit intent, so the model never guesses.

Edit entry point

On a generation detail page (or lightbox):

Button: Edit

Opens: Edit Drawer / Modal

Shows:

Image preview (locked)

Bubble grid

“+ Add change” button

Disabled state for Generate until at least 1 change is queued

Bubble Grid (Intent Selector)

Each bubble maps to an intent enum.

Recommended v1 intents:

fix_typo

change_text

add_element

remove_element

change_background

change_photo

style_colors

other (freeform)

When user clicks a bubble:

Set active intent

Reveal the chat input area for that intent only

Show a short helper prompt tailored to that bubble

Multi-Change Queue (Up to 3)
UX

Button: + Add change

Users can add up to 3 changes (max) before running generation.

Each change becomes a “chip/card” in a queue:

Example queue cards:

Change Text: “Headline → Trusted Local Electrical Services”

Change Background: “Modern electrical panel room, blue lighting”

Add Element: “Add ‘Free Estimates’ badge”

Rules

Max queue length: 3

“Generate” runs once using the queue

User can:

Edit a queued item

Remove a queued item

Reorder queued items (optional but nice)

Chat Input Behavior
Bubble-gated input

Chat input is hidden until an intent bubble is selected.

Input placeholder changes per intent:

Fix Typo: “Type the typo and the correction…”

Change Text: “Tell me what text to change and what to replace it with…”

Change Background: “Describe the new background…”

Other: “Describe what you want changed…”

“Other” bubble

This is always available

Allows free typing

Still forces structured output by requiring the model to translate the user request into one of the allowed internal edit actions (or reject if unsafe / too broad)

Backend Contract (What we send to the model)

When user clicks Generate, send:

source_image_id (or signed URL)

template_id (if this came from a template)

intent_queue (1–3 items)

template_semantic_anchors (headline, subheadline, CTA, contact, logo zone, subject zone, background zone)

lock_rules (do not change face/body, do not invent limbs, etc.)

Queue format (example)

{
  "source_image_id": "gen_123",
  "intent_queue": [
    { "intent": "change_text", "targets": ["headline"], "value": "Trusted Local Electrical Services" },
    { "intent": "change_background", "value": "modern electrical utility room, subtle blue accents, clean lighting" },
    { "intent": "add_element", "targets": ["badge"], "value": "Free Estimates" }
  ]
}

Global Edit Safety Rules (apply to all intents)

Hard rules to prevent uncanny edits:

Never reconstruct the user’s face

Never invent missing body parts

If template has full body but upload is head/torso only: do not generate legs/torso, instead reposition/crop/mask like Photoshop

Background changes must not alter the subject

Text changes must preserve layout unless user explicitly requests layout change

Prompting Strategy

The model should:

Read the intent queue

Apply only those edits

Return:

new image

structured “what changed” log for UI display

If user request is too broad inside “Other”:

Respond with a clarification UI message, or

Suggest which bubble to use

Nice. Here’s a clean, premium-ready v1 bubble set with exact microcopy. This is written so you can drop it straight into the context doc and hand it to Antigravity without interpretation.

Edit Mode v1 – Bubble Set + Microcopy
Edit Mode Entry

When user clicks Edit on a generation:

Open Edit Drawer / Modal

Show image preview (locked)

Show bubble grid

Hide chat input until a bubble is selected

Disable Generate until at least one change is queued

Bubble Grid (Primary Actions)
📝 Fix Typo

Intent: fix_typo

Helper text shown after click:

“Tell me the typo and what it should say.”

Placeholder:

“Change ‘Plumming’ to ‘Plumbing’”

Rules:

Text-only update

No layout, background, or subject changes

Re-render text layer only

✏️ Change Text

Intent: change_text

Follow-up options (quick select):

Headline

Subheadline

CTA Button

Footer / Contact Info

Helper text:

“What should it say instead?”

Placeholder:

“Trusted Local Electrical Services”

Rules:

Preserve font, alignment, and hierarchy

Resize text only if needed to fit container

➕ Add Element

Intent: add_element

Options:

Add CTA button

Add logo

Add badge (Free Estimates, 24/7 Service, Licensed & Insured)

Add divider / accent shape

Helper text:

“What do you want to add?”

Rules:

Snap to template safe zones

Never overlap subject’s face

Never trigger full regeneration

➖ Remove Element

Intent: remove_element

Options:

Remove logo

Remove CTA

Remove badge

Remove background effect

Helper text:

“Which element should be removed?”

Rules:

Clean removal

Auto-adjust spacing

Preserve everything else

🖼 Change Photo

Intent: change_photo

Follow-up choice:

Replace subject photo

Replace background image

Helper text:

“Upload a new photo or describe what to replace.”

Rules:

Subject replacement uses cutout compositing

No body completion

No wardrobe or face changes

🌆 Change Background

Intent: change_background

Helper text:

“What kind of background should this have?”

Placeholder:

“Modern electrical utility room with clean lighting”

Rules:

Background-only regeneration

Subject layer is locked

Match lighting direction and depth

🎨 Style & Colors

Intent: style_colors

Options:

Change color palette

Darker / lighter

More contrast

Softer look

Helper text:

“Describe the look you want.”

Rules:

Global color grading only

No subject edits

💬 Other

Intent: other

Helper text:

“Tell me exactly what you want to change.”

Rules:

Must map to allowed intents internally

If request is too broad, prompt user to clarify

Never full regenerate without confirmation

Multi-Change Queue UX

Button: + Add change

Max changes: 3

Each change becomes a card:

Example:

Change Text → Headline

Change Background → Electrical workspace

Add Element → Free Estimates badge

Each card has:

Edit

Remove

Generate button becomes active when ≥1 change exists.

Generate Button Copy

Default: Apply Changes

Loading: Updating…

Success message:

“Your changes are ready.”

Optional subtext:

“Only the requested edits were applied.”

Global Safety Rules (Non-Negotiable)

These apply to all edit intents:

Uploaded subject is treated as a 2D photographic cutout

Never regenerate face, body, or clothing

Never invent missing limbs or torso

If template shows full body but upload does not:

Reposition

Crop

Mask behind UI elements

Subject identity always overrides template subject

If unsure, preserve and reposition instead of generating