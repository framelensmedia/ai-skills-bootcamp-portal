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